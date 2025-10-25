import React, { useMemo } from 'react';

interface TimerDisplayProps {
    timeRemaining: number;
    totalTime: number;
    isRunning: boolean;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ timeRemaining, totalTime, isRunning }) => {
    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');

    const progress = useMemo(() => {
        // Prevent progress from going over 100% if time dips slightly below 0 before stopping
        return totalTime > 0 ? Math.min(1, (totalTime - timeRemaining) / totalTime) : 0;
    }, [timeRemaining, totalTime]);

    const radius = 85;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - progress * circumference;

    return (
        <div className="relative h-48 sm:h-56 flex items-center justify-center mb-6">
            <svg
                className={`absolute w-48 h-48 sm:w-56 sm:h-56 ${isRunning ? 'timer-running' : ''}`}
                viewBox="0 0 180 180"
            >
                {/* Background circle */}
                <circle
                    className="text-white/20"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    r={radius}
                    cx="90"
                    cy="90"
                />
                {/* Progress circle */}
                <circle
                    className="text-white"
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
            <div className="text-7xl sm:text-8xl font-thin text-white tracking-wider" style={{ fontVariantNumeric: 'tabular-nums', textShadow: '0 0 15px rgba(255, 255, 255, 0.3)' }}>
                {minutes}:{seconds}
            </div>
            {/* Style tag for dynamic animation class */}
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% {
                        filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
                    }
                    50% {
                        filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.5));
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
