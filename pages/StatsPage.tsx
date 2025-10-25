

import React, { useState, useEffect, useCallback } from 'react';
import HistoryPanel from '../components/HistoryPanel';
import Spinner from '../components/common/Spinner';
import * as dbService from '../services/dbService';
import { DbDailyLog, Task } from '../types';
import { getTodayDateString } from '../utils/date';

const StatsPage: React.FC = () => {
    const [historyRange, setHistoryRange] = useState(() => {
        const endDate = getTodayDateString();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 6);
        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate,
        };
    });
    const [logs, setLogs] = useState<DbDailyLog[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (start: string, end: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const [fetchedLogs, fetchedTasks] = await Promise.all([
                dbService.getHistoricalLogs(start, end),
                dbService.getHistoricalTasks(start, end)
            ]);
            setLogs(fetchedLogs || []);
            setTasks(fetchedTasks || []);
        } catch (err) {
            console.error("Error fetching historical data:", err);
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
            historyRange={historyRange}
            setHistoryRange={setHistoryRange}
        />
    );
};

export default StatsPage;
