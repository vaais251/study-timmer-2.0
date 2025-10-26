import React, { useMemo } from 'react';
import Panel from './common/Panel';
import { Task } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface StatsPanelProps {
    completedToday: Task[];
    tasksToday: Task[];
    totalFocusMinutes: number;
}

const StatItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div className="bg-white/10 p-3 rounded-lg text-center">
        <div className="text-xs text-white/80 mb-1">{label}</div>
        <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
);

const StatsPanel: React.FC<StatsPanelProps> = ({ completedToday, tasksToday, totalFocusMinutes }) => {
    const stats = useMemo(() => {
        const totalTasks = completedToday.length + tasksToday.length;
        const completionPercentage = totalTasks === 0 ? 0 : Math.round((completedToday.length / totalTasks) * 100);
        const allTasks = [...completedToday, ...tasksToday];
        const pomsDone = allTasks.reduce((acc, task) => acc + (task.completed_poms || 0), 0);
        const pomsEst = allTasks.reduce((acc, task) => acc + (task.total_poms || 0), 0);

        return {
            totalTasks,
            completionPercentage,
            pomsDone,
            pomsEst
        };
    }, [completedToday, tasksToday]);

    const chartData = [
        { name: 'Completed', value: completedToday.length },
        { name: 'Incomplete', value: tasksToday.length },
    ];
    const COLORS = ['#34D399', '#F87171'];

    return (
        <Panel title="📊 Today's Progress">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <StatItem label="Focus Time" value={`${totalFocusMinutes}m`} />
                <StatItem label="Tasks Done" value={completedToday.length} />
                <StatItem label="Completion %" value={`${stats.completionPercentage}%`} />
                <StatItem label="Total Tasks" value={stats.totalTasks} />
                <StatItem label="Poms Done" value={stats.pomsDone} />
                <StatItem label="Poms Estimated" value={stats.pomsEst} />
            </div>
            <div className="h-56 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Panel>
    );
};

export default StatsPanel;