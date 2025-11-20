
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

    const statsData = useMemo(() => {
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

        let card1Label = "Focus Time";
        let card1Value = `${totalFocusToday}m`;
        
        let diff = 0;
        let hasData = false;

        if (comparisonPeriod === 'yesterday') {
            card1Label = "Focus Time";
            card1Value = `${totalFocusToday}m`;
            
            if (totalFocusToday > 0 || totalFocusYesterday > 0) {
                diff = totalFocusToday - totalFocusYesterday;
                hasData = true;
            }
        } else { // '7day' which is now 'vs Last Week'
            card1Label = "This Week";
            card1Value = `${totalFocusRecent7Days}m`;
            
            if (totalFocusRecent7Days > 0 || totalFocusPrevious7Days > 0) {
                diff = totalFocusRecent7Days - totalFocusPrevious7Days;
                hasData = true;
            }
        }

        const pomsEst = allTasksForToday.reduce((acc, task) => acc + (task.total_poms > 0 ? task.total_poms : 0), 0);
        const completionPercentage = pomsEst > 0 ? Math.round((pomsDone / pomsEst) * 100) : 0;
        
        return { 
            card1Label, 
            card1Value, 
            diff, 
            hasData,
            completionPercentage, 
            pomsDone, 
            pomsEst 
        };

    }, [historicalLogs, comparisonPeriod, completedToday, tasksToday, dailyLog]);

    let card2Value;
    if (statsData.hasData) {
        if (statsData.diff > 0) {
            card2Value = <div className="text-4xl font-bold text-green-400 flex items-center justify-center gap-1"><UpArrowIcon /> {statsData.diff}m</div>;
        } else if (statsData.diff < 0) {
            card2Value = <div className="text-4xl font-bold text-red-400 flex items-center justify-center gap-1"><DownArrowIcon /> {Math.abs(statsData.diff)}m</div>;
        } else {
            card2Value = <div className="text-4xl font-bold text-white">0m</div>;
        }
    } else {
        card2Value = <div className="text-4xl font-bold text-white">-</div>;
    }

    return (
        <Panel title="Today's Progress" className="h-full">
            <div className="grid grid-cols-2 gap-4">
                <StatCard>
                    <div className="text-4xl font-bold text-white">{statsData.card1Value}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">{statsData.card1Label}</div>
                </StatCard>
                <StatCard>
                     <div className="relative inline-flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-colors group">
                        <select
                            value={comparisonPeriod}
                            onChange={(e) => setComparisonPeriod(e.target.value as 'yesterday' | '7day')}
                            className="bg-transparent text-sm text-white/80 border-0 focus:ring-0 focus:outline-none text-center appearance-none cursor-pointer py-1 pl-3 pr-7 w-full z-10 relative font-medium"
                            aria-label="Select comparison period"
                        >
                            <option value="yesterday" className="bg-slate-800 text-white">vs Yesterday</option>
                            <option value="7day" className="bg-slate-800 text-white">vs Last Week</option>
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/60 group-hover:text-white/80 transition-colors z-0">
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M5.516 7.548c.436-.446 1.144-.446 1.584 0L10 10.42l2.9-2.872c.44-.446 1.148-.446 1.584 0 .44.446.44 1.152 0 1.596l-3.7 3.704c-.436.446-1.144.446-1.584 0l-3.7-3.704c-.44-.446-.44-1.152 0-1.596z"/></svg>
                        </div>
                    </div>
                    <div className="mt-1">{card2Value}</div>
                </StatCard>
                <StatCard>
                    <div className="text-4xl font-bold text-white">{statsData.completionPercentage}%</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Completion</div>
                </StatCard>
                <StatCard>
                    <div className="text-4xl font-bold text-white">{`${statsData.pomsDone}/${statsData.pomsEst}`}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Poms Done</div>
                </StatCard>
            </div>
        </Panel>
    );
};

export default React.memo(StatsPanel);
