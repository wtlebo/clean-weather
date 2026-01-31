
import React from 'react';
import { X, Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import type { Activity } from '../../types/activity';

interface ActivityManagerProps {
    activities: Activity[];
    onClose: () => void;
    onEdit: (activity: Activity) => void;
    onDelete: (id: string) => void;
    onCreate: () => void;
    onReorder: (activities: Activity[]) => void;
    isPremium: boolean;
    onSync: () => void;
    isSyncing: boolean;
    userId?: string;
}

export const ActivityManager: React.FC<ActivityManagerProps> = ({ activities, onClose, onEdit, onDelete, onCreate, onReorder, isPremium, onSync, isSyncing, userId }) => {

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
        }}>
            <div style={{
                width: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
                background: '#18181b', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                {/* Header */}
                <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#fff' }}>My Activities</h2>
                    <button onClick={onClose} style={{ color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
                </div>

                {/* List */}
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activities.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                            No activities yet. Create one to get started!
                        </div>
                    ) : (
                        activities.map((activity, index) => (
                            <div
                                key={activity.id}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', index.toString());
                                    e.dataTransfer.effectAllowed = 'move';
                                    // Optional: Add styling
                                    e.currentTarget.style.opacity = '0.5';
                                }}
                                onDragEnd={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault(); // Necessary to allow dropping
                                    e.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                    const toIndex = index;

                                    if (fromIndex !== toIndex) {
                                        const newActivities = [...activities];
                                        const [movedItem] = newActivities.splice(fromIndex, 1);
                                        newActivities.splice(toIndex, 0, movedItem);
                                        onReorder(newActivities);
                                    }
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: '#27272a', padding: '12px 16px', borderRadius: '8px', border: '1px solid #3f3f46',
                                    cursor: 'move'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ color: '#52525b', display: 'flex', alignItems: 'center' }}>
                                        <GripVertical size={20} />
                                    </div>
                                    <span style={{ fontSize: '1.5rem' }}>{activity.icon}</span>
                                    <span style={{ fontSize: '1rem', fontWeight: 500, color: '#fff' }}>{activity.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(activity); }}
                                        style={{ background: '#3f3f46', border: 'none', color: '#fff', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                                        title="Edit"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Delete "${activity.name}" ? `)) onDelete(activity.id);
                                        }}
                                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {/* Limit Logic */}
                    {/* Free: Max 1. Premium: Max 10. */}
                    {(!isPremium && activities.length >= 1) || (isPremium && activities.length >= 10) ? (
                        <div style={{ textAlign: 'center' }}>
                            <button
                                disabled
                                style={{
                                    width: '100%',
                                    background: '#333',
                                    color: '#888',
                                    border: 'none',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    cursor: 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    opacity: 0.7
                                }}
                            >
                                <Plus /> Create New Activity
                            </button>
                            <p style={{ color: '#eab308', marginTop: '12px', fontSize: '0.9rem', margin: '12px 0 0 0' }}>
                                {!isPremium ? (
                                    <>
                                        Free tier is limited to 1 activity.
                                        <br />
                                        <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>(Upgrade to Pro for more!)</span>
                                    </>
                                ) : (
                                    <>
                                        Maximum of 10 activities reached.
                                    </>
                                )}
                            </p>
                        </div>
                    ) : (
                        <button
                            onClick={onCreate}
                            style={{
                                width: '100%',
                                background: '#10b981', // Emerald 500
                                color: '#fff',
                                border: 'none',
                                padding: '12px',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                        >
                            <Plus /> Create New Activity
                        </button>
                    )}

                    {/* Sync Button */}
                    {activities.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button
                                onClick={onSync}
                                disabled={isSyncing}
                                style={{
                                    width: '100%',
                                    background: '#222',
                                    color: isSyncing ? '#666' : '#bbb',
                                    border: '1px solid #333',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                {isSyncing ? 'Syncing...' : '📅 Sync to Google Calendar'}
                            </button>
                            <button
                                onClick={() => {
                                    if (!userId) {
                                        alert("Please sign in to subscribe (Settings -> Sign In)");
                                        return;
                                    }
                                    // Determine Environment for Pretty URL
                                    const isProd = window.location.hostname === 'theidealtime.com';
                                    const isStaging = window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com');

                                    let url = `https://us-central1-the-ideal-time.cloudfunctions.net/calendarFeed?userId=${userId}`;
                                    if (isProd || isStaging) {
                                        url = `${window.location.origin}/IdealTime.ics?userId=${userId}`;
                                    }

                                    const webcal = url.replace('https://', 'webcal://').replace('http://', 'webcal://');

                                    // Copy to clipboard
                                    navigator.clipboard.writeText(url).then(() => {
                                        if (confirm(`Calendar Feed URL copied to clipboard!\n\nOpen your calendar app (Apple/Outlook/Google) and select "Subscribe to URL".\n\nClick OK to try opening automatically.`)) {
                                            window.open(webcal, '_self');
                                        }
                                    });
                                }}
                                style={{
                                    width: '100%',
                                    background: '#222',
                                    color: '#bbb',
                                    border: '1px solid #333',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                🔗 Subscribe (Google/Apple/Outlook)
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
