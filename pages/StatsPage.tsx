

import React, { useState, useEffect, useCallback } from 'react';
import HistoryPanel from '../components/HistoryPanel';
import Spinner from '../components/common/Spinner';
import * as dbService from '../services/dbService';
import { DbDailyLog, Task, Project, Target, Settings, PomodoroHistory } from '../types';
import { getTodayDateString, getMonthStartDateString } from '../utils/date';

const StatsPage: React.FC = () => {
    const [historyRange, setHistoryRange] = useState(() => ({
        start: getMonthStartDateString(),
        end: getTodayDateString(),
    }));
    const [logs, setLogs] = useState<DbDailyLog[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [targets, setTargets] = useState<Target[]>([]);
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [pomodoroHistory, setPomodoroHistory] = useState<PomodoroHistory[]>([]);
    const [consistencyLogs, setConsistencyLogs] = useState<DbDailyLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (start: string, end: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const [
                fetchedLogs, fetchedTasks, fetchedProjects, fetchedTargets, 
                fetchedAllProjects, fetchedAllTasks, fetchedSettings,
                fetchedPomodoroHistory, fetchedConsistencyLogs
            ] = await Promise.all([
                dbService.getHistoricalLogs(start, end),
                dbService.getHistoricalTasks(start, end),
                dbService.getHistoricalProjects(start, end),
                dbService.getHistoricalTargets(start, end),
                dbService.getProjects(),
                dbService.getAllTasksForStats(),
                dbService.getSettings(),
                dbService.getPomodoroHistory(start, end),
                dbService.getConsistencyLogs(180) // Fetch last 6 months
            ]);
            setLogs(fetchedLogs || []);
            setTasks(fetchedTasks || []);
            setProjects(fetchedProjects || []);
            setAllProjects(fetchedAllProjects || []);
            setTargets(fetchedTargets || []);
            setAllTasks(fetchedAllTasks || []);
            setSettings(fetchedSettings || null);
            setPomodoroHistory(fetchedPomodoroHistory || []);
            setConsistencyLogs(fetchedConsistencyLogs || []);
        } catch (err) {
            setError("Failed to load historical data. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(historyRange.start, historyRange.end);
    }, [historyRange, fetchData]);
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    if (error) {
        return <div className="text-center text-red-400 bg-red-500/20 p-4 rounded-lg">{error}</div>;
    }

    return (
        <HistoryPanel
            logs={logs}
            tasks={tasks}
            projects={projects}
            allProjects={allProjects}
            targets={targets}
            allTasks={allTasks}
            historyRange={historyRange}
            setHistoryRange={setHistoryRange}
            settings={settings}
            pomodoroHistory={pomodoroHistory}
            consistencyLogs={consistencyLogs}
        />
    );
};

export default StatsPage;
