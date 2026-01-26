import React from 'react';
import { AreaChart, Area, YAxis, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';
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
    showHighLow?: boolean;
}

export const TideChart: React.FC<TideChartProps> = ({
    data, width, height, syncId, nowIndex, ticks, domain, alertThreshold,
    showHighLow = true
}) => {
    const gradientOffset = () => {
        const tides = data.map(d => d.tideHeight ?? 0); // Default to 0 if null
        // CRITICAL FIX: Use actual data range for gradient calculation, NOT the domain.
        // SVG gradients with objectBoundingBox (default) apply to the rendered shape (the data area),
        // not the entire chart coordinate system. 
        // If we use the Domain (which includes padding), we calculate a % offset that is then applied 
        // to the smaller Data shape, causing "Top %" to be red even if the data is below the threshold.
        const dataMax = Math.max(...tides);
        const dataMin = Math.min(...tides);

        // If threshold provided, use it. Otherwise, set it effectively infinite (no red).
        const HIGH_TIDE_THRESHOLD = alertThreshold ?? 999;
        const LOW_TIDE_THRESHOLD = -999;

        if (dataMax <= dataMin) {
            return { high: 0, low: 1 };
        }

        // If the peak is below the threshold, there should be NO red.
        if (dataMax < HIGH_TIDE_THRESHOLD) {
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

    // Calculate Local Min/Max for markers
    const markers = React.useMemo(() => {
        if (!showHighLow) return [];
        const result: { x: number, y: number, type: 'high' | 'low', val: number, isKing: boolean }[] = [];

        // Simple local extrema detection
        // We look at i-1, i, i+1
        for (let i = 1; i < data.length - 1; i++) {
            const prev = data[i - 1].tideHeight ?? 0;
            const curr = data[i].tideHeight ?? 0;
            const next = data[i + 1].tideHeight ?? 0;

            if (curr > prev && curr > next) {
                // Local High
                // Use a small epsilon to catch peaks that visually touch the line but might be floating point under
                const isKing = alertThreshold !== undefined && curr >= (alertThreshold - 0.05);
                result.push({ x: i, y: curr, type: 'high', val: curr, isKing });
            } else if (curr < prev && curr < next) {
                // Local Low
                result.push({ x: i, y: curr, type: 'low', val: curr, isKing: false });
            }
        }
        return result;
    }, [data, showHighLow, alertThreshold]);

    const renderCustomLabel = (props: any) => {
        const { cx, cy, payload } = props;
        const { val, type, isKing } = payload;

        const isHigh = type === 'high';
        const offset = isHigh ? -10 : 15; // Text above or below dot
        // Use a brighter red for better visibility on dark backgrounds
        const color = isKing ? '#ff5252' : '#a0aec0';

        return (
            <text
                x={cx}
                y={cy + offset}
                fill={color}
                textAnchor="middle"
                style={{ fontSize: '11px', fontWeight: 'bold', textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
            >
                {val.toFixed(1)}
            </text>
        );
    };

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

            {/* Tide Markers */}
            {markers.map((marker, i) => (
                <ReferenceDot
                    key={i}
                    x={marker.x}
                    y={marker.y}
                    r={0} // No dot radius
                    fill="none"
                    stroke="none"
                    shape={(props: any) => (
                        <g>
                            {/* Dot removed as requested */}
                            {renderCustomLabel({ ...props, payload: marker })}
                        </g>
                    )}
                />
            ))}

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
