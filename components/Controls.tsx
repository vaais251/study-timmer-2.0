import React from 'react';
import { PlayIcon, PauseIcon, ResetIcon, SettingsIcon } from './common/Icons';

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
    navigateToSettings: () => void;
}

const Controls: React.FC<ControlsProps> = ({ isRunning, startTimer, stopTimer, resetTimer, navigateToSettings }) => {
    return (
        <div className="flex justify-center gap-4 sm:gap-6 mb-6">
            {!isRunning ? (
                <ControlButton onClick={startTimer} label="Start" className="bg-gradient-to-br from-cyan-400 to-blue-600">
                    <PlayIcon />
                </ControlButton>
            ) : (
                <ControlButton onClick={stopTimer} label="Pause" className="bg-gradient-to-br from-pink-500 to-red-500">
                    <PauseIcon />
                </ControlButton>
            )}
            <ControlButton onClick={resetTimer} label="Reset" className="bg-gradient-to-br from-amber-400 to-orange-500">
                <ResetIcon />
            </ControlButton>
            <ControlButton onClick={navigateToSettings} label="Settings" className="bg-gradient-to-br from-green-400 to-emerald-500">
                <SettingsIcon />
            </ControlButton>
        </div>
    );
};

export default Controls;