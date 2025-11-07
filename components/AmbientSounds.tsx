

import React, { useState, useEffect } from 'react';
import { playWhiteNoise, stopWhiteNoise, setWhiteNoiseVolume } from '../utils/audio';

const AmbientSounds: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.1);

    useEffect(() => {
        if (isPlaying) {
            playWhiteNoise();
        } else {
            stopWhiteNoise();
        }
        return () => {
            stopWhiteNoise(); // Cleanup on component unmount
        };
    }, [isPlaying]);

    useEffect(() => {
        setWhiteNoiseVolume(volume);
    }, [volume]);

    const handleTogglePlay = () => {
        setIsPlaying(prev => !prev);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVolume(parseFloat(e.target.value));
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-slate-700/80">
            <div className="flex items-center justify-between gap-4">
                 <div className="flex items-center gap-3">
                    <div className="text-2xl flex-shrink-0">🎧</div>
                    <span className="text-white font-semibold hidden sm:inline">Ambient Noise</span>
                </div>
                <div className="flex items-center gap-4 flex-grow">
                     <input
                        type="range"
                        min="0"
                        max="0.2"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        disabled={!isPlaying}
                        aria-label="White noise volume"
                    />
                    <button
                        onClick={handleTogglePlay}
                        className={`w-24 px-4 py-2 rounded-full font-bold text-white transition hover:scale-105 ${
                            isPlaying ? 'bg-gradient-to-br from-pink-500 to-red-500' : 'bg-gradient-to-br from-cyan-400 to-blue-600'
                        }`}
                    >
                        {isPlaying ? 'Stop' : 'Play'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AmbientSounds;