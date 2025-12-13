import React from 'react';
import './WeatherPanel.css';

interface WeatherPanelProps {
    title: React.ReactNode;
    height?: number;
    children?: React.ReactNode;
    axis?: React.ReactNode;
    tooltip?: React.ReactNode;
    tooltipLeft?: number;
}

export const WeatherPanel: React.FC<WeatherPanelProps> = ({
    title,
    height = 200,
    children,
    axis,
    tooltip,
    tooltipLeft
}) => {
    return (
        <div className="weather-panel">
            {/* Header: Standard block flow above chart */}
            <div className="panel-header">
                <span className="panel-title">{title}</span>
            </div>

            {/* Body: Grid layout (Axis + Content) */}
            <div className="panel-body" style={{ height: `${height}px` }}>
                {axis && (
                    <div className="panel-axis">
                        {axis}
                    </div>
                )}
                <div className="panel-content" style={{ position: 'relative' }}>
                    {children || <div className="panel-placeholder">No Data</div>}

                    {/* Custom Tooltip Overlay */}
                    {tooltip && tooltipLeft !== undefined && (
                        <div style={{
                            position: 'absolute',
                            left: `${tooltipLeft}px`,
                            top: '5px', // Just below top edge
                            transform: 'translateX(4px)', // Offset to right of crosshair
                            zIndex: 100,
                            pointerEvents: 'none'
                        }}>
                            {tooltip}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
