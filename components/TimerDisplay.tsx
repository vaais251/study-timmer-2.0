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

    const radius = 100;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - progress * circumference;

    const isFocus = mode === 'focus';
    const theme = {
        bgCircle: 'text-slate-700/50',
        progressCircle: isFocus ? 'text-teal-400' : 'text-purple-400',
        text: 'text-slate-100',
        glowColor: isFocus ? 'rgba(45, 212, 191, 0.5)' : 'rgba(167, 139, 250, 0.5)',
    };

    return (
        <div className="relative h-80 sm:h-96 flex items-center justify-center my-4 animate-float">
            <svg
                className={`absolute w-72 h-72 sm:w-80 sm:h-80 transition-transform duration-500 ${isRunning ? 'timer-running scale-105' : 'scale-100'}`}
                viewBox="0 0 220 220"
                style={{ '--glow-color': theme.glowColor } as React.CSSProperties}
            >
                {/* Background circle */}
                <circle
                    className={theme.bgCircle}
                    stroke="currentColor"
                    strokeWidth="16"
                    fill="transparent"
                    r={radius}
                    cx="110"
                    cy="110"
                />
                {/* Progress circle */}
                <circle
                    className={theme.progressCircle}
                    stroke="currentColor"
                    strokeWidth="16"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx="110"
                    cy="110"
                    style={{
                        transform: 'rotate(-90deg)',
                        transformOrigin: '50% 50%',
                        transition: 'stroke-dashoffset 1s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-lg font-semibold uppercase tracking-widest ${isFocus ? 'text-teal-400' : 'text-purple-400'}`}>
                    {isStopwatchMode && isFocus ? 'Stopwatch' : isFocus ? 'Focus' : 'Break'}
                </div>
                <div className={`relative text-7xl sm:text-8xl font-light tracking-wider ${theme.text} ${isRunning ? (isFocus ? 'timer-text-glow-focus' : 'timer-text-glow-break') : ''}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {minutes}:{seconds}
                </div>
            </div>
        </div>
    );
};

export default TimerDisplay;