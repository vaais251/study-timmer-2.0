

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
}

const StatItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div className="text-center">
        <div className="text-sm text-white/80 mb-1">{label}</div>
        <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
);

const StatCard: React.FC<{title: string, children: React.ReactNode}> = ({ title, children }) => (
    <div className="bg-white/5 p-4 rounded-xl">
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


const HistoryPanel: React.FC<HistoryPanelProps> = ({ logs, tasks, allTasks, projects, allProjects, targets, historyRange, setHistoryRange, settings, pomodoroHistory, consistencyLogs }) => {
    const [selectedDay, setSelectedDay] = useState<string>('');
    
    const aggregatedData = useMemo(() => {
        if (!logs || !tasks || !projects || !targets || !allTasks || !allProjects) {
            return {
                totalFocus: 0, completedCount: 0, totalTasks: 0, 
                pomsDone: 0, pomsEst: 0, projectsCompleted: 0, targetsCompleted: 0,
                lineChartData: [], 
                taskBreakdownData: [{ name: 'Completed', value: 0 }, { name: 'Pending', value: 0 }],
                projectBreakdownData: [{ name: 'Completed', value: 0 }, { name: 'Pending', value: 0 }],
                tagAnalysisData: []
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
            lineChartData, taskBreakdownData, projectBreakdownData, tagAnalysisData
        };
    }, [logs, tasks, allTasks, projects, allProjects, targets, historyRange, settings, pomodoroHistory]);

    const selectedDayData = useMemo(() => {
        if (!selectedDay) return null;

        const tasksForDay = tasks.filter(t => t.due_date === selectedDay);
        const pomodoroHistoryForDay = pomodoroHistory.filter(p => p.ended_at.startsWith(selectedDay));

        const completedTasksCount = tasksForDay.filter(t => t.completed_at).length;
        const totalTasksCount = tasksForDay.length;
        const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
        const totalFocusMinutes = pomodoroHistoryForDay.reduce((sum, record) => sum + (Number(record.duration_minutes) || 0), 0);
        
        return {
            tasks: tasksForDay,
            completedTasksCount,
            totalTasksCount,
            completionPercentage,
            totalFocusMinutes,
        };
    }, [selectedDay, tasks, pomodoroHistory]);
    
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
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-white text-center mb-2">Select Date Range</h3>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <input type="date" value={historyRange.start} onChange={e => setHistoryRange(p => ({...p, start: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                    <span className="text-white">to</span>
                    <input type="date" value={historyRange.end} onChange={e => setHistoryRange(p => ({...p, end: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
                <StatCard title="Time & Tasks">
                    <div className="flex justify-around items-center h-full">
                        <StatItem label="Focus Time" value={`${aggregatedData.totalFocus}m`} />
                        <StatItem label="Tasks Done" value={aggregatedData.completedCount} />
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

            <div className="h-64 mt-8">
                 <h3 className="text-lg font-semibold text-white text-center mb-2">Daily Task Completion %</h3>
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

            <div className="grid md:grid-cols-2 gap-6 mt-8">
                 <div className="h-56">
                    <h3 className="text-lg font-semibold text-white text-center mb-2">Overall Task Breakdown</h3>
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
                 <div className="h-56">
                    <h3 className="text-lg font-semibold text-white text-center mb-2">Overall Project Breakdown</h3>
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

            <div className="mt-8">
                <div className="h-96">
                    <h3 className="text-lg font-semibold text-white text-center mb-2">Focus Time by Category</h3>
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
                        <div className="flex items-center justify-center h-full text-white/60">
                            No tagged tasks with completed sessions in this date range.
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-8">
                <h3 className="text-lg font-semibold text-white text-center mb-2">View a Specific Day</h3>
                <div className="flex gap-2">
                    <input type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                </div>
                {selectedDayData ? (
                    <div className="bg-black/20 p-3 mt-3 rounded-lg text-white text-sm space-y-1">
                        <p><strong>Date:</strong> {selectedDay}</p>
                        <p><strong>Completed Tasks:</strong> {selectedDayData.completedTasksCount} / {selectedDayData.totalTasksCount}</p>
                        <p><strong>Task Completion:</strong> {selectedDayData.completionPercentage}%</p>
                        <p><strong>Total Focus Minutes:</strong> {selectedDayData.totalFocusMinutes}</p>
                        <h4 className="font-bold pt-2">Tasks for this day: ({selectedDayData.tasks.length})</h4>
                         {selectedDayData.tasks.length > 0 ? (
                            <ul className='list-disc list-inside'>
                                {selectedDayData.tasks.map(t => (
                                    <li key={t.id} className={t.completed_at ? 'text-green-400' : 'text-amber-400'}>{t.text} - {t.completed_at ? 'Completed' : 'Incomplete'}</li>
                                ))}
                            </ul>
                        ) : <p className="text-white/60">No tasks were due on this day.</p>}
                    </div>
                ) : selectedDay && (
                    <div className="bg-black/20 p-3 mt-3 rounded-lg text-white/70 text-sm text-center">
                        No data found for {selectedDay}.
                    </div>
                )}
            </div>

            <ConsistencyTracker logs={consistencyLogs} />

            <div className="mt-8">
                <div className="h-96">
                    <h3 className="text-lg font-semibold text-white text-center mb-2">Focus Distribution (%)</h3>
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
                        <div className="flex items-center justify-center h-full text-white/60">
                            No data to display.
                        </div>
                    )}
                </div>
            </div>
        </Panel>
    );
};

export default HistoryPanel;