import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { searchLocations } from '../services/api';
import type { LocationResult } from '../services/api';

interface LocationSearchProps {
    currentLocationName: string;
    onLocationSelect: (location: LocationResult) => void;
}

export const LocationSearch: React.FC<LocationSearchProps> = ({ currentLocationName, onLocationSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<LocationResult[]>([]);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length >= 3) {
                setLoading(true);
                const locations = await searchLocations(query);
                setResults(locations);
                setLoading(false);
            } else {
                setResults([]);
            }
        }, 500); // Debounce

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (loc: LocationResult) => {
        onLocationSelect(loc);
        setIsOpen(false);
        setQuery('');
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', zIndex: 9999 }}>
            {isOpen ? (
                <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#333', borderRadius: '4px', padding: '4px 8px' }}>
                        <Search size={16} color="#aaa" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search city..."
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                marginLeft: '8px',
                                outline: 'none',
                                fontSize: '0.9rem',
                                width: '200px'
                            }}
                        />
                    </div>
                    {/* Dropdown */}
                    {(results.length > 0 || loading) && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#222',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            marginTop: '4px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                        }}>
                            {loading && <div style={{ padding: '8px', color: '#888' }}>Loading...</div>}
                            {results.map((loc) => (
                                <div
                                    key={loc.id}
                                    onClick={() => handleSelect(loc)}
                                    style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid #333'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{ fontWeight: 500 }}>{loc.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                                        {loc.admin1 ? `${loc.admin1}, ` : ''}{loc.country_code}
                                    </div>
                                </div>
                            ))}
                            {!loading && results.length === 0 && query.length >= 3 && (
                                <div style={{ padding: '8px', color: '#888' }}>No results found</div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <h1
                    onClick={() => setIsOpen(true)}
                    style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        margin: 0
                        // Reuse existing h1 styles effectively by just rendering h1
                    }}
                >
                    {currentLocationName}
                    <Search size={14} color="#555" style={{ opacity: 0.5 }} />
                </h1>
            )}
        </div>
    );
};
