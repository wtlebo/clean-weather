import React from 'react';
import { AreaChart, YAxis } from 'recharts';

interface StickyAxisProps {
    domain: [number, number];
    height: number;
    orientation?: 'left' | 'right';
    unit?: string;
    tickFormatter?: (value: number) => string;
    tickCount?: number;
    ticks?: number[];
    margin?: { top: number; right: number; bottom: number; left: number };
    tick?: any; // Allow custom tick renderer or props
}

export const StickyAxis: React.FC<StickyAxisProps> = ({
    domain,
    height,
    orientation = 'left',
    tickFormatter,
    tickCount = 5,
    ticks,
    margin = { top: 5, right: 0, left: 0, bottom: 5 },
    tick
}) => {
    // ... (rest of local variables)
    const defaultTickFormatter = (value: number) => `${value}`;
    const dummyData = [{ value: domain[0] }, { value: domain[1] }];

    return (
        <div className="sticky-axis-container" style={{ height, width: 32, position: 'relative', overflow: 'hidden' }}>
            <AreaChart width={32} height={height} data={dummyData} margin={margin}>
                <YAxis
                    dataKey="value"
                    domain={domain}
                    orientation={orientation}
                    tick={tick || { fontSize: 9, fill: '#aaa', fontWeight: 500 }}
                    tickCount={tickCount}
                    width={32}
                    tickFormatter={tickFormatter || defaultTickFormatter}
                    interval={0}
                    ticks={ticks}
                />
            </AreaChart>
        </div>
    );
};
