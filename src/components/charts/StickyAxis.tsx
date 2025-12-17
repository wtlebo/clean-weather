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
}

export const StickyAxis: React.FC<StickyAxisProps> = ({
    domain,
    height,
    orientation = 'left',
    tickFormatter,
    tickCount = 5,
    ticks,
    margin = { top: 5, right: 0, left: 0, bottom: 5 }
}) => {
    // We create a dummy chart just to render the axis
    // The width needs to be enough to hold the ticks
    // For compact view: just numbers
    const defaultTickFormatter = (value: number) => {
        return `${value}`;
    };

    // Create explicit dummy data points at the min and max of the domain
    // This forces Recharts to render the axis correctly spanning the full height
    const dummyData = [
        { value: domain[0] },
        { value: domain[1] }
    ];

    return (
        <div className="sticky-axis-container" style={{ height, width: 32, position: 'relative', overflow: 'hidden' }}>

            <AreaChart
                width={32}
                height={height}
                data={dummyData}
                margin={margin}
            >
                <YAxis
                    dataKey="value"
                    domain={domain}
                    orientation={orientation}
                    tick={{ fontSize: 9, fill: '#aaa', fontWeight: 500 }}
                    tickCount={tickCount}
                    width={32}
                    tickFormatter={tickFormatter || defaultTickFormatter}
                    interval={0} // Force show all provided ticks (let parent control density)
                    ticks={ticks}
                />
            </AreaChart>
        </div>
    );
};
