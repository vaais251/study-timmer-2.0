import React, { useMemo } from 'react';
import { Mode } from '../types';

interface TimerDisplayProps {
    timeRemaining: number;
    totalTime: number;
    isRunning: boolean;
    mode: Mode;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ timeRemaining, totalTime, isRunning, mode }) => {
    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');

    const progress = useMemo(() => {
        // Prevent progress from going over 100% if time dips slightly below 0 before stopping
        return totalTime > 0 ? Math.min(1, (totalTime - timeRemaining) / totalTime) : 0;
    }, [timeRemaining, totalTime]);

    const radius = 85;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - progress * circumference;

    const isFocus = mode === 'focus';
    const theme = {
        bgCircle: isFocus ? 'text-white/20' : 'text-slate-800/20',
        progressCircle: isFocus ? 'text-white' : 'text-slate-800',
        text: isFocus ? 'text-white' : 'text-slate-800',
        textShadow: isFocus ? '0 0 15px rgba(255, 255, 255, 0.3)' : 'none',
        glowColor: isFocus ? 'rgba(255, 255, 255, 0.5)' : 'rgba(40, 40, 40, 0.4)'
    };

    return (
        <div className="relative h-48 sm:h-56 flex items-center justify-center mb-6">
            <svg
                className={`absolute w-48 h-48 sm:w-56 sm:h-56 ${isRunning ? 'timer-running' : ''}`}
                viewBox="0 0 180 180"
                style={{ '--glow-color': theme.glowColor } as React.CSSProperties}
            >
                {/* Background circle */}
                <circle
                    className={theme.bgCircle}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    r={radius}
                    cx="90"
                    cy="90"
                />
                {/* Progress circle */}
                <circle
                    className={theme.progressCircle}
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx="90"
                    cy="90"
                    style={{
                        transform: 'rotate(-90deg)',
                        transformOrigin: '50% 50%',
                        transition: 'stroke-dashoffset 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                />
            </svg>
            <div className={`text-7xl sm:text-8xl font-thin ${theme.text} tracking-wider`} style={{ fontVariantNumeric: 'tabular-nums', textShadow: theme.textShadow }}>
                {minutes}:{seconds}
            </div>
            {/* Style tag for dynamic animation class */}
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% {
                        filter: drop-shadow(0 0 10px var(--glow-color, rgba(255, 255, 255, 0.3)));
                    }
                    50% {
                        filter: drop-shadow(0 0 20px var(--glow-color, rgba(255, 255, 255, 0.5)));
                    }
                }
                .timer-running {
                    animation: pulse-glow 2.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default TimerDisplay;