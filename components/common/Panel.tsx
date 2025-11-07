
import React from 'react';

interface PanelProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

const Panel: React.FC<PanelProps> = ({ title, children, className = '' }) => {
    return (
        <div className={`bg-[#0B1120]/50 backdrop-blur-lg rounded-2xl p-4 sm:p-6 border border-slate-700/50 ${className} animate-slideUp`}>
            <h2 className="text-white text-xl font-bold mb-4 tracking-tight">{title}</h2>
            {children}
        </div>
    );
};

export default Panel;