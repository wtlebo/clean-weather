import type { LocationResult } from '../services/api';

export type Operator = '>' | '<' | '>=' | '<=' | '==' | 'between' | 'contains';

export type WeatherParameter =
    // Core
    | 'temperature'
    | 'feelsLike'
    | 'windSpeed'
    | 'windGust'
    | 'windDirection'
    | 'precipProbability'
    | 'cloudCover'
    | 'humidity'
    | 'dewPoint'
    | 'uvIndex'
    | 'aqi'
    // Marine
    | 'tideHeight'
    | 'waterTemp'
    | 'waveHeight'
    | 'wavePeriod'
    | 'swellHeight'
    | 'swellPeriod'
    | 'swellDirection'
    // Astro
    | 'moonPhase' // 0-1
    | 'moonIllumination' // 0-100%
    | 'isDaylight' // boolean
    | 'timeOfDay' // hour 0-23
    // History/Accumulation
    | 'snowAccumulation'
    | 'rainAccumulation';

// Base Condition
interface BaseCondition {
    id: string;
}

// 1. Weather Condition (The standard numeric checks)
export interface WeatherCondition extends BaseCondition {
    type: 'weather';
    parameterId: WeatherParameter;
    operator: Operator;
    value: number | string;
    value2?: number | string; // For 'between'
    tolerance?: number;
    duration?: number; // Hours to look back (for accumulation)
    horizon?: 'past' | 'future'; // 'past' (default) or 'future'
}

// 2. Time Condition (Replaces separate TimeConstraint)
export type ReferenceEvent = 'sunrise' | 'sunset' | 'moonrise' | 'moonset' | 'highTide' | 'lowTide';
export type DayType = 'all' | 'weekdays' | 'weekends';

export interface TimeCondition extends BaseCondition {
    type: 'time';
    subType: 'range' | 'event' | 'daylight';
    // For 'range'
    startHour?: number;
    endHour?: number;
    rangeOperator?: 'inside' | 'outside'; // New: "Between X and Y" vs "Outside X and Y"

    // For 'event'
    event?: ReferenceEvent;
    offsetHours?: number; // Used for both 'event' (+/-) and 'daylight' (buffer)
    // For 'daylight'
    daylightMode?: 'day' | 'night';

    days: DayType;
}

export type Condition = WeatherCondition | TimeCondition;

export interface Activity {
    id: string;
    name: string;
    icon: string;
    color: string;
    dealBreakers: Condition[];
    niceToHaves: Condition[];
    targetScore?: number;
    location?: LocationResult; // Optional for migration, but enforced in UI
}
