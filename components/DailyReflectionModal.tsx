import React, { useState } from 'react';

interface DailyReflectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (challenges: string, improvements: string) => void;
    initialChallenges?: string;
    initialImprovements?: string;
}

const DailyReflectionModal: React.FC<DailyReflectionModalProps> = ({ isOpen, onClose, onSave, initialChallenges = '', initialImprovements = '' }) => {
    const [challenges, setChallenges] = useState(initialChallenges);
    const [improvements, setImprovements] = useState(initialImprovements);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(challenges, improvements);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-50 animate-fadeIn p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-slideUp">
                <h2 className="text-2xl font-bold text-white mb-2 text-center">🌙 Daily Reflection</h2>
                <p className="text-slate-400 text-sm text-center mb-6">
                    Great work completing your tasks! Take a moment to reflect on today to improve tomorrow.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-red-300 mb-1">Challenges Faced Today</label>
                        <textarea
                            value={challenges}
                            onChange={(e) => setChallenges(e.target.value)}
                            placeholder="What obstacles did you encounter? (e.g., distraction, fatigue, tough concepts)"
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all min-h-[80px]"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-green-300 mb-1">Improvements for Tomorrow</label>
                        <textarea
                            value={improvements}
                            onChange={(e) => setImprovements(e.target.value)}
                            placeholder="How can you overcome these challenges next time?"
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/50 transition-all min-h-[80px]"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 rounded-lg font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 transition"
                    >
                        Skip
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-1 py-3 rounded-lg font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-lg transition"
                    >
                        Save Reflection
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyReflectionModal;