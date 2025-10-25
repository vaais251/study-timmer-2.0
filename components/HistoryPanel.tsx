

import React, { useState, useMemo } from 'react';
import Panel from './common/Panel';
import { DbDailyLog, Task } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface HistoryPanelProps {
    logs: DbDailyLog[];
    tasks: Task[];
    historyRange: { start: string; end: string };
    setHistoryRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
}

const StatItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div className="bg-white/10 p-3 rounded-lg text-center">
        <div className="text-xs text-white/80 mb-1">{label}</div>
        <div className="text-xl font-semibold text-white">{value}</div>
    </div>
);

const HistoryPanel: React.FC<HistoryPanelProps> = ({ logs, tasks, historyRange, setHistoryRange }) => {
    const [selectedDay, setSelectedDay] = useState<string>('');
    
    const aggregatedData = useMemo(() => {
        if (!logs || !tasks) {
            return {
                totalFocus: 0, totalSessions: 0, completedCount: 0, totalTasks: 0, 
                pomsDone: 0, pomsEst: 0, completionPerc: 0,
                pieChartData: [], lineChartData: []
            };
        }

        const totalFocus = logs.reduce((acc, log) => acc + log.total_focus_minutes, 0);
        const totalSessions = logs.reduce((acc, log) => acc + log.completed_sessions, 0);

        const completedCount = tasks.filter(t => t.completed_at !== null).length;
        const totalTasks = tasks.length;
        const pomsDone = tasks.reduce((acc, t) => acc + t.completed_poms, 0);
        const pomsEst = tasks.reduce((acc, t) => acc + t.total_poms, 0);
        
        const completionPerc = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

        const lineChartData = logs.map(log => {
            const tasksForDay = tasks.filter(t => t.due_date === log.date);
            const completedForDay = tasksForDay.filter(t => t.completed_at !== null).length;
            const completion = tasksForDay.length > 0 ? Math.round((completedForDay / tasksForDay.length) * 100) : 0;
            return {
                date: new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                completion: completion,
            };
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return {
            totalFocus, totalSessions, completedCount, totalTasks, pomsDone, pomsEst, completionPerc,
            pieChartData: [
                { name: 'Completed Tasks', value: completedCount },
                { name: 'Incomplete Tasks', value: totalTasks - completedCount },
            ],
            lineChartData
        };
    }, [logs, tasks]);

    const selectedDayData = useMemo(() => {
        if (!selectedDay) return null;
        const logForDay = logs.find(l => l.date === selectedDay);
        const tasksForDay = tasks.filter(t => t.due_date === selectedDay);
        return { log: logForDay, tasks: tasksForDay };
    }, [selectedDay, logs, tasks]);
    
    const COLORS = ['#34D399', '#F87171'];

    return (
        <Panel title="📜 Task History">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-white text-center mb-2">Select Date Range</h3>
                <div className="flex items-center justify-center gap-2">
                    <input type="date" value={historyRange.start} onChange={e => setHistoryRange(p => ({...p, start: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                    <span className="text-white">to</span>
                    <input type="date" value={historyRange.end} onChange={e => setHistoryRange(p => ({...p, end: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                <StatItem label="Focus Time" value={`${aggregatedData.totalFocus}m`} />
                <StatItem label="Sessions" value={aggregatedData.totalSessions} />
                <StatItem label="Completion %" value={`${aggregatedData.completionPerc}%`} />
                <StatItem label="Total Tasks" value={aggregatedData.totalTasks} />
                <StatItem label="Poms Done" value={aggregatedData.pomsDone} />
                <StatItem label="Poms Est" value={aggregatedData.pomsEst} />
            </div>

            <div className="h-56 mt-6">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={aggregatedData.pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                             {aggregatedData.pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            
            <div className="h-64 mt-6">
                 <h3 className="text-lg font-semibold text-white text-center mb-2">Task Completion Over Time</h3>
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aggregatedData.lineChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                        <YAxis stroke="rgba(255,255,255,0.7)" unit="%" domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} />
                        <Legend />
                        <Line type="monotone" dataKey="completion" name="Task Completion %" stroke="#8884d8" activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-6">
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
