

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
    const data = useMemo(() => {
        // The `logs` prop now contains the completion percentage in `completed_sessions`.
        const activityMap: Map<string, number> = new Map(logs.map(log => [log.date, log.completed_sessions]));
        const today = new Date();
        const days = Array.from({ length: 180 }, (_, i) => {
            const date = new Date();
            date.setDate(today.getDate() - i);
            return date;
        }).reverse();

        const firstDayOfWeek = days[0].getDay();
        const placeholders = Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`ph-${i}`} className="w-4 h-4" />);
        
        const cells = days.map(date => {
            const dateString = getTodayDateString(date);
            const percentage = activityMap.get(dateString) || 0;
            
            // Color thresholds are now based on completion percentage.
            let colorClass = 'bg-white/10'; // 0%
            if (percentage > 0) colorClass = 'bg-green-500/30';   // 1-24%
            if (percentage >= 25) colorClass = 'bg-green-500/50';  // 25-49%
            if (percentage >= 50) colorClass = 'bg-green-500/70';  // 50-74%
            if (percentage >= 75) colorClass = 'bg-green-500/90';  // 75-99%
            if (percentage === 100) colorClass = 'bg-green-500';   // 100%

            // Tooltip now shows the completion percentage.
            return <div key={dateString} className={`w-4 h-4 rounded-sm ${colorClass}`} title={`${percentage}% tasks completed on ${dateString}`} />;
        });

        return [...placeholders, ...cells];
    }, [logs]);

    const monthLabels = useMemo(() => {
        const months = [];
        let lastMonth = -1;
        for (let i = 180 - 1; i >= 0; i -= 7) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const month = date.getMonth();
            if (month !== lastMonth) {
                months.push(date.toLocaleString('default', { month: 'short' }));
                lastMonth = month;
            }
        }
        return months;
    }, []);

    return (
        <div className="mt-8">
            <h3 className="text-lg font-semibold text-white text-center mb-2">Daily Consistency Tracker</h3>
            <div className="bg-black/20 p-3 rounded-lg overflow-x-auto">
                <div className="flex justify-end gap-x-[72px] pr-2 mb-1">
                    {monthLabels.map((m, i) => <span key={i} className="text-xs text-white/50">{m}</span>)}
                </div>
                <div className="grid grid-flow-col grid-rows-7 gap-1">{data}</div>
            </div>
        </div>
    );
};

// --- New Component: Focus Heatmap ---
const FocusHeatmap: React.FC<{ history: PomodoroHistory[] }> = ({ history }) => {
    const heatmapData = useMemo(() => {
        const grid = Array(7).fill(0).map(() => Array(24).fill(0));
        let maxMinutes = 0;

        history.forEach(item => {
            const date = new Date(item.ended_at);
            const day = date.getDay(); // Sunday = 0, Saturday = 6
            const hour = date.getHours();
            grid[day][hour] += Number(item.duration_minutes) || 0; // Ensure duration is a number
            if (grid[day][hour] > maxMinutes) {
                maxMinutes = grid[day][hour];
            }
        });

        return { grid, maxMinutes };
    }, [history]);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = ['12am', '6am', '12pm', '6pm', '11pm'];

    return (
        <div className="mt-8">
            <h3 className="text-lg font-semibold text-white text-center mb-2">Weekly Focus Heatmap</h3>
            <div className="bg-black/20 p-3 rounded-lg text-xs text-white/60 flex gap-2">
                <div className="flex flex-col justify-between pt-1">
                    {days.map(day => <div key={day} className="h-2">{day}</div>)}
                </div>
                <div className="flex-grow">
                    <div className="grid grid-cols-24 gap-px">
                        {heatmapData.grid.flat().map((minutes, i) => {
                            const opacity = heatmapData.maxMinutes > 0 ? minutes / heatmapData.maxMinutes : 0;
                            return (
                                <div
                                    key={i}
                                    className="w-full h-2 rounded-sm"
                                    style={{ backgroundColor: `rgba(67, 56, 202, ${opacity})` }}
                                    title={`${minutes} focus minutes`}
                                />
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-1">
                         {hours.map(hour => <span key={hour}>{hour}</span>)}
                    </div>
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
            const tagFocusTimes = new Map<string, number>();
            // FIX: Use optional chaining and provide a default of 25 minutes.
            // This makes the chart resilient to cases where settings haven't been saved yet.
            const defaultFocusDuration = settings?.focusDuration || 25;

            tasks.forEach(task => {
                if (task.completed_poms > 0 && Array.isArray(task.tags) && task.tags.length > 0) {
                    const durationPerPom = task.custom_focus_duration || defaultFocusDuration;
                    const totalFocusForTask = task.completed_poms * durationPerPom;
                    task.tags.forEach(tag => {
                        const tagKey = tag.trim().toLowerCase();
                        if (tagKey) {
                            const currentTotal = tagFocusTimes.get(tagKey) || 0;
                            tagFocusTimes.set(tagKey, currentTotal + totalFocusForTask);
                        }
                    });
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
                        <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} />
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
                            <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} />
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
                            <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} />
                            <Legend wrapperStyle={{fontSize: "12px"}}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="h-80 mt-8">
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
                                formatter={(value: number) => [`${value} minutes`, 'Focus Time']}
                            />
                            <Legend wrapperStyle={{fontSize: "12px"}}/>
                            <Bar dataKey="minutes" name="Focus Minutes" fill="#8884d8" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-white/60">
                        No tagged tasks with completed sessions in this date range.
                    </div>
                )}
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

            <FocusHeatmap history={pomodoroHistory} />

        </Panel>
    );
};

export default HistoryPanel;