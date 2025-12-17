import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
    className?: string;
    style?: React.CSSProperties;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ className, style }) => {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        const url = window.location.href;

        // Try native share
        if (navigator.share && /mobile/i.test(navigator.userAgent)) {
            try {
                await navigator.share({
                    title: 'Weather Plot',
                    text: 'Check out the weather on Weather Plot',
                    url: url
                });
                return;
            } catch (err) {
                // User cancelled or not supported, fall through to clipboard
                console.log('Share error or cancel:', err);
            }
        }

        // Fallback to clipboard
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    return (
        <button
            className={`icon-button ${className || ''}`}
            onClick={handleShare}
            style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: copied ? '#4ade80' : '#888',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                ...style
            }}
            onMouseEnter={(e) => {
                if (!copied) e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
                if (!copied) e.currentTarget.style.color = '#888';
            }}
            title="Share View"
        >
            {copied ? <Check size={18} /> : <Share2 size={18} />}
        </button>
    );
};
