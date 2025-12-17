import { addHours, startOfHour } from 'date-fns';
import type { WeatherPoint, WeatherCondition } from '../types/weather';

export const generateWeatherData = (startOffset = 120, totalHours = 240): WeatherPoint[] => {
    const now = startOfHour(new Date());
    const startDate = addHours(now, -startOffset);

    return Array.from({ length: totalHours }, (_, i) => {
        const currentTime = addHours(startDate, i);
        const hour = currentTime.getHours();
        const month = currentTime.getMonth(); // 0-11

        // Base temperature cycle (diurnal)
        // Coldest at 4 AM, Warmest at 3 PM
        const diurnalVariation = Math.sin((hour - 9) * (Math.PI / 12));
        const seasonalBase = 60 + Math.cos((month - 6) * (Math.PI / 6)) * 25; // Summer ~85, Winter ~35
        const randomFluctuation = (Math.random() - 0.5) * 5;

        const temperature = Math.round((seasonalBase + diurnalVariation * 10 + randomFluctuation) * 10) / 10;

        // Wind (Pre-calculated for feels like)
        const windSpeed = 5 + Math.random() * 15;
        const windDirection = (i * 10 + Math.random() * 30) % 360;

        // Precipitation
        // Random "storms" that last a few hours
        const precipitationProbability = Math.max(0, Math.min(1, Math.sin(i / 10) * Math.cos(i / 5) + (Math.random() * 0.2)));
        const precipitationAmount = precipitationProbability > 0.6 ? Math.random() * 5 : 0;

        // Tide (approx 12.4 hour cycle)
        // Amplitude modulation (Spring vs Neap tides) - approx 14 day cycle (336 hours)
        const moonCycle = Math.sin(i * (Math.PI * 2 / 336));
        const tideAmplitude = 1.6 + (moonCycle * 0.6); // Varies between 1.0m and 2.2m
        const tideHeight = Math.sin(i * (Math.PI * 2 / 12.4)) * tideAmplitude;

        // Determine type based on temperature
        let precipitationType: 'rain' | 'snow' | 'sleet' | 'none' = 'none';
        if (precipitationAmount > 0 || precipitationProbability > 0.2) {
            if (temperature < 32) precipitationType = 'snow';
            else if (temperature < 35) precipitationType = 'sleet';
            else precipitationType = 'rain';
        }

        // condition derivation (Moved to after precip type calculation)
        let condition: WeatherCondition = 'sunny';
        const cloudCover = Math.max(0, Math.min(1, precipitationProbability + (Math.random() * 0.3)));
        const isDay = hour >= 6 && hour <= 20;

        if (precipitationAmount > 0.5) {
            if (precipitationType === 'snow') condition = 'snowy';
            else if (precipitationType === 'sleet') condition = 'sleet';
            else condition = 'rainy';

            if (precipitationAmount > 2 && precipitationType === 'rain') condition = 'stormy';
        }
        else if (cloudCover > 0.7) condition = 'cloudy';
        else if (cloudCover > 0.3) condition = 'partly-cloudy';
        else condition = isDay ? 'sunny' : 'clear';

        // Thunder: Only if raining and decent probability
        let thunderProbability = 0;
        if (precipitationType === 'rain' && precipitationProbability > 0.5) {
            // 30% chance of thunder logic active
            if (Math.random() > 0.7) {
                thunderProbability = Math.random() * 0.8; // up to 80%
            }
        }

        // Wind
        // Wind variables already declared above
        // windSpeed and windDirection are available here

        // Sporadic gusts (20% chance)
        let windGust: number | undefined;
        let windGustDirection: number | undefined;
        if (Math.random() > 0.8) {
            windGust = windSpeed + 5 + Math.random() * 15; // Gust is significantly higher
            windGustDirection = (windDirection + (Math.random() - 0.5) * 40) % 360; // Direction variation
        }

        // Humidity Generation
        let humidity = 0.6 + (Math.random() * 0.1);
        if (!isDay) humidity += 0.15; // Higher at night
        if (precipitationProbability > 0.3) humidity = Math.max(humidity, 0.8 + (precipitationProbability * 0.2));
        humidity = Math.min(1, Math.max(0, humidity));

        // Check if windSpeed was already declared? 
        // My previous edit moved windSpeed up. 
        // I need to be careful about double declaration. 
        // To be safe, I will NOT trust my previous implicit move and instead:
        // 1. Revert the "move up" if I can, OR just assume I need to fix the duplicate.
        // Actually, let's look at the file content again to be sure where things are.

        // Let's just calculate feelsLike here using the variables we have.
        // But wait, windSpeed is calculated lower down in the original file.
        // My previous Step 1904 edit moved it up? No, that was the *plan*.
        // Step 1905 executed the move up.

        // Error prevention: I should read the file first to see the current state after Step 1905.
        // BUT, I can just do the calculation at the end.

        let feelsLike = temperature;
        // Simple Wind Chill (Mock)
        if (temperature < 60) {
            feelsLike = temperature - (windSpeed * 0.5);
        }
        // Simple Heat Index (Mock - using humidity if available, or just cloud cover as proxy?)
        // We have humidity now.
        else if (temperature > 80) {
            feelsLike = temperature + ((humidity - 0.4) * 10);
        }
        feelsLike = Math.round(feelsLike * 10) / 10;

        // Approximations
        const dewPoint = temperature - ((100 - (humidity * 100)) / 5);

        // UV Index (Simple Solar Angle model)
        let uvIndex = 0;
        if (hour >= 6 && hour <= 18) {
            const peakUV = 10;
            // Parabolic curve for day centered at 12
            const progress = (hour - 6) / 12; // 0 to 1
            // sin(0) to sin(PI)
            const solarComponent = Math.sin(progress * Math.PI);

            // Cloud attenuation (simple: reduce by cloud cover)
            const cloudFactor = 1 - (cloudCover * 0.7); // Clouds allow some UV

            uvIndex = Math.max(0, peakUV * solarComponent * cloudFactor);
        }

        // AQI (Random walk + daily cycle)
        // Base AQI
        const traffic = (hour === 8 || hour === 17) ? 20 : 0;
        const randomAQI = Math.random() * 20;
        const baseAQI = 40;
        const aqi = Math.round(baseAQI + traffic + randomAQI);

        return {
            timestamp: currentTime,
            temperature,
            feelsLike,
            precipitationProbability,
            precipitationAmount,
            precipitationType,
            thunderProbability,
            windSpeed,
            windDirection,
            windGust,
            windGustDirection,
            cloudCover,
            tideHeight,
            condition,
            isDay,
            humidity,
            aqi,
            uvIndex,
            dewPoint,
            waveHeight: null,
            wavePeriod: null,
            swellHeight: null,
            swellPeriod: null,
            swellDirection: null,
            waterTemperature: null
        };
    });
};
