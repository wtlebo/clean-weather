import React, { useRef, useEffect } from 'react';
import './TimelineContainer.css';

interface TimelineContainerProps {
    children: React.ReactNode;
    hours?: number; // Total hours to display (default 240 for 10 days)
    hourWidth?: number; // Width in px per hour (default 60)
    startHourOffset?: number; // Hours before "now" to start (default 120 for 5 days)
    selectedIndex: number | null;
    onTimeSelect: (index: number) => void;
    axisWidth?: number; // Width of the sticky axis column
    nowIndex?: number; // The calculated "Now" index for initial scrolling
}

export const TimelineContainer: React.FC<TimelineContainerProps> = ({
    children,
    hours = 240,
    hourWidth = 60,
    startHourOffset = 120,
    selectedIndex,
    onTimeSelect,
    axisWidth = 32,
    nowIndex
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const totalWidth = hours * hourWidth + axisWidth; // Add axis width to total

    // Scroll to "Now" on mount
    useEffect(() => {
        if (scrollRef.current) {
            // If nowIndex is provided (dynamic), use it. Otherwise fall back to startHourOffset.
            // We want to see 3 hours of past data, so we scroll to "Now - 3h".
            const targetIndex = nowIndex !== undefined ? nowIndex : startHourOffset;
            const hoursFromStartToView = Math.max(0, targetIndex - 3);
            const scrollPos = hoursFromStartToView * hourWidth;
            scrollRef.current.scrollLeft = scrollPos;
        }
    }, [hourWidth, startHourOffset, nowIndex]);

    const isDragging = useRef(false);
    const startX = useRef(0);
    const startY = useRef(0);

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = false;
        startX.current = e.clientX;
        startY.current = e.clientY;
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging.current) return;
        const dist = Math.sqrt(
            Math.pow(e.clientX - startX.current, 2) + Math.pow(e.clientY - startY.current, 2)
        );
        if (dist > 5) { // 5px threshold
            isDragging.current = true;
        }
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isDragging.current) return;

        // Calculate index based on click X
        const contentRect = e.currentTarget.getBoundingClientRect();
        const absoluteX = e.clientX - contentRect.left;

        // Subtract axis width to get data-relative X
        const dataX = absoluteX - axisWidth;

        // Ignore clicks on the axis itself
        if (dataX < 0) return;

        const index = Math.floor(dataX / hourWidth);
        if (index >= 0 && index < hours) {
            // Fuzzy Dismissal: If clicking within +/- 3 hours of selection, clear it.
            // We achieve this by passing the *current* selectedIndex, which triggers the toggle-off in App.tsx.
            if (selectedIndex !== null && Math.abs(index - selectedIndex) <= 3) {
                onTimeSelect(selectedIndex);
            } else {
                onTimeSelect(index);
            }
        }
    };

    return (
        <div
            className="timeline-scroll-wrapper"
            ref={scrollRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
        >
            <div
                className="timeline-content"
                style={{ width: `${totalWidth}px` }}
                onClick={handleClick}
            >
                {/* Global Selection Line */}
                {selectedIndex !== null && (
                    <div
                        className="selection-line"
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${axisWidth + (selectedIndex * hourWidth) + (hourWidth / 2)}px`,
                            width: '1px',
                            backgroundColor: '#aaa', // Grey
                            zIndex: 60, // Above "Now" line (50) and content
                            pointerEvents: 'none'
                        }}
                    />
                )}

                {children}
            </div>
        </div>
    );
};
