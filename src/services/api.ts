import type { WeatherPoint } from '../types/weather';
import { fetchTidePredictions, findNearestStations, fetchStationDatums } from './noaa';

const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const AQI_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const MARINE_API = 'https://marine-api.open-meteo.com/v1/marine';

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
    fetchedAt?: number;
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



// Cache Helper
const CACHE_DURATION = 15 * 60 * 1000; // 15 Minutes

export const fetchWeatherData = async (lat: number, lon: number, forceRefresh: boolean = false): Promise<WeatherResult> => {
    const cacheKey = `weather_cache_${lat.toFixed(4)}_${lon.toFixed(4)}`;

    // 1. Try Cache
    try {
        const cached = localStorage.getItem(cacheKey);
        if (!forceRefresh && cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                console.log('Returning cached weather data');
                // Re-hydrate Date objects
                const hydratedPoints = data.points.map((p: any) => ({
                    ...p,
                    timestamp: new Date(p.timestamp)
                }));
                return { ...data, points: hydratedPoints, fetchedAt: timestamp };
            }
        }
    } catch (e) {
        console.warn('Cache read error', e);
    }

    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        timezone: 'GMT', // Fetch in UTC to ensure continuous timeline
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
        timezone: 'GMT', // Match Weather Timezone
        past_days: '5',
        forecast_days: '5',
        hourly: 'us_aqi'
    });

    // Marine API params
    const marineParams = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        timezone: 'GMT',
        past_days: '5',
        forecast_days: '10',
        hourly: [
            'wave_height',
            'wave_period',
            'swell_wave_height',
            'swell_wave_period',
            'swell_wave_direction',
            'sea_surface_temperature'
        ].join(',')
    });

    try {
        const [weatherRes, aqiRes, marineRes] = await Promise.all([
            fetch(`${WEATHER_API}?${params}`),
            fetch(`${AQI_API}?${aqiParams}`),
            fetch(`${MARINE_API}?${marineParams}`)
        ]);

        if (!weatherRes.ok) throw new Error('Weather API Error');

        const weatherData = await weatherRes.json();
        const aqiData = aqiRes.ok ? await aqiRes.json() : { hourly: { us_aqi: [] } };
        // Marine might 404 or return empty if on land
        const marineData = marineRes.ok ? await marineRes.json() : { hourly: {} };

        // NOAA Tide Integration
        let tideStation: { name: string; distance: number; alertThreshold?: number; } | null = null;
        let tidePredictions: any[] = [];
        try {
            // Get top 3 nearest stations to handle cases where the closest one has no data (e.g. Santa Ana River)
            const stations = await findNearestStations(lat, lon, 3);

            for (const station of stations) {
                try {
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

                    if (preds && preds.length > 0) {
                        // Success!
                        tideStation = { name: station.name, distance: station.distance || 0 };
                        tidePredictions = preds;

                        if (datums) {
                            const hatRelMllw = datums.HAT - datums.MLLW;
                            const buffer = hatRelMllw / 12;
                            tideStation.alertThreshold = hatRelMllw - buffer;
                        }
                        break; // Stop looking
                    }
                } catch (innerErr) {
                    console.warn(`Failed to fetch tides for ${station.name} (${station.id}), trying next...`, innerErr);
                }
            }
        } catch (err) {
            console.error('NOAA Tide Error:', err);
        }

        const points = normalizeData(weatherData, aqiData, marineData, tidePredictions);
        const result = { points, tideStation };

        // Save to Cache
        try {
            const now = Date.now();
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: now,
                data: result
            }));
            return { ...result, fetchedAt: now };
        } catch (e) {
            console.warn('Cache write error', e);
            return result; // Return anyway
        }

    } catch (error) {
        console.error('Weather fetch error:', error);
        throw error;
    }
};

const normalizeData = (weather: OpenMeteoResponse, aqi: OpenMeteoResponse, marine: OpenMeteoResponse, tidePredictions: any[]): WeatherPoint[] => {
    const hourly = weather.hourly;
    const us_aqi = aqi.hourly?.us_aqi || [];
    const marine_hourly = marine.hourly || {};

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
        // t is UTC string "YYYY-MM-DDTHH:mm" because we requested &timezone=GMT
        const timestamp = new Date(t + 'Z');
        const timeMs = timestamp.getTime();

        // Lookup tide in Map
        const tideVal = tideMap.get(timeMs) ?? null;

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

        // Marine Data (Optional / Nullable)
        // Open-Meteo uses meters for wave height by default, we need to convert if using imperial?
        // Wait, app handles conversion? AppSettings has units. The data stored in WeatherPoint is usually metric (API native) or converted?
        // fetchWeatherData params: temperature_unit: 'fahrenheit', precipitation_unit: 'mm'.
        // So temp is F, precip is mm.
        // Marine API defaults to meters.
        // Let's store raw meters and convert in UI, OR convert here if we want consistent units.
        // For simplicity, let's assume we want meters in raw data (like tideHeight) and convert in component.

        const waveHeight = marine_hourly.wave_height?.[i];
        const wavePeriod = marine_hourly.wave_period?.[i];
        const swellHeight = marine_hourly.swell_wave_height?.[i];
        const swellPeriod = marine_hourly.swell_wave_period?.[i];
        const swellDirection = marine_hourly.swell_wave_direction?.[i];
        const waterTemp = marine_hourly.sea_surface_temperature?.[i];

        return {
            timestamp, // True UTC Date object
            temperature: Number(hourly.temperature_2m[i]),
            feelsLike: Number(hourly.apparent_temperature[i]),
            precipitationProbability: Number(hourly.precipitation_probability[i]) / 100, // API is 0-100, we want 0-1
            precipitationAmount: precipitationType === 'snow' ? totalPrecip * 10 : totalPrecip, // Force standard 10:1 Snow Ratio (Liquid * 10)
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
            humidity_raw: Number(hourly.relative_humidity_2m[i]),

            // Marine
            waveHeight: waveHeight !== undefined && waveHeight !== null ? Number(waveHeight) : null,
            wavePeriod: wavePeriod !== undefined && wavePeriod !== null ? Number(wavePeriod) : null,
            swellHeight: swellHeight !== undefined && swellHeight !== null ? Number(swellHeight) : null,
            swellPeriod: swellPeriod !== undefined && swellPeriod !== null ? Number(swellPeriod) : null,
            swellDirection: swellDirection !== undefined && swellDirection !== null ? Number(swellDirection) : null,
            waterTemperature: waterTemp !== undefined && waterTemp !== null ? Number(waterTemp) : null,
        } as unknown as WeatherPoint;
    });
};
