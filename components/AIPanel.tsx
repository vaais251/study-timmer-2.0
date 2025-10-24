
import React, { useState } from 'react';
import Panel from './common/Panel';

interface AIPanelProps {
    title: string;
    description: string;
    buttonText: string;
    onGetAdvice: (prompt?: string) => Promise<void>;
    aiState: { content: string; isLoading: boolean };
    showPromptTextarea: boolean;
}

const AIPanel: React.FC<AIPanelProps> = ({ title, description, buttonText, onGetAdvice, aiState, showPromptTextarea }) => {
    const [prompt, setPrompt] = useState('');

    return (
        <Panel title={title}>
            <p className="text-white/80 text-center text-sm mb-4">{description}</p>
            {showPromptTextarea && (
                 <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask a specific question or add context (Optional)"
                    className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50 mb-3 min-h-[80px]"
                 />
            )}
            <button 
                onClick={() => onGetAdvice(prompt)} 
                disabled={aiState.isLoading}
                className="w-full p-3 bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold rounded-lg transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {aiState.isLoading ? 'Thinking...' : buttonText}
            </button>
            <div className="bg-black/20 p-4 mt-4 rounded-lg text-white/90 min-h-[100px] text-sm leading-relaxed">
                {aiState.isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="w-8 h-8 border-4 border-white/20 border-t-purple-400 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div dangerouslySetInnerHTML={{ __html: aiState.content }} />
                )}
            </div>
        </Panel>
    );
};

export default AIPanel;
