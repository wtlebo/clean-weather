import type { Activity, Condition, WeatherCondition, TimeCondition, WeatherParameter } from '../types/activity';
import type { WeatherPoint } from '../types/weather';
import SunCalc from 'suncalc';

export interface EvaluationResult {
    score: number; // 0.0 to 1.0
    color: string; // Hex
    isViable: boolean; // True if time & dealbreakers pass
    failedDealBreakers: string[]; // List of reasons (e.g. "Wind > 15mph")
    metNiceToHaves: string[];
}

// Color Gradient (Red -> Yellow -> Green)
// Color Gradient (Red -> Yellow -> Green)
const getColorForScore = (score: number, isViable: boolean): string => {
    // Deal Breaker (Not Viable): "Black/Empty" -> Transparent or matching bg
    // Using a very low opacity black to effectively "hide" the bar, or just return transparent.
    // However, if the bar is on top of a timeline, transparency works best to show "nothing".
    if (!isViable) return 'rgba(0,0,0,0)';

    // Helper to interpolate hex
    const interpolate = (start: [number, number, number], end: [number, number, number], factor: number) => {
        const r = Math.round(start[0] + (end[0] - start[0]) * factor);
        const g = Math.round(start[1] + (end[1] - start[1]) * factor);
        const b = Math.round(start[2] + (end[2] - start[2]) * factor);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    };

    // Low Score (Viable): Orange -> Yellow -> Emerald Green (#10b981)
    const orange: [number, number, number] = [249, 115, 22]; // #f97316
    const yellow: [number, number, number] = [234, 179, 8]; // #eab308
    const green: [number, number, number] = [16, 185, 129]; // #10b981 (Emerald 500 - Matches button)

    if (score < 0.5) {
        return interpolate(orange, yellow, score * 2);
    } else {
        return interpolate(yellow, green, (score - 0.5) * 2);
    }
};

const getParamValue = (p: WeatherPoint, param: WeatherParameter, context?: { allPoints: WeatherPoint[], index: number, duration: number, horizon?: 'past' | 'future' }): number | null => {
    // Standardize everything to what the Activity uses (Imperial mostly)
    switch (param) {
        case 'temperature': return p.temperature;
        case 'feelsLike': return p.feelsLike;
        case 'windSpeed': return p.windSpeed;
        case 'windGust': return p.windGust || 0;
        case 'windDirection': return p.windDirection;
        case 'precipProbability': return p.precipitationProbability * 100; // 0-1 -> 0-100%
        case 'cloudCover': return p.cloudCover * 100; // 0-1 -> 0-100%
        case 'humidity': return p.humidity * 100; // 0-1 -> 0-100%
        case 'dewPoint': return p.dewPoint;
        case 'uvIndex': return p.uvIndex;
        case 'aqi': return p.aqi;

        // Marine - Convert Meters to Feet!
        case 'tideHeight': return p.tideHeight; // Now fetched as feet
        case 'waterTemp': return p.waterTemperature;
        case 'waveHeight': return p.waveHeight !== null ? p.waveHeight * 3.28084 : null;
        case 'swellHeight': return p.swellHeight !== null ? p.swellHeight * 3.28084 : null;
        case 'wavePeriod': return p.wavePeriod;
        case 'swellPeriod': return p.swellPeriod;
        case 'swellDirection': return p.swellDirection;

        // Astro
        // Astro
        case 'moonPhase': return SunCalc.getMoonIllumination(p.timestamp).phase;
        case 'moonIllumination': return SunCalc.getMoonIllumination(p.timestamp).fraction * 100;
        case 'isDaylight': return p.isDay ? 1 : 0;
        case 'timeOfDay': return p.timestamp.getHours();

        // History / Accumulation
        case 'snowAccumulation':
        case 'rainAccumulation': {
            if (!context || !context.duration || context.duration <= 0) return 0;
            const targetType = param === 'snowAccumulation' ? 'snow' : 'rain';
            let sum = 0;

            const horizon = context.horizon || 'past';

            if (horizon === 'future') {
                // Sum Forward
                const end = Math.min(context.allPoints.length - 1, context.index + context.duration);
                for (let i = context.index; i <= end; i++) {
                    const pt = context.allPoints[i];
                    if (pt.precipitationType === targetType || (pt.precipitationType as any) === 'sleet') {
                        sum += (pt.precipitationAmount || 0) * 0.0393701; // mm to inches
                    }
                }
            } else {
                // Sum Backwards (Default)
                const start = Math.max(0, context.index - context.duration);
                for (let i = start; i <= context.index; i++) {
                    const pt = context.allPoints[i];
                    if (pt.precipitationType === targetType || (pt.precipitationType as any) === 'sleet') {
                        sum += (pt.precipitationAmount || 0) * 0.0393701; // mm to inches
                    }
                }
            }
            return sum;
        }

        default: return null;
    }
};

const evaluateWeatherCondition = (condition: WeatherCondition, point: WeatherPoint, allPoints?: WeatherPoint[], index?: number): boolean => {
    // Pass context if duration is present
    const context = (allPoints && index !== undefined && condition.duration)
        ? { allPoints, index, duration: condition.duration, horizon: condition.horizon }
        : undefined;

    const val = getParamValue(point, condition.parameterId, context);
    if (val === null) return false;

    const target = Number(condition.value);
    const target2 = condition.value2 ? Number(condition.value2) : 0;

    switch (condition.operator) {
        case '>': return val > target;
        case '<': return val < target;
        case '>=': return val >= target;
        case '<=': return val <= target;
        case '==': return Math.abs(val - target) < 0.1;
        case 'between': return val >= target && val <= target2;
        default: return false;
    }
};

