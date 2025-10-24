
import React, { useMemo } from 'react';

interface TimerDisplayProps {
    timeRemaining: number;
    totalTime: number;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ timeRemaining, totalTime }) => {
    const minutes = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const seconds = (timeRemaining % 60).toString().padStart(2, '0');

    const progress = useMemo(() => {
        return totalTime > 0 ? (totalTime - timeRemaining) / totalTime : 0;
    }, [timeRemaining, totalTime]);

    const radius = 85;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - progress * circumference;

    return (
        <div className="relative h-48 sm:h-56 flex items-center justify-center mb-6">
            <svg className="absolute w-48 h-48 sm:w-56 sm:h-56" viewBox="0 0 180 180">
                <circle
                    className="text-white/30"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    r={radius}
                    cx="90"
                    cy="90"
                />
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
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s linear' }}
                />
            </svg>
            <div className="text-7xl sm:text-8xl font-thin text-white tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {minutes}:{seconds}
            </div>
        </div>
    );
};

export default TimerDisplay;
