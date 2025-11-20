
import React, { useMemo, useState } from 'react';
import { Task, PomodoroHistory } from '../types';
import Panel from './common/Panel';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AIInsightModal from './common/AIInsightModal';
import { SparklesIcon } from './common/Icons';

interface CategoryFocusPieChartProps {
    tasks: Task[];
    todaysHistory: PomodoroHistory[];
}

const COLORS = ['#F59E0B', '#10B981', '#84CC16', '#EC4899', '#38BDF8', '#F43F5E', '#6366F1'];

const CategoryFocusPieChart: React.FC<CategoryFocusPieChartProps> = ({ tasks, todaysHistory }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const totalFocusMinutes = useMemo(() => {
        return Math.round(todaysHistory.reduce((sum, item) => sum + (Number(item.duration_minutes) || 0), 0));
    }, [todaysHistory]);

    const chartData = useMemo(() => {
        const taskMap = new Map<string, Task>();
        tasks.forEach(task => taskMap.set(task.id, task));
        
        const tagFocusMap = new Map<string, number>();
        let untaggedMinutes = 0;
        
        todaysHistory.forEach(historyItem => {
            const duration = Number(historyItem.duration_minutes) || 0;
            let isTagged = false;

            if (historyItem.task_id) {
                const task = taskMap.get(historyItem.task_id);
                if (task && task.tags && task.tags.length > 0) {
                    isTagged = true;
                    task.tags.forEach(tag => {
                        const normalizedTag = tag.trim().toLowerCase();
                        if (normalizedTag) {
                            tagFocusMap.set(normalizedTag, (tagFocusMap.get(normalizedTag) || 0) + duration);
                        }
                    });
                }
            }
            if (!isTagged) {
                untaggedMinutes += duration;
            }
        });

        const finalData = Array.from(tagFocusMap.entries())
            .map(([name, minutes]) => ({ 
                name: name.charAt(0).toUpperCase() + name.slice(1), 
                value: Math.round(minutes),
            }));

        if (untaggedMinutes > 0) {
            finalData.push({ name: 'Untagged', value: Math.round(untaggedMinutes) });
        }
        
        return finalData
            .filter(d => d.value > 0) // Don't show categories with 0 minutes
            .sort((a, b) => b.value - a.value);

    }, [tasks, todaysHistory]);

    if (totalFocusMinutes === 0) {
        return (
            <Panel title="Today's Focus Distribution" className="h-full flex flex-col">
                <div className="relative flex-grow h-80 flex items-center justify-center bg-black/10 rounded-xl border border-white/5 m-2">
                     <div className="absolute inset-0 flex items-center justify-center opacity-5">
                        <svg viewBox="0 0 100 100" className="w-48 h-48">
                            <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="8" fill="none" />
                        </svg>
                     </div>
                     <div className="text-center z-10 p-4">
                        <p className="text-slate-300 text-lg font-medium mb-2">Ready to Focus?</p>
                        <p className="text-slate-500 text-xs max-w-[200px] mx-auto">Complete your first session today to see your time distribution here.</p>
                     </div>
                </div>
            </Panel>
        );
    }

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        if (percent * 100 < 5) return null; // Don't render label for very small slices
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-sm font-bold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    const chartElement = (
        <div className="w-full h-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={110}
                        innerRadius={65}
                        fill="#8884d8"
                        dataKey="value"
                        paddingAngle={2}
                        stroke="rgba(0,0,0,0.2)"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}
                        itemStyle={{ color: 'white' }}
                        formatter={(value: number) => [`${value} minutes`, 'Focus Time']}
                    />
                    <Legend wrapperStyle={{ bottom: -5, fontSize: '12px' }} />
                </PieChart>
            </ResponsiveContainer>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] text-center pointer-events-none">
                <span className="text-4xl font-bold text-white tracking-tight">{totalFocusMinutes}</span>
                <span className="block text-xs uppercase tracking-wider text-slate-400 mt-1 font-semibold">Total Mins</span>
            </div>
        </div>
    );

    return (
        <>
            <Panel title="Today's Focus Distribution" className="h-full flex flex-col">
                <div className="relative flex-grow">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="absolute -top-12 right-0 p-2 text-purple-400 hover:text-purple-300 hover:bg-white/5 rounded-full transition z-10"
                        title="Get AI Insights for this chart"
                    >
                        <SparklesIcon />
                    </button>
                    <div className="h-80 w-full relative">
                        {chartElement}
                    </div>
                </div>
            </Panel>
            <AIInsightModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                chartTitle="Today's Focus Distribution (%)"
                chartData={chartData}
                chartElement={<div className="h-80 w-full">{chartElement}</div>}
            />
        </>
    );
};

export default React.memo(CategoryFocusPieChart);
