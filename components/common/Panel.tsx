
import React from 'react';

interface PanelProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

const Panel: React.FC<PanelProps> = ({ title, children, className = '' }) => {
    return (
        <div className={`bg-white/10 rounded-2xl p-4 sm:p-6 mt-5 ${className}`}>
            <h2 className="text-white text-xl font-bold mb-4 text-center">{title}</h2>
            {children}
        </div>
    );
};

export default Panel;
