import React, { useMemo } from 'react';
import { Task, PomodoroHistory } from '../types';
import Panel from './common/Panel';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';

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
            .map(([name, minutes]) => ({ 
                name: name.charAt(0).toUpperCase() + name.slice(1), 
                minutes: Math.round(minutes) 
            }))
            .sort((a, b) => b.minutes - a.minutes);

        return sortedData;
    }, [tasks, todaysHistory]);

    if (totalFocusMinutes === 0) {
        return (
             <Panel title="Today's Focus Breakdown">
                 <div className="p-4 text-white/70 text-center h-40 flex items-center justify-center">
                    <p>Complete a focus session to see your time breakdown by category.</p>
                </div>
             </Panel>
        );
    }
    
    if (categoryData.length === 0) {
        return (
             <Panel title="Today's Focus Breakdown">
                <div className="p-4 text-white/70 text-center">
                    <p className="text-lg">You've focused for <span className="font-bold text-white">{totalFocusMinutes}</span> minutes today!</p>
                    <p className="mt-2 text-sm">Add tags to your tasks in the 'Plan' tab to see a breakdown here.</p>
                </div>
             </Panel>
        );
    }
    
    // Determine chart height based on number of categories to prevent squishing
    const chartHeight = Math.max(160, categoryData.length * 35); // 35px per bar, min 160px

    return (
        <Panel title="Today's Focus Breakdown">
            <div className="text-center mb-4">
                <span className="text-4xl font-bold text-white">{totalFocusMinutes}</span>
                <span className="text-lg text-white/80"> Total Minutes</span>
            </div>
            <div style={{ height: `${chartHeight}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={categoryData}
                        margin={{ top: 5, right: 40, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                        <XAxis type="number" stroke="rgba(255,255,255,0.7)" unit="m" />
                        <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.7)" width={80} tick={{ fontSize: 12 }} interval={0} />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                            contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                            itemStyle={{ color: 'white' }} 
                            labelStyle={{ color: 'white', fontWeight: 'bold' }}
                            formatter={(value: number) => [`${value} minutes`, 'Focus Time']}
                        />
                        <Bar dataKey="minutes" name="Focus Minutes" fill="#10B981">
                            <LabelList 
                                dataKey="minutes" 
                                position="right" 
                                style={{ fill: '#a7f3d0', fontSize: 12 }} 
                                formatter={(value: number) => `${value}m`} 
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Panel>
    );
};

export default CategoryFocusChart;