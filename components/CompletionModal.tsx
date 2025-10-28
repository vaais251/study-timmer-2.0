
import React, { useState } from 'react';
import { Mode } from '../types';

interface CompletionModalProps {
    title: string;
    message: string;
    nextMode: Mode;
    showCommentBox: boolean;
    onContinue: (comment: string) => void;
}

const CompletionModal: React.FC<CompletionModalProps> = ({ title, message, nextMode, showCommentBox, onContinue }) => {
    const [comment, setComment] = useState('');
    
    const isFocusNext = nextMode === 'focus';
    const accentColor = isFocusNext ? 'text-teal-400' : 'text-purple-400';
    const buttonBg = isFocusNext ? 'bg-teal-500 hover:bg-teal-600' : 'bg-purple-500 hover:bg-purple-600';

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-50 animate-fadeIn">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-sm w-11/12 text-center shadow-2xl animate-slideUp">
                <div className="text-6xl mb-4 animate-bounce">{nextMode === 'focus' ? '🎯' : '☕'}</div>
                <h2 className={`text-2xl font-bold text-white mb-2`}>{title}</h2>
                <p className="text-slate-300 mb-6" dangerouslySetInnerHTML={{ __html: message }} />
                
                {showCommentBox && (
                    <textarea 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="What did you accomplish? (Optional)"
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 mb-4 min-h-[80px]"
                    />
                )}
                
                <button
                    onClick={() => onContinue(comment)}
                    className={`w-full p-4 ${buttonBg} text-white font-bold rounded-lg transition-transform hover:scale-105 uppercase tracking-wider`}
                >
                    Start Next Phase
                </button>
            </div>
             <style>{`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              .animate-fadeIn { animation: fadeIn 0.3s ease; }
              @keyframes slideUp { from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); } }
              .animate-slideUp { animation: slideUp 0.4s ease; }
              @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
              .animate-bounce { animation: bounce 1.5s ease infinite; }
            `}</style>
        </div>
    );
};

export default CompletionModal;