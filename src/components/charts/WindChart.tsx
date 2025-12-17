import React from 'react';
import { LineChart, Line, YAxis, CartesianGrid, ReferenceLine, ReferenceDot } from 'recharts';
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
    showDailyHigh?: boolean;
    timezone?: string; // Added
    units?: 'imperial' | 'metric';
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

export const WindChart: React.FC<WindChartProps> = ({
    data, width, height, syncId, nowIndex, domain, ticks,
    showDailyHigh = true, timezone = 'UTC', units = 'imperial'
}) => {

    // Check for high winds to style the chart
    const maxGust = React.useMemo(() => Math.max(...data.map(d => d.windGust || 0)), [data]);
    const highWindThreshold = units === 'imperial' ? 45 : 20;

    // Calculate gradient offset
    const yMax = (domain && typeof domain[1] === 'number') ? domain[1] : (maxGust > 0 ? maxGust * 1.1 : 10);
    const gradientOffset = yMax <= highWindThreshold ? 0 : (yMax - highWindThreshold) / yMax;

    // Calculate Daily Highs (Max of Speed AND Gust)
    const dailyMarkers = React.useMemo(() => {
        if (!showDailyHigh) return [];
        const markers: { x: number, y: number, val: number, isGust: boolean }[] = [];

        // Group by day string
        const days: Record<string, {
            maxWind: number, maxWindIndex: number,
            maxGust: number, maxGustIndex: number
        }> = {};

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
                days[dateStr] = {
                    maxWind: d.windSpeed, maxWindIndex: i,
                    maxGust: d.windGust || 0, maxGustIndex: i
                };
            } else {
                // Check Wind
                if (d.windSpeed > days[dateStr].maxWind) {
                    days[dateStr].maxWind = d.windSpeed;
                    days[dateStr].maxWindIndex = i;
                }
                // Check Gust
                if ((d.windGust || 0) > days[dateStr].maxGust) {
                    days[dateStr].maxGust = d.windGust || 0;
                    days[dateStr].maxGustIndex = i;
                }
            }
        });

        Object.values(days).forEach(day => {
            // Add Wind Marker
            markers.push({ x: day.maxWindIndex, y: day.maxWind, val: day.maxWind, isGust: false });

            // Add Gust Marker (only if meaningful value > 0)
            if (day.maxGust > 0) {
                markers.push({ x: day.maxGustIndex, y: day.maxGust, val: day.maxGust, isGust: true });
            }
        });

        return markers;
    }, [data, showDailyHigh]);

    const renderDailyMarker = (props: any) => {
        const { cx, cy, payload } = props;
        const { val, isGust, offsetX, offsetY } = payload;

        return (
            <text
                x={cx + (offsetX || 0)}
                y={cy - 10 + (offsetY || 0)}
                fill={isGust ? "#f97316" : "#a0aec0"}
                textAnchor="middle"
                style={{ fontSize: '12px', fontWeight: 'bold', textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
            >
                {Math.round(val)}
            </text>
        );
    };

    // Calculate Collision Offsets
    const finalMarkers = React.useMemo(() => {
        if (dailyMarkers.length === 0) return [];

        // Clone and Initialize
        const markers = dailyMarkers.map(m => ({ ...m, offsetX: 0, offsetY: 0 }));

        // 1. Separate into two groups
        const windMarkers = markers.filter(m => !m.isGust).sort((a, b) => a.x - b.x);
        const gustMarkers = markers.filter(m => m.isGust).sort((a, b) => a.x - b.x);

        const MIN_X_DIST = 4;
        const COLLISION_X_OFFSET = 12;

        // 2. Process Wind Series (Horizontal)
        for (let i = 0; i < windMarkers.length - 1; i++) {
            const current = windMarkers[i];
            const next = windMarkers[i + 1];
            if ((next.x - current.x) < MIN_X_DIST) {
                current.offsetX -= COLLISION_X_OFFSET;
                next.offsetX += COLLISION_X_OFFSET;
            }
        }

        // 3. Process Gust Series (Horizontal)
        for (let i = 0; i < gustMarkers.length - 1; i++) {
            const current = gustMarkers[i];
            const next = gustMarkers[i + 1];
            if ((next.x - current.x) < MIN_X_DIST) {
                current.offsetX -= COLLISION_X_OFFSET;
                next.offsetX += COLLISION_X_OFFSET;
            }
        }

        // 4. Combine and check for Vertical Overlap (Same Day/Index)
        // We need to check if a Wind and Gust are at the same X (or very close now?)
        // Let's rely on original X to find pairs.
        // If they share an X, we generally want to push them apart vertically.

        // Re-bucket by X
        const byX: Record<number, typeof markers> = {};
        markers.forEach(m => {
            if (!byX[m.x]) byX[m.x] = [];
            byX[m.x].push(m);
        });

        Object.values(byX).forEach(pair => {
            if (pair.length >= 2) {
                // We have both Wind and Gust at this index
                // pair[0] and pair[1]
                const m1 = pair[0];
                const m2 = pair[1];

                // Which is higher visual value? (Lower Y val = Higher visual)
                // Actually 'val' is the speed. Higher speed = Higher visual.
                // We want to push the Higher speed UP (-offsetY) and Lower speed DOWN (+offsetY)
                // BUT only if they are colliding?
                // Wind vs Gust are usually close in X (dist=0).
                // They might be close in Y (val).
                const valDiff = Math.abs(m1.val - m2.val);

                // Even if values are different, if we have text stacking, we might want to ensure separation.
                // Text is drawn at y - 10.

                // Force separation if close
                if (valDiff < 8) { // Increased threshold from 4 to 8
                    // Determine which is upper
                    const m1IsHigher = m1.val > m2.val;
                    const upper = m1IsHigher ? m1 : m2;
                    const lower = m1IsHigher ? m2 : m1;

                    upper.offsetY = -12; // Push up
                    lower.offsetY = 12;  // Push down
                }
            }
        });

        // Flatten
        return markers;
    }, [dailyMarkers]);

    return (
        <LineChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 20, right: 0, left: 0, bottom: 5 }} // Increased top margin for markers
            syncId={syncId}
        >
            <defs>
                <linearGradient id="gustGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset={gradientOffset} stopColor="#f97316" stopOpacity={1} />
                    <stop offset={gradientOffset} stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false} opacity={0.2} />
            {/* Manual Grid Lines to match Ticks */}
            {ticks && ticks.map((tick) => (
                <ReferenceLine key={tick} yAxisId="0" y={tick} stroke="#ccc" strokeDasharray="3 3" strokeOpacity={0.2} />
            ))}

            <YAxis
                yAxisId="0"
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

            {/* Gust Line (Base - Dashed) */}
            <Line
                yAxisId="0"
                type="monotone"
                dataKey="windGust"
                stroke="#f97316"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                connectNulls={false}
                dot={false}
                activeDot={false}
            />
            {/* Gust Line (Highlight - Solid > Threshold) */}
            <Line
                yAxisId="0"
                type="monotone"
                dataKey="windGust"
                stroke="url(#gustGradient)"
                strokeWidth={1.5}
                connectNulls={false}
                dot={false}
                activeDot={false}
            />

            {/* Daily High Markers */}
            {finalMarkers.map((marker, i) => (
                <ReferenceDot
                    key={i}
                    yAxisId="0"
                    x={marker.x}
                    y={marker.val}
                    r={0}
                    shape={(props: any) => renderDailyMarker({ ...props, payload: marker })}
                />
            ))}

            <Line
                yAxisId="0"
                type="monotone"
                dataKey="windSpeed"
                stroke="#a0aec0"
                strokeWidth={2}
                dot={<CustomizedDot />}
                activeDot={false}
            />
            {/* Now Line (Render last) */}
            {nowIndex !== undefined && (
                <ReferenceLine x={nowIndex} yAxisId="0" stroke="#8b0000" strokeWidth={2} />
            )}
        </LineChart>
    );
};
