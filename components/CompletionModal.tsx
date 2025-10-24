
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
    
    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 animate-fadeIn">
            <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-2xl p-6 sm:p-8 max-w-sm w-11/12 text-center shadow-2xl animate-slideUp">
                <div className="text-6xl mb-4 animate-bounce">{nextMode === 'focus' ? '🎯' : '☕'}</div>
                <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                <p className="text-white/90 mb-6" dangerouslySetInnerHTML={{ __html: message }} />
                
                {showCommentBox && (
                    <textarea 
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="What did you accomplish? (Optional)"
                        className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50 mb-4 min-h-[80px]"
                    />
                )}
                
                <button
                    onClick={() => onContinue(comment)}
                    className="w-full p-4 bg-white text-[#667eea] font-bold rounded-lg transition-transform hover:scale-105 uppercase tracking-wider"
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
