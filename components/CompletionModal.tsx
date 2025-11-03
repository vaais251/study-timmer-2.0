import React, { useState } from 'react';
import { Mode } from '../types';

interface CompletionModalProps {
    title: string;
    message: string;
    nextMode: Mode;
    showCommentBox: boolean;
    onContinue: (comment: string, difficulty: 'complete_focus' | 'half_focus' | 'none_focus' | null) => void;
}

type Difficulty = 'complete_focus' | 'half_focus' | 'none_focus';

const CompletionModal: React.FC<CompletionModalProps> = ({ title, message, nextMode, showCommentBox, onContinue }) => {
    const [comment, setComment] = useState('');
    const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
    
    const isFocusNext = nextMode === 'focus';
    const accentColor = isFocusNext ? 'text-teal-400' : 'text-purple-400';
    const buttonBg = isFocusNext ? 'bg-teal-500 hover:bg-teal-600' : 'bg-purple-500 hover:bg-purple-600';

    const difficultyOptions: { label: string; value: Difficulty }[] = [
        { label: 'Complete Focus', value: 'complete_focus' },
        { label: 'Half Focus', value: 'half_focus' },
        { label: 'None Focus', value: 'none_focus' },
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-50 animate-fadeIn">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-sm w-11/12 text-center shadow-2xl animate-slideUp">
                <div className="text-6xl mb-4 animate-bounce-subtle">{nextMode === 'focus' ? '🎯' : '☕'}</div>
                <h2 className={`text-2xl font-bold text-white mb-2`}>{title}</h2>
                <p className="text-slate-300 mb-6" dangerouslySetInnerHTML={{ __html: message }} />
                
                {showCommentBox && (
                    <div className="space-y-4 mb-6">
                        <textarea 
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="What did you accomplish? (Optional)"
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 min-h-[80px]"
                        />
                         <div>
                            <label className="text-sm text-slate-300 mb-2 block">How was your focus? (Optional)</label>
                            <div className="flex justify-center gap-2">
                                {difficultyOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setDifficulty(opt.value)}
                                        className={`px-4 py-2 rounded-full font-semibold border-2 transition-colors text-sm
                                            ${difficulty === opt.value
                                                ? 'bg-cyan-500 border-cyan-500 text-white'
                                                : 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                <button
                    onClick={() => onContinue(comment, difficulty)}
                    className={`w-full p-4 ${buttonBg} text-white font-bold rounded-lg transition-transform hover:scale-105 uppercase tracking-wider`}
                >
                    Start Next Phase
                </button>
            </div>
        </div>
    );
};

export default CompletionModal;