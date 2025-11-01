import React, { useState, useEffect, useCallback } from 'react';
import HistoryPanel from '../components/HistoryPanel';
import Spinner from '../components/common/Spinner';
import * as dbService from '../services/dbService';
import { DbDailyLog, Task, Project, Target, Settings, PomodoroHistory } from '../types';
import { getTodayDateString, getMonthStartDateString, getSevenDaysAgoDateString } from '../utils/date';
import AISummaryModal from '../components/common/AISummaryModal';
import { getTabSummary } from '../services/geminiService';
import { SparklesIcon } from '../components/common/Icons';

const StatsPage: React.FC = () => {
    const [historyRange, setHistoryRange] = useState(() => ({
        start: getSevenDaysAgoDateString(),
        end: getTodayDateString(),
    }));
    const [logs, setLogs] = useState<DbDailyLog[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [targets, setTargets] = useState<Target[]>([]);
    const [allTargets, setAllTargets] = useState<Target[]>([]);
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [pomodoroHistory, setPomodoroHistory] = useState<PomodoroHistory[]>([]);
    const [consistencyLogs, setConsistencyLogs] = useState<DbDailyLog[]>([]);
    const [timelinePomodoroHistory, setTimelinePomodoroHistory] = useState<PomodoroHistory[]>([]);
    const [consistencyPomodoroHistory, setConsistencyPomodoroHistory] = useState<PomodoroHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'categories' | 'priorities'>('dashboard');

    const [summaryModalState, setSummaryModalState] = useState<{ isOpen: boolean; title: string; fetcher: (() => Promise<string>) | null }>({
        isOpen: false,
        title: '',
        fetcher: null,
    });

    const fetchData = useCallback(async (start: string, end: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 29);
            const timelineStartDate = getTodayDateString(thirtyDaysAgo);
            const timelineEndDate = getTodayDateString(today);

            const oneEightyDaysAgo = new Date();
            oneEightyDaysAgo.setDate(today.getDate() - 179);
            const consistencyStartDate = getTodayDateString(oneEightyDaysAgo);

            const [
                fetchedLogs, fetchedTasks, fetchedProjects, fetchedTargets, 
                fetchedAllProjects, fetchedAllTasks, fetchedSettings,
                fetchedPomodoroHistory, fetchedConsistencyLogs,
                fetchedTimelineHistory, fetchedAllTargets,
                fetchedConsistencyPomodoroHistory
            ] = await Promise.all([
                dbService.getHistoricalLogs(start, end),
                dbService.getHistoricalTasks(start, end),
                dbService.getHistoricalProjects(start, end),
                dbService.getHistoricalTargets(start, end),
                dbService.getProjects(),
                dbService.getAllTasksForStats(),
                dbService.getSettings(),
                dbService.getPomodoroHistory(start, end),
                dbService.getConsistencyLogs(180), // Fetch last 6 months
                dbService.getPomodoroHistory(timelineStartDate, timelineEndDate),
                dbService.getTargets(),
                dbService.getPomodoroHistory(consistencyStartDate, timelineEndDate)
            ]);
            setLogs(fetchedLogs || []);
            setTasks(fetchedTasks || []);
            setProjects(fetchedProjects || []);
            setAllProjects(fetchedAllProjects || []);
            setTargets(fetchedTargets || []);
            setAllTargets(fetchedAllTargets || []);
            setAllTasks(fetchedAllTasks || []);
            setSettings(fetchedSettings || null);
            setPomodoroHistory(fetchedPomodoroHistory || []);
            setConsistencyLogs(fetchedConsistencyLogs || []);
            setTimelinePomodoroHistory(fetchedTimelineHistory || []);
            setConsistencyPomodoroHistory(fetchedConsistencyPomodoroHistory || []);
        } catch (err) {
            setError("Failed to load historical data. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(historyRange.start, historyRange.end);
    }, [historyRange, fetchData]);

    const handleOpenOverallSummary = useCallback(() => {
        if (isLoading) return;

        const title = `Overall AI Summary (${historyRange.start} to ${historyRange.end})`;
        
        const dataForSummary = {
            dateRange: historyRange,
            dailyLogs: logs,
            tasksInRange: tasks,
            projectsCompletedInRange: projects,
            targetsMetInRange: targets,
            consistencyLogs: consistencyLogs,
            pomodoroHistoryForTimeline: timelinePomodoroHistory,
        };

        const fetcher = () => getTabSummary("Overall History", dataForSummary);
        setSummaryModalState({ isOpen: true, title, fetcher });

    }, [isLoading, historyRange, logs, tasks, projects, targets, consistencyLogs, timelinePomodoroHistory]);

    const handleCloseSummaryModal = () => {
        setSummaryModalState({ isOpen: false, title: '', fetcher: null });
    };

    const tabs = [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'categories', label: 'Categories' },
        { key: 'priorities', label: 'Priorities' },
    ];
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    if (error) {
        return <div className="text-center text-red-400 bg-red-500/20 p-4 rounded-lg">{error}</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4 gap-4">
                <div className="flex-1"></div> {/* Left spacer */}
                <div className="flex justify-center gap-1 sm:gap-2 bg-slate-800/50 p-1 rounded-full max-w-xl mx-auto flex-grow">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`flex-1 p-2 text-xs sm:text-sm rounded-full font-bold transition-colors whitespace-nowrap ${
                                activeTab === tab.key
                                    ? 'bg-slate-700 text-white shadow-inner'
                                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                 <div className="flex-1 flex justify-end">
                    <button 
                        onClick={handleOpenOverallSummary}
                        className="flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200 font-semibold px-3 py-2 rounded-full hover:bg-white/10 transition whitespace-nowrap"
                        title="Get an AI-powered summary of your entire activity in the selected date range"
                    >
                        <SparklesIcon />
                        <span className="hidden lg:inline">Overall Summary</span>
                    </button>
                </div>
            </div>
            <HistoryPanel
                logs={logs}
                tasks={tasks}
                projects={projects}
                allProjects={allProjects}
                targets={targets}
                allTargets={allTargets}
                allTasks={allTasks}
                historyRange={historyRange}
                setHistoryRange={setHistoryRange}
                settings={settings}
                pomodoroHistory={pomodoroHistory}
                consistencyLogs={consistencyLogs}
                timelinePomodoroHistory={timelinePomodoroHistory}
                consistencyPomodoroHistory={consistencyPomodoroHistory}
                activeTab={activeTab}
            />
             {summaryModalState.isOpen && summaryModalState.fetcher && (
                <AISummaryModal
                    isOpen={summaryModalState.isOpen}
                    onClose={handleCloseSummaryModal}
                    title={summaryModalState.title}
                    fetcher={summaryModalState.fetcher}
                />
            )}
        </div>
    );
};

export default React.memo(StatsPage);