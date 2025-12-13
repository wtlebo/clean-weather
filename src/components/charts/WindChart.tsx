import React from 'react';
import { LineChart, Line, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { WeatherPoint } from '../../types/weather';
import { ArrowUp } from 'lucide-react';

interface WindChartProps {
    data: WeatherPoint[];
    width: number;
    height: number;
    syncId?: string;
    nowIndex?: number;
    domain?: [number, number];
    ticks?: number[];
}

const CustomizedDot = (props: any) => {
    const { cx, cy, payload, index } = props;

    // Only show arrow every 4th point to reduce clutter
    if (index % 4 !== 0) return null;

    // Wind direction is "coming from", so arrow should point "going to" (+180 deg)
    const rotation = (payload.windDirection || 0) + 180;

    return (
        <foreignObject x={cx - 15} y={cy - 15} width={30} height={30} style={{ pointerEvents: 'none' }}>
            <div style={{
                transform: `rotate(${rotation}deg)`,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <ArrowUp size={24} color="#ffffff" strokeWidth={1.5} />
            </div>
        </foreignObject>
    );
};



export const WindChart: React.FC<WindChartProps> = ({ data, width, height, syncId, nowIndex, domain, ticks }) => {
    return (
        <LineChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
            syncId={syncId}
        >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />



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

            {/* Gust Line (Behind wind or separate? Layer order matters if overlapping) */}
            <Line
                type="monotone"
                dataKey="windGust"
                stroke="#f97316" // Orange
                strokeWidth={1.5}
                strokeDasharray="4 4" // Dashed line for sporadic nature
                connectNulls={false}
                dot={false}
                activeDot={false}
            />

            <Line
                type="monotone"
                dataKey="windSpeed"
                stroke="#a0aec0"
                strokeWidth={2}
                dot={<CustomizedDot />}
                activeDot={false}
            />
            {/* Now Line (Render last) */}
            {nowIndex !== undefined && (
                <ReferenceLine x={nowIndex} stroke="#8b0000" strokeWidth={2} />
            )}
        </LineChart>
    );
};
