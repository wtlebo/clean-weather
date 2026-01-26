import React from 'react';
import { ComposedChart, Line, Bar, Cell, Area, YAxis, XAxis, CartesianGrid, ReferenceLine, ReferenceArea } from 'recharts';
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
    showAccumulation?: boolean;
    units?: 'imperial' | 'metric';
}

export const PrecipitationChart: React.FC<PrecipitationChartProps> = ({
    data, width, height, syncId, nowIndex, ticks,
    showHumidity = true, showAmount = true, showThunder = true, showAccumulation = true, units = 'imperial'
}: PrecipitationChartProps) => {
    // augment data for thunder indicator
    const chartData = data.map(d => ({
        ...d,
        thunderIndicator: d.thunderProbability > 0 ? 1 : 0
    }));

    // Calculate Precipitation Blocks
    const stormBlocks = React.useMemo<{ startIndex: number, endIndex: number, total: number, type: string }[]>(() => {
        if (!showAccumulation || !showAmount) return []; // Skip if disabled OR amount bars hidden

        const blocks: { startIndex: number, endIndex: number, total: number, type: string }[] = [];
        let currentBlock: { startIndex: number, total: number, type: string } | null = null;
        const MIN_HOURS = 5;

        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const hasPrecip = d.precipitationAmount > 0;
            // Simplified type check matching previous logic
            const currentType = d.precipitationType === 'snow' ? 'Snow' : 'Rain';

            if (hasPrecip) {
                if (!currentBlock) {
                    currentBlock = { startIndex: i, total: d.precipitationAmount, type: currentType };
                } else if (currentBlock.type !== currentType) {
                    // Type mismatch: Close previous block and start new one
                    if ((i - currentBlock.startIndex) >= MIN_HOURS) {
                        blocks.push({
                            startIndex: currentBlock.startIndex,
                            endIndex: i - 1,
                            total: currentBlock.total,
                            type: currentBlock.type
                        });
                    }
                    currentBlock = { startIndex: i, total: d.precipitationAmount, type: currentType };
                } else {
                    currentBlock.total += d.precipitationAmount;
                }
            } else {
                if (currentBlock) {
                    // End block
                    if ((i - currentBlock.startIndex) >= MIN_HOURS) {
                        blocks.push({
                            startIndex: currentBlock.startIndex,
                            endIndex: i - 1,
                            total: currentBlock.total,
                            type: currentBlock.type
                        });
                    }
                    currentBlock = null;
                }
            }
        }

        // Handle case where block goes to end of data
        if (currentBlock && (data.length - currentBlock.startIndex) >= MIN_HOURS) {
            blocks.push({
                startIndex: currentBlock.startIndex,
                endIndex: data.length - 1,
                total: currentBlock.total,
                type: currentBlock.type
            });
        }

        return blocks;
    }, [data, showAccumulation]);

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
                <linearGradient id="colorPrecipProb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ab47bc" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ab47bc" stopOpacity={0.1} />
                </linearGradient>
            </defs>

            {/* Storm Blocks (Background Layer) */}
            {stormBlocks.map((block, i) => (
                <ReferenceArea
                    key={`storm-${i}`}
                    x1={block.startIndex}
                    x2={block.endIndex}
                    // No yAxisId needed, defaults to 0 (the main probability axis)
                    y1={0}
                    y2={0.25} // Restrict to bottom 25% as requested
                    fill={block.type === 'snow' ? '#2196f3' : '#4caf50'}
                    fillOpacity={0.2} // Slightly more visible since it's smaller
                    label={{
                        value: `${block.total.toFixed(units === 'metric' ? 0 : 2)} ${units === 'metric' ? 'mm' : 'in'}`,
                        position: 'center',
                        fill: '#cccccc', // Grey text for theme
                        style: {
                            textShadow: '0px 0px 4px rgba(0,0,0,0.9)',
                            fontWeight: 'bold',
                            fontSize: '11px'
                        }
                    }}
                />
            ))}

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
