import React from 'react';
import type { AppSettings } from '../types/settings';
import { X, GripVertical } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
    settings: AppSettings;
    onUpdate: (newSettings: AppSettings) => void;
}

// Sortable Item Component
function SortableChartItem({ chart, index, onToggle }: { chart: any, index: number, onToggle: (index: number) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: chart.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: isDragging ? '#333' : '#222', // Visual feedback
        padding: '10px',
        borderRadius: '8px',
        border: !chart.visible ? '1px solid #333' : '1px solid transparent',
        opacity: chart.visible ? 1 : 0.6,
        marginBottom: '8px',
        zIndex: isDragging ? 999 : 'auto',
        position: isDragging ? 'relative' as const : 'static' as const,
        touchAction: 'none' // Important for touch dragging
    };

    return (
        <div ref={setNodeRef} style={style}>
            {/* Drag Handle */}
            <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#666', display: 'flex', alignItems: 'center' }}>
                <GripVertical size={20} />
            </div>

            <input
                type="checkbox"
                checked={chart.visible}
                onChange={() => onToggle(index)}
                style={{ width: '18px', height: '18px', accentColor: '#2196f3', cursor: 'pointer' }}
            />
            <span style={{ flex: 1, fontWeight: 500 }}>{chart.label}</span>
        </div>
    );
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose, settings, onUpdate }) => {
    if (!open) return null;

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor), // Mouse and Touch
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            const oldIndex = settings.chartOrder.findIndex((c) => c.id === active.id);
            const newIndex = settings.chartOrder.findIndex((c) => c.id === over?.id);

            onUpdate({
                ...settings,
                chartOrder: arrayMove(settings.chartOrder, oldIndex, newIndex)
            });
        }
    };

    const handleUnitChange = (unit: 'imperial' | 'metric') => {
        onUpdate({ ...settings, units: unit });
    };

    const toggleChartVisibility = (index: number) => {
        const newOrder = [...settings.chartOrder];
        newOrder[index] = { ...newOrder[index], visible: !newOrder[index].visible };
        onUpdate({ ...settings, chartOrder: newOrder });
    };

    const handleTempToggle = (key: keyof typeof settings.temp) => {
        onUpdate({
            ...settings,
            temp: { ...settings.temp, [key]: !settings.temp[key] }
        });
    };

    const handlePrecipToggle = (key: keyof typeof settings.precip) => {
        const newValue = !settings.precip[key];
        let newPrecipSettings = { ...settings.precip, [key]: newValue };

        // If disabling Amount, also disable Accumulation
        if (key === 'showAmount' && !newValue) {
            newPrecipSettings.showAccumulation = false;
        }

        onUpdate({
            ...settings,
            precip: newPrecipSettings
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000,
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
                    <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>
                        Charts (Drag to Reorder)
                    </h3>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={settings.chartOrder.map(c => c.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {settings.chartOrder.map((chart, index) => (
                                    <SortableChartItem
                                        key={chart.id}
                                        chart={chart}
                                        index={index}
                                        onToggle={toggleChartVisibility}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
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
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: '#222', borderRadius: '8px', cursor: 'pointer', marginTop: '8px' }}>
                            <input type="checkbox" checked={settings.temp.showDailyHighLow} onChange={() => handleTempToggle('showDailyHighLow')} style={{ width: '16px', height: '16px', accentColor: '#2196f3' }} />
                            <span style={{ fontSize: '0.9rem' }}>Show Daily High/Low</span>
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
                            <label style={{
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: '#222', borderRadius: '8px',
                                cursor: settings.precip.showAmount ? 'pointer' : 'not-allowed',
                                opacity: settings.precip.showAmount ? 1 : 0.5
                            }}>
                                <input
                                    type="checkbox"
                                    checked={settings.precip.showAccumulation}
                                    onChange={() => handlePrecipToggle('showAccumulation')}
                                    disabled={!settings.precip.showAmount}
                                    style={{ width: '16px', height: '16px', accentColor: '#2196f3' }}
                                />
                                <span style={{ fontSize: '0.9rem' }}>Show Accumulation Totals</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: '#222', borderRadius: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={settings.precip.showThunder} onChange={() => handlePrecipToggle('showThunder')} style={{ width: '16px', height: '16px', accentColor: '#2196f3' }} />
                                <span style={{ fontSize: '0.9rem' }}>Show Thunder Probability</span>
                            </label>
                        </div>
                    </div>



                    <div style={{ marginTop: '15px' }}>
                        <h4 style={{ fontSize: '0.85rem', color: '#aaa', margin: '0 0 8px 0' }}>Tides</h4>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: '#222', borderRadius: '8px', cursor: 'pointer' }}>
                            <input type="checkbox"
                                checked={settings.tide?.showHighLow ?? true}
                                onChange={() => onUpdate({ ...settings, tide: { ...settings.tide, showHighLow: !settings.tide.showHighLow } })}
                                style={{ width: '16px', height: '16px', accentColor: '#2196f3' }}
                            />
                            <span style={{ fontSize: '0.9rem' }}>Show High/Low Markers</span>
                        </label>
                    </div>
                </section>

            </div>
        </div>
    );
};
