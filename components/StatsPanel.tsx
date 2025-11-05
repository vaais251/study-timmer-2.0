import React, { useMemo, useState } from 'react';
import Panel from './common/Panel';
import { Task, DbDailyLog } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { getTodayDateString } from '../utils/date';
import AIInsightModal from './common/AIInsightModal';
import { SparklesIcon } from './common/Icons';

interface StatsPanelProps {
    completedToday: Task[];
    tasksToday: Task[];
    historicalLogs: DbDailyLog[];
}

const StatItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div className="bg-white/10 p-3 rounded-lg text-center">
        <div className="text-xs text-white/80 mb-1">{label}</div>
        <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
);

const StatsPanel: React.FC<StatsPanelProps> = ({ completedToday, tasksToday, historicalLogs }) => {
    const [comparisonPeriod, setComparisonPeriod] = useState<'yesterday' | '7day'>('yesterday');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { card1, card2, card3, stats, chartData } = useMemo(() => {
        const todayString = getTodayDateString();
        const today = new Date(todayString + 'T12:00:00'); // Use a fixed time to avoid TZ issues near midnight

        // --- Calculations ---
        const dailyTotals = new Map<string, number>();
        historicalLogs.forEach(log => {
            dailyTotals.set(log.date, log.total_focus_minutes);
        });

        const getRangeTotal = (endDate: Date, numDays: number): number => {
            let total = 0;
            const loopDate = new Date(endDate);
            for (let i = 0; i < numDays; i++) {
                const dateString = getTodayDateString(loopDate);
                total += dailyTotals.get(dateString) || 0;
                loopDate.setDate(loopDate.getDate() - 1);
            }
            return total;
        };

        const totalFocusToday = dailyTotals.get(todayString) || 0;

        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const totalFocusYesterday = dailyTotals.get(getTodayDateString(yesterday)) || 0;

        const totalFocusRecent7Days = getRangeTotal(today, 7);

        const previous7DaysEndDate = new Date(today);
        previous7DaysEndDate.setDate(today.getDate() - 7);
        const totalFocusPrevious7Days = getRangeTotal(previous7DaysEndDate, 7);
        
        // --- Card Data ---
        let card1: { label: string, value: string };
        let card2Value: React.ReactNode;
        let card3: { label: string, value: string };

        if (comparisonPeriod === 'yesterday') {
            card1 = { label: "Focus Time", value: `${totalFocusToday}m` };
            
            // Robust comparison logic
            if (totalFocusToday > 0 && totalFocusYesterday > 0) {
                const diff = totalFocusToday - totalFocusYesterday;
                if (diff > 0) {
                    card2Value = <div className="text-2xl font-semibold text-green-400">▲ {diff}m</div>;
                } else if (diff < 0) {
                    card2Value = <div className="text-2xl font-semibold text-red-400">▼ {Math.abs(diff)}m</div>;
                } else {
                    card2Value = <div className="text-2xl font-semibold text-white">0m</div>;
                }
            } else if (totalFocusToday > 0 && totalFocusYesterday === 0) {
                card2Value = <div className="text-2xl font-semibold text-green-400">▲ {totalFocusToday}m</div>;
            } else if (totalFocusToday === 0 && totalFocusYesterday > 0) {
                card2Value = <div className="text-2xl font-semibold text-red-400">▼ {totalFocusYesterday}m</div>;
            } else { // both are 0
                card2Value = <div className="text-2xl font-semibold text-white">-</div>;
            }
            
            const sevenDayAverageForStatCard = totalFocusRecent7Days > 0 ? Math.round(totalFocusRecent7Days / 7) : 0;
            card3 = { label: "7-Day Avg", value: `${sevenDayAverageForStatCard}m` };

        } else { // '7day' which is now 'vs Last Week'
            card1 = { label: "This Week", value: `${totalFocusRecent7Days}m` };
            
            const diff = totalFocusRecent7Days - totalFocusPrevious7Days;
            if (totalFocusRecent7Days > 0 || totalFocusPrevious7Days > 0) {
                const color = diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-white';
                const symbol = diff > 0 ? '▲' : diff < 0 ? '▼' : '';
                const text = diff === 0 ? '0m' : `${symbol} ${Math.abs(diff)}m`;
                card2Value = <div className={`text-2xl font-semibold ${color}`}>{text}</div>;
            } else {
                card2Value = <div className="text-2xl font-semibold text-white">-</div>;
            }
            
            card3 = { label: "Last Week", value: `${totalFocusPrevious7Days}m` };
        }

        const card2Label = (
             <div className="relative">
                <select
                    value={comparisonPeriod}
                    onChange={(e) => setComparisonPeriod(e.target.value as 'yesterday' | '7day')}
                    className="w-full bg-transparent text-xs text-white/80 mb-1 border-0 focus:ring-0 focus:outline-none text-center appearance-none cursor-pointer pr-5"
                    aria-label="Select comparison period"
                >
                    <option value="yesterday" className="bg-slate-800">vs Yesterday</option>
                    <option value="7day" className="bg-slate-800">vs Last Week</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="w-4 h-4 fill-current text-white/60" viewBox="0 0 20 20"><path d="M5.516 7.548c.436-.446 1.144-.446 1.584 0L10 10.42l2.9-2.872c.44-.446 1.148-.446 1.584 0 .44.446.44 1.152 0 1.596l-3.7 3.704c-.436.446-1.144.446-1.584 0l-3.7-3.704c-.44-.446-.44-1.152 0-1.596z"/></svg>
                </div>
            </div>
        );

        // --- NEW LOGIC: Pom-based calculations ---
        const allTasks = [...completedToday, ...tasksToday];
        // Exclude stopwatch tasks from estimated poms calculation as they don't have a fixed target.
        const pomsDone = allTasks.reduce((acc, task) => acc + (task.completed_poms || 0), 0);
        const pomsEst = allTasks.reduce((acc, task) => acc + (task.total_poms > 0 ? task.total_poms : 0), 0);
        
        const completionPercentage = pomsEst > 0 ? Math.round((pomsDone / pomsEst) * 100) : 0;
        
        const stats = { completionPercentage, pomsDone, pomsEst };

        const pomsRemaining = Math.max(0, pomsEst - pomsDone);
        const chartData = [
            { name: 'Poms Done', value: pomsDone },
            { name: 'Poms Remaining', value: pomsRemaining },
        ].filter(d => d.value > 0); // Only show slices with a value
        
        return { card1, card2: { label: card2Label, value: card2Value }, card3, stats, chartData };

    }, [historicalLogs, comparisonPeriod, completedToday, tasksToday]);


    const COLORS = ['#34D399', '#F87171'];

    const chartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );

    return (
        <>
            <Panel title="📊 Today's Progress">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <StatItem label={card1.label} value={card1.value} />
                    
                    <div className="bg-white/10 p-3 rounded-lg text-center">
                        {card2.label}
                        {card2.value}
                    </div>
                    
                    <StatItem label={card3.label} value={card3.value} />
                    <StatItem label="Completion %" value={`${stats.completionPercentage}%`} />
                    <StatItem label="Poms Done" value={stats.pomsDone} />
                    <StatItem label="Poms Estimated" value={stats.pomsEst} />
                </div>
                 <div className="flex justify-center items-center gap-2 mt-6 -mb-2">
                    <h3 className="text-md font-semibold text-white">Task Completion Breakdown</h3>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="p-1 text-purple-400 hover:text-purple-300 transition"
                        title="Get AI Insights for this chart"
                    >
                        <SparklesIcon />
                    </button>
                </div>
                <div className="h-56 mt-4">
                   {chartElement}
                </div>
            </Panel>
            <AIInsightModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                chartTitle="Today's Task Completion Breakdown"
                chartData={chartData}
                chartElement={<div className="h-56">{chartElement}</div>}
            />
        </>
    );
};

export default React.memo(StatsPanel);