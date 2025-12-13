import React from 'react';
import { AreaChart, Area, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { WeatherPoint } from '../../types/weather';

interface TideChartProps {
    data: WeatherPoint[];
    width: number;
    height: number;
    syncId?: string;
    nowIndex?: number;
    ticks?: number[];
    domain?: [number, number];
    alertThreshold?: number; // Threshold for "King Tide" (e.g. HAT)
}

export const TideChart: React.FC<TideChartProps> = ({ data, width, height, syncId, nowIndex, ticks, domain, alertThreshold }) => {
    const gradientOffset = () => {
        const tides = data.map(d => d.tideHeight ?? 0); // Default to 0 if null
        const dataMax = domain ? domain[1] : Math.max(...tides);
        const dataMin = domain ? domain[0] : Math.min(...tides);

        // If threshold provided, use it. Otherwise, set it effectively infinite (no red).
        const HIGH_TIDE_THRESHOLD = alertThreshold ?? 999;
        const LOW_TIDE_THRESHOLD = -999;

        if (dataMax <= dataMin) {
            return { high: 0, low: 1 };
        }

        const highOffset = (dataMax - HIGH_TIDE_THRESHOLD) / (dataMax - dataMin);
        const lowOffset = (dataMax - LOW_TIDE_THRESHOLD) / (dataMax - dataMin);

        return {
            high: Math.max(0, Math.min(1, highOffset)),
            low: Math.max(0, Math.min(1, lowOffset))
        };
    };

    const off = gradientOffset();

    return (
        <AreaChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
            syncId={syncId}
        >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />

            <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" opacity={0.5} />

            <YAxis
                orientation="right"
                domain={domain || ['auto', 'auto']}
                ticks={ticks}
                width={0}
                hide={false}
                axisLine={false}
                tickLine={false}
                tick={() => null}
                interval={0}
            />

            <Area
                type="monotone"
                dataKey="tideHeight"
                stroke="url(#splitColorTide)"
                fill="url(#splitColorTide)"
                strokeWidth={2}
                baseValue={0}
                activeDot={false}
            />

            {/* Now Line (Render last to appear on top) */}
            {nowIndex !== undefined && (
                <ReferenceLine x={nowIndex} stroke="#8b0000" strokeWidth={2} />
            )}

            <defs>
                <linearGradient id="splitColorTide" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={off.high} stopColor="#d32f2f" stopOpacity={0.8} />
                    <stop offset={off.high} stopColor="#29b6f6" stopOpacity={0.6} />
                    <stop offset={off.low} stopColor="#29b6f6" stopOpacity={0.6} />
                    <stop offset={off.low} stopColor="#d32f2f" stopOpacity={0.8} />
                </linearGradient>
            </defs>
        </AreaChart>
    );
};
