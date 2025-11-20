
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
            return totalTime > 0 ? Math.min(1, timeForProgress / totalTime) : 0;
        } else {
            return totalTime > 0 ? Math.min(1, (totalTime - timeForProgress) / totalTime) : 0;
        }
    }, [timeForProgress, totalTime, isStopwatchMode]);

    const radius = 120;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - progress * circumference;

    const isFocus = mode === 'focus';
    
    // Colors
    const strokeColor = isFocus ? '#22d3ee' : '#a78bfa'; // Cyan or Purple
    const glowFilter = isFocus ? 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))' : 'drop-shadow(0 0 8px rgba(167, 139, 250, 0.6))';

    return (
        <div className="relative h-80 sm:h-[400px] flex items-center justify-center my-6">
            {/* Background Pulse */}
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ${isRunning ? 'opacity-100' : 'opacity-0'}`}>
                 <div className={`w-64 h-64 rounded-full blur-[80px] ${isFocus ? 'bg-cyan-500/20' : 'bg-purple-500/20'}`}></div>
            </div>

            <svg
                className={`absolute w-full h-full max-w-[350px] max-h-[350px] transition-transform duration-700 ${isRunning ? 'scale-105' : 'scale-100'}`}
                viewBox="0 0 260 260"
            >
                {/* Track */}
                <circle
                    className="text-white/5"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    r={radius}
                    cx="130"
                    cy="130"
                />
                {/* Progress */}
                <circle
                    stroke={strokeColor}
                    strokeWidth="12"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx="130"
                    cy="130"
                    style={{
                        transform: 'rotate(-90deg)',
                        transformOrigin: '50% 50%',
                        transition: 'stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        filter: isRunning ? glowFilter : 'none'
                    }}
                />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <div className={`mb-2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-black/30 backdrop-blur-sm border border-white/10 ${isFocus ? 'text-cyan-300' : 'text-purple-300'}`}>
                    {isStopwatchMode && isFocus ? 'Stopwatch' : isFocus ? 'Focus Session' : 'Break Time'}
                </div>
                <div className={`text-7xl sm:text-9xl font-bold tabular-nums tracking-tighter transition-all duration-300 ${isRunning ? (isFocus ? 'timer-glow-focus text-white' : 'timer-glow-break text-white') : 'text-slate-300'}`}>
                    {minutes}:{seconds}
                </div>
                <div className="mt-4 text-slate-400 text-sm font-medium">
                    {isRunning ? 'Stay in the zone' : 'Ready to start?'}
                </div>
            </div>
        </div>
    );
};

export default TimerDisplay;
