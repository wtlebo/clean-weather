
import React, { useState } from 'react';
import { X, Plus, Info, Save, Trash2, MapPin } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { LocationSearch } from '../LocationSearch';
import type { LocationResult } from '../../services/api';
import type { Activity, Condition, WeatherCondition, TimeCondition, WeatherParameter, Operator, ReferenceEvent, DayType } from '../../types/activity';

interface ActivityBuilderProps {
    existingActivity?: Activity;
    currentLocation: LocationResult;
    settings: any; // Using any for now
    onClose: () => void;
    onSave: (activity: Activity) => void;
}

const PARAMETERS: { id: WeatherParameter | 'time'; label: string }[] = [
    // We will use a special 'time' ID for the type selector, but actul params are below
    { id: 'temperature', label: 'Temperature' },
    { id: 'feelsLike', label: 'Feels Like' },
    { id: 'windSpeed', label: 'Wind Speed' },
    { id: 'windGust', label: 'Wind Gust' },
    { id: 'cloudCover', label: 'Cloud Cover' },
    { id: 'precipProbability', label: 'Precip Chance' },
    { id: 'humidity', label: 'Humidity' },
    { id: 'uvIndex', label: 'UV Index' },
    { id: 'tideHeight', label: 'Tide Height' },
    { id: 'waveHeight', label: 'Wave Height' },
    { id: 'waterTemp', label: 'Water Temp' },
    { id: 'moonIllumination', label: 'Moon Illumination' }, // New
    { id: 'snowAccumulation', label: 'Total Snow' },
    { id: 'rainAccumulation', label: 'Total Rain' },
];

const DEFAULT_VALUES: Record<WeatherParameter, number> = {
    temperature: 70,
    feelsLike: 70,
    windSpeed: 10,
    windGust: 25,
    cloudCover: 50,
    precipProbability: 50,
    humidity: 90,
    uvIndex: 3,
    tideHeight: 5,
    waveHeight: 2,
    waterTemp: 40,
    snowAccumulation: 6,
    rainAccumulation: 1,
    // Add missing keys with sane defaults just in case
    dewPoint: 50,
    swellHeight: 2,
    swellPeriod: 8,
    swellDirection: 0,
    wavePeriod: 8,
    windDirection: 0,
    moonPhase: 0.5,
    moonIllumination: 95, // Default > 95%
    isDaylight: 1,
    timeOfDay: 12,
    aqi: 50
};


const PARAMETER_BOUNDS: Record<WeatherParameter, { min: number, max: number }> = {
    temperature: { min: -100, max: 200 },
    feelsLike: { min: -100, max: 200 },
    windSpeed: { min: 0, max: 200 },
    windGust: { min: 0, max: 200 },
    cloudCover: { min: 0, max: 100 },
    precipProbability: { min: 0, max: 100 },
    humidity: { min: 0, max: 100 },
    uvIndex: { min: 0, max: 20 },
    tideHeight: { min: -5, max: 30 }, // Expanded min to -5 to handle low tides (neg)
    waveHeight: { min: 0, max: 50 },
    waterTemp: { min: 0, max: 200 },
    snowAccumulation: { min: 0, max: 200 },
    rainAccumulation: { min: 0, max: 20 },

    // Safety defaults for others
    dewPoint: { min: -100, max: 150 },
    swellHeight: { min: 0, max: 50 },
    swellPeriod: { min: 0, max: 30 },
    swellDirection: { min: 0, max: 360 },
    wavePeriod: { min: 0, max: 30 },
    windDirection: { min: 0, max: 360 },
    moonPhase: { min: 0, max: 1 },
    moonIllumination: { min: 0, max: 100 },
    isDaylight: { min: 0, max: 1 },
    timeOfDay: { min: 0, max: 23 },
    aqi: { min: 0, max: 500 }
};