const evaluateTimeCondition = (c: TimeCondition, point: WeatherPoint, lat: number, lon: number): { pass: boolean; info?: string } => {
    // 1. Day Check
    const day = point.timestamp.getDay(); // 0 = Sun
    const isWeekend = day === 0 || day === 6;
    if (c.days === 'weekdays' && isWeekend) return { pass: false, info: 'Weekend' };
    if (c.days === 'weekends' && !isWeekend) return { pass: false, info: 'Weekday' };

    // 2. Time Check
    if (c.subType === 'range') {
        const h = point.timestamp.getHours();
        const start = c.startHour ?? 0;
        const end = c.endHour ?? 23;
        const operator = c.rangeOperator || 'inside'; // Default to inside

        let insideRange = false;
        if (start <= end) {
            insideRange = h >= start && h <= end;
        } else {
            // Wrap around (e.g. 22 to 02)
            insideRange = h >= start || h <= end;
        }

        const pass = operator === 'outside' ? !insideRange : insideRange;
        return { pass, info: `Hour: ${h}` };
    } else if (c.subType === 'event' && c.event) {
        // Event Relative calculation (e.g. Sunset +/- 1hr)
        const times = SunCalc.getTimes(point.timestamp, lat, lon);
        let eventTime: Date | null = null;

        if (['sunrise', 'sunset'].includes(c.event)) {
            if (c.event === 'sunrise') eventTime = times.sunrise;
            else if (c.event === 'sunset') eventTime = times.sunset;
        } else if (['moonrise', 'moonset'].includes(c.event)) {
            const moonTimes = SunCalc.getMoonTimes(point.timestamp, lat, lon);
            if (c.event === 'moonrise') eventTime = moonTimes.rise;
            else if (c.event === 'moonset') eventTime = moonTimes.set;
        }

        if (eventTime && !isNaN(eventTime.getTime())) {
            const diffHours = Math.abs(point.timestamp.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
            const allowedOffset = !isNaN(Number(c.offsetHours)) ? Number(c.offsetHours) : 1;
            const pass = diffHours <= allowedOffset;
            return { pass, info: `Diff: ${diffHours.toFixed(2)}h vs ${allowedOffset}h` };
        }
        return { pass: false, info: ' Event missing' }; // Event data missing for this day
    } else if (c.subType === 'daylight') {
        // Daylight with buffer
        // "Day Time" = Between Sunrise and Sunset
        // "Night Time" = Before Sunrise OR After Sunset
        // Buffer: "Day + 1h" means "Sunrise-1h to Sunset+1h" (Extended day)
        const times = SunCalc.getTimes(point.timestamp, lat, lon);
        const buffer = c.offsetHours ?? 0;

        const sunrise = times.sunrise.getTime() - (buffer * 60 * 60 * 1000);
        const sunset = times.sunset.getTime() + (buffer * 60 * 60 * 1000);
        const now = point.timestamp.getTime();

        const isDay = now >= sunrise && now <= sunset;

        const mode = c.daylightMode || 'day';
        if (mode === 'day') return { pass: isDay, info: isDay ? 'Day' : 'Night' };
        else return { pass: !isDay, info: !isDay ? 'Night' : 'Day' };
    }
    return { pass: true };
};

const evaluateCondition = (condition: Condition, point: WeatherPoint, lat: number, lon: number, allPoints?: WeatherPoint[], index?: number): { pass: boolean; label: string } => {
    if (condition.type === 'weather') {
        const pass = evaluateWeatherCondition(condition as WeatherCondition, point, allPoints, index);
        const wc = condition as WeatherCondition;
        let label = `${wc.parameterId} ${wc.operator} ${wc.value}`;
        if (wc.duration) label += ` (last ${wc.duration}h)`;
        return { pass, label };
    } else {
        const res = evaluateTimeCondition(condition as TimeCondition, point, lat, lon);
        const tc = condition as TimeCondition;
        const baseLabel = tc.subType === 'range'
            ? `Time: ${tc.startHour}-${tc.endHour}`
            : `${tc.event} +/- ${tc.offsetHours}h`;

        return { pass: res.pass, label: `${baseLabel} (${res.info})` };
    }
};

export const calculateActivityScore = (activity: Activity, point: WeatherPoint, lat: number = 0, lon: number = 0, allPoints?: WeatherPoint[], index?: number): EvaluationResult => {
    // 1. Deal Breakers
    const failed: string[] = [];
    for (const db of activity.dealBreakers) {
        const res = evaluateCondition(db, point, lat, lon, allPoints, index);
        if (!res.pass) {
            failed.push(res.label);
        }
    }

    if (failed.length > 0) {
        return {
            score: 0,
            color: '#3f3f46', // Greyed out
            isViable: false,
            failedDealBreakers: failed,
            metNiceToHaves: []
        };
    }

    // 2. Nice to Haves
    let met = 0;
    const metList: string[] = [];
    if (activity.niceToHaves.length === 0) {
        return {
            score: 1,
            color: getColorForScore(1, true),
            isViable: true,
            failedDealBreakers: [],
            metNiceToHaves: []
        };
    }

    for (const nth of activity.niceToHaves) {
        const res = evaluateCondition(nth, point, lat, lon, allPoints, index);
        if (res.pass) {
            met++;
            metList.push(res.label);
        }
    }

    const score = met / activity.niceToHaves.length;

    return {
        score,
        color: getColorForScore(score, true),
        isViable: true,
        failedDealBreakers: [],
        metNiceToHaves: metList
    };
};
