import React from 'react';
import { AreaChart, Area, Line, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { WeatherPoint } from '../../types/weather';

interface MarineChartProps {
    data: WeatherPoint[];
    width: number;
    height: number;
    syncId?: string;
    nowIndex?: number;
    units: 'imperial' | 'metric';
}

export const MarineChart: React.FC<MarineChartProps> = ({
    data, width, height, syncId, nowIndex, units
}) => {
    const isImperial = units === 'imperial';
    const multiplier = isImperial ? 3.28084 : 1;

    // Convert data for display
    const chartData = React.useMemo(() => {
        return data.map(d => ({
            ...d,
            displayWaveHeight: (d.waveHeight || 0) * multiplier,
            displaySwellHeight: (d.swellHeight || 0) * multiplier
        }));
    }, [data, multiplier]);

    // Calculate domain to match App.tsx logic: [0, ceil(max * 1.2)]
    // This ensures alignment with the StickyAxis panel.
    const maxWave = Math.max(...chartData.map(d => d.displayWaveHeight));
    const domainMax = Math.ceil((maxWave || (isImperial ? 30 : 10)) * 1.2);

    return (
        <AreaChart
            width={width}
            height={height}
            data={chartData}
            syncId={syncId}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
        >
            <defs>
                <linearGradient id="colorWave" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#006994" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#006994" stopOpacity={0.1} />
                </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />

            <YAxis
                hide
                domain={[0, domainMax]}
                width={0}
            />

            <Area
                type="monotone"
                dataKey="displayWaveHeight"
                stroke="#006994"
                fillOpacity={1}
                fill="url(#colorWave)"
                strokeWidth={2}
                activeDot={false}
            />

            <Line
                type="monotone"
                dataKey="displaySwellHeight"
                stroke="#9c27b0"
                strokeWidth={2}
                dot={false}
                activeDot={false}
            />

            {nowIndex !== undefined && (
                <ReferenceLine x={nowIndex} stroke="#8b0000" strokeWidth={1} />
            )}
        </AreaChart>
    );
};
