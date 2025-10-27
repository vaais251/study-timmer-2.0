
import React from 'react';
import { PlayIcon, PauseIcon, ResetIcon } from './common/Icons';

interface ControlButtonProps {
    onClick: () => void;
    label: string;
    children: React.ReactNode;
    className: string;
}

const ControlButton: React.FC<ControlButtonProps> = ({ onClick, label, children, className }) => (
    <button
        onClick={onClick}
        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full text-white font-semibold flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-lg ${className}`}
        aria-label={label}
    >
        {children}
        <span className="text-xs mt-1 uppercase tracking-wider">{label}</span>
    </button>
);

interface ControlsProps {
    isRunning: boolean;
    startTimer: () => void;
    stopTimer: () => void;
    resetTimer: () => void;
}

const Controls: React.FC<ControlsProps> = ({ isRunning, startTimer, stopTimer, resetTimer }) => {
    if (!isRunning) {
        return (
            <div className="text-center my-6">
                <button
                    onClick={startTimer}
                    className="bg-gradient-to-br from-red-500 to-pink-500 text-white font-bold py-3 px-12 rounded-full shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-pink-400/50"
                    aria-label="Start focus time"
                >
                    FOCUS TIME
                </button>
            </div>
        );
    }

    return (
        <div className="flex justify-center gap-4 sm:gap-6 my-6">
            <ControlButton onClick={stopTimer} label="Pause" className="bg-gradient-to-br from-pink-500 to-red-500">
                <PauseIcon />
            </ControlButton>
            <ControlButton onClick={resetTimer} label="Reset" className="bg-gradient-to-br from-amber-400 to-orange-500">
                <ResetIcon />
            </ControlButton>
        </div>
    );
};

export default Controls;
