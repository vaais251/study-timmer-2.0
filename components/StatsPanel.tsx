import React, { useMemo, useState } from 'react';
import Panel from './common/Panel';
import { Task, DbDailyLog, PomodoroHistory } from '../types';
import { getTodayDateString } from '../utils/date';
import { UpArrowIcon, DownArrowIcon } from './common/Icons';

interface StatsPanelProps {
    completedToday: Task[];
    tasksToday: Task[];
    historicalLogs: DbDailyLog[];
    todaysHistory: PomodoroHistory[];
    dailyLog: DbDailyLog;
}

const StatCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-slate-800/70 p-4 rounded-xl text-center flex flex-col justify-center min-h-[100px]">
        {children}
    </div>
);

const StatsPanel: React.FC<StatsPanelProps> = ({ completedToday, tasksToday, historicalLogs, todaysHistory, dailyLog }) => {
    const [comparisonPeriod, setComparisonPeriod] = useState<'yesterday' | '7day'>('yesterday');

    const { card1, card2, stats } = useMemo(() => {
        const todayString = getTodayDateString();
        const today = new Date(todayString + 'T12:00:00');

        const dailyLogMap = new Map<string, DbDailyLog>();
        historicalLogs.forEach(log => {
            dailyLogMap.set(log.date, log);
        });

        const allTasksForToday = [...completedToday, ...tasksToday];
        
        const totalFocusToday = dailyLog.total_focus_minutes;

        const pomsDone = allTasksForToday.reduce((acc, task) => {
            if (task.total_poms > 0) {
                return acc + task.completed_poms;
            }
            return acc;
        }, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayLog = dailyLogMap.get(getTodayDateString(yesterday));
        const totalFocusYesterday = yesterdayLog?.total_focus_minutes || 0;
        
        const getRangeTotal = (endDate: Date, numDays: number): number => {
            let total = 0;
            const loopDate = new Date(endDate);
            for (let i = 0; i < numDays; i++) {
                const dateString = getTodayDateString(loopDate);
                total += dailyLogMap.get(dateString)?.total_focus_minutes || 0;
                loopDate.setDate(loopDate.getDate() - 1);
            }
            return total;
        };
        
        const totalFocusRecent7Days = getRangeTotal(today, 7);
        const previous7DaysEndDate = new Date(today);
        previous7DaysEndDate.setDate(today.getDate() - 7);
        const totalFocusPrevious7Days = getRangeTotal(previous7DaysEndDate, 7);

        let card1: { label: string, value: string };
        let card2Value: React.ReactNode;

        if (comparisonPeriod === 'yesterday') {
            card1 = { label: "Focus Time", value: `${totalFocusToday}m` };
            
            if (totalFocusToday > 0 || totalFocusYesterday > 0) {
                const diff = totalFocusToday - totalFocusYesterday;
                if (diff > 0) {
                    card2Value = <div className="text-4xl font-bold text-green-400 flex items-center justify-center gap-1"><UpArrowIcon /> {diff}m</div>;
                } else if (diff < 0) {
                    card2Value = <div className="text-4xl font-bold text-red-400 flex items-center justify-center gap-1"><DownArrowIcon /> {Math.abs(diff)}m</div>;
                } else {
                    card2Value = <div className="text-4xl font-bold text-white">0m</div>;
                }
            } else {
                card2Value = <div className="text-4xl font-bold text-white">-</div>;
            }
        } else { // '7day' which is now 'vs Last Week'
            card1 = { label: "This Week", value: `${totalFocusRecent7Days}m` };
            
            const diff = totalFocusRecent7Days - totalFocusPrevious7Days;
            if (totalFocusRecent7Days > 0 || totalFocusPrevious7Days > 0) {
                const color = diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-white';
                const Symbol = diff > 0 ? UpArrowIcon : DownArrowIcon;
                const text = diff === 0 ? '0m' : <><Symbol /> {Math.abs(diff)}m</>;
                card2Value = <div className={`text-4xl font-bold ${color} flex items-center justify-center gap-1`}>{text}</div>;
            } else {
                card2Value = <div className="text-4xl font-bold text-white">-</div>;
            }
        }

        const card2Label = (
             <div className="relative">
                <select
                    value={comparisonPeriod}
                    onChange={(e) => setComparisonPeriod(e.target.value as 'yesterday' | '7day')}
                    className="bg-transparent text-sm text-white/80 border-0 focus:ring-0 focus:outline-none text-center appearance-none cursor-pointer pr-5"
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

        const pomsEst = allTasksForToday.reduce((acc, task) => acc + (task.total_poms > 0 ? task.total_poms : 0), 0);
        const completionPercentage = pomsEst > 0 ? Math.round((pomsDone / pomsEst) * 100) : 0;
        const stats = { completionPercentage, pomsDone, pomsEst };
        
        return { card1, card2: { label: card2Label, value: card2Value }, stats };

    }, [historicalLogs, comparisonPeriod, completedToday, tasksToday, dailyLog]);

    return (
        <Panel title="Today's Progress" className="h-full">
            <div className="grid grid-cols-2 gap-4">
                <StatCard>
                    <div className="text-4xl font-bold text-white">{card1.value}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">{card1.label}</div>
                </StatCard>
                <StatCard>
                    {card2.label}
                    <div className="mt-1">{card2.value}</div>
                </StatCard>
                <StatCard>
                    <div className="text-4xl font-bold text-white">{stats.completionPercentage}%</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Completion</div>
                </StatCard>
                <StatCard>
                    <div className="text-4xl font-bold text-white">{`${stats.pomsDone}/${stats.pomsEst}`}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Poms Done</div>
                </StatCard>
            </div>
        </Panel>
    );
};

export default React.memo(StatsPanel);