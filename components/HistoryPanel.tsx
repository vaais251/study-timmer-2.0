

import React, { useState, useMemo } from 'react';
import Panel from './common/Panel';
import { DbDailyLog, Task, Project, Target, Settings, PomodoroHistory } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { getTodayDateString } from '../utils/date';

interface HistoryPanelProps {
    logs: DbDailyLog[];
    tasks: Task[];
    allTasks: Task[];
    projects: Project[];
    allProjects: Project[];
    targets: Target[];
    historyRange: { start: string; end: string };
    setHistoryRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
    settings: Settings | null;
    pomodoroHistory: PomodoroHistory[];
    consistencyLogs: DbDailyLog[];
    timelinePomodoroHistory: PomodoroHistory[];
}

const formatMinutesToHours = (minutes: number) => {
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}m`;
};

const StatItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div className="text-center">
        <div className="text-sm text-white/80 mb-1">{label}</div>
        <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
);

const StatCard: React.FC<{title: string, children: React.ReactNode}> = ({ title, children }) => (
    <div className="bg-white/5 p-4 rounded-xl h-full flex flex-col justify-center">
        <h3 className="font-bold text-center mb-3 text-white/70 uppercase tracking-wider text-sm">{title}</h3>
        {children}
    </div>
);

// --- New Component: Consistency Tracker ---
const ConsistencyTracker: React.FC<{ logs: DbDailyLog[] }> = ({ logs }) => {
    const { weeks, monthLabels } = useMemo(() => {
        const activityMap: Map<string, number> = new Map(logs.map(log => [log.date, log.completed_sessions]));
        const today = new Date();
        const daysToShow = 180; // Approx 6 months
        const days = Array.from({ length: daysToShow }, (_, i) => {
            const date = new Date();
            date.setDate(today.getDate() - (daysToShow - 1 - i));
            return date;
        });

        const firstDayOfWeek = days[0].getDay(); // 0=Sun, 1=Mon, ...

        const allCells = [
            ...Array(firstDayOfWeek).fill(null),
            ...days.map(date => {
                const dateString = getTodayDateString(date);
                const percentage = activityMap.get(dateString) || 0;

                let colorClass = 'bg-gray-800'; // Corresponds to GitHub's no-contribution color
                if (percentage > 0 && percentage < 25) colorClass = 'bg-emerald-900';
                if (percentage >= 25 && percentage < 50) colorClass = 'bg-emerald-700';
                if (percentage >= 50 && percentage < 75) colorClass = 'bg-emerald-500';
                if (percentage >= 75) colorClass = 'bg-emerald-300';

                return {
                    date: dateString,
                    colorClass,
                    percentage,
                    month: date.getMonth(),
                };
            })
        ];

        const weeks = [];
        for (let i = 0; i < allCells.length; i += 7) {
            weeks.push(allCells.slice(i, i + 7));
        }

        const monthLabels: { name: string; startColumn: number }[] = [];
        let lastMonth = -1;
        weeks.forEach((week, colIndex) => {
            const firstDayOfNewMonthInWeek = week.find(day => day && day.month !== lastMonth);
            if (firstDayOfNewMonthInWeek) {
                lastMonth = firstDayOfNewMonthInWeek.month;
                if (colIndex > 0 || monthLabels.length === 0) {
                     monthLabels.push({
                        name: new Date(today.getFullYear(), lastMonth).toLocaleString('default', { month: 'short' }),
                        startColumn: colIndex,
                    });
                }
            }
        });

        return { weeks, monthLabels };
    }, [logs]);

    return (
        <div className="mt-8">
            <h3 className="text-lg font-semibold text-white text-center mb-4">Daily Consistency Tracker</h3>
            <div className="bg-black/20 p-4 rounded-lg overflow-x-auto">
                <div className="inline-block">
                    <div className="flex" style={{ paddingLeft: '2.5rem', paddingBottom: '0.5rem' }}>
                        {monthLabels.map((month, index) => {
                            const nextMonth = monthLabels[index + 1];
                            const colSpan = nextMonth ? nextMonth.startColumn - month.startColumn : weeks.length - month.startColumn;
                            // Cell width (w-3) is 12px, gap is 4px. Total per column = 16px.
                            return (
                                <div key={month.name} className="text-xs text-white/50" style={{ minWidth: `${colSpan * 16}px` }}>
                                    {month.name}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-3">
                        <div className="grid grid-rows-7 text-xs text-white/50 w-8 shrink-0 text-right pr-2">
                            <span></span>
                            <span className="self-center">Mon</span>
                            <span></span>
                            <span className="self-center">Wed</span>
                            <span></span>
                            <span className="self-center">Fri</span>
                            <span></span>
                        </div>
                        
                        <div className="flex gap-1">
                            {weeks.map((week, weekIndex) => (
                                <div key={weekIndex} className="grid grid-rows-7 gap-1">
                                    {week.map((day, dayIndex) => (
                                        day 
                                        ? <div 
                                            key={day.date} 
                                            className={`w-3 h-3 rounded-sm ${day.colorClass}`} 
                                            title={`${day.percentage}% tasks completed on ${day.date}`} 
                                          />
                                        : <div key={`ph-${weekIndex}-${dayIndex}`} className="w-3 h-3" />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end items-center mt-4 text-xs text-white/60 gap-2 pr-4">
                    <span>Less</span>
                    <div className="w-3 h-3 rounded-sm bg-gray-800"></div>
                    <div className="w-3 h-3 rounded-sm bg-emerald-900"></div>
                    <div className="w-3 h-3 rounded-sm bg-emerald-700"></div>
                    <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                    <div className="w-3 h-3 rounded-sm bg-emerald-300"></div>
                    <span>More</span>
                </div>
            </div>
        </div>
    );
};

const CategoryTimelineChart: React.FC<{ tasks: Task[], history: PomodoroHistory[] }> = ({ tasks, history }) => {
    const [view, setView] = useState<'month' | 'week'>('month');

    const chartData = useMemo(() => {
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - (view === 'month' ? 29 : 6));
        
        const startDateString = getTodayDateString(startDate);
        const endDateString = getTodayDateString(today);

        const filteredHistory = history.filter(h => {
            const hDate = h.ended_at.split('T')[0];
            return hDate >= startDateString && hDate <= endDateString;
        });

        const taskMap = new Map<string, Task>();
        tasks.forEach(task => taskMap.set(task.id, task));

        const dataByDate = new Map<string, { date: string, [key: string]: number | string }>();
        const allTags = new Set<string>();

        // Initialize date map for all days in the range
        const loopDate = new Date(startDate);
        while (loopDate <= today) {
            const dateStr = getTodayDateString(loopDate);
            dataByDate.set(dateStr, { date: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
            loopDate.setDate(loopDate.getDate() + 1);
        }

        filteredHistory.forEach(h => {
            const task = h.task_id ? taskMap.get(h.task_id) : null;
            if (task && task.tags && task.tags.length > 0) {
                const dateStr = h.ended_at.split('T')[0];
                const dayData = dataByDate.get(dateStr);
                if (dayData) {
                    task.tags.forEach(tag => {
                        const normalizedTag = tag.trim().toLowerCase();
                        if (normalizedTag) {
                            allTags.add(normalizedTag);
                            dayData[normalizedTag] = (dayData[normalizedTag] || 0) as number + (Number(h.duration_minutes) || 0);
                        }
                    });
                }
            }
        });
        
        const sortedTags = Array.from(allTags).sort();
        const finalData = Array.from(dataByDate.values());

        // Ensure all tags are present in all date objects for recharts
        finalData.forEach(dayData => {
            sortedTags.forEach(tag => {
                if (!dayData[tag]) {
                    dayData[tag] = 0;
                }
            });
        });

        return { data: finalData, tags: sortedTags };

    }, [view, tasks, history]);

    const COLORS = ['#F59E0B', '#10B981', '#38BDF8', '#EC4899', '#84CC16', '#F43F5E', '#6366F1'];
    
    return (
        <div className="mt-8">
            <h3 className="text-lg font-semibold text-white text-center mb-2">Category Focus Over Time</h3>
             <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full max-w-sm mx-auto">
                <button 
                    onClick={() => setView('week')} 
                    className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${view === 'week' ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                >
                    This Week
                </button>
                 <button 
                    onClick={() => setView('month')} 
                    className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${view === 'month' ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                >
                    This Month
                </button>
            </div>
            {chartData.data.length > 0 && chartData.tags.length > 0 ? (
                 <div className="h-96 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                            <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                            <YAxis stroke="rgba(255,255,255,0.7)" unit="m" />
                            <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} labelStyle={{ color: 'white', fontWeight: 'bold' }} />
                            <Legend wrapperStyle={{fontSize: "12px"}}/>
                            {chartData.tags.map((tag, index) => (
                                <Line 
                                    key={tag} 
                                    type="monotone" 
                                    dataKey={tag} 
                                    name={tag.charAt(0).toUpperCase() + tag.slice(1)}
                                    stroke={COLORS[index % COLORS.length]} 
                                    strokeWidth={2}
                                    dot={{ r: 2 }}
                                    activeDot={{ r: 6 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-64 flex items-center justify-center text-white/60 bg-black/10 rounded-lg">
                    <p>No tagged focus sessions found for this period.</p>
                </div>
            )}
        </div>
    );
};


const HistoryPanel: React.FC<HistoryPanelProps> = ({ logs, tasks, allTasks, projects, allProjects, targets, historyRange, setHistoryRange, settings, pomodoroHistory, consistencyLogs, timelinePomodoroHistory }) => {
    const [selectedDay, setSelectedDay] = useState<string>(getTodayDateString());
    const [detailViewType, setDetailViewType] = useState<'day' | 'week' | 'month' | 'all'>('day');

    const handleSetRange = (days: number) => {
        const today = getTodayDateString();
        const ago = new Date();
        ago.setDate(ago.getDate() - (days - 1));
        const startDate = getTodayDateString(ago);
        setHistoryRange({ start: startDate, end: today });
    };
    
    const aggregatedData = useMemo(() => {
        if (!logs || !tasks || !projects || !targets || !allTasks || !allProjects) {
            return {
                totalFocus: 0, completedCount: 0, totalTasks: 0, 
                pomsDone: 0, pomsEst: 0, projectsCompleted: 0, targetsCompleted: 0,
                lineChartData: [], 
                taskBreakdownData: [{ name: 'Completed', value: 0 }, { name: 'Pending', value: 0 }],
                projectBreakdownData: [{ name: 'Completed', value: 0 }, { name: 'Pending', value: 0 }],
                tagAnalysisData: [],
                focusLineChartData: []
            };
        }

        // Authoritative calculation for focus time, using pomodoro_history as the source of truth.
        const totalFocus = pomodoroHistory.reduce((acc, entry) => acc + (Number(entry.duration_minutes) || 0), 0);
        const completedCount = tasks.filter(t => t.completed_at !== null).length;
        const totalTasks = tasks.length;
        const pomsDone = tasks.reduce((acc, t) => acc + t.completed_poms, 0);
        const pomsEst = tasks.reduce((acc, t) => acc + t.total_poms, 0);
        const projectsCompleted = projects.length;
        const targetsCompleted = targets.length;

        const lineChartDataPoints = new Map<string, { total: number, completed: number }>();
        if (historyRange.start && historyRange.end) {
            let currentDate = new Date(historyRange.start + 'T00:00:00');
            const endDate = new Date(historyRange.end + 'T00:00:00');
            while(currentDate <= endDate) {
                const dateString = currentDate.toISOString().split('T')[0];
                lineChartDataPoints.set(dateString, { total: 0, completed: 0 });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        tasks.forEach(task => {
            if (lineChartDataPoints.has(task.due_date)) {
                const dayData = lineChartDataPoints.get(task.due_date)!;
                dayData.total++;
                if (task.completed_at) {
                    dayData.completed++;
                }
            }
        });

        const lineChartData = Array.from(lineChartDataPoints.entries()).map(([dateString, data]) => ({
            date: new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            completion: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
        }));
        
        const focusMinutesPerDay = new Map<string, number>();
        if (historyRange.start && historyRange.end) {
            let currentDate = new Date(historyRange.start + 'T00:00:00');
            const endDate = new Date(historyRange.end + 'T00:00:00');
            while(currentDate <= endDate) {
                const dateString = currentDate.toISOString().split('T')[0];
                focusMinutesPerDay.set(dateString, 0);
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        pomodoroHistory.forEach(entry => {
            const dateString = entry.ended_at.split('T')[0];
            if (focusMinutesPerDay.has(dateString)) {
                const currentMinutes = focusMinutesPerDay.get(dateString)!;
                focusMinutesPerDay.set(dateString, currentMinutes + (Number(entry.duration_minutes) || 0));
            }
        });

        const focusLineChartData = Array.from(focusMinutesPerDay.entries()).map(([dateString, minutes]) => ({
            date: new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            focusMinutes: minutes,
        }));

        const totalCompletedTasks = allTasks.filter(t => t.completed_at).length;
        const totalPendingTasks = allTasks.length - totalCompletedTasks;
        const taskBreakdownData = [
            { name: 'Completed', value: totalCompletedTasks },
            { name: 'Pending', value: totalPendingTasks },
        ];

        const totalCompletedProjects = allProjects.filter(p => p.completed_at).length;
        const totalPendingProjects = allProjects.length - totalCompletedProjects;
        const projectBreakdownData = [
            { name: 'Completed', value: totalCompletedProjects },
            { name: 'Pending', value: totalPendingProjects },
        ];
        
        const tagAnalysisData = (() => {
            // Authoritative calculation using pomodoro_history as the source of truth for time spent.
            // This ensures consistency with the Mastery Tracker.
            const taskMap = new Map<string, string[]>();
            allTasks.forEach(task => {
                if (task.id && task.tags?.length > 0) {
                    taskMap.set(task.id, task.tags);
                }
            });

            const tagFocusTimes = new Map<string, number>();

            pomodoroHistory.forEach(item => {
                if (item.task_id) {
                    const tags = taskMap.get(item.task_id);
                    if (tags) {
                        tags.forEach(tag => {
                            const normalizedTag = tag.trim().toLowerCase();
                            if (normalizedTag) {
                                const currentTotal = tagFocusTimes.get(normalizedTag) || 0;
                                tagFocusTimes.set(normalizedTag, currentTotal + (Number(item.duration_minutes) || 0));
                            }
                        });
                    }
                }
            });

            return Array.from(tagFocusTimes.entries())
                .map(([name, minutes]) => ({
                    name: name.charAt(0).toUpperCase() + name.slice(1),
                    minutes,
                }))
                .sort((a, b) => b.minutes - a.minutes);
        })();


        return {
            totalFocus, completedCount, totalTasks, pomsDone, pomsEst, projectsCompleted, targetsCompleted,
            lineChartData, taskBreakdownData, projectBreakdownData, tagAnalysisData, focusLineChartData
        };
    }, [logs, tasks, allTasks, projects, allProjects, targets, historyRange, settings, pomodoroHistory]);

    const detailedViewData = useMemo(() => {
        const today = getTodayDateString();
        let startDate = '';
        let endDate = '';
        let title = '';
    
        switch (detailViewType) {
            case 'day':
                if (!selectedDay) return null;
                startDate = selectedDay;
                endDate = selectedDay;
                title = new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                break;
            case 'week': {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 6);
                startDate = getTodayDateString(weekAgo);
                endDate = today;
                title = `Last 7 Days (${startDate} to ${endDate})`;
                break;
            }
            case 'month': {
                const monthAgo = new Date();
                monthAgo.setDate(monthAgo.getDate() - 29);
                startDate = getTodayDateString(monthAgo);
                endDate = today;
                title = `Last 30 Days (${startDate} to ${endDate})`;
                break;
            }
            case 'all': {
                startDate = historyRange.start;
                endDate = historyRange.end;
                title = `Selected Range (${startDate} to ${endDate})`;
                break;
            }
            default:
                return null;
        }
        
        if (!startDate || !endDate) return null;

        const tasksInRange = tasks.filter(t => t.due_date >= startDate && t.due_date <= endDate);
        const pomodoroHistoryInRange = pomodoroHistory.filter(p => {
            const pDate = p.ended_at.split('T')[0];
            return pDate >= startDate && pDate <= endDate;
        });

        const completedTasksCount = tasksInRange.filter(t => t.completed_at).length;
        const totalTasksCount = tasksInRange.length;
        const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
        const totalFocusMinutes = pomodoroHistoryInRange.reduce((sum, record) => sum + (Number(record.duration_minutes) || 0), 0);
        
        return {
            title,
            startDate,
            endDate,
            tasks: tasksInRange,
            completedTasksCount,
            totalTasksCount,
            completionPercentage,
            totalFocusMinutes,
        };
    }, [detailViewType, selectedDay, tasks, pomodoroHistory, historyRange]);
    
    const COLORS_TASKS = ['#34D399', '#F87171'];
    const COLORS_PROJECTS = ['#60A5FA', '#FBBF24'];
    const COLORS_PIE = ['#F59E0B', '#10B981', '#84CC16', '#EC4899', '#38BDF8', '#F43F5E', '#6366F1'];


    const pieChartData = useMemo(() => 
        aggregatedData.tagAnalysisData.map(item => ({ name: item.name, value: item.minutes })),
        [aggregatedData.tagAnalysisData]
    );

    const totalFocusMinutesInRange = useMemo(() => 
        pieChartData.reduce((sum, item) => sum + item.value, 0),
        [pieChartData]
    );

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        if (percent * 100 < 5) return null;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-sm font-bold">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <Panel title="📜 History & Progress">
            {/* --- Section 1: Controls --- */}
            <div className="mb-6 space-y-2">
                <h3 className="text-lg font-semibold text-white text-center">Select Date Range</h3>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <input type="date" value={historyRange.start} onChange={e => setHistoryRange(p => ({...p, start: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                    <span className="text-white">to</span>
                    <input type="date" value={historyRange.end} onChange={e => setHistoryRange(p => ({...p, end: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                </div>
                <div className="flex justify-center gap-2">
                    <button onClick={() => handleSetRange(7)} className="p-2 px-3 rounded-lg font-semibold text-white transition bg-white/10 hover:bg-white/20 text-xs sm:text-sm">Last 7 Days</button>
                    <button onClick={() => handleSetRange(30)} className="p-2 px-3 rounded-lg font-semibold text-white transition bg-white/10 hover:bg-white/20 text-xs sm:text-sm">Last 30 Days</button>
                </div>
            </div>

            {/* --- Section 2: KPIs --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
                <StatCard title="Time & Tasks">
                    <div className="flex justify-around items-center h-full">
                        <StatItem label="Focus Time" value={formatMinutesToHours(aggregatedData.totalFocus)} />
                        <StatItem label="Tasks Done" value={`${aggregatedData.completedCount} / ${aggregatedData.totalTasks}`} />
                    </div>
                </StatCard>
                <StatCard title="Task Progress">
                    <div className="grid grid-cols-2 gap-y-2">
                        <StatItem label="Tasks Done" value={aggregatedData.completedCount} />
                        <StatItem label="Tasks in Range" value={aggregatedData.totalTasks} />
                        <StatItem label="Poms Done" value={aggregatedData.pomsDone} />
                        <StatItem label="Poms Est" value={aggregatedData.pomsEst} />
                    </div>
                </StatCard>
                 <StatCard title="Achievements">
                     <div className="flex justify-around items-center h-full">
                        <StatItem label="Projects Done" value={aggregatedData.projectsCompleted} />
                        <StatItem label="Targets Met" value={aggregatedData.targetsCompleted} />
                    </div>
                </StatCard>
            </div>

            {/* --- Section 3: Consistency Tracker --- */}
            <ConsistencyTracker logs={consistencyLogs} />

            {/* --- Section 4: Time-based Trends --- */}
            <div className="mt-8 space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-white text-center mb-2">Daily Focus Minutes</h3>
                    <div className="h-72">
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={aggregatedData.focusLineChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                                <YAxis stroke="rgba(255,255,255,0.7)" unit="m" />
                                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} labelStyle={{ color: 'white', fontWeight: 'bold' }} />
                                <Legend wrapperStyle={{fontSize: "12px"}}/>
                                <Line type="monotone" dataKey="focusMinutes" name="Focus Minutes" stroke="#34D399" activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-white text-center mb-2">Daily Task Completion %</h3>
                    <div className="h-72">
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={aggregatedData.lineChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                                <YAxis stroke="rgba(255,255,255,0.7)" unit="%" domain={[0, 100]} />
                                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} labelStyle={{ color: 'white', fontWeight: 'bold' }} />
                                <Legend wrapperStyle={{fontSize: "12px"}}/>
                                <Line type="monotone" dataKey="completion" name="Task Completion %" stroke="#f59e0b" activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* --- Section 5: Focus Breakdown --- */}
            <div className="mt-8 space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-white text-center mb-2">Focus Time by Category</h3>
                    <div className="h-96">
                        {aggregatedData.tagAnalysisData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={aggregatedData.tagAnalysisData}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                                    <XAxis type="number" stroke="rgba(255,255,255,0.7)" unit="m" />
                                    <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.7)" width={80} tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                                        contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                                        itemStyle={{ color: 'white' }} 
                                        labelStyle={{ color: 'white', fontWeight: 'bold' }}
                                        formatter={(value: number) => [`${value} minutes`, 'Focus Time']}
                                    />
                                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                                    <Bar dataKey="minutes" name="Focus Minutes" fill="#f59e0b" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-white/60 bg-black/10 rounded-lg">
                                No tagged tasks with completed sessions in this date range.
                            </div>
                        )}
                    </div>
                </div>
                <div>
                     <h3 className="text-lg font-semibold text-white text-center mb-2">Focus Distribution (%)</h3>
                    <div className="h-96">
                         {pieChartData.length > 0 ? (
                            <div className="w-full h-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieChartData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={renderCustomizedLabel}
                                            outerRadius={110}
                                            innerRadius={70}
                                            fill="#8884d8"
                                            dataKey="value"
                                            paddingAngle={2}
                                        >
                                            {pieChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                                            itemStyle={{ color: 'white' }}
                                            formatter={(value: number) => [`${value} minutes`, 'Focus Time']}
                                        />
                                        <Legend wrapperStyle={{ bottom: 0 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                                    <span className="text-4xl font-bold text-white">{totalFocusMinutesInRange}</span>
                                    <span className="block text-sm text-white/70">Total Mins</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-white/60 bg-black/10 rounded-lg">
                                No data to display.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- Section 6: Category Timeline --- */}
            <CategoryTimelineChart tasks={allTasks} history={timelinePomodoroHistory} />

            {/* --- Section 7: Overall Stats --- */}
            <div className="mt-8 space-y-6">
                 <div>
                    <h3 className="text-lg font-semibold text-white text-center mb-2">Overall Task Breakdown</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={aggregatedData.taskBreakdownData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                                    {aggregatedData.taskBreakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_TASKS[index % COLORS_TASKS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} />
                                <Legend wrapperStyle={{fontSize: "12px"}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                 <div>
                    <h3 className="text-lg font-semibold text-white text-center mb-2">Overall Project Breakdown</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={aggregatedData.projectBreakdownData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                                    {aggregatedData.projectBreakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_PROJECTS[index % COLORS_PROJECTS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} />
                                <Legend wrapperStyle={{fontSize: "12px"}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* --- Section 8: Detailed Drill-down --- */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold text-white text-center mb-2">Detailed Breakdown</h3>
                <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full max-w-lg mx-auto">
                    {(['day', 'week', 'month', 'all'] as const).map(type => (
                        <button 
                            key={type} 
                            onClick={() => setDetailViewType(type)} 
                            className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${detailViewType === type ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                        >
                            {type === 'day' ? 'Day' : type === 'week' ? 'Last 7 Days' : type === 'month' ? 'Last 30 Days' : 'Date Range'}
                        </button>
                    ))}
                </div>
                {detailViewType === 'day' && (
                  <div className="flex gap-2 max-w-sm mx-auto">
                      <input type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                  </div>
                )}
                {detailedViewData ? (
                    <div className="bg-black/20 p-3 mt-3 rounded-lg text-white text-sm space-y-1 max-w-lg mx-auto">
                        <p><strong>{detailedViewData.startDate === detailedViewData.endDate ? 'Date' : 'Period'}:</strong> {detailedViewData.title}</p>
                        <p><strong>Completed Tasks:</strong> {detailedViewData.completedTasksCount} / {detailedViewData.totalTasksCount}</p>
                        <p><strong>Task Completion:</strong> {detailedViewData.completionPercentage}%</p>
                        <p><strong>Total Focus Minutes:</strong> {detailedViewData.totalFocusMinutes}</p>
                        <h4 className="font-bold pt-2">Tasks ({detailedViewData.tasks.length}):</h4>
                         {detailedViewData.tasks.length > 0 ? (
                            <ul className='list-disc list-inside max-h-48 overflow-y-auto pr-2 space-y-1'>
                                {detailedViewData.tasks.sort((a,b) => a.due_date.localeCompare(b.due_date)).map(t => (
                                    <li key={t.id} className={t.completed_at ? 'text-green-400' : 'text-amber-400'}>
                                        <span className="font-mono text-xs">{t.due_date}:</span> {t.text} - {t.completed_at ? 'Completed' : 'Incomplete'}
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-white/60">No tasks were due in this period.</p>}
                    </div>
                ) : (
                    <div className="bg-black/20 p-3 mt-3 rounded-lg text-white/70 text-sm text-center max-w-lg mx-auto">
                         {detailViewType === 'day' ? 'Select a day to see details.' : 'Loading data...'}
                    </div>
                )}
            </div>

        </Panel>
    );
};

export default HistoryPanel;