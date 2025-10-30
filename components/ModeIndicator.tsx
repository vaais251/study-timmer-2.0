
import React from 'react';
import { Mode } from '../types';

interface ModeIndicatorProps {
    mode: Mode;
}

const ModeIndicator: React.FC<ModeIndicatorProps> = ({ mode }) => {
    const isFocus = mode === 'focus';
    const baseClasses = "inline-block px-8 py-2 rounded-full text-white font-bold text-lg uppercase tracking-wider transition-all duration-300 animate-pulse-subtle-scale";
    const focusClasses = "bg-gradient-to-br from-pink-400 to-red-500";
    const breakClasses = "bg-gradient-to-br from-green-400 to-lime-600";
    
    return (
        <div className="text-center mb-4">
            <div className={`${baseClasses} ${isFocus ? focusClasses : breakClasses}`}>
                {isFocus ? 'Focus Time' : 'Break Time'}
            </div>
        </div>
    );
};

export default ModeIndicator;