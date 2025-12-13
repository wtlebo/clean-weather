import React from 'react';
import { AreaChart, Area, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { WeatherPoint } from '../../types/weather';

interface SkyCoverChartProps {
    data: WeatherPoint[];
    width: number;
    height: number;
    syncId?: string;
    nowIndex?: number;
    ticks?: number[];
}

export const SkyCoverChart: React.FC<SkyCoverChartProps> = ({ data, width, height, syncId, nowIndex, ticks }) => {
    return (
        <AreaChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
            syncId={syncId}
        >
            <defs>
                <linearGradient id="colorCloud" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#cfd8dc" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#cfd8dc" stopOpacity={0.2} />
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />



            <YAxis
                orientation="right"
                domain={[0, 1]}
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
                dataKey="cloudCover"
                stroke="#90a4ae"
                fill="url(#colorCloud)"
                strokeWidth={2}
                activeDot={false}
            />
            {/* Now Line (Render last) */}
            {nowIndex !== undefined && (
                <ReferenceLine x={nowIndex} stroke="#8b0000" strokeWidth={2} />
            )}
        </AreaChart>
    );
};
