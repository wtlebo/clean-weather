import React from 'react';
import type { AppSettings } from '../types/settings';
import { X, ArrowUp, ArrowDown } from 'lucide-react';

interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
    settings: AppSettings;
    onUpdate: (newSettings: AppSettings) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose, settings, onUpdate }) => {
    if (!open) return null;

    const handleUnitChange = (unit: 'imperial' | 'metric') => {
        onUpdate({ ...settings, units: unit });
    };

    const toggleChartVisibility = (index: number) => {
        const newOrder = [...settings.chartOrder];
        newOrder[index] = { ...newOrder[index], visible: !newOrder[index].visible };
        onUpdate({ ...settings, chartOrder: newOrder });
    };

    const moveChart = (index: number, direction: -1 | 1) => {
        const newOrder = [...settings.chartOrder];
        if (index + direction < 0 || index + direction >= newOrder.length) return;

        const temp = newOrder[index];
        newOrder[index] = newOrder[index + direction];
        newOrder[index + direction] = temp;

        onUpdate({ ...settings, chartOrder: newOrder });
    };

    const handleTempToggle = (key: keyof typeof settings.temp) => {
        onUpdate({
            ...settings,
            temp: { ...settings.temp, [key]: !settings.temp[key] }
        });
    };

    const handlePrecipToggle = (key: keyof typeof settings.precip) => {
        onUpdate({
            ...settings,
            precip: { ...settings.precip, [key]: !settings.precip[key] }
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '12px',
                width: '90%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto',
                border: '1px solid #333', color: '#fff'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Settings</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Units Section */}
                <section style={{ marginBottom: '25px' }}>
                    <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>Units</h3>
                    <div style={{ display: 'flex', gap: '10px', background: '#222', padding: '4px', borderRadius: '8px' }}>
                        {['imperial', 'metric'].map((u) => (
                            <button
                                key={u}
                                onClick={() => handleUnitChange(u as any)}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: settings.units === u ? '#2196f3' : 'transparent',
                                    color: settings.units === u ? '#fff' : '#888',
                                    fontWeight: settings.units === u ? 'bold' : 'normal',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {u}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Chart Order & Visibility */}
                <section style={{ marginBottom: '25px' }}>
                    <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>Charts (Order & Visibility)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {settings.chartOrder.map((chart, index) => (
                            <div key={chart.id} style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                background: '#222', padding: '10px', borderRadius: '8px',
                                border: !chart.visible ? '1px solid #333' : '1px solid transparent',
                                opacity: chart.visible ? 1 : 0.6
                            }}>
                                <input
                                    type="checkbox"
                                    checked={chart.visible}
                                    onChange={() => toggleChartVisibility(index)}
                                    style={{ width: '18px', height: '18px', accentColor: '#2196f3', cursor: 'pointer' }}
                                />
                                <span style={{ flex: 1, fontWeight: 500 }}>{chart.label}</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={() => moveChart(index, -1)}
                                        disabled={index === 0}
                                        style={{ background: '#333', border: 'none', color: index === 0 ? '#555' : '#fff', borderRadius: '4px', padding: '4px', cursor: index === 0 ? 'default' : 'pointer' }}
                                    >
                                        <ArrowUp size={16} />
                                    </button>
                                    <button
                                        onClick={() => moveChart(index, 1)}
                                        disabled={index === settings.chartOrder.length - 1}
                                        style={{ background: '#333', border: 'none', color: index === settings.chartOrder.length - 1 ? '#555' : '#fff', borderRadius: '4px', padding: '4px', cursor: index === settings.chartOrder.length - 1 ? 'default' : 'pointer' }}
                                    >
                                        <ArrowDown size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Detailed Options */}
                <section>
                    <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>Chart Details</h3>

                    <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ fontSize: '0.85rem', color: '#aaa', margin: '0 0 8px 0' }}>Temperature</h4>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: '#222', borderRadius: '8px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={settings.temp.showFeelsLike} onChange={() => handleTempToggle('showFeelsLike')} style={{ width: '16px', height: '16px', accentColor: '#2196f3' }} />
                            <span style={{ fontSize: '0.9rem' }}>Show "Feels Like"</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: '#222', borderRadius: '8px', cursor: 'pointer', marginTop: '8px' }}>
                            <input type="checkbox" checked={settings.temp.showDewPoint} onChange={() => handleTempToggle('showDewPoint')} style={{ width: '16px', height: '16px', accentColor: '#2196f3' }} />
                            <span style={{ fontSize: '0.9rem' }}>Show Dew Point</span>
                        </label>
                    </div>

                    <div>
                        <h4 style={{ fontSize: '0.85rem', color: '#aaa', margin: '0 0 8px 0' }}>Precipitation</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: '#222', borderRadius: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={settings.precip.showHumidity} onChange={() => handlePrecipToggle('showHumidity')} style={{ width: '16px', height: '16px', accentColor: '#2196f3' }} />
                                <span style={{ fontSize: '0.9rem' }}>Show Humidity</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: '#222', borderRadius: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={settings.precip.showAmount} onChange={() => handlePrecipToggle('showAmount')} style={{ width: '16px', height: '16px', accentColor: '#2196f3' }} />
                                <span style={{ fontSize: '0.9rem' }}>Show Precip Amount</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: '#222', borderRadius: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={settings.precip.showThunder} onChange={() => handlePrecipToggle('showThunder')} style={{ width: '16px', height: '16px', accentColor: '#2196f3' }} />
                                <span style={{ fontSize: '0.9rem' }}>Show Thunder Probability</span>
                            </label>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
};
