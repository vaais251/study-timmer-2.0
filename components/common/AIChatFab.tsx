import React from 'react';
import { AIIcon } from './Icons';

interface AIChatFabProps {
    onClick: () => void;
}

const AIChatFab: React.FC<AIChatFabProps> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className="fixed bottom-20 right-6 md:bottom-8 md:right-8 z-30 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg flex items-center justify-center transform transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-teal-500/50 animate-pulse-fab"
            aria-label="Open AI Coach"
        >
            <AIIcon />
             <style>{`
              @keyframes pulse-fab {
                0%, 100% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.5); }
                70% { box-shadow: 0 0 0 15px rgba(20, 184, 166, 0); }
              }
              .animate-pulse-fab { animation: pulse-fab 2s infinite; }
            `}</style>
        </button>
    );
};

export default AIChatFab;