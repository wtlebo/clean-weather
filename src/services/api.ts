import type { WeatherPoint } from '../types/weather';
import { fetchTidePredictions, findNearestStation, fetchStationDatums } from './noaa';

const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const AQI_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

export interface LocationResult {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    elevation: number;
    country_code: string;
    admin1?: string; // State/Province
    timezone: string;
}

interface OpenMeteoResponse {
    utc_offset_seconds: number;
    hourly: {
        time: string[];
        [key: string]: (number | null | string)[];
    };
    hourly_units?: {
        [key: string]: string;
    };
}

export interface WeatherResult {
    points: WeatherPoint[];
    tideStation: { name: string; distance: number; alertThreshold?: number; } | null;
}

export const searchLocations = async (query: string): Promise<LocationResult[]> => {
    if (query.length < 3) return [];

    try {
        const url = `${GEOCODING_API}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        const response = await fetch(url);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('Geocoding error:', error);
        return [];
    }
};

export const fetchWeatherData = async (lat: number, lon: number, timezone: string): Promise<WeatherResult> => {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        timezone: timezone,
        past_days: '5',
        forecast_days: '10',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        precipitation_unit: 'mm',
        hourly: [
            'temperature_2m',
            'relative_humidity_2m',
            'apparent_temperature',
            'precipitation_probability',
            'precipitation',
            'rain',
            'showers',
            'snowfall',
            'weather_code',
            'cloud_cover',
            'wind_speed_10m',
            'wind_direction_10m',
            'wind_gusts_10m',
            'uv_index',
            'dew_point_2m',
            'is_day'
        ].join(',')
    });

    const aqiParams = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        timezone: timezone,
        past_days: '5',
        forecast_days: '5', // Limit for Free AQI API
        hourly: 'us_aqi'
    });

    try {
        const [weatherRes, aqiRes] = await Promise.all([
            fetch(`${WEATHER_API}?${params}`),
            fetch(`${AQI_API}?${aqiParams}`)
        ]);

        if (!weatherRes.ok) throw new Error('Weather API Error');

        const weatherData = await weatherRes.json();
        const aqiData = aqiRes.ok ? await aqiRes.json() : { hourly: { us_aqi: [] } };

        // NOAA Tide Integration
        let tideStation: { name: string; distance: number; alertThreshold?: number; } | null = null;
        let tidePredictions: any[] = [];
        try {
            const station = await findNearestStation(lat, lon);
            if (station) {
                tideStation = { name: station.name, distance: station.distance || 0 };
                // Fetch for complete range: 5 days past + 10 days future = 15 days
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 5);
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 10);

                // Parallel fetch predictions and datums
                const [preds, datums] = await Promise.all([
                    fetchTidePredictions(station.id, startDate, endDate),
                    fetchStationDatums(station.id)
                ]);

                tidePredictions = preds;

                if (datums) {
                    // Alert Threshold: HAT (relative to MSL) - 0.5ft buffer
                    tideStation.alertThreshold = (datums.HAT - datums.MSL) - 0.5;
                }
            }
        } catch (err) {
            console.error('NOAA Tide Error:', err);
        }

        const points = normalizeData(weatherData, aqiData, tidePredictions);
        return { points, tideStation };

    } catch (error) {
        console.error('Weather fetch error:', error);
        throw error;
    }
};

const normalizeData = (weather: OpenMeteoResponse, aqi: OpenMeteoResponse, tidePredictions: any[]): WeatherPoint[] => {
    const hourly = weather.hourly;
    const us_aqi = aqi.hourly?.us_aqi || [];
    const utcOffset = weather.utc_offset_seconds || 0;

    // Map tides to Map<timestamp_ms, value> for easier lookup
    // NOAA returns GMT timestamps, so we parse them as UTC.
    const tideMap = new Map<number, number>();
    tidePredictions.forEach((p: any) => {
        // p.t is "YYYY-MM-DD HH:mm" (GMT)
        const timeMs = new Date(p.t + 'Z').getTime();
        if (!isNaN(timeMs)) {
            tideMap.set(timeMs, Number(p.v));
        }
    });

    return hourly.time.map((t, i) => {
        // 't' is Local Time string i.e. "2023-12-13T10:00"
        // To find the actual UTC instant, we treat 't' as if it were UTC, then subtract the offset.
        // Example: t="10:00", Offset=-5h. Real UTC is 15:00.
        // new Date("10:00Z").getTime() -> 10:00 UTC epoch.
        // 10:00 UTC - (-5h) = 15:00 UTC. Correct.
        const localAsUtc = new Date(t + 'Z').getTime();
        const trueUtcMs = localAsUtc - (utcOffset * 1000);

        // Lookup tide in Map
        const tideVal = tideMap.get(trueUtcMs) ?? null;

        // Weather Code Interpretation
        const wc = Number(hourly.weather_code[i]);
        // is_day is 0 or 1
        const isDayRaw = hourly.is_day ? hourly.is_day[i] : 1;
        const isDay = isDayRaw === 1;

        // Simple condition mapping
        let condition = 'Cloudy'; // Default
        if (wc === 0) condition = isDay ? 'Sunny' : 'Clear';
        else if (wc <= 3) condition = isDay ? 'Partly Cloudy' : 'Partly Clear'; // Tweaked for night
        else if (wc <= 45) condition = 'Foggy';
        else if (wc <= 48) condition = 'Foggy';
        else if (wc <= 57) condition = 'Rainy'; // Drizzle
        else if (wc <= 67) condition = 'Rainy';
        else if (wc <= 77) condition = 'Snowy';
        else if (wc <= 82) condition = 'Rainy'; // Showers
        else if (wc <= 86) condition = 'Snowy';
        else if (wc >= 95) condition = 'Stormy';

        // Precip Type Logic
        let precipitationType: 'rain' | 'snow' | 'sleet' | 'none' = 'none';
        const rain = Number(hourly.rain?.[i] || 0);
        const showers = Number(hourly.showers?.[i] || 0);
        const snow = Number(hourly.snowfall?.[i] || 0);
        const totalPrecip = Number(hourly.precipitation?.[i] || 0);

        if (totalPrecip > 0) {
            if (snow > 0) precipitationType = 'snow';
            else if ((rain + showers) > 0) precipitationType = 'rain';
        }

        return {
            timestamp: new Date(t), // Keep strictly local time for display (compatible with how App renders X-Axis)
            temperature: Number(hourly.temperature_2m[i]),
            feelsLike: Number(hourly.apparent_temperature[i]),
            precipitationProbability: Number(hourly.precipitation_probability[i]) / 100, // API is 0-100, we want 0-1
            precipitationAmount: totalPrecip,
            precipitationType,
            windSpeed: Number(hourly.wind_speed_10m[i]),
            windDirection: Number(hourly.wind_direction_10m[i]),
            windGust: Number(hourly.wind_gusts_10m[i]),
            humidity: Number(hourly.relative_humidity_2m[i]) / 100, // API is 0-100
            dewPoint: Number(hourly.dew_point_2m[i]),
            cloudCover: Number(hourly.cloud_cover[i]) / 100,
            pressure: 1013, // Not fetched
            uvIndex: Number(hourly.uv_index[i]),
            aqi: us_aqi[i] !== undefined && us_aqi[i] !== null ? Number(us_aqi[i]) : null,
            tideHeight: tideVal !== undefined && tideVal !== null ? Number(tideVal) : null,
            isDay,
            condition,
            humidity_raw: Number(hourly.relative_humidity_2m[i])
        } as unknown as WeatherPoint;
    });
};
