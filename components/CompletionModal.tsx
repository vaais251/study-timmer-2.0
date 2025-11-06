
import React, { useState } from 'react';
import { Mode, FocusLevel } from '../types';

interface CompletionModalProps {
    title: string;
    message: string;
    nextMode: Mode;
    showCommentBox: boolean;
    onContinue: (comment: string, focusLevel: FocusLevel | null) => void;
    isSyncing: boolean;
}

const FocusLevelButton: React.FC<{ level: FocusLevel; label: string; icon: string; selected: FocusLevel | null; onSelect: (level: FocusLevel) => void; disabled: boolean; }> = ({ level, label, icon, selected, onSelect, disabled }) => {
    const isSelected = selected === level;
    const colors = {
        complete_focus: {
            bg: 'bg-green-500/20 hover:bg-green-500/40',
            selectedBg: 'bg-green-500 text-white',
            text: 'text-green-300'
        },
        half_focus: {
            bg: 'bg-amber-500/20 hover:bg-amber-500/40',
            selectedBg: 'bg-amber-500 text-white',
            text: 'text-amber-300'
        },
        none_focus: {
            bg: 'bg-red-500/20 hover:bg-red-500/40',
            selectedBg: 'bg-red-500 text-white',
            text: 'text-red-300'
        }
    };
    
    return (
        <button
            onClick={() => onSelect(level)}
            disabled={disabled}
            className={`flex-1 p-2 rounded-lg transition-all border-2 border-transparent ${isSelected ? colors[level].selectedBg : colors[level].bg} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <div className="text-3xl">{icon}</div>
            <div className={`text-xs font-semibold mt-1 ${isSelected ? 'text-white' : colors[level].text}`}>{label}</div>
        </button>
    );
};


const CompletionModal: React.FC<CompletionModalProps> = ({ title, message, nextMode, showCommentBox, onContinue, isSyncing }) => {
    const [comment, setComment] = useState('');
    
    const isFocusNext = nextMode === 'focus';
    const buttonBg = isFocusNext ? 'bg-teal-500 hover:bg-teal-600' : 'bg-purple-500 hover:bg-purple-600';

    const handleSelectFocusAndContinue = (level: FocusLevel) => {
        onContinue(comment, level);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-50 animate-fadeIn">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-sm w-11/12 text-center shadow-2xl animate-slideUp">
                <div className="text-6xl mb-4 animate-bounce-subtle">{nextMode === 'focus' ? '🎯' : '☕'}</div>
                <h2 className={`text-2xl font-bold text-white mb-2`}>{title}</h2>
                <p className="text-slate-300 mb-6" dangerouslySetInnerHTML={{ __html: message }} />
                
                {showCommentBox ? (
                    <>
                        <textarea 
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="What did you accomplish? (Optional)"
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 mb-4 min-h-[80px] disabled:opacity-50"
                            disabled={isSyncing}
                        />
                         <div className="my-4">
                            <h3 className="text-sm font-semibold text-white mb-2">How was your focus? (Click to continue)</h3>
                            <div className="flex justify-center gap-2">
                                <FocusLevelButton level="complete_focus" label="Full Focus" icon="😊" selected={null} onSelect={handleSelectFocusAndContinue} disabled={isSyncing} />
                                <FocusLevelButton level="half_focus" label="Half Focus" icon="🤔" selected={null} onSelect={handleSelectFocusAndContinue} disabled={isSyncing} />
                                <FocusLevelButton level="none_focus" label="Distracted" icon="😩" selected={null} onSelect={handleSelectFocusAndContinue} disabled={isSyncing} />
                            </div>
                        </div>
                    </>
                ) : (
                    <button
                        onClick={() => onContinue(comment, null)}
                        disabled={isSyncing}
                        className={`w-full p-4 ${buttonBg} text-white font-bold rounded-lg transition-transform hover:scale-105 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isSyncing ? 'Processing...' : 'Start Next Phase'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CompletionModal;
