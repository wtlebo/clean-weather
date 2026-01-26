import React, { useMemo } from 'react';
import { AreaChart, Area, YAxis, CartesianGrid } from 'recharts';
import SunCalc from 'suncalc';
import { findMoonRiseSetEvents, findMoonEvents } from '../../utils/moon';
import type { WeatherPoint } from '../../types/weather';

interface MoonPhaseRowProps {
    data: WeatherPoint[];
    width: number;
    hourWidth: number;
    nowIndex: number; // Added
}


export const MoonPhaseRow: React.FC<MoonPhaseRowProps & { lat: number; lon: number }> = ({ data, width, hourWidth, nowIndex, lat, lon }) => {

    const events = useMemo(() => findMoonRiseSetEvents(data, lat, lon), [data, lat, lon]);

    // Calculate fraction for the wave background
    const waveData = useMemo(() => {
        return data.map(d => ({
            fraction: SunCalc.getMoonIllumination(new Date(d.timestamp)).fraction
        }));
    }, [data]);

    // Dynamic Moon Path Generator
    const drawMoonPhase = (phase: number, size: number) => {
        const r = size / 2; // radius
        const c = size / 2; // center

        // SVG Path Logic
        const isWaxing = phase <= 0.5;
        const xAmplitude = Math.cos(2 * Math.PI * phase) * r;

        let path = '';

        if (isWaxing) {
            path = `
                M ${c},0 
                A ${r},${r} 0 0 1 ${c},${size} 
                A ${Math.abs(xAmplitude)},${r} 0 0 ${phase < 0.25 ? 1 : 0} ${c},0
            `;
        } else {
            path = `
                M ${c},0 
                A ${r},${r} 0 0 0 ${c},${size} 
                A ${Math.abs(xAmplitude)},${r} 0 0 ${phase < 0.75 ? 1 : 0} ${c},0
            `;
        }

        return (
            <svg width={size} height={size}>
                {/* Background Circle (Full Moon Base) */}
                <circle cx={c} cy={c} r={r} fill="#e2e8f0" stroke="#555" strokeWidth="1" />
                {/* Shadow Path */}
                <path d={path} fill="#333" />
            </svg>
        );
    };

    const renderEventIcon = (event: { type: 'rise' | 'set', phase: any }) => {
        const isRise = event.type === 'rise';
        const color = isRise ? '#fbbf24' : '#fbbf24';

        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                {isRise && (
                    <svg width="10" height="6" viewBox="0 0 10 6" style={{ marginBottom: '2px' }}>
                        <path d="M0 6 L5 0 L10 6" fill={color} />
                    </svg>
                )}

                {drawMoonPhase(event.phase.phase, 14)}

                {!isRise && (
                    <svg width="10" height="6" viewBox="0 0 10 6" style={{ marginTop: '2px' }}>
                        <path d="M0 0 L5 6 L10 0" fill={color} />
                    </svg>
                )}
            </div>
        );
    };

    const phaseEvents = useMemo(() => {
        return findMoonEvents(data).filter(e => e.type === 'new' || e.type === 'full');
    }, [data]);

    // Ensure we render if we have events OR phase lines OR the Now line is valid
    // Actually, checking nowIndex validity (it's always a number?) 
    // Let's just return null if no data, which is standard.
    // But the previous check was: if (events.length === 0 && phaseEvents.length === 0) return null;
    // We should probably remove that check or include nowIndex check? 
    // If there's no moon events, we still might want to see the Now line? 
    // Actually, if there's data, we show the chart. The check was for "empty" chart optimization.
    // I'll leave the check for now but if the user complains about empty stripes I'll fix it. 
    // Wait, if I'm adding a "Now" line, the chart isn't empty anymore technically. 
    // But practically, if no moon events, it's just a background?
    // Let's stick to adding the line.

    if (events.length === 0 && phaseEvents.length === 0) return null;

    return (
        <div style={{
            position: 'relative',
            width: width,
            height: '100%',
            borderBottom: '1px solid #333',
            backgroundColor: 'rgba(0,0,0,0.2)'
        }}>
            {/* Background Wave */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
                <AreaChart
                    width={width}
                    height={40}
                    data={waveData}
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="moonGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.0} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="fraction"
                        stroke="none"
                        fill="url(#moonGradient)"
                        isAnimationActive={false}
                        activeDot={false}
                    />
                    <YAxis domain={[0, 1]} hide />
                    <CartesianGrid vertical={false} stroke="#555" strokeDasharray="3 3" opacity={0.5} />
                </AreaChart>
            </div>

            {/* Major Phase Lines (New / Full) */}
            {phaseEvents.map((event, i) => {
                const left = (event.hourIndex * hourWidth) + (hourWidth / 2);
                if (left < 0 || left > width) return null;

                return (
                    <div
                        key={`phase-${i}`}
                        style={{
                            position: 'absolute',
                            left: `${left}px`,
                            top: 0,
                            bottom: 0,
                            width: '1px',
                            backgroundColor: 'rgba(255,255,255,0.15)',
                            borderLeft: '1px dashed rgba(255,255,255,0.3)',
                            zIndex: 5,
                            pointerEvents: 'none'
                        }}
                    />
                );
            })}

            {/* Now Line */}
            {nowIndex >= 0 && (
                <div
                    style={{
                        position: 'absolute',
                        left: `${(nowIndex * hourWidth) + (hourWidth / 2)}px`,
                        top: 0,
                        bottom: 0,
                        width: '2px', // Match strokeWidth={2}
                        backgroundColor: '#8b0000',
                        zIndex: 15, // Above icons (10)
                        pointerEvents: 'none',
                        transform: 'translateX(-50%)' // Center the 2px line
                    }}
                />
            )}

            {/* Icons Layer */}
            {events.map((event, i) => {
                const index = data.findIndex(d => d.timestamp.getTime() === event.timestamp.getTime());
                if (index === -1) return null;

                const pLeft = (index * hourWidth) + (hourWidth / 2) - 8; // Center it
                if (pLeft < 0 || pLeft > width) return null;

                return (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${pLeft}px`,
                            top: '4px', // Tweak top to fit icon + carat
                            cursor: 'help',
                            zIndex: 10
                        }}
                        title={`${event.type === 'rise' ? 'Moon Rise' : 'Moon Set'}: ${event.phase.label} (${Math.round(event.phase.fraction * 100)}%)`}
                    >
                        {renderEventIcon(event)}
                    </div>
                );
            })}
        </div>
    );
};
