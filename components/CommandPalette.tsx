import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Page, Task, Project, Goal, Target } from '../types';
import { SearchIcon, TimerIcon, PlanIcon, StatsIcon, AIIcon, TargetIcon as GoalsIcon, SettingsIcon } from './common/Icons';

// Simple fuzzy search utility
const fuzzySearch = (query: string, text: string) => {
    const search = query.toLowerCase();
    const target = text.toLowerCase();
    let searchIndex = 0;
    for (let i = 0; i < target.length; i++) {
        if (target[i] === search[searchIndex]) {
            searchIndex++;
        }
    }
    return searchIndex === search.length;
};

interface CommandItem {
    id: string;
    title: string;
    type: 'page' | 'task' | 'project' | 'goal' | 'target';
    action: () => void;
    icon: React.ReactNode;
}

interface CommandPaletteProps {
    onClose: () => void;
    setPage: (page: Page) => void;
    tasks: Task[];
    projects: Project[];
    goals: Goal[];
    targets: Target[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ onClose, setPage, tasks, projects, goals, targets }) => {
    const [search, setSearch] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLUListElement>(null);

    const allCommands = useMemo(() => {
        const pages: CommandItem[] = [
            { id: 'page-timer', title: 'Go to Timer', type: 'page', action: () => setPage('timer'), icon: <TimerIcon /> },
            { id: 'page-plan', title: 'Go to Plan', type: 'page', action: () => setPage('plan'), icon: <PlanIcon /> },
            { id: 'page-goals', title: 'Go to Goals', type: 'page', action: () => setPage('goals'), icon: <GoalsIcon /> },
            { id: 'page-stats', title: 'Go to Stats', type: 'page', action: () => setPage('stats'), icon: <StatsIcon /> },
            { id: 'page-ai', title: 'Go to AI Coach', type: 'page', action: () => setPage('ai'), icon: <AIIcon /> },
            { id: 'page-settings', title: 'Go to Settings', type: 'page', action: () => setPage('settings'), icon: <SettingsIcon /> },
        ];

        const taskCommands: CommandItem[] = tasks.map(t => ({
            id: t.id,
            title: t.text,
            type: 'task',
            action: () => setPage('plan'),
            icon: <PlanIcon />,
        }));
        
        const projectCommands: CommandItem[] = projects.map(p => ({
            id: p.id,
            title: p.name,
            type: 'project',
            action: () => setPage('goals'),
            icon: <GoalsIcon />,
        }));

        const goalCommands: CommandItem[] = goals.map(g => ({
            id: g.id,
            title: g.text,
            type: 'goal',
            action: () => setPage('goals'),
            icon: <GoalsIcon />,
        }));
        
        const targetCommands: CommandItem[] = targets.map(t => ({
            id: t.id,
            title: t.text,
            type: 'target',
            action: () => setPage('goals'),
            icon: <GoalsIcon />,
        }));

        return [...pages, ...taskCommands, ...projectCommands, ...goalCommands, ...targetCommands];
    }, [setPage, tasks, projects, goals, targets]);

    const filteredResults = useMemo(() => {
        if (!search) {
            return allCommands.filter(cmd => cmd.type === 'page');
        }
        return allCommands.filter(cmd => fuzzySearch(search, cmd.title));
    }, [search, allCommands]);

    const groupedResults = useMemo(() => {
        const groups: { [key: string]: CommandItem[] } = {};
        filteredResults.forEach(item => {
            if (!groups[item.type]) {
                groups[item.type] = [];
            }
            groups[item.type].push(item);
        });
        return Object.entries(groups);
    }, [filteredResults]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    
    useEffect(() => {
        setActiveIndex(0);
    }, [search]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % filteredResults.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + filteredResults.length) % filteredResults.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const activeItem = filteredResults[activeIndex];
                if (activeItem) {
                    activeItem.action();
                    onClose();
                }
            }
        };
        // The palette is mounted, so we can listen directly
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeIndex, filteredResults, onClose]);

    useEffect(() => {
        const activeElement = resultsRef.current?.querySelector(`[data-index="${activeIndex}"]`);
        activeElement?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const handleSelect = (item: CommandItem) => {
        item.action();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-start z-50 pt-20" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl animate-scaleIn" onClick={e => e.stopPropagation()}>
                <div className="relative p-3 border-b border-slate-700">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-6 pointer-events-none text-slate-400">
                        <SearchIcon />
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search for pages, tasks, projects..."
                        className="w-full bg-transparent border-none rounded-lg p-2 pl-12 text-white placeholder:text-slate-400 focus:outline-none focus:ring-0 text-lg"
                    />
                </div>
                <ul ref={resultsRef} className="max-h-96 overflow-y-auto p-2">
                    {groupedResults.length > 0 ? (
                        groupedResults.map(([type, items], groupIndex) => (
                            <li key={type}>
                                <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase">{type}</div>
                                <ul>
                                    {items.map(item => {
                                        const itemIndex = filteredResults.findIndex(i => i.id === item.id);
                                        const isSelected = activeIndex === itemIndex;
                                        return (
                                            <li
                                                key={item.id}
                                                data-index={itemIndex}
                                                onClick={() => handleSelect(item)}
                                                onMouseEnter={() => setActiveIndex(itemIndex)}
                                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer text-slate-300 ${isSelected ? 'bg-slate-700/50 text-white' : 'hover:bg-slate-700/30'}`}
                                            >
                                                <div className="text-slate-400">{item.icon}</div>
                                                <span className="flex-grow">{item.title}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        ))
                    ) : (
                        <li className="p-4 text-center text-slate-400">No results found.</li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default CommandPalette;
