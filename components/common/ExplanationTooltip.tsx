import React, { useState, useRef, useEffect } from 'react';
import { QuestionMarkCircleIcon } from './Icons';

interface ExplanationTooltipProps {
    title: string;
    content: string; // Will be treated as HTML
}

const ExplanationTooltip: React.FC<ExplanationTooltipProps> = ({ title, content }) => {
    const [isOpen, setIsOpen] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative inline-flex items-center" ref={tooltipRef}>
            <button 
                onClick={() => setIsOpen(o => !o)} 
                className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={`Explanation for ${title}`}
            >
                <QuestionMarkCircleIcon />
            </button>
            {isOpen && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-4 z-20 animate-scaleIn text-left">
                    <h4 className="font-bold text-white mb-2">{title}</h4>
                    <div 
                        className="text-sm text-slate-300 space-y-2 prose prose-sm prose-invert max-w-none" 
                        dangerouslySetInnerHTML={{ __html: content }}
                    ></div>
                </div>
            )}
        </div>
    );
};

export default ExplanationTooltip;
