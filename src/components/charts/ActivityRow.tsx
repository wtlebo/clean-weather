import React from 'react';
import type { WeatherPoint } from '../../types/weather';
import type { Activity } from '../../types/activity';
import { calculateActivityScore } from '../../services/scorer';

interface ActivityRowProps {
    points: WeatherPoint[];
    activity: Activity;
    lat: number;
    lon: number;
    height: number;
    onEdit?: () => void;
}

export const ActivityRow: React.FC<ActivityRowProps> = ({ points, activity, lat, lon }) => {
    // Tooltip removed per user request
    return (
        <div style={{ display: 'flex', height: '100%', gap: '1px', width: '100%', position: 'relative', alignItems: 'center' }}>
            {points.map((point, i) => {
                const result = calculateActivityScore(activity, point, lat, lon, points, i);
                return (
                    <div
                        key={i}
                        style={{
                            flex: 1,
                            height: '80%', // Increased from 60% to maintain size in smaller container 
                            backgroundColor: result.color,
                            opacity: result.isViable ? 0.9 : 0.6,
                            borderRadius: '1px',
                            cursor: 'default'
                        }}
                    />
                );
            })}
        </div>
    );
};
