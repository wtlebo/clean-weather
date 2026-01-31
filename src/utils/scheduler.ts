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

// ... (helpers)

const createBlock = (
    activity: Activity,
    block: { start: number; end: number; scores: EvaluationResult[]; points: WeatherPoint[] },
    lat: number,
    lon: number,
    locationName: string,
    baseUrl: string // New param
): CalendarBlock => {
    // ... (rest of code)
    // ...

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
