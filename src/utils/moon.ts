import SunCalc from 'suncalc';

export interface MoonPhaseData {
    phase: number; // 0.0 to 1.0
    fraction: number; // Illuminated fraction (0.0 to 1.0)
    label: string;
}

export interface MoonEvent {
    hourIndex: number;
    type: 'new' | 'wax_cresc' | 'first' | 'wax_gibb' | 'full' | 'wan_gibb' | 'third' | 'wan_cresc';
    label: string;
    phaseValue: number;
}

// 8 Phases
// 0.000 = New
// 0.125 = Waxing Crescent
// 0.250 = First Quarter
// 0.375 = Waxing Gibbous
// 0.500 = Full
// 0.625 = Waning Gibbous
// 0.750 = Last Quarter
// 0.875 = Waning Crescent
const PHASE_THRESHOLDS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];
const TYPES = ['new', 'wax_cresc', 'first', 'wax_gibb', 'full', 'wan_gibb', 'third', 'wan_cresc'] as const;
const LABELS = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];

export const getMoonData = (date: Date): MoonPhaseData => {
    const moon = SunCalc.getMoonIllumination(date);

    // Determine label for general tooltip
    let label = 'New Moon';
    const p = moon.phase;
    // Simple ranges for text label (centered around the events)
    // Each phase covers 1/8th of the cycle (0.125), so +/- 0.0625
    if (p >= 0.9375 || p < 0.0625) label = 'New Moon';
    else if (p < 0.1875) label = 'Waxing Crescent';
    else if (p < 0.3125) label = 'First Quarter';
    else if (p < 0.4375) label = 'Waxing Gibbous';
    else if (p < 0.5625) label = 'Full Moon';
    else if (p < 0.5625) label = 'Full Moon'; // Note: Typo safeguard in logic? No, let's just be clean.
    else if (p < 0.6875) label = 'Waning Gibbous';
    else if (p < 0.8125) label = 'Last Quarter';
    else label = 'Waning Crescent';

    return {
        phase: moon.phase,
        fraction: moon.fraction,
        label
    };
};

/**
 * Scans the timeline to find the EXACT hour where a major phase transition occurs.
 * Because phase is continuous, we look for the hour where it crosses a threshold (or gets closest).
 */
export const findMoonEvents = (startData: any[]): MoonEvent[] => {
    const events: MoonEvent[] = [];
    if (startData.length < 2) return [];

    let prevPhase = SunCalc.getMoonIllumination(new Date(startData[0].timestamp)).phase;

    for (let i = 1; i < startData.length; i++) {
        const currDate = new Date(startData[i].timestamp);
        const currPhase = SunCalc.getMoonIllumination(currDate).phase;

        for (let t = 0; t < PHASE_THRESHOLDS.length; t++) {
            const threshold = PHASE_THRESHOLDS[t];
            const type = TYPES[t];

            let crossed = false;

            if (threshold === 0) {
                // Wrap check: prev > 0.9 and curr < 0.1
                if (prevPhase > 0.9 && currPhase < 0.1) crossed = true;
            } else {
                // Standard check
                if (prevPhase < threshold && currPhase >= threshold) crossed = true;
            }

            if (crossed) {
                events.push({
                    hourIndex: i, // Mark this hour as the event
                    type,
                    label: LABELS[t],
                    phaseValue: currPhase
                });
            }
        }
        prevPhase = currPhase;
    }

    return events;
};

export interface CheckMoonEvent {
    timestamp: Date;
    type: 'rise' | 'set';
    phase: MoonPhaseData;
}

export const findMoonRiseSetEvents = (data: any[], lat: number, lon: number): CheckMoonEvent[] => {
    const events: CheckMoonEvent[] = [];
    if (!data.length) return [];

    // Map timestamps to hours to avoid duplicates
    const processedHours = new Set<string>();

    data.forEach((point) => {
        const date = new Date(point.timestamp);
        const times = SunCalc.getMoonTimes(date, lat, lon);

        // Check Rise
        if (times.rise) {

            // If the rise time is within this hour block (simple approach: same hour)
            // Or better: if the rise time is closest to this point's timestamp compared to neighbors.
            // Simplified: if the rise time is within +/- 30 mins of this point? 
            // Our points are hourly. So we check if times.rise is in [timestamp - 30m, timestamp + 30m]
            const diff = Math.abs(times.rise.getTime() - date.getTime());
            if (diff < 30 * 60 * 1000) {
                const key = `rise-${times.rise.getDate()}-${times.rise.getHours()}`;
                if (!processedHours.has(key)) {
                    processedHours.add(key);
                    events.push({
                        timestamp: point.timestamp,
                        type: 'rise',
                        phase: getMoonData(times.rise)
                    });
                }
            }
        }

        // Check Set
        if (times.set) {
            const diff = Math.abs(times.set.getTime() - date.getTime());
            if (diff < 30 * 60 * 1000) {
                const key = `set-${times.set.getDate()}-${times.set.getHours()}`;
                if (!processedHours.has(key)) {
                    processedHours.add(key);
                    events.push({
                        timestamp: point.timestamp,
                        type: 'set',
                        phase: getMoonData(times.set)
                    });
                }
            }
        }
    });

    return events;
};
