
import React from 'react';

interface PanelProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

const Panel: React.FC<PanelProps> = ({ title, children, className = '' }) => {
    return (
        <div className={`bg-slate-800/50 rounded-xl p-4 sm:p-6 mt-6 border border-slate-700/80 ${className} animate-slideUp`}>
            <h2 className="text-white text-xl font-semibold mb-4 text-center tracking-tight">{title}</h2>
            {children}
        </div>
    );
};

export default Panel;