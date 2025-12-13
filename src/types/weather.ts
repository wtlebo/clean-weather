export interface WeatherPoint {
    timestamp: Date;
    temperature: number; // degrees
    feelsLike: number;
    precipitationProbability: number; // 0-1
    precipitationAmount: number; // mm
    precipitationType: 'rain' | 'snow' | 'sleet' | 'none';
    thunderProbability: number; // 0-1
    windSpeed: number; // unit agnostic for now
    windDirection: number; // degrees (0-360)
    windGust?: number; // sporadic gust speed
    windGustDirection?: number; // sporadic gust direction
    cloudCover: number; // 0-1
    tideHeight: number | null; // meters
    condition: WeatherCondition;
    isDay: boolean; // true if between sunrise/sunset
    aqi: number | null; // 0-500
    uvIndex: number; // 0-11+
    dewPoint: number; // F
}

export type WeatherCondition = 'sunny' | 'clear' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'sleet';
