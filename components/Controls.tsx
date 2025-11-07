

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
            ? "bg-teal-500/30 hover:bg-teal-500/40 border-teal-400/50 focus:ring-teal-400"
            : "bg-purple-500/30 hover:bg-purple-500/40 border-purple-400/50 focus:ring-purple-400";
        
        return (
            <div className="text-center my-6 h-16 flex items-center justify-center">
                <button
                    onClick={handleMainClick}
                    className={`text-white font-semibold py-4 px-12 rounded-full shadow-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-4 backdrop-blur-sm border ${buttonClass}`}
                    aria-label={`Start ${mode} time`}
                >
                    <span className="flex items-center gap-2">
                        <PlayIcon /> {buttonText}
                    </span>
                </button>
            </div>
        );
    }
    
    // Create a generic button component for the running/paused states
    const ActionButton: React.FC<{ onClick: () => void; label: string; children: React.ReactNode; className: string; }> = ({ onClick, label, children, className }) => (
        <button
            onClick={onClick}
            className={`w-40 h-16 rounded-full text-white font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-lg backdrop-blur-sm border ${className}`}
            aria-label={label}
        >
            {children}
            <span>{label}</span>
        </button>
    );

    const SecondaryButton: React.FC<{ onClick: () => void; label: string; children: React.ReactNode; className: string; }> = ({ onClick, label, children, className }) => (
        <button
            onClick={onClick}
            className={`w-16 h-16 rounded-full text-slate-300 hover:text-white flex items-center justify-center transition-all duration-200 bg-black/20 hover:bg-black/30 backdrop-blur-sm border border-white/10 focus:outline-none focus:ring-4 focus:ring-white/20 shadow-md ${className}`}
            aria-label={label}
        >
            {children}
        </button>
    );


    const MainActionButton = isRunning 
        ? (
            <ActionButton onClick={handleMainClick} label="Pause" className="bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/50">
                <PauseIcon />
            </ActionButton>
        ) : ( // isPaused
             <ActionButton onClick={handleMainClick} label="Resume" className="bg-green-500/20 hover:bg-green-500/30 border-green-400/50">
                <PlayIcon />
            </ActionButton>
        );

    return (
        <div className="flex justify-center items-center gap-4 my-6 h-16">
            <SecondaryButton onClick={resetTimer} label="Reset" className="">
                <ResetIcon />
            </SecondaryButton>
            {MainActionButton}
        </div>
    );
};

export default Controls;