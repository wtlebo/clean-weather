import React from 'react';
import { AreaChart, Area, YAxis, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';
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
    showDailyHighLow?: boolean;
    units: 'imperial' | 'metric';
    timezone?: string; // Added
}

export const TemperatureChart: React.FC<TemperatureChartProps> = ({
    data, width, height, syncId, nowIndex, domain, ticks,
    showFeelsLike = true, showDewPoint = false, showDailyHighLow = true, units, timezone = 'UTC'
}) => {
    // Calculate min/max for domain to make the chart look dynamic
    const temps = data.map(d => d.temperature);
    // Use passed domain OR fallback
    const minTemp = domain ? domain[0] : Math.floor(Math.min(...temps) - 2);
    const maxTemp = domain ? domain[1] : Math.ceil(Math.max(...temps) + 2);

    // Dynamic Gradient Logic
    // Define base stops in Fahrenheit
    const baseStops = [
        { temp: 95, color: '#d32f2f' }, // Red
        { temp: 85, color: '#f44336' }, // Light Red
        { temp: 75, color: '#ff9800' }, // Orange
        { temp: 65, color: '#ffeb3b' }, // Yellow
        { temp: 55, color: '#8bc34a' }, // Green
        { temp: 45, color: '#00bcd4' }, // Cyan
        { temp: 35, color: '#2196f3' }, // Blue
        { temp: 25, color: '#3f51b5' }, // Indigo
    ];

    // Convert stops to Metric if needed
    const stops = units === 'imperial'
        ? baseStops
        : baseStops.map(s => ({ ...s, temp: (s.temp - 32) * 5 / 9 }));

    const gradientStops = stops.map(stop => {
        // SVG Gradient: 0% is TOP (MaxTemp), 100% is BOTTOM (MinTemp)
        // Need position relative to max->min scale
        const percent = (maxTemp - stop.temp) / (maxTemp - minTemp);
        return { ...stop, offset: percent };
    }).filter(s => s.offset >= 0 && s.offset <= 1)
        .sort((a, b) => a.offset - b.offset);

    // Helper to interpolate color for markers
    const getColorForTemp = (t: number) => {
        // Find surrounding stops
        // stops are typically high temp to low temp (e.g., 95 -> 25) ? No, baseStops definition order matters.
        // baseStops above are 95 down to 25.
        // Let's sort stops by temp ascending for easier interpolation
        const sortedStops = [...stops].sort((a, b) => a.temp - b.temp);

        if (t <= sortedStops[0].temp) return sortedStops[0].color;
        if (t >= sortedStops[sortedStops.length - 1].temp) return sortedStops[sortedStops.length - 1].color;

        for (let i = 0; i < sortedStops.length - 1; i++) {
            const s1 = sortedStops[i];
            const s2 = sortedStops[i + 1];
            if (t >= s1.temp && t <= s2.temp) {
                // Interpolate
                const ratio = (t - s1.temp) / (s2.temp - s1.temp);
                // Simple hex interpolation? Or return closest? 
                // Let's returned the mixed color.
                return interpolateHex(s1.color, s2.color, ratio);
            }
        }
        return '#888';
    };

    const interpolateHex = (c1: string, c2: string, ratio: number) => {
        const r1 = parseInt(c1.substring(1, 3), 16);
        const g1 = parseInt(c1.substring(3, 5), 16);
        const b1 = parseInt(c1.substring(5, 7), 16);

        const r2 = parseInt(c2.substring(1, 3), 16);
        const g2 = parseInt(c2.substring(3, 5), 16);
        const b2 = parseInt(c2.substring(5, 7), 16);

        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    // Calculate Daily Highs/Lows
    const dailyMarkers = React.useMemo(() => {
        if (!showDailyHighLow) return [];
        const markers: { x: number, y: number, type: 'high' | 'low', temp: number }[] = [];

        // Group by day string
        const days: Record<string, { min: number, minIndices: number[], max: number, maxIndices: number[] }> = {};

        // Timezone aware formatter
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });

        data.forEach((d, i) => {
            const dateStr = formatter.format(d.timestamp);
            if (!days[dateStr]) {
                days[dateStr] = { min: d.temperature, minIndices: [i], max: d.temperature, maxIndices: [i] };
            } else {
                const day = days[dateStr];
                if (d.temperature < day.min) {
                    day.min = d.temperature;
                    day.minIndices = [i];
                } else if (d.temperature === day.min) {
                    day.minIndices.push(i);
                }

                if (d.temperature > day.max) {
                    day.max = d.temperature;
                    day.maxIndices = [i];
                } else if (d.temperature === day.max) {
                    day.maxIndices.push(i);
                }
            }
        });

        Object.values(days).forEach(day => {
            // Pick the middle index for the marker if multiple
            const minIdx = day.minIndices[Math.floor(day.minIndices.length / 2)];
            const maxIdx = day.maxIndices[Math.floor(day.maxIndices.length / 2)];

            markers.push({ x: minIdx, y: day.min, type: 'low', temp: day.min });
            markers.push({ x: maxIdx, y: day.max, type: 'high', temp: day.max });
        });

        // Detect Collisions
        // Sort by X to check neighbors
        markers.sort((a, b) => a.x - b.x);

        const MIN_DIST = 4; // Minimum index distance (approx 4 hours)

        // We'll store offsets in a mutable way for the rendering phase or map to new array
        const adjustedMarkers = markers.map(m => ({ ...m, offsetX: 0 }));

        for (let i = 0; i < adjustedMarkers.length - 1; i++) {
            const current = adjustedMarkers[i];
            const next = adjustedMarkers[i + 1];

            if ((next.x - current.x) < MIN_DIST) {
                // Collision detected
                // Shift current to Left, Next to Right
                // Check if they are same type (High/High or Low/Low) or close in Y? 
                // Actually if they are close in X, labels might overlap regardless of Y if we don't check Y.
                // But High labels are 'above', Low labels are 'below'. 
                // A High colliding with a Low might be fine if distinct temps. 
                // User said "High from one day is close to High for next day". 
                // So let's prioritize shifting generally if X is close, but maybe less if types differ?
                // Simpler: Just shift if X is close.

                current.offsetX -= 12;
                next.offsetX += 12;
            }
        }

        return adjustedMarkers;
    }, [data, showDailyHighLow]);

    const renderCustomMarker = (props: any) => {
        const { cx, cy, payload } = props;
        const meta = payload as { type: 'high' | 'low', temp: number, offsetX: number };
        const color = getColorForTemp(meta.temp);
        const isHigh = meta.type === 'high';

        // Offset: High is above, Low is below
        // Closer to text, shorter bars
        const textOffset = isHigh ? -12 : 12;
        const barOffset = isHigh ? -22 : 20; // Adjusted High to -22 for visual balance

        const finalX = cx + meta.offsetX;

        return (
            <g>
                {/* Text */}
                <text
                    x={finalX}
                    y={cy + textOffset}
                    fill={color}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fontSize: '12px', fontWeight: 'bold', textShadow: '0 0 2px rgba(0,0,0,0.5)' }}
                >
                    {Math.round(meta.temp)}
                </text>
                {/* Bar */}
                <line
                    x1={finalX - 8}
                    y1={cy + barOffset}
                    x2={finalX + 8}
                    y2={cy + barOffset}
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                />
                {/* Also draw a subtle dot on the line? Maybe not needed if chart is visible. */}
            </g>
        );
    };

    return (
        <AreaChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 20, right: 0, left: 0, bottom: 20 }} // Increase margin for markers
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
                yAxisId="0"
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

            <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false} opacity={0.2} />
            {/* Manual Grid Lines to match Ticks */}
            {ticks && ticks.map((tick) => (
                <ReferenceLine key={tick} yAxisId="0" y={tick} stroke="#ccc" strokeDasharray="3 3" strokeOpacity={0.2} />
            ))}

            <Area
                yAxisId="0"
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
                    yAxisId="0"
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
                    yAxisId="0"
                    type="monotone"
                    dataKey="dewPoint"
                    stroke="#a0aec0"
                    fill="none"
                    strokeWidth={1.5}
                    activeDot={false}
                    strokeOpacity={0.8}
                />
            )}

            {/* Daily High/Low Markers */}
            {dailyMarkers.map((marker, i) => (
                <ReferenceDot
                    key={i}
                    yAxisId="0"
                    x={marker.x}
                    y={marker.y}
                    r={0}
                    shape={(props: any) => renderCustomMarker({ ...props, payload: marker })}
                />
            ))}

            {/* Now Line (Render last to appear on top) */}
            {nowIndex !== undefined && (
                <ReferenceLine x={nowIndex} yAxisId="0" stroke="#8b0000" strokeWidth={2} />
            )}
        </AreaChart>
    );
};
