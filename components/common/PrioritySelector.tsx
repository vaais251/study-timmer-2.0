import React from 'react';

interface PrioritySelectorProps {
    priority: number | null;
    setPriority: (priority: number | null) => void;
}

const priorityLevels = [
    { level: 1, label: 'P1', color: 'border-red-500 bg-red-500/20 hover:bg-red-500/40', selectedColor: 'bg-red-500 text-white border-red-500' },
    { level: 2, label: 'P2', color: 'border-amber-500 bg-amber-500/20 hover:bg-amber-500/40', selectedColor: 'bg-amber-500 text-white border-amber-500' },
    { level: 3, label: 'P3', color: 'border-sky-500 bg-sky-500/20 hover:bg-sky-500/40', selectedColor: 'bg-sky-500 text-white border-sky-500' },
    { level: 4, label: 'P4', color: 'border-slate-500 bg-slate-500/20 hover:bg-slate-500/40', selectedColor: 'bg-slate-500 text-white border-slate-500' },
];

const PrioritySelector: React.FC<PrioritySelectorProps> = ({ priority, setPriority }) => {
    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-black/20 p-1">
                {priorityLevels.map(({ level, label, color, selectedColor }) => (
                    <button
                        key={level}
                        type="button"
                        onClick={() => setPriority(priority === level ? null : level)}
                        className={`w-8 h-8 rounded-full text-xs font-bold border-2 transition-all ${priority === level ? selectedColor : color}`}
                        title={`Priority ${level}`}
                    >
                        {label}
                    </button>
                ))}
            </div>
             {priority !== null && (
                <button 
                    type="button" 
                    onClick={() => setPriority(null)} 
                    className="text-slate-400 hover:text-white text-xl font-bold leading-none p-1 transition" 
                    title="Clear Priority"
                >&times;</button>
            )}
        </div>
    );
};

export default PrioritySelector;