export const ActivityBuilder: React.FC<ActivityBuilderProps> = ({ existingActivity, currentLocation, settings, onClose, onSave }) => {
    const [name, setName] = useState(existingActivity?.name || '');
    const [location, setLocation] = useState<LocationResult>(existingActivity?.location || currentLocation);
    const [icon, setIcon] = useState(existingActivity?.icon || '🏃'); // Default emoji
    const [dealBreakers, setDealBreakers] = useState<Condition[]>(existingActivity?.dealBreakers || []);
    const [niceToHaves, setNiceToHaves] = useState<Condition[]>(existingActivity?.niceToHaves || []);

    // UI States
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    // Helper to get bounds (converted if metric)
    const getBounds = (param: WeatherParameter) => {
        const bounds = PARAMETER_BOUNDS[param] || { min: 0, max: 100 };
        const isMetric = settings.units === 'metric';

        if (!isMetric) return bounds;

        // Metric Conversions
        switch (param) {
            case 'temperature':
            case 'feelsLike':
            case 'waterTemp':
            case 'dewPoint':
                return {
                    min: Math.round((bounds.min - 32) * (5 / 9)),
                    max: Math.round((bounds.max - 32) * (5 / 9))
                };
            case 'windSpeed':
            case 'windGust':
                return {
                    min: Math.floor(bounds.min * 1.60934),
                    max: Math.ceil(bounds.max * 1.60934)
                };
            case 'tideHeight':
            case 'waveHeight':
            case 'swellHeight':
                return {
                    min: parseFloat((bounds.min / 3.28084).toFixed(1)),
                    max: parseFloat((bounds.max / 3.28084).toFixed(1))
                };
            case 'snowAccumulation':
            case 'rainAccumulation':
                return {
                    min: Math.floor(bounds.min * 25.4),
                    max: Math.ceil(bounds.max * 25.4)
                };
            default:
                return bounds;
        }
    };

    // Helper to get default value (converted if metric)
    const getDefaultValue = (param: WeatherParameter) => {
        const raw = DEFAULT_VALUES[param] ?? 0;
        const isMetric = settings.units === 'metric';

        if (!isMetric) return raw;

        // Metric Conversions
        switch (param) {
            case 'temperature':
            case 'feelsLike':
            case 'waterTemp':
            case 'dewPoint':
                return Math.round((raw - 32) * (5 / 9));
            case 'windSpeed':
            case 'windGust':
                return Math.round(raw * 1.60934);
            case 'tideHeight':
            case 'waveHeight':
            case 'swellHeight':
                return parseFloat((raw / 3.28084).toFixed(1));
            case 'snowAccumulation':
            case 'rainAccumulation':
                // "equivalent" usually implies similar magnitude in standard units? 
                // 1 inch -> 25.4 mm. User might prefer cm? 
                // Let's stick to standard inches for now as requested previously, OR convert if using explicit metric inputs elsewhere.
                // Given the Scorer inputs are standardized, let's just keep the number for now if inconsistent, 
                // BUT user said "metric equivalent"
                // Let's assume mm for precip if metric
                return Math.round(raw * 25.4);
            default:
                return raw;
        }
    };

    // Helper to get display unit based on settings
    const getUnitLabel = (param: WeatherParameter) => {
        const isMetric = settings.units === 'metric';
        switch (param) {
            case 'temperature':
            case 'feelsLike':
            case 'waterTemp':
            case 'dewPoint':
                return isMetric ? '°C' : '°F';
            case 'windSpeed':
            case 'windGust':
                return isMetric ? 'km/h' : 'mph';
            case 'precipProbability':
            case 'cloudCover':
            case 'humidity':
            case 'moonIllumination':
                return '%';
            case 'tideHeight':
            case 'waveHeight':
            case 'swellHeight':
                return isMetric ? 'm' : 'ft';
            case 'snowAccumulation':
            case 'rainAccumulation':
                return isMetric ? 'mm' : 'in';
            default:
                return '';
        }
    };



    const addCondition = (list: Condition[], setter: (val: Condition[]) => void, type: 'weather' | 'time' = 'weather') => {
        const id = Math.random().toString(36).substr(2, 9);
        if (type === 'weather') {
            const newCondition: WeatherCondition = {
                id,
                type: 'weather',
                parameterId: 'temperature',
                operator: '>',
                value: getDefaultValue('temperature')
            };
            setter([...list, newCondition]);
        } else {
            const newCondition: TimeCondition = {
                id,
                type: 'time',
                subType: 'range',
                days: 'all',
                startHour: 9,
                endHour: 17
            };
            setter([...list, newCondition]);
        }
    };

    const updateCondition = (list: Condition[], setter: (val: Condition[]) => void, id: string, updates: Partial<Condition>) => {
        setter(list.map(c => c.id === id ? { ...c, ...updates } as Condition : c));
    };

    const removeCondition = (list: Condition[], setter: (val: Condition[]) => void, id: string) => {
        setter(list.filter(c => c.id !== id));
    };

    const handleSave = () => {
        const newActivity: Activity = {
            id: existingActivity?.id || Math.random().toString(36).substr(2, 9),
            name,
            icon,
            color: existingActivity?.color || '#3b82f6',
            location,
            dealBreakers,
            niceToHaves
        };
        onSave(newActivity);
        onClose();
    };

    const renderConditionRow = (c: Condition, list: Condition[], setter: (val: Condition[]) => void) => {
        const isWeather = c.type === 'weather';
        const isAccumulation = isWeather && ['snowAccumulation', 'rainAccumulation'].includes((c as WeatherCondition).parameterId);

        // Helper valid for current parameter in loop
        const currentBounds = isWeather ? getBounds((c as WeatherCondition).parameterId) : { min: 0, max: 100 };

        return (
            <div key={c.id} style={{
                marginBottom: '8px',
                padding: '12px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: '1px solid #333'
            }}>
                {/* Header: Type Selector & Delete */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Type Toggle */}
                        <select
                            value={c.type}
                            onChange={(e) => {
                                // Switching types resets data structure
                                const newType = e.target.value as 'weather' | 'time';
                                if (newType === 'weather') {
                                    updateCondition(list, setter, c.id, {
                                        type: 'weather',
                                        parameterId: 'temperature',
                                        operator: '>',
                                        value: getDefaultValue('temperature'),
                                        value2: undefined,
                                        days: undefined, startHour: undefined, endHour: undefined, subType: undefined // clear time props
                                    } as any);
                                } else {
                                    updateCondition(list, setter, c.id, {
                                        type: 'time',
                                        subType: 'range',
                                        days: 'all',
                                        startHour: 9,
                                        endHour: 17,
                                        parameterId: undefined, operator: undefined, value: undefined // clear weather props
                                    } as any);
                                }
                            }}
                            style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                background: '#222',
                                color: '#ccc',
                                border: '1px solid #444',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="weather">Environment</option>
                            <option value="time">Time</option>
                        </select>

                        {/* Secondary Selector based on Type */}
                        {isWeather ? (
                            <select
                                value={(c as WeatherCondition).parameterId}
                                onChange={(e) => {
                                    const pid = e.target.value as WeatherParameter;
                                    updateCondition(list, setter, c.id, {
                                        parameterId: pid,
                                        value: getDefaultValue(pid) // Auto-set default
                                    });
                                }}
                                style={{ padding: '6px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555', fontWeight: 600 }}
                            >
                                {PARAMETERS.map(p => (
                                    <option key={p.id} value={p.id}>{p.label}</option>
                                ))}
                            </select>
                        ) : (
                            <select
                                value={(c as TimeCondition).subType}
                                onChange={(e) => updateCondition(list, setter, c.id, { subType: e.target.value as 'range' | 'event' | 'daylight' })}
                                style={{ padding: '6px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555', fontWeight: 600 }}
                            >
                                <option value="range">Clock Time</option>
                                <option value="event">Event-Based</option>
                                <option value="daylight">Daylight</option>
                            </select>
                        )}
                    </div>

                    <button
                        onClick={() => removeCondition(list, setter, c.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                {/* Body: Inputs */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {isWeather ? (
                        <>
                            {/* Operator */}
                            <select
                                value={(c as WeatherCondition).operator}
                                onChange={(e) => updateCondition(list, setter, c.id, { operator: e.target.value as Operator })}
                                style={{ padding: '6px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555', flex: 1 }}
                            >
                                <option value=">">Greater than</option>
                                <option value="<">Less than</option>
                                <option value="between">Between</option>
                                <option value="==">Equals</option>
                            </select>

                            {/* Value 1 */}
                            <div style={{ position: 'relative', flex: 1 }}>
                                <input
                                    type="number"
                                    min={currentBounds.min}
                                    max={currentBounds.max}
                                    value={(c as WeatherCondition).value}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        updateCondition(list, setter, c.id, { value: val === '' ? '' : parseFloat(val) });
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    style={{ width: '100%', padding: '6px', paddingRight: '24px', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}
                                />
                                <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: '0.8rem', pointerEvents: 'none' }}>
                                    {getUnitLabel((c as WeatherCondition).parameterId)}
                                </span>
                            </div>

                            {/* Value 2 (Between) */}
                            {(c as WeatherCondition).operator === 'between' && (
                                <>
                                    <span style={{ color: '#888' }}>&</span>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <input
                                            type="number"
                                            min={currentBounds.min}
                                            max={currentBounds.max}
                                            value={(c as WeatherCondition).value2 || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                updateCondition(list, setter, c.id, { value2: val === '' ? '' : parseFloat(val) });
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            style={{ width: '100%', padding: '6px', paddingRight: '24px', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}
                                        />
                                        <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', color: '#666', fontSize: '0.8rem', pointerEvents: 'none' }}>
                                            {getUnitLabel((c as WeatherCondition).parameterId)}
                                        </span>
                                    </div>
                                </>
                            )}

                            {/* Duration for Accumulation */}
                            {isAccumulation && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', width: '100%' }}>
                                    <span style={{ color: '#aaa', fontSize: '0.9rem' }}>over the last</span>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="number" min="0"
                                            value={(c as WeatherCondition).duration || 1}
                                            onChange={(e) => updateCondition(list, setter, c.id, { duration: parseFloat(e.target.value) })}
                                            onFocus={(e) => e.target.select()}
                                            style={{ width: '60px', padding: '6px', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}
                                        />
                                    </div>
                                    <span style={{ color: '#aaa', fontSize: '0.9rem' }}>hours</span>
                                </div>
                            )}
                        </>
                    ) : (
                        // Time Inputs
                        (c as TimeCondition).subType === 'range' ? (
                            <>
                                <select
                                    value={(c as TimeCondition).days}
                                    onChange={(e) => updateCondition(list, setter, c.id, { days: e.target.value as DayType })}
                                    style={{ padding: '6px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' }}
                                >
                                    <option value="all">Every Day</option>
                                    <option value="weekdays">Weekdays</option>
                                    <option value="weekends">Weekends</option>
                                </select>
                                <select
                                    value={(c as TimeCondition).rangeOperator || 'inside'}
                                    onChange={(e) => updateCondition(list, setter, c.id, { rangeOperator: e.target.value as 'inside' | 'outside' })}
                                    style={{ padding: '6px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' }}
                                >
                                    <option value="inside">between</option>
                                    <option value="outside">outside</option>
                                </select>
                                <input
                                    type="number" min="0" max="23"
                                    value={(c as TimeCondition).startHour}
                                    onChange={(e) => updateCondition(list, setter, c.id, { startHour: parseInt(e.target.value) })}
                                    style={{ width: '50px', padding: '6px', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}
                                />
                                <span style={{ color: '#888' }}>to</span>
                                <input
                                    type="number" min="0" max="23"
                                    value={(c as TimeCondition).endHour}
                                    onChange={(e) => updateCondition(list, setter, c.id, { endHour: parseInt(e.target.value) })}
                                    style={{ width: '50px', padding: '6px', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}
                                />
                                <span style={{ color: '#666', fontSize: '0.8rem' }}>24h</span>
                            </>
                        ) : (c as TimeCondition).subType === 'daylight' ? (
                            <>
                                <select
                                    value={(c as TimeCondition).daylightMode || 'day'}
                                    onChange={(e) => updateCondition(list, setter, c.id, { daylightMode: e.target.value as 'day' | 'night' })}
                                    style={{ padding: '6px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555', flex: 1 }}
                                >
                                    <option value="day">Day Time</option>
                                    <option value="night">Night Time</option>
                                </select>
                                <span style={{ color: '#888' }}>+/-</span>
                                <input
                                    type="number" min="-6" max="6"
                                    value={(c as TimeCondition).offsetHours ?? 0}
                                    onChange={(e) => updateCondition(list, setter, c.id, { offsetHours: parseFloat(e.target.value) })}
                                    style={{ width: '50px', padding: '6px', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}
                                />
                                <span style={{ color: '#666', fontSize: '0.8rem' }}>hours buffer</span>
                            </>
                        ) : (
                            <>
                                {/* Event */}
                                <select
                                    value={(c as TimeCondition).event}
                                    onChange={(e) => updateCondition(list, setter, c.id, { event: e.target.value as ReferenceEvent })}
                                    style={{ padding: '6px', borderRadius: '4px', background: '#333', color: '#fff', border: '1px solid #555' }}
                                >
                                    <option value="sunrise">Sunrise</option>
                                    <option value="sunset">Sunset</option>
                                    <option value="moonrise">Moonrise</option>
                                    <option value="moonset">Moonset</option>
                                </select>
                                <span style={{ color: '#888' }}>+/-</span>
                                <input
                                    type="number"
                                    value={(c as TimeCondition).offsetHours || 1}
                                    onChange={(e) => updateCondition(list, setter, c.id, { offsetHours: parseFloat(e.target.value) })}
                                    style={{ width: '50px', padding: '6px', borderRadius: '4px', background: '#222', color: '#fff', border: '1px solid #444' }}
                                />
                                <span style={{ color: '#666', fontSize: '0.8rem' }}>hours</span>
                            </>
                        )
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
        }}>
            <div style={{
                width: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                background: '#18181b', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Emoji Picker Button */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                style={{
                                    width: '40px', height: '40px', fontSize: '24px',
                                    background: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                {icon}
                            </button>
                            {showEmojiPicker && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, marginTop: '8px',
                                    zIndex: 3100, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                                }}>
                                    <EmojiPicker
                                        theme={'dark' as any}
                                        onEmojiClick={(data) => {
                                            setIcon(data.emoji);
                                            setShowEmojiPicker(false);
                                        }}
                                        width={350}
                                        height={400}
                                    />
                                </div>
                            )}
                        </div>

                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{ fontSize: '1.25rem', fontWeight: 'bold', background: 'transparent', border: 'none', color: '#fff', outline: 'none' }}
                            placeholder="Activity Name"
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={() => setShowInfo(!showInfo)}
                            style={{ color: showInfo ? '#3b82f6' : '#888', background: 'none', border: 'none', cursor: 'pointer' }}
                            title="Scoring Info"
                        >
                            <Info size={20} />
                        </button>
                        <button onClick={onClose} style={{ color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
                    </div>
                </div>

                {/* Location Selector (New) */}
                <div style={{ padding: '0 20px', marginBottom: '0', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #333', background: '#1c1c1f', zIndex: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#aaa', fontSize: '0.9rem', padding: '12px 0' }}>
                        <MapPin size={16} />
                        <span>Analysis Location <span style={{ fontSize: '0.8em', opacity: 0.7 }}>(for calendar sync)</span>:</span>
                    </div>
                    <div style={{ transform: 'scale(1)', transformOrigin: 'left center' }}>
                        <LocationSearch
                            currentLocationName={location.name}
                            onLocationSelect={setLocation}
                        />
                    </div>
                </div>

                {/* Info Panel Overlay */}
                {showInfo && (
                    <div style={{ background: '#27272a', padding: '16px', borderBottom: '1px solid #333', fontSize: '0.9rem', color: '#ccc', lineHeight: '1.5' }}>
                        <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '8px' }}>How Scoring Works</h4>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                            <div style={{ width: '16px', height: '16px', border: '1px solid #444', background: 'transparent' }}></div>
                            <span><strong>Empty (Black)</strong>: Failed a Deal Breaker. Not a valid time.</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                            <div style={{ width: '16px', height: '16px', background: '#f97316' }}></div>
                            <span><strong>Orange</strong>: Viable, but meets few "Nice to Haves".</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                            <div style={{ width: '16px', height: '16px', background: '#eab308' }}></div>
                            <span><strong>Yellow</strong>: Good! Meets most "Nice to Haves".</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '0', alignItems: 'center' }}>
                            <div style={{ width: '16px', height: '16px', background: '#10b981' }}></div>
                            <span><strong>Green</strong>: Ideal! Meets all "Nice to Haves".</span>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

                    {/* Deal Breakers */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ef4444' }}>Deal Breakers</h3>
                            <button
                                onClick={() => addCondition(dealBreakers, setDealBreakers)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                            >
                                <Plus size={14} /> Add Rule
                            </button>
                        </div>
                        {dealBreakers.length === 0 ? (
                            <div style={{ padding: '16px', border: '1px dashed #333', borderRadius: '8px', color: '#555', textAlign: 'center', fontSize: '0.9rem' }}>
                                Not a valid time if any of these fail.
                            </div>
                        ) : (
                            dealBreakers.map(c => renderConditionRow(c, dealBreakers, setDealBreakers))
                        )}
                    </div>

                    {/* Nice to Haves */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#22c55e' }}>Nice to Haves</h3>
                            <button
                                onClick={() => addCondition(niceToHaves, setNiceToHaves)}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                            >
                                <Plus size={14} /> Add Rule
                            </button>
                        </div>
                        {niceToHaves.length === 0 ? (
                            <div style={{ padding: '16px', border: '1px dashed #333', borderRadius: '8px', color: '#555', textAlign: 'center', fontSize: '0.9rem' }}>
                                Result is GREENER the more of these pass.
                            </div>
                        ) : (
                            niceToHaves.map(c => renderConditionRow(c, niceToHaves, setNiceToHaves))
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div style={{ padding: '20px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', background: 'transparent', color: '#888', border: '1px solid #333', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} style={{ padding: '8px 20px', borderRadius: '6px', background: '#fff', color: '#000', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <Save size={16} /> Save Activity
                    </button>
                </div>
            </div>
        </div>
    );
};
