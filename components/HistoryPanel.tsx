

import React, { useState, useMemo } from 'react';
import Panel from './common/Panel';
import { DbDailyLog, Task, Project, Target } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface HistoryPanelProps {
    logs: DbDailyLog[];
    tasks: Task[];
    allTasks: Task[];
    projects: Project[];
    allProjects: Project[];
    targets: Target[];
    historyRange: { start: string; end: string };
    setHistoryRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
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

const HistoryPanel: React.FC<HistoryPanelProps> = ({ logs, tasks, allTasks, projects, allProjects, targets, historyRange, setHistoryRange }) => {
    const [selectedDay, setSelectedDay] = useState<string>('');
    
    const aggregatedData = useMemo(() => {
        if (!logs || !tasks || !projects || !targets || !allTasks || !allProjects) {
            return {
                totalFocus: 0, totalSessions: 0, completedCount: 0, totalTasks: 0, 
                pomsDone: 0, pomsEst: 0, projectsCompleted: 0, targetsCompleted: 0,
                lineChartData: [], taskBreakdownData: [], projectBreakdownData: []
            };
        }

        const totalFocus = logs.reduce((acc, log) => acc + log.total_focus_minutes, 0);
        const totalSessions = logs.reduce((acc, log) => acc + log.completed_sessions, 0);
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
        
        return {
            totalFocus, totalSessions, completedCount, totalTasks, pomsDone, pomsEst, projectsCompleted, targetsCompleted,
            lineChartData, taskBreakdownData, projectBreakdownData
        };
    }, [logs, tasks, allTasks, projects, allProjects, targets, historyRange]);

    const selectedDayData = useMemo(() => {
        if (!selectedDay) return null;
        const logForDay = logs.find(l => l.date === selectedDay);
        const tasksForDay = tasks.filter(t => t.due_date === selectedDay);
        return { log: logForDay, tasks: tasksForDay };
    }, [selectedDay, logs, tasks]);
    
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
                <StatCard title="Time & Sessions">
                    <div className="flex justify-around items-center h-full">
                        <StatItem label="Focus Time" value={`${aggregatedData.totalFocus}m`} />
                        <StatItem label="Sessions" value={aggregatedData.totalSessions} />
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


            <div className="mt-8">
                <h3 className="text-lg font-semibold text-white text-center mb-2">View a Specific Day</h3>
                <div className="flex gap-2">
                    <input type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                </div>
                {selectedDayData ? (
                    <div className="bg-black/20 p-3 mt-3 rounded-lg text-white text-sm space-y-1">
                        <p><strong>Date:</strong> {selectedDay}</p>
                        <p><strong>Completed Sessions:</strong> {selectedDayData.log?.completed_sessions ?? '0'}</p>
                        <p><strong>Total Focus Minutes:</strong> {selectedDayData.log?.total_focus_minutes ?? '0'}</p>
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

        </Panel>
    );
};

export default HistoryPanel;