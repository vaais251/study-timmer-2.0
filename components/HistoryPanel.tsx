
import React, { useState, useMemo, useCallback } from 'react';
import Panel from './common/Panel';
import { AppState, DailyLog } from '../types';
import { getTodayDateString } from '../utils/date';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface HistoryPanelProps {
    appState: AppState;
    historyRange: { start: string; end: string };
    setHistoryRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
}

const StatItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div className="bg-white/10 p-3 rounded-lg text-center">
        <div className="text-xs text-white/80 mb-1">{label}</div>
        <div className="text-xl font-semibold text-white">{value}</div>
    </div>
);

const HistoryPanel: React.FC<HistoryPanelProps> = ({ appState, historyRange, setHistoryRange }) => {
    const [selectedDayLog, setSelectedDayLog] = useState<DailyLog | null>(null);
    const [selectedDay, setSelectedDay] = useState<string>('');
    
    const getLogsForRange = useCallback((startDateStr: string, endDateStr: string): { date: string, log: DailyLog }[] => {
        const logs = [];
        let currentDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        const todayStr = getTodayDateString();

        while (currentDate <= endDate) {
            const dateStr = getTodayDateString(currentDate);
            if (dateStr === todayStr) {
                logs.push({ date: dateStr, log: {
                    completed: appState.completedToday,
                    incomplete: appState.tasks,
                    stats: { completedSessions: appState.completedSessions, totalFocusMinutes: appState.totalFocusMinutes }
                }});
            } else {
                const logData = JSON.parse(localStorage.getItem(`pomodoro-log-${dateStr}`) || 'null');
                if (logData) {
                    logs.push({ date: dateStr, log: logData });
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return logs;
    }, [appState]);

    const aggregatedData = useMemo(() => {
        const logs = getLogsForRange(historyRange.start, historyRange.end);
        let totalFocus = 0;
        let totalSessions = 0;
        let completedCount = 0;
        let totalTasks = 0;
        let pomsDone = 0;
        let pomsEst = 0;

        logs.forEach(({log}) => {
            totalFocus += log.stats.totalFocusMinutes;
            totalSessions += log.stats.completedSessions;
            completedCount += log.completed.length;
            totalTasks += log.completed.length + log.incomplete.length;
            
            const allTasks = [...log.completed, ...log.incomplete];
            pomsDone += allTasks.reduce((acc, t) => acc + t.completedPoms, 0);
            pomsEst += allTasks.reduce((acc, t) => acc + t.totalPoms, 0);
        });

        const lastDayIncomplete = logs[logs.length-1]?.log.incomplete.length || 0;
        
        return {
            totalFocus,
            totalSessions,
            completedCount,
            totalTasks,
            pomsDone,
            pomsEst,
            completionPerc: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
            chartData: [
                { name: 'Completed', value: completedCount },
                { name: 'Incomplete', value: lastDayIncomplete },
            ],
            lineChartData: logs.map(({date, log}) => {
                const dailyTotal = log.completed.length + log.incomplete.length;
                return {
                    date,
                    completion: dailyTotal > 0 ? Math.round((log.completed.length / dailyTotal) * 100) : 0,
                }
            })
        };
    }, [historyRange, getLogsForRange]);
    
    const handleViewDayLog = () => {
        if (!selectedDay) return;
        const log = JSON.parse(localStorage.getItem(`pomodoro-log-${selectedDay}`) || 'null');
        setSelectedDayLog(log);
    }
    
    const COLORS = ['#34D399', '#F87171'];

    return (
        <Panel title="📜 Task History">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-white text-center mb-2">Historical Progress</h3>
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
                        <Pie data={aggregatedData.chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                             {aggregatedData.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            
            <div className="h-64 mt-6">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aggregatedData.lineChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                        <YAxis stroke="rgba(255,255,255,0.7)" unit="%" />
                        <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} />
                        <Legend />
                        <Line type="monotone" dataKey="completion" stroke="#8884d8" activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>


            <div className="mt-6">
                <h3 className="text-lg font-semibold text-white text-center mb-2">Single Day Log</h3>
                <div className="flex gap-2">
                    <input type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                    <button onClick={handleViewDayLog} className="px-4 rounded-lg font-bold text-white bg-gradient-to-br from-green-500 to-emerald-600">View</button>
                </div>
                {selectedDayLog && (
                    <div className="bg-black/20 p-3 mt-3 rounded-lg text-white text-sm">
                        <h4 className="font-bold">✅ Completed:</h4>
                        <ul className="list-disc list-inside pl-2">
                           {selectedDayLog.completed.map(t => <li key={t.id}>{t.text}</li>)}
                           {selectedDayLog.completed.length === 0 && <li>None</li>}
                        </ul>
                         <h4 className="font-bold mt-2">📝 Incomplete:</h4>
                        <ul className="list-disc list-inside pl-2">
                           {selectedDayLog.incomplete.map(t => <li key={t.id}>{t.text}</li>)}
                           {selectedDayLog.incomplete.length === 0 && <li>None</li>}
                        </ul>
                    </div>
                )}
            </div>

        </Panel>
    );
};

export default HistoryPanel;
