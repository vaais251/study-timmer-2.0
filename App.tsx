

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabaseClient';
import * as dbService from './services/dbService';
import { Task, Settings, Mode, Page, DbDailyLog } from './types';
import { getTodayDateString } from './utils/date';
import { playFocusStartSound, playFocusEndSound, playBreakStartSound, playBreakEndSound, playAlertLoop, resumeAudioContext } from './utils/audio';

import Navbar from './components/layout/Navbar';
import TimerPage from './pages/TimerPage';
import PlanPage from './pages/PlanPage';
import StatsPage from './pages/StatsPage';
import AICoachPage from './pages/AICoachPage';
import SettingsPage from './pages/SettingsPage';
import CompletionModal from './components/CompletionModal';
import AuthPage from './pages/AuthPage';
import Spinner from './components/common/Spinner';

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [settings, setSettings] = useState<Settings>({
        focusDuration: 25,
        breakDuration: 5,
        sessionsPerCycle: 2,
    });

    const [tasks, setTasks] = useState<Task[]>([]);
    
    const [dailyLog, setDailyLog] = useState<DbDailyLog>({
        date: getTodayDateString(),
        completed_sessions: 0,
        total_focus_minutes: 0,
    });

    const [appState, setAppState] = useState({
        mode: 'focus' as Mode,
        currentSession: 1,
        timeRemaining: settings.focusDuration * 60,
        isRunning: false,
    });

    const [page, setPage] = useState<Page>('timer');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', message: '', nextMode: 'focus' as Mode, showCommentBox: false });

    const timerInterval = useRef<number | null>(null);
    const notificationInterval = useRef<number | null>(null);
    const wakeLock = useRef<any | null>(null);

    // Derived state for tasks
    const todayString = getTodayDateString();
    const tasksToday = tasks.filter(t => t.due_date === todayString && !t.completed_at);
    const tasksForTomorrow = tasks.filter(t => t.due_date > todayString && !t.completed_at);
    const completedToday = tasks.filter(t => !!t.completed_at && t.due_date === todayString);
    const allIncompleteTasks = tasks.filter(t => !t.completed_at);
    const allCompletedTasks = tasks.filter(t => !!t.completed_at);


    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchData = useCallback(async () => {
        if (!session) return;
        setIsLoading(true);
        try {
            const [userSettings, userTasks, userDailyLog] = await Promise.all([
                dbService.getSettings(),
                dbService.getTasks(),
                dbService.getDailyLogForToday()
            ]);

            if (userSettings) setSettings(userSettings);
            if (userTasks) setTasks(userTasks);
            if (userDailyLog) setDailyLog(userDailyLog);
            
            setAppState(prev => ({
                ...prev,
                timeRemaining: (userSettings?.focusDuration || 25) * 60,
            }));

        } catch (error) {
            
        } finally {
            setIsLoading(false);
        }
    }, [session]);

    useEffect(() => {
        if (session) {
            fetchData();
        } else {
            setIsLoading(false); // Not logged in, stop loading
        }
    }, [session, fetchData]);
    
    // Stop Timer Logic
    const stopTimer = useCallback(() => {
        if (!appState.isRunning) return;
        setAppState(prev => ({ ...prev, isRunning: false }));
        if (timerInterval.current) clearInterval(timerInterval.current);
        if (wakeLock.current) wakeLock.current.release().then(() => wakeLock.current = null);
    }, [appState.isRunning]);

    // Reset Timer Logic
    const resetTimer = useCallback(() => {
        stopTimer();
        setAppState(prev => ({
            ...prev,
            mode: 'focus',
            currentSession: 1,
            timeRemaining: settings.focusDuration * 60,
        }));
    }, [stopTimer, settings.focusDuration]);

    // Start Timer Logic
    const startTimer = async () => {
        if (appState.isRunning) return;
        resumeAudioContext();
        setAppState(prev => ({ ...prev, isRunning: true }));
        
        timerInterval.current = window.setInterval(() => {
            setAppState(prev => ({ ...prev, timeRemaining: prev.timeRemaining - 1 }));
        }, 1000);

        if ('wakeLock' in navigator) {
            try {
                wakeLock.current = await navigator.wakeLock.request('screen');
            } catch (err: any) {
                // This error is not critical and can be ignored.
            }
        }

        if (appState.mode === 'focus') playFocusStartSound(); else playBreakStartSound();
    };

    // Phase Completion Logic
    const completePhase = useCallback(async () => {
        stopTimer();
        notificationInterval.current = window.setInterval(playAlertLoop, 3000);
        playAlertLoop();

        let newLog = { ...dailyLog };

        if (appState.mode === 'focus') {
            playFocusEndSound();
            newLog.completed_sessions++;
            newLog.total_focus_minutes += settings.focusDuration;
            
            setDailyLog(newLog);
            await dbService.upsertDailyLog(newLog);

            if (appState.currentSession >= settings.sessionsPerCycle) {
                setModalContent({ title: '🎉 Full Cycle Complete!', message: 'Congratulations! You completed a full study cycle.<br/>Take a well-deserved break!', nextMode: 'break', showCommentBox: true });
            } else {
                setModalContent({ title: '⏰ Focus Complete!', message: 'Great work! Time for a break.', nextMode: 'break', showCommentBox: true });
            }
        } else {
            playBreakEndSound();
            const activeTask = tasksToday.find(t => t.completed_at === null);
            const nextTaskMessage = activeTask
                ? `Next task: <br><strong>${activeTask.text}</strong>`
                : 'Add a new task to get started!';
            setModalContent({ title: '⏰ Break Over!', message: nextTaskMessage, nextMode: 'focus', showCommentBox: false });
        }
        setIsModalVisible(true);
    }, [appState, settings, stopTimer, tasksToday, dailyLog]);
    
    useEffect(() => {
        if (appState.isRunning && appState.timeRemaining <= 0) {
            completePhase();
        }
        document.title = `${Math.floor(appState.timeRemaining / 60).toString().padStart(2, '0')}:${(appState.timeRemaining % 60).toString().padStart(2, '0')} - ${appState.mode === 'focus' ? 'Focus' : 'Break'}`;
    }, [appState.timeRemaining, appState.isRunning, appState.mode, completePhase]);

    // Dynamic background effect
    useEffect(() => {
        const bgClass = appState.mode === 'focus'
            ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2]'
            : 'bg-gradient-to-br from-[#a8e063] to-[#56ab2f]';
        document.body.className = `${bgClass} transition-colors duration-1000 ease-in-out`;
        document.body.style.minHeight = '100vh';
        document.body.style.display = 'flex';
        document.body.style.justifyContent = 'center';
        document.body.style.alignItems = 'flex-start';
        document.body.style.paddingTop = '2.5rem';
        document.body.style.paddingBottom = '2.5rem';
        document.body.style.fontFamily = `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`;
    }, [appState.mode]);
    
    // Modal Continue Handler
    const handleModalContinue = (comment: string) => {
        if (notificationInterval.current) clearInterval(notificationInterval.current);
        
        if (modalContent.showCommentBox) {
            handleTaskCompletion(comment);
        }

        const nextMode = modalContent.nextMode;
        const newCurrentSession = nextMode === 'focus' 
            ? (appState.currentSession >= settings.sessionsPerCycle ? 1 : appState.currentSession + 1)
            : appState.currentSession;
        
        const newTime = (nextMode === 'focus' ? settings.focusDuration : settings.breakDuration) * 60;

        setAppState(prev => ({
            ...prev,
            mode: nextMode,
            currentSession: newCurrentSession,
            timeRemaining: newTime,
        }));

        setIsModalVisible(false);
        startTimer();
    };
    
    // Task Handlers
    const handleTaskCompletion = async (comment: string) => {
        const currentTask = tasksToday.find(t => t.completed_at === null);
        if (!currentTask) return;

        const updatedTask: Task = { ...currentTask };
        updatedTask.completed_poms++;
        if (comment) {
            updatedTask.comments = [...(updatedTask.comments || []), comment];
        }

        if (updatedTask.completed_poms >= updatedTask.total_poms) {
            updatedTask.completed_at = new Date().toISOString();
        }
        
        const newTasks = await dbService.updateTask(updatedTask);
        if (newTasks) setTasks(newTasks);
    };

    const handleAddTask = async (text: string, poms: number, isTomorrow: boolean) => {
        const newTasks = await dbService.addTask(text, poms, isTomorrow);
        if (newTasks) {
            setTasks(newTasks);
        }
    };
    
    const handleDeleteTask = async (id: string) => {
        const newTasks = await dbService.deleteTask(id);
        if (newTasks) setTasks(newTasks);
    };

    const handleMoveTask = async (id: string, action: 'postpone' | 'duplicate') => {
        const newTasks = await dbService.moveTask(id, action);
        if (newTasks) setTasks(newTasks);
    };
    
    const handleReorderTasks = async (reorderedTasks: Task[]) => {
        // Note: Supabase doesn't have a built-in way to save order easily without an order column.
        // For this app, we'll just update the local state for drag-and-drop reordering.
        // The order will reset on the next page load.
        const otherTasks = tasks.filter(t => t.due_date !== todayString || t.completed_at !== null);
        setTasks([...reorderedTasks, ...otherTasks]);
    };

    const handleSaveSettings = async (newSettings: Settings) => {
        await dbService.updateSettings(newSettings);
        setSettings(newSettings);
        resetTimer();
        setPage('timer'); // Navigate back to timer after saving
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setTasks([]);
        setDailyLog({ date: getTodayDateString(), completed_sessions: 0, total_focus_minutes: 0 });
        setPage('timer');
    };

    // Page Rendering Logic
    const renderPage = () => {
        switch (page) {
            case 'timer':
                return <TimerPage
                    tasksToday={tasksToday}
                    completedToday={completedToday}
                    dailyLog={dailyLog}
                    settings={settings}
                    appState={appState}
                    startTimer={startTimer}
                    stopTimer={stopTimer}
                    resetTimer={resetTimer}
                    navigateToSettings={() => setPage('settings')}
                />;
            case 'plan':
                 return <PlanPage 
                    tasksToday={tasksToday}
                    tasksForTomorrow={tasksForTomorrow}
                    completedToday={completedToday}
                    onAddTask={handleAddTask}
                    onDeleteTask={handleDeleteTask}
                    onMoveTask={handleMoveTask}
                    onReorderTasks={handleReorderTasks}
                 />;
            case 'stats':
                return <StatsPage />;
            case 'ai':
                return <AICoachPage 
                            completedTasks={allCompletedTasks} 
                            incompleteTasks={allIncompleteTasks} 
                       />;
            case 'settings':
                return <SettingsPage 
                    settings={settings}
                    onSave={handleSaveSettings}
                />;
            default:
                return <TimerPage
                    tasksToday={tasksToday}
                    completedToday={completedToday}
                    dailyLog={dailyLog}
                    settings={settings}
                    appState={appState}
                    startTimer={startTimer}
                    stopTimer={stopTimer}
                    resetTimer={resetTimer}
                    navigateToSettings={() => setPage('settings')}
                />;
        }
    };
    
    // Main Component Render
    if (isLoading) {
        return <div className="w-full h-screen flex items-center justify-center bg-gray-900"><Spinner /></div>;
    }

    if (!session) {
        return <AuthPage />;
    }

    return (
        <div className="w-full max-w-2xl mx-auto px-4">
            <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-4 sm:p-8 shadow-2xl border border-white/20 animate-slideIn">
                <Navbar currentPage={page} setPage={setPage} onLogout={handleLogout} />
                <main className="mt-4">
                    {renderPage()}
                </main>
            </div>
            {isModalVisible && (
                <CompletionModal
                    title={modalContent.title}
                    message={modalContent.message}
                    nextMode={modalContent.nextMode}
                    showCommentBox={modalContent.showCommentBox}
                    onContinue={handleModalContinue}
                />
            )}
            <style>{`
              @keyframes slideIn {
                  from { opacity: 0; transform: translateY(-30px); }
                  to { opacity: 1; transform: translateY(0); }
              }
              .animate-slideIn { animation: slideIn 0.5s ease-out; }
            `}</style>
        </div>
    );
};

export default App;