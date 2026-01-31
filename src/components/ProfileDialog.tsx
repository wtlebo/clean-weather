import React from 'react';
import { X, Crown, User, Settings as SettingsIcon, LogOut, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ProfileDialogProps {
    onClose: () => void;
    onOpenSettings: () => void;
    onOpenFeedback: () => void;
}

export const ProfileDialog: React.FC<ProfileDialogProps> = ({ onClose, onOpenSettings, onOpenFeedback }) => {
    const { user, isPremium, togglePremium, logout } = useAuth();

    if (!user) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000
        }}>
            <div style={{
                width: '360px',
                background: '#18181b', // Zinc 900
                border: '1px solid #333',
                borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#27272a' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#fff' }}>Account</h2>
                    <button onClick={onClose} style={{ color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><X size={20} /></button>
                </div>

                {/* User Info */}
                <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: isPremium ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#3f3f46',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '24px', position: 'relative'
                    }}>
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="User" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                        ) : (
                            <User size={32} />
                        )}
                        {isPremium && (
                            <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#000', borderRadius: '50%', padding: '4px', border: '1px solid #333' }}>
                                <Crown size={12} fill="#f59e0b" color="#f59e0b" />
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '1.1rem' }}>{user.displayName || 'User'}</div>
                        <div style={{ color: '#888', fontSize: '0.9rem' }}>{user.email}</div>
                    </div>

                    <div style={{
                        background: isPremium ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        color: isPremium ? '#fbbf24' : '#a1a1aa',
                        padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 500,
                        marginTop: '4px', border: isPremium ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #3f3f46'
                    }}>
                        {isPremium ? 'PRO PLAN' : 'FREE PLAN'}
                    </div>
                </div>

                {/* Actions List */}
                <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Mock Upgrade Toggle */}
                    <button
                        onClick={togglePremium}
                        style={{
                            width: '100%',
                            background: isPremium ? '#27272a' : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            border: isPremium ? '1px solid #333' : 'none',
                            padding: '12px',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            marginBottom: '12px'
                        }}
                    >
                        {isPremium ? (
                            'Downgrade to Free'
                        ) : (
                            <>
                                <Crown size={18} /> Upgrade to Pro
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => { onClose(); onOpenSettings(); }}
                        className="profile-action-btn"
                        style={{
                            background: 'transparent', color: '#e4e4e7', border: 'none', padding: '12px',
                            borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                            textAlign: 'left', fontSize: '0.95rem', transition: 'background 0.2s'
                        }}
                    >
                        <SettingsIcon size={20} color="#a1a1aa" /> App Settings
                    </button>

                    <button
                        onClick={onOpenFeedback}
                        className="profile-action-btn"
                        style={{
                            background: 'transparent', color: '#e4e4e7', border: 'none', padding: '12px',
                            borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                            textAlign: 'left', fontSize: '0.95rem', transition: 'background 0.2s'
                        }}
                    >
                        <MessageSquare size={20} color="#a1a1aa" /> Send Feedback
                    </button>

                    <button
                        onClick={() => { onClose(); logout(); }}
                        className="profile-action-btn"
                        style={{
                            background: 'transparent', color: '#ef4444', border: 'none', padding: '12px',
                            borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                            textAlign: 'left', fontSize: '0.95rem', transition: 'background 0.2s', marginTop: '8px',
                            borderTop: '1px solid #27272a'
                        }}
                    >
                        <LogOut size={20} color="#ef4444" /> Sign Out
                    </button>
                </div>
            </div>
            <style>{`
        .profile-action-btn:hover { background: #27272a !important; }
      `}</style>
        </div>
    );
};
