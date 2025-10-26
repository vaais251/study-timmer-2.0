


import React, { useMemo } from 'react';
import { Task, PomodoroHistory } from '../types';
import Panel from './common/Panel';

interface CategoryFocusChartProps {
    tasks: Task[];
    todaysHistory: PomodoroHistory[];
    totalFocusMinutes: number;
}

const CategoryFocusChart: React.FC<CategoryFocusChartProps> = ({ tasks, todaysHistory, totalFocusMinutes }) => {
    const categoryData = useMemo(() => {
        // Create a map for quick task lookup by ID
        const taskMap = new Map<string, Task>();
        tasks.forEach(task => taskMap.set(task.id, task));
        
        const tagFocusMap = new Map<string, number>();
        
        todaysHistory.forEach(historyItem => {
            if (historyItem.task_id) {
                const task = taskMap.get(historyItem.task_id);
                if (task && task.tags && task.tags.length > 0) {
                    task.tags.forEach(tag => {
                        const normalizedTag = tag.trim().toLowerCase();
                        if (normalizedTag) {
                            tagFocusMap.set(normalizedTag, (tagFocusMap.get(normalizedTag) || 0) + (Number(historyItem.duration_minutes) || 0));
                        }
                    });
                }
            }
        });

        const sortedData = Array.from(tagFocusMap.entries())
            .map(([name, minutes]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), minutes }))
            .sort((a, b) => b.minutes - a.minutes);

        return sortedData;
    }, [tasks, todaysHistory]);

    const colors = [
        '#f1f5f9', // slate-100
        '#e2e8f0', // slate-200
        '#cbd5e1', // slate-300
        '#94a3b8', // slate-400
        '#64748b', // slate-500
    ];
    
    let content: React.ReactNode;

    if (totalFocusMinutes > 0 && categoryData.length > 0) {
        content = (
            <div className="p-4 text-white" style={{ fontFamily: `'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif` }}>
                <div className="text-6xl font-bold mb-8 text-left">{totalFocusMinutes}<span className="text-5xl font-medium align-baseline">m</span></div>
                <div className="pl-2">
                    {categoryData.slice(0, 5).map((item, index) => ( // Show top 5
                        <div key={item.name} className="flex items-center" style={{ marginTop: index > 0 ? '-24px' : '0px', zIndex: categoryData.length - index, position: 'relative' }}>
                            <div 
                                className="w-16 h-16 rounded-full flex items-center justify-center text-slate-800 font-bold text-lg shadow-lg border-2 border-slate-800/20"
                                style={{ backgroundColor: colors[index % colors.length] }}
                                title={`${item.minutes} minutes`}
                            >
                                {item.minutes}m
                            </div>
                            <span className="ml-4 text-xl font-medium">{item.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    } else if (totalFocusMinutes > 0) {
         content = (
            <div className="p-4 text-white/70 text-center">
                <p className="text-lg">You've focused for <span className="font-bold text-white">{totalFocusMinutes}</span> minutes today!</p>
                <p className="mt-2 text-sm">Add tags to your tasks in the 'Plan' tab to see a breakdown here.</p>
            </div>
        );
    } else {
        content = (
             <div className="p-4 text-white/70 text-center h-40 flex items-center justify-center">
                <p>Complete a focus session to see your time breakdown by category.</p>
            </div>
        );
    }

    return (
        <Panel title="Today's Focus Breakdown">
            {content}
        </Panel>
    );
};

export default CategoryFocusChart;