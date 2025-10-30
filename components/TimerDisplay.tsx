import React, { useMemo } from 'react';
import { Mode } from '../types';

interface TimerDisplayProps {
    timeRemaining: number;
    totalTime: number;
    isRunning: boolean;
    mode: Mode;
    isStopwatchMode: boolean;
    timeForProgress: number;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ timeRemaining, totalTime, isRunning, mode, isStopwatchMode, timeForProgress }) => {
    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');

    const progress = useMemo(() => {
        if (totalTime === Infinity || totalTime <= 0) return 0;
        
        if (isStopwatchMode) {
            // For stopwatch, progress is how far into the current chunk we are.
            return totalTime > 0 ? Math.min(1, timeForProgress / totalTime) : 0;
        } else {
            // For countdown, it's how much time has passed from the total.
            return totalTime > 0 ? Math.min(1, (totalTime - timeForProgress) / totalTime) : 0;
        }
    }, [timeForProgress, totalTime, isStopwatchMode]);

    const radius = 85;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - progress * circumference;

    const isFocus = mode === 'focus';
    const theme = {
        bgCircle: 'text-slate-700/50',
        progressCircle: isFocus ? 'text-teal-400' : 'text-purple-400',
        text: 'text-slate-100',
        textShadow: isFocus ? '0 0 20px rgba(45, 212, 191, 0.4)' : '0 0 20px rgba(167, 139, 250, 0.4)',
        glowColor: isFocus ? 'rgba(45, 212, 191, 0.5)' : 'rgba(167, 139, 250, 0.5)',
    };

    return (
        <div className="relative h-52 sm:h-64 flex items-center justify-center mb-6">
            <svg
                className={`absolute w-52 h-52 sm:w-64 sm:h-64 transition-transform duration-500 ${isRunning ? 'timer-running scale-105' : 'scale-100'}`}
                viewBox="0 0 180 180"
                style={{ '--glow-color': theme.glowColor } as React.CSSProperties}
            >
                {/* Background circle */}
                <circle
                    className={theme.bgCircle}
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    r={radius}
                    cx="90"
                    cy="90"
                />
                {/* Progress circle */}
                <circle
                    className={theme.progressCircle}
                    stroke="currentColor"
                    strokeWidth="10"
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
                        transition: 'stroke-dashoffset 0.35s linear'
                    }}
                />
            </svg>
            <div className={`text-7xl sm:text-8xl font-light ${theme.text} tracking-wider`} style={{ fontVariantNumeric: 'tabular-nums', textShadow: theme.textShadow }}>
                {minutes}:{seconds}
            </div>
            {/* Style tag for dynamic animation class */}
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% {
                        filter: drop-shadow(0 0 8px var(--glow-color, transparent));
                    }
                    50% {
                        filter: drop-shadow(0 0 16px var(--glow-color, transparent));
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