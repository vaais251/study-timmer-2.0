
import React, { useState, useEffect } from 'react';
import Panel from './common/Panel';
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
        <Panel title="🎧 Ambient Sound">
            <div className="flex items-center justify-between gap-4">
                <span className="text-white font-semibold">White Noise</span>
                <div className="flex items-center gap-4 flex-grow">
                     <input
                        type="range"
                        min="0"
                        max="0.2"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                        disabled={!isPlaying}
                    />
                    <button
                        onClick={handleTogglePlay}
                        className={`px-4 py-2 rounded-lg font-bold text-white transition hover:scale-105 ${
                            isPlaying ? 'bg-gradient-to-br from-pink-500 to-red-500' : 'bg-gradient-to-br from-cyan-400 to-blue-600'
                        }`}
                    >
                        {isPlaying ? 'Stop' : 'Play'}
                    </button>
                </div>
            </div>
        </Panel>
    );
};

export default AmbientSounds;