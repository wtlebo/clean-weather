import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { WeatherPoint } from '../../types/weather';

interface WaterTempChartProps {
    data: WeatherPoint[];
    width: number;
    height: number;
    syncId?: string;
    nowIndex?: number;
    domain: [number, number];
    ticks: number[];
}

export const WaterTempChart: React.FC<WaterTempChartProps> = ({
    data, width, height, syncId, nowIndex, domain, ticks
}) => {

    // Gradient definitions based on temp? 
    // Or just a nice blue/teal gradient for water.
    // Water is usually fairly stable, so a subtle gradient is nice.
    // Let's use a Cyan/Teal color.

    return (
        <AreaChart
            width={width}
            height={height}
            data={data}
            syncId={syncId}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
        >
            <defs>
                <linearGradient id="waterTempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1} />
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" opacity={0.3} />
            <XAxis hide />
            <YAxis
                hide
                domain={domain}
                ticks={ticks}
            />

            <Area
                type="monotone"
                dataKey="waterTemperature"
                stroke="#06b6d4" // Cyan-500
                fill="url(#waterTempGradient)"
                strokeWidth={2}
                isAnimationActive={false}
                activeDot={false}
            />

            {/* Grid Lines */}
            {ticks.map(tick => (
                <ReferenceLine
                    key={tick}
                    y={tick}
                    stroke="#ffffff"
                    strokeOpacity={0.1}
                    strokeDasharray="3 3"
                />
            ))}

            {nowIndex !== undefined && (
                <ReferenceLine x={nowIndex} stroke="#8b0000" strokeWidth={2} />
            )}
        </AreaChart>
    );
};
