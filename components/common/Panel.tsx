
import React from 'react';

interface PanelProps {
    title: string;
    children: React.ReactNode;
    className?: string;
    headerAction?: React.ReactNode;
}

const Panel: React.FC<PanelProps> = ({ title, children, className = '', headerAction }) => {
    return (
        <div className={`glass-panel rounded-3xl p-6 ${className} animate-slideUp transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/5`}>
            <div className="flex justify-between items-center mb-5">
                <h2 className="text-white/90 text-lg font-bold tracking-tight flex items-center gap-2">
                    {title}
                </h2>
                {headerAction}
            </div>
            {children}
        </div>
    );
};

export default Panel;
