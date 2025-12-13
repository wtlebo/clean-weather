import React from 'react';
import { AreaChart, Area, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { WeatherPoint } from '../../types/weather';

interface UVChartProps {
    data: WeatherPoint[];
    width: number;
    height: number;
    syncId?: string;
    nowIndex?: number;
    ticks?: number[];
}

export const UVChart: React.FC<UVChartProps> = ({ data, width, height, syncId, nowIndex, ticks }) => {
    return (
        <AreaChart
            width={width}
            height={height}
            data={data}
            syncId={syncId}
            margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
        >
            <defs>
                <linearGradient id="colorUV" x1="0" y1="1" x2="0" y2="0">
                    {/* 0-11 scale */}
                    <stop offset="0%" stopColor="#4caf50" /> {/* 0-2 Low */}
                    <stop offset="20%" stopColor="#4caf50" />
                    <stop offset="25%" stopColor="#ffeb3b" /> {/* 3-5 Mod */}
                    <stop offset="45%" stopColor="#ffeb3b" />
                    <stop offset="50%" stopColor="#ff9800" /> {/* 6-7 High */}
                    <stop offset="65%" stopColor="#ff9800" />
                    <stop offset="70%" stopColor="#f44336" /> {/* 8-10 Very High */}
                    <stop offset="90%" stopColor="#f44336" />
                    <stop offset="100%" stopColor="#9c27b0" /> {/* 11+ Extreme */}
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />



            <YAxis
                domain={[0, 12]}
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
                dataKey="uvIndex"
                stroke="url(#colorUV)"
                fill="none"
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
