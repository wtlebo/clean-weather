import React from 'react';
import { AreaChart, Area, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { WeatherPoint } from '../../types/weather';

interface TemperatureChartProps {
    data: WeatherPoint[];
    width: number;
    height: number;
    syncId?: string;
    nowIndex?: number;
    domain?: [number, number];
    ticks?: number[]; // Added
    showFeelsLike?: boolean;
    showDewPoint?: boolean;
}

export const TemperatureChart: React.FC<TemperatureChartProps> = ({
    data, width, height, syncId, nowIndex, domain, ticks,
    showFeelsLike = true, showDewPoint = false
}) => {
    // Calculate min/max for domain to make the chart look dynamic
    const temps = data.map(d => d.temperature);
    // Use passed domain OR fallback
    const minTemp = domain ? domain[0] : Math.floor(Math.min(...temps) - 2);
    const maxTemp = domain ? domain[1] : Math.ceil(Math.max(...temps) + 2);

    // Dynamic Gradient Logic
    const stops = [
        { temp: 95, color: '#d32f2f' }, // Red
        { temp: 85, color: '#f44336' }, // Light Red
        { temp: 75, color: '#ff9800' }, // Orange
        { temp: 65, color: '#ffeb3b' }, // Yellow
        { temp: 55, color: '#8bc34a' }, // Green
        { temp: 45, color: '#00bcd4' }, // Cyan
        { temp: 35, color: '#2196f3' }, // Blue
        { temp: 25, color: '#3f51b5' }, // Indigo
    ];

    const gradientStops = stops.map(stop => {
        // SVG Gradient: 0% is TOP (MaxTemp), 100% is BOTTOM (MinTemp)
        // So we need the position of 'temp' relative to the max->min scale
        const percent = (maxTemp - stop.temp) / (maxTemp - minTemp);
        return { ...stop, offset: percent };
    }).filter(s => s.offset >= 0 && s.offset <= 1)
        .sort((a, b) => a.offset - b.offset);

    return (
        <AreaChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
            syncId={syncId}
        >
            <defs>
                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    {gradientStops.map((s, i) => (
                        <stop key={i} offset={`${(s.offset * 100).toFixed(1)}%`} stopColor={s.color} stopOpacity={0.8} />
                    ))}
                    {gradientStops.length === 0 && <stop offset="50%" stopColor="#8bc34a" />}
                </linearGradient>
            </defs>

            <YAxis
                domain={[minTemp, maxTemp]}
                orientation="right"
                tickCount={5}
                ticks={ticks} // Explicit ticks
                width={0}
                hide={false}
                axisLine={false}
                tickLine={false}
                tick={() => null}
                interval={0}
                mirror={true}
            />

            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />



            <Area
                type="monotone"
                dataKey="temperature"
                stroke="url(#colorTemp)"
                fill="none"
                strokeWidth={3}
                activeDot={false}
            />
            {/* Feels Like Line */}
            {showFeelsLike && (
                <Area
                    type="monotone"
                    dataKey="feelsLike"
                    stroke="url(#colorTemp)"
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.7}
                    activeDot={false}
                />
            )}
            {/* Dew Point Line */}
            {showDewPoint && (
                <Area
                    type="monotone"
                    dataKey="dewPoint"
                    stroke="#a0aec0"
                    fill="none"
                    strokeWidth={1.5}
                    activeDot={false}
                    strokeOpacity={0.8}
                />
            )}

            {/* Now Line (Render last to appear on top) */}
            {nowIndex !== undefined && (
                <ReferenceLine x={nowIndex} stroke="#8b0000" strokeWidth={2} />
            )}
        </AreaChart>
    );
};
