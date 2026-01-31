import { encodeShareData } from './sharing';
import type { EvaluationResult } from '../services/scorer';
import type { Activity } from '../types/activity';
import type { WeatherPoint } from '../types/weather';
import SunCalc from 'suncalc';

export interface CalendarBlock {
    start: Date;
    end: Date;
    summary: string;
    description: string;
    htmlDescription: string;
}

const SCORE_THRESHOLD = 0.8; // Only sync "Great" times (Green)

export const generateCalendarBlocks = (
    activity: Activity,
    points: WeatherPoint[],
    scores: EvaluationResult[],
    lat: number,
    lon: number,
    locationName: string,
    baseUrl: string // New param
): CalendarBlock[] => {
    const blocks: CalendarBlock[] = [];
    let currentBlock: { start: number; end: number; scores: EvaluationResult[]; points: WeatherPoint[] } | null = null;

    // 1. Grouping
    scores.forEach((res, index) => {
        const isIdeal = res.score >= SCORE_THRESHOLD && res.isViable;

        if (isIdeal) {
            if (!currentBlock) {
                // Start new block
                currentBlock = { start: index, end: index, scores: [res], points: [points[index]] };
            } else {
                // Extend block
                currentBlock.end = index;
                currentBlock.scores.push(res);
                currentBlock.points.push(points[index]);
            }
        } else {
            // End current block if exists
            if (currentBlock) {
                blocks.push(createBlock(activity, currentBlock, lat, lon, locationName, baseUrl));
                currentBlock = null;
            }
        }
    });

    // Push final block
    if (currentBlock) {
        blocks.push(createBlock(activity, currentBlock, lat, lon, locationName, baseUrl));
    }

    return blocks;
};

// Helper to get cardinal direction
const getWindDirection = (deg: number): string => {
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[val % 16];
};

// Helper to format conditions
const formatCondition = (c: any): string => {
    if (c.type === 'time') {
        if (c.subType === 'daylight') return `Daylight (${c.daylightMode === 'night' ? 'Night' : 'Day'})`;
        if (c.subType === 'event') return `${c.event}`;
        if (c.subType === 'range') return `Time: ${c.startHour}-${c.endHour}`;
    }
    if (c.type === 'weather') {
        const pName = c.parameterId.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase()); // Camel to Title
        return `${pName} ${c.operator} ${c.value}${c.value2 ? ` & ${c.value2}` : ''}`;
    }
    return 'Custom Rule';
};

const createBlock = (
    activity: Activity,
    block: { start: number; end: number; scores: EvaluationResult[]; points: WeatherPoint[] },
    lat: number,
    lon: number,
    locationName: string,
    baseUrl: string // New param
): CalendarBlock => {
    // 1. Time Range
    const startTime = new Date(block.points[0].timestamp);
    const endTime = new Date(block.points[block.points.length - 1].timestamp);
    endTime.setHours(endTime.getHours() + 1);

    // 2. Summary
    const summary = `Ideal for ${activity.name}`;

    // 3. Description Construction
    const lines: string[] = [];
    lines.push('Conditions are ideal based on your preferences.');
    lines.push('');

    // --- Stats ---
    const firstP = block.points[0];
    const windDir = getWindDirection(firstP.windDirection);

    lines.push(`🌡️ Temp: ${Math.round(firstP.temperature)}°F`);
    lines.push(`💨 Wind: ${Math.round(firstP.windSpeed)}mph from ${windDir}`); // Changed to include cardinal
    lines.push(`☁️ Sky: ${Math.round(firstP.cloudCover * 100)}%`); // Added Sky
    lines.push(`💧 Precip: ${Math.round(firstP.precipitationProbability * 100)}%`); // Added Precip

    // --- Rules Met ---
    // We want to list the Deal Breakers that were passed
    if (activity.dealBreakers.length > 0) {
        lines.push('');
        lines.push('✅ Criteria Met:');
        activity.dealBreakers.forEach(c => {
            lines.push(`- ${formatCondition(c)}`); // List readable rule
        });
    }

    // --- Astronomical ---
    const hasMoonRule = activity.niceToHaves.some(c => c.type === 'time' && (c.subType === 'event' && c.event?.includes('moon')));

    if (hasMoonRule) {
        const moon = SunCalc.getMoonIllumination(startTime);
        const moonPos = SunCalc.getMoonPosition(startTime, lat, lon);
        const phase = Math.round(moon.fraction * 100);
        const altitude = (moonPos.altitude * (180 / Math.PI)).toFixed(1);
        const azimuth = (moonPos.azimuth * (180 / Math.PI) + 180).toFixed(0);

        lines.push('');
        lines.push(`🌙 Moon Details:`);
        lines.push(`- Illumination: ${phase}%`);
        lines.push(`- Elevation: ${altitude}°`);
        lines.push(`- Azimuth: ${azimuth}°`);
    }

    lines.push('');

    // Generate Share Link (Deep Link)
    const sharePayload = encodeShareData({
        activity: activity,
        location: {
            name: locationName,
            lat: lat,
            lon: lon,
            country: '' // Optional
        }
    });

    // Add Plain Text Link
    // Use baseUrl instead of hardcoded
    const url = `${baseUrl}/?share=${sharePayload}`;
    lines.push(`View Chart: ${url}`);

    // Generate HTML Description
    const htmlLines = lines.map(line => {
        if (line === '') return '<br>';
        // Convert the Plain Text link line to an Anchor tag
        if (line.includes('View Chart:')) {
            return `<div><a href="${url}">View Chart</a></div>`;
        }
        return `<div>${line}</div>`;
    });

    return {
        start: startTime,
        end: endTime,
        summary,
        description: lines.join('\n'),
        htmlDescription: htmlLines.join('')
    };
};
