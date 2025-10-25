
import React from 'react';

const LoadingAnimation: React.FC = () => {
    return (
        <div className="fixed inset-0 w-full h-screen flex items-center justify-center bg-[#1e1b4b] z-50">
            <div className="relative flex items-center justify-center">
                {/* Pulsing Rings */}
                <div className="absolute w-48 h-48 rounded-full bg-indigo-500/20 animate-pulse-slow"></div>
                <div className="absolute w-32 h-32 rounded-full bg-indigo-500/30 animate-pulse-slower"></div>
                <div className="absolute w-20 h-20 rounded-full bg-indigo-500/40 animate-pulse-slowest"></div>

                {/* Floating Icon */}
                <div className="relative w-16 h-16 animate-float">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#f5576c] to-[#f093fb]"></div>
                    <div className="absolute inset-2.5 rounded-full bg-white"></div>
                    <div className="absolute inset-5 rounded-full bg-gradient-to-br from-[#f5576c] to-[#f093fb]"></div>
                </div>
            </div>
            <style>{`
                @keyframes pulse-slow {
                    0%, 100% { transform: scale(0.5); opacity: 0; }
                    50% { opacity: 1; }
                    80% { transform: scale(1.5); opacity: 0; }
                }
                .animate-pulse-slow { animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
                .animate-pulse-slower { animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-delay: 1s; }
                .animate-pulse-slowest { animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-delay: 2s; }
                
                @keyframes float {
                    0%, 100% { transform: translateY(-10px); }
                    50% { transform: translateY(10px); }
                }
                .animate-float { animation: float 3s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

export default LoadingAnimation;
