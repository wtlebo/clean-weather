import React from 'react';
import { addHours, startOfHour } from 'date-fns';
import './TimeAxis.css';

import type { WeatherPoint } from '../../types/weather';

interface TimeAxisProps {
    hours?: number;
    hourWidth?: number;
    startHourOffset?: number; // Hours before "now"
    data?: WeatherPoint[]; // Optional: Use real solar data if available
    customStartTime?: Date; // Optional: Force a specific start time (e.g. from data)
    axisWidth?: number; // Width of the sticky axis column to align with
    timezone?: string; // Target timezone for display
}

export const TimeAxis: React.FC<TimeAxisProps> = ({
    hours = 240,
    hourWidth = 60,
    startHourOffset = 120,
    data,
    customStartTime,
    axisWidth = 32,
    timezone = 'UTC'
}) => {
    // We work with "Ticks" which are just hour offsets from the start time.
    // The "Time" rendered should be formatted in the target timezone.

    // Start Time is assumed to be a generic UTC-ish anchor coming from the API (which we normalized to UTC)
    // or the previous local logic.
    // If we passed a UTC Date as customStartTime, we can just increment ticks.

    const now = startOfHour(new Date());
    const startTime = customStartTime ? customStartTime : addHours(now, -startHourOffset);

    // Create a lookup map for faster access if data is provided
    const dayMap = new Map<number, boolean>();
    if (data) {
        data.forEach(p => {
            const t = startOfHour(new Date(p.timestamp)).getTime();
            dayMap.set(t, p.isDay);
        });
    }

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: timezone
    });

    const hourFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: true,
        timeZone: timezone
    });

    // Helper to get integer hour (0-23) in the target timezone for logic
    const getTargetHour = (date: Date) => {
        const parts = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            hour12: false,
            timeZone: timezone
        }).formatToParts(date);
        const h = parts.find(p => p.type === 'hour')?.value;
        return h ? parseInt(h) === 24 ? 0 : parseInt(h) : 0;
    };

    const ticks = Array.from({ length: hours }, (_, i) => {
        // Physical Time (UTC/Real)
        const time = addHours(startTime, i);

        // Logical Time (Target Timezone)
        const targetHour = getTargetHour(time);

        const isMidnight = targetHour === 0;
        const isNoon = targetHour === 12; // Unused but kept for parity?
        const showLabel = targetHour % 3 === 0;

        // Use real data if available, fall back to heuristic
        let isDaylight = false;
        if (data) {
            // Check lookup (Map uses getTime which is timezone agnostic, good)
            isDaylight = dayMap.get(time.getTime()) ?? (targetHour >= 6 && targetHour < 18);
        } else {
            // Heuristic based on target timezone hour
            isDaylight = targetHour >= 6 && targetHour < 18;
        }

        // Label formatting: "12", "3", "6" (from Intl)
        // Intl returns "12 PM", "3 AM". We want just number usually? 
        // Original was "12", "3". Let's parse or use simple numeric?
        // format(time, 'h') -> '12'.
        // Let's strip AM/PM from Intl if we want to match style.
        let label = hourFormatter.format(time).replace(/ (AM|PM)/, '');

        return {
            time,
            isMidnight,
            isNoon,
            isDaylight,
            label,
            dayLabel: dateFormatter.format(time),
            showLabel
        };
    });

    return (
        <div className="time-axis" style={{
            height: '38px', // Ultra compact: Date(16) + Hour(16) + Grid(6)
            width: '100%',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backgroundColor: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-color)',
            // paddingLeft: '32px', // Removed: Padding doesn't shift absolute children. Handled in left prop.
        }}>
            {ticks.map((tick, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: `${axisWidth + (i * hourWidth)}px`, // Shift by axisWidth
                        width: `${hourWidth}px`,
                        height: '100%',
                    }}
                >
                    {/* 1. Date Row (Top 0-16px) */}
                    {(tick.isMidnight || i === 0) && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '16px',
                            whiteSpace: 'nowrap',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#fff',
                            paddingLeft: '6px',
                            lineHeight: '16px',
                            zIndex: 30
                        }}>
                            {tick.dayLabel}
                        </div>
                    )}

                    {/* Day Delimiter Line (Midnight Only) */}
                    {tick.isMidnight && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: '1px',
                            backgroundColor: '#fff',
                            zIndex: 25
                        }} />
                    )}

                    {/* 2. Hour Row (Middle 16-32px) */}
                    {tick.showLabel && (
                        <div style={{
                            position: 'absolute',
                            top: '16px',
                            left: 0,
                            width: '100%',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: '4px',
                            fontSize: '11px',
                            color: '#ccc',
                            fontWeight: 500
                        }}>
                            {tick.label}
                        </div>
                    )}

                    {/* 3. The Grid / Visual Tick (Bottom 32-38px) */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        height: '6px', // Exactly matches yellow bar height
                        borderLeft: tick.showLabel ? '1px solid #444' : '1px solid #333',
                    }}>
                        {/* Yellow Daylight Bar */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            width: '100%',
                            height: '6px',
                            backgroundColor: tick.isDaylight ? '#FFD700' : 'transparent',
                            opacity: 0.5
                        }} />
                    </div>
                </div>
            ))}
        </div>
    );
};
