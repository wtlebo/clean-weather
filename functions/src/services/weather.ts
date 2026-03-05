import type { WeatherPoint, TideEvent } from '../shared/types/weather';
import { trackUsage } from '../shared/utils/usage';

const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
// const GEOCCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
// const MARINE_API = 'https://marine-api.open-meteo.com/v1/marine';

// We do NOT support Local Storage or DOM APIs here.

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

export interface WeatherResult {
    points: WeatherPoint[];
    tideStation: { name: string; distance: number; alertThreshold?: number; } | null;
    tideHighLows?: TideEvent[]; // Added
    fetchedAt?: number;
}

// Fetch Weather Data (Server Side)
export const fetchWeatherData = async (lat: number, lon: number): Promise<WeatherResult> => {

    // Construct Query
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        timezone: 'GMT', // Fetch in UTC to ensure continuous timeline
        past_days: '3', // Include past days for accumulation rules (snow/rain over last 24-48h)
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
            'weathercode',
            'cloudcover',
            'windspeed_10m',
            'winddirection_10m',
            'windgusts_10m',
            'uv_index',
            'dewpoint_2m',
            'is_day' // Helper to know if sun is up
        ].join(',')
    });

    // Marine Query (Optional: We could split this or always fetch)
    // For now, let's skip marine to save complexity/latency unless requested?
    // Actually, `WeatherPoint` requires marine fields (nullable).
    // Let's implement basic weather first.

    try {
        const response = await fetch(`${WEATHER_API}?${params.toString()}`);
        if (!response.ok) throw new Error('Weather API Failed');

        // Track Usage (Open-Meteo)
        await trackUsage('weather', 1);

        const data = await response.json();

        // Process Data
        const hourly = data.hourly;
        const points: WeatherPoint[] = hourly.time.map((timeStr: string, index: number) => {
            const timestamp = new Date(timeStr + 'Z');

            const hasFrozen = hourly.snowfall[index] > 0;
            const hasLiquid = hourly.rain[index] > 0 || (hourly.showers && hourly.showers[index] > 0);

            let precipType: 'rain' | 'snow' | 'sleet' | 'none' = 'none';
            if (hasFrozen && hasLiquid) precipType = 'sleet';
            else if (hasFrozen) precipType = 'snow';
            else if (hasLiquid) precipType = 'rain';

            // Snow is roughly a 10:1 ratio from liquid precipitation. Sleet remains raw liquid density.
            const rawPrecip = hourly.precipitation[index] || 0;
            const precipAmount = precipType === 'snow' ? rawPrecip * 10 : rawPrecip;

            return {
                timestamp,
                temperature: hourly.temperature_2m[index],
                feelsLike: hourly.apparent_temperature[index],
                precipitationProbability: hourly.precipitation_probability[index] / 100, // API is 0-100
                precipitationAmount: precipAmount,
                precipitationType: precipType,
                thunderProbability: 0, // Not available
                windSpeed: hourly.windspeed_10m[index],
                windDirection: hourly.winddirection_10m[index],
                windGust: hourly.windgusts_10m[index],
                cloudCover: hourly.cloudcover[index] / 100, // API is 0-100
                humidity: hourly.relative_humidity_2m[index] / 100, // API is 0-100
                uvIndex: hourly.uv_index[index],
                dewPoint: hourly.dewpoint_2m[index],
                isDay: hourly.is_day[index] === 1,

                // Defaults for missing datatypes
                aqi: null,
                tideHeight: null,
                waveHeight: null,
                wavePeriod: null,
                swellHeight: null,
                swellPeriod: null,
                swellDirection: null,
                waterTemperature: null,

                // Placeholder Condition (Can derive from weathercode)
                condition: 'clear'
            };
        });

        return {
            points,
            tideStation: null,
            tideHighLows: [],
            fetchedAt: Date.now()
        };

    } catch (e) {
        console.error('Server Weather Fetch Failed', e);
        throw e;
    }
};
