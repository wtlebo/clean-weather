import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Info, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface StatusIndicatorProps {
    lastFetchTime: Date | null;
    currentTime: Date;
    onRefresh: () => void;
    isLoading: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ lastFetchTime, currentTime, onRefresh, isLoading }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!lastFetchTime) return null;

    const diffMinutes = (currentTime.getTime() - lastFetchTime.getTime()) / (1000 * 60);

    let statusColor = '#22c55e'; // Green
    let statusText = 'Fresh';

    if (diffMinutes > 240) { // 4 hours
        statusColor = '#ef4444'; // Red
        statusText = 'Stale';
    } else if (diffMinutes > 60) { // 1 hour
        statusColor = '#eab308'; // Yellow
        statusText = 'Aging';
    }

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: statusColor,
                    cursor: 'pointer',
                    boxShadow: `0 0 8px ${statusColor}66`,
                    border: '1px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.3s ease'
                }}
                title={`Data Status: ${statusText}`}
            />

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '24px',
                    right: '-10px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '16px',
                    width: '280px',
                    zIndex: 10000,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    color: '#fff',
                    fontSize: '13px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Data Status</h3>
                        <span style={{
                            backgroundColor: statusColor,
                            color: '#000',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: 'bold'
                        }}>
                            {statusText.toUpperCase()}
                        </span>
                    </div>

                    <p style={{ color: '#ccc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Info size={14} />
                        Fetched {formatDistanceToNow(lastFetchTime)} ago
                    </p>

                    <div style={{ height: '1px', backgroundColor: '#333', margin: '12px 0' }} />

                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#888' }}>DATA SOURCES</h4>

                    <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', textDecoration: 'none', marginBottom: '8px' }}>
                        <ExternalLink size={12} /> Open-Meteo (Weather)
                    </a>
                    <a href="https://tidesandcurrents.noaa.gov/" target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', textDecoration: 'none', marginBottom: '16px' }}>
                        <ExternalLink size={12} /> NOAA (Tides)
                    </a>

                    <button
                        onClick={() => { onRefresh(); setIsOpen(false); }}
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: '#333',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: isLoading ? 'wait' : 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#444')}
                        onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#333')}
                    >
                        <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
                        {isLoading ? 'Refreshing...' : 'Refresh Data Now'}
                    </button>
                </div>
            )}
            <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
};
