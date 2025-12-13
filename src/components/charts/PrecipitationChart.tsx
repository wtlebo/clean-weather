import React from 'react';
import { ComposedChart, Line, Bar, Cell, Area, YAxis, XAxis, CartesianGrid, ReferenceLine } from 'recharts';
import type { WeatherPoint } from '../../types/weather';

interface PrecipitationChartProps {
    data: WeatherPoint[];
    width: number;
    height: number;
    syncId?: string;
    nowIndex?: number;
    ticks?: number[];
    showHumidity?: boolean;
    showAmount?: boolean;
    showThunder?: boolean;
}

export const PrecipitationChart: React.FC<PrecipitationChartProps> = ({
    data, width, height, syncId, nowIndex, ticks,
    showHumidity = true, showAmount = true, showThunder = true
}) => {
    // augment data for thunder indicator
    const chartData = data.map(d => ({
        ...d,
        thunderIndicator: d.thunderProbability > 0 ? 1 : 0
    }));

    return (
        <ComposedChart
            width={width}
            height={height}
            data={chartData}
            margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
            syncId={syncId}
            barCategoryGap={0} // Ensure full width bars
        >
            <defs>
                <pattern id="stripeSleet" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                    <rect width="2" height="4" transform="translate(0,0)" fill="#4caf50" />
                    <rect width="2" height="4" transform="translate(2,0)" fill="#2196f3" />
                </pattern>
                {/* Purple Gradient for Precipitation Probability */}
                <linearGradient id="colorPrecipProb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ab47bc" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ab47bc" stopOpacity={0.1} />
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />

            {/* Explicit axes to allow layering of bars via different IDs */}
            {/* Main Axis (Default) */}
            <XAxis hide />
            {/* Thunder Axis (Secondary) */}
            <XAxis xAxisId="thunderX" hide />

            {/* Probability Axis (Right) - DEFAULT Y-AXIS (No ID) */}
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

            {/* Amount Axis (Left/Hidden or subtle) */}
            <YAxis
                yAxisId="amount"
                orientation="left"
                tick={{ fontSize: 9, fill: '#888' }}
                width={30}
                hide={true}
            />

            {/* Thunder Axis (Hidden) */
             /* Domain [0, 20]: 1 shows it at ~5% height */}
            <YAxis yAxisId="thunder" domain={[0, 20]} hide />

            {/* Precipitation Probability Area (Bottom Layer) */}
            <Area
                type="monotone"
                dataKey="precipitationProbability"
                stroke="#ab47bc"
                fill="url(#colorPrecipProb)"
                strokeWidth={1.5}
                activeDot={false}
            />

            {/* Amount Bar (Middle Layer, Default X Axis) */}
            {showAmount && (
                <Bar
                    dataKey="precipIntensity"
                    isAnimationActive={false}
                >
                    {data.map((entry, index) => {
                        let color = '#4caf50'; // Rain (Green)
                        if (entry.precipitationType === 'snow') color = '#2196f3'; // Blue
                        if (entry.precipitationType === 'sleet') return <Cell key={`cell-${index}`} fill="url(#stripeSleet)" fillOpacity={0.8} />;
                        return <Cell key={`cell-${index}`} fill={color} fillOpacity={0.6} />;
                    })}
                </Bar>
            )}

            {/* Thunder Bar (Top Layer) */}
            {showThunder && (
                <Bar
                    xAxisId="thunderX"
                    yAxisId="thunder"
                    dataKey="thunderIndicator"
                    fill="#d32f2f"
                    isAnimationActive={false}
                />
            )}

            {/* Humidity Line (Top Layer) */}
            {showHumidity && (
                <Line
                    type="monotone"
                    dataKey="humidity"
                    stroke="#444444"
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    strokeOpacity={0.8}
                />
            )}

            {/* Now Line (Top Layer, Default X Axis) */}
            {nowIndex !== undefined && (
                <ReferenceLine x={nowIndex} stroke="#8b0000" strokeWidth={2} />
            )}
        </ComposedChart>
    );
};
