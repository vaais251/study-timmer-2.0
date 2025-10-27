
import React from 'react';
import { PlayIcon, PauseIcon, ResetIcon } from './common/Icons';
import { Mode } from '../types';

interface ControlsProps {
    isRunning: boolean;
    startTimer: () => void;
    stopTimer: () => void;
    resetTimer: () => void;
    timeRemaining: number;
    sessionTotalTime: number;
    mode: Mode;
}

const Controls: React.FC<ControlsProps> = ({ isRunning, startTimer, stopTimer, resetTimer, timeRemaining, sessionTotalTime, mode }) => {
    const isPaused = !isRunning && timeRemaining < sessionTotalTime;
    const isPristine = !isRunning && !isPaused;

    const handleMainClick = () => {
        if (isRunning) {
            stopTimer(); // Pause
        } else {
            startTimer(); // Start or Resume
        }
    };
    
    // Case 1: Timer is pristine (stopped and full) -> Show a single large start button
    if (isPristine) {
        const buttonText = mode === 'focus' ? 'START FOCUS' : 'START BREAK';
        const buttonClass = mode === 'focus' 
            ? "bg-gradient-to-br from-red-500 to-pink-500 focus:ring-pink-400/50"
            : "bg-gradient-to-br from-green-500 to-lime-600 focus:ring-lime-400/50";
        
        return (
            <div className="text-center my-6 h-20 flex items-center justify-center">
                <button
                    onClick={handleMainClick}
                    className={`text-white font-bold py-4 px-16 rounded-full shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 ${buttonClass}`}
                    aria-label={`Start ${mode} time`}
                >
                    {buttonText}
                </button>
            </div>
        );
    }
    
    // Create a generic button component for the running/paused states
    const ActionButton: React.FC<{ onClick: () => void; label: string; children: React.ReactNode; className: string; }> = ({ onClick, label, children, className }) => (
        <button
            onClick={onClick}
            className={`w-32 h-16 sm:w-36 sm:h-20 rounded-full text-white font-semibold flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-lg ${className}`}
            aria-label={label}
        >
            {children}
            <span className="text-xs mt-1 uppercase tracking-wider">{label}</span>
        </button>
    );

    const SecondaryButton: React.FC<{ onClick: () => void; label: string; children: React.ReactNode; className: string; }> = ({ onClick, label, children, className }) => (
        <button
            onClick={onClick}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full text-white font-semibold flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-lg ${className}`}
            aria-label={label}
        >
            {children}
            <span className="text-xs mt-1 uppercase tracking-wider">{label}</span>
        </button>
    );


    // Case 2 & 3: Timer is running or paused -> Show main action button + reset button
    const MainActionButton = isRunning 
        ? (
            <ActionButton onClick={handleMainClick} label="Pause" className="bg-gradient-to-br from-yellow-500 to-orange-500">
                <PauseIcon />
            </ActionButton>
        ) : ( // isPaused
             <ActionButton onClick={handleMainClick} label="Resume" className="bg-gradient-to-br from-green-500 to-emerald-600">
                <PlayIcon />
            </ActionButton>
        );

    return (
        <div className="flex justify-center items-center gap-4 sm:gap-6 my-6 h-20">
            {MainActionButton}
            <SecondaryButton onClick={resetTimer} label="Reset" className="bg-gradient-to-br from-red-500 to-pink-500">
                <ResetIcon />
            </SecondaryButton>
        </div>
    );
};

export default Controls;
