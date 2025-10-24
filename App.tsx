
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task, DailyLog, Settings, AppState, Mode, Page } from './types';
import { getTodayDateString } from './utils/date';
import { playFocusStartSound, playFocusEndSound, playBreakStartSound, playBreakEndSound, playAlertLoop, resumeAudioContext } from './utils/audio';

import Navbar from './components/layout/Navbar';
import TimerPage from './pages/TimerPage';
import PlanPage from './pages/PlanPage';
import StatsPage from './pages/StatsPage';
import AICoachPage from './pages/AICoachPage';
import SettingsPage from './pages/SettingsPage';
import CompletionModal from './components/CompletionModal';

const App: React.FC = () => {
    const [settings, setSettings] = useState<Settings>({
        focusDuration: 25,
        breakDuration: 5,
        sessionsPerCycle: 2,
    });

    const [appState, setAppState] = useState<AppState>({
        mode: 'focus',
        currentSession: 1,
        timeRemaining: settings.focusDuration * 60,
        totalTime: settings.focusDuration * 60,
        isRunning: false,
        completedSessions: 0,
        totalFocusMinutes: 0,
        tasks: [],
        completedToday: [],
        tasksForTomorrow: [],
    });

    const [historyRange, setHistoryRange] = useState({
        start: getTodayDateString(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
        end: getTodayDateString(),
    });
    
    const [page, setPage] = useState<Page>('timer');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', message: '', nextMode: 'focus' as Mode, showCommentBox: false });

    const timerInterval = useRef<number | null>(null);
    const notificationInterval = useRef<number | null>(null);
    const wakeLock = useRef<any | null>(null); // Use 'any' for WakeLockSentinel for broader compatibility

    const stopTimer = useCallback(() => {
        if (!appState.isRunning) return;
        setAppState(prev => ({ ...prev, isRunning: false }));
        if (timerInterval.current) clearInterval(timerInterval.current);
        if (wakeLock.current) wakeLock.current.release().then(() => wakeLock.current = null);
    }, [appState.isRunning]);

    const resetTimer = useCallback(() => {
        stopTimer();
        setAppState(prev => ({
            ...prev,
            mode: 'focus',
            currentSession: 1,
            timeRemaining: settings.focusDuration * 60,
            totalTime: settings.focusDuration * 60,
        }));
    }, [stopTimer, settings.focusDuration]);

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
    

    const completePhase = useCallback(() => {
        stopTimer();
        notificationInterval.current = window.setInterval(playAlertLoop, 3000);
        playAlertLoop();

        if (appState.mode === 'focus') {
            playFocusEndSound();
            const newCompletedSessions = appState.completedSessions + 1;
            const newTotalFocusMinutes = appState.totalFocusMinutes + settings.focusDuration;
            
            setAppState(prev => ({
                ...prev,
                completedSessions: newCompletedSessions,
                totalFocusMinutes: newTotalFocusMinutes,
            }));

            if (appState.currentSession >= settings.sessionsPerCycle) {
                setModalContent({ title: '🎉 Full Cycle Complete!', message: 'Congratulations! You completed a full study cycle.<br/>Take a well-deserved break!', nextMode: 'break', showCommentBox: true });
            } else {
                setModalContent({ title: '⏰ Focus Complete!', message: 'Great work! Time for a break.', nextMode: 'break', showCommentBox: true });
            }
        } else {
            playBreakEndSound();
            const nextTaskMessage = appState.tasks.length > 0
                ? `Next task: <br><strong>${appState.tasks[0].text}</strong>`
                : 'Add a new task to get started!';
            setModalContent({ title: '⏰ Break Over!', message: nextTaskMessage, nextMode: 'focus', showCommentBox: false });
        }
        setIsModalVisible(true);
    }, [appState, settings, stopTimer]);

    useEffect(() => {
        if (appState.isRunning && appState.timeRemaining <= 0) {
            completePhase();
        }
        document.title = `${Math.floor(appState.timeRemaining / 60).toString().padStart(2, '0')}:${(appState.timeRemaining % 60).toString().padStart(2, '0')} - ${appState.mode === 'focus' ? 'Focus' : 'Break'}`;
    }, [appState.timeRemaining, appState.isRunning, appState.mode, completePhase]);

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
            } catch (err) {
                console.error('Wake Lock error:', err);
            }
        }

        if (appState.mode === 'focus') playFocusStartSound(); else playBreakStartSound();
    };

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
            totalTime: newTime,
        }));

        setIsModalVisible(false);
        startTimer();
    };
    
    const handleTaskCompletion = (comment: string) => {
        if (appState.tasks.length === 0) return;

        let currentTask = { ...appState.tasks[0] };
        currentTask.completedPoms++;
        if (comment) {
            currentTask.comments = [...(currentTask.comments || []), comment];
        }

        if (currentTask.completedPoms >= currentTask.totalPoms) {
            setAppState(prev => ({
                ...prev,
                tasks: prev.tasks.slice(1),
                completedToday: [...prev.completedToday, currentTask],
            }));
        } else {
            const newTasks = [...appState.tasks];
            newTasks[0] = currentTask;
            setAppState(prev => ({ ...prev, tasks: newTasks }));
        }
    };
    
    // Load state from localStorage on initial render
    useEffect(() => {
        try {
            const savedSettings = JSON.parse(localStorage.getItem('pomodoro-settings') || '{}');
            if (savedSettings.focusDuration) setSettings(savedSettings);

            const todayStr = getTodayDateString();
            const lastVisitedStr = localStorage.getItem('pomodoro-last-visited') || todayStr;
            let loadedState: Partial<AppState> = {};

            if (todayStr !== lastVisitedStr) {
                const pendingTasksFromYesterday = JSON.parse(localStorage.getItem('pomodoro-pending-tasks') || '[]');
                const yesterdaysLog = JSON.parse(localStorage.getItem(`pomodoro-log-${lastVisitedStr}`) || '{}');

                if (pendingTasksFromYesterday.length > 0 || (yesterdaysLog.completed && yesterdaysLog.completed.length > 0)) {
                    const archiveLog = {
                        completed: yesterdaysLog.completed || [],
                        incomplete: pendingTasksFromYesterday,
                        stats: yesterdaysLog.stats || { completedSessions: 0, totalFocusMinutes: 0 }
                    };
                    localStorage.setItem(`pomodoro-log-${lastVisitedStr}`, JSON.stringify(archiveLog));
                }

                loadedState.tasks = JSON.parse(localStorage.getItem('pomodoro-tasks-tomorrow') || '[]');
                loadedState.tasksForTomorrow = [];
                loadedState.completedToday = [];
                loadedState.completedSessions = 0;
                loadedState.totalFocusMinutes = 0;
            } else {
                loadedState.tasks = JSON.parse(localStorage.getItem('pomodoro-pending-tasks') || '[]');
                loadedState.tasksForTomorrow = JSON.parse(localStorage.getItem('pomodoro-tasks-tomorrow') || '[]');
                const todaysLog = JSON.parse(localStorage.getItem(`pomodoro-log-${todayStr}`) || '{}');
                loadedState.completedToday = todaysLog.completed || [];
                loadedState.completedSessions = todaysLog.stats?.completedSessions || 0;
                loadedState.totalFocusMinutes = todaysLog.stats?.totalFocusMinutes || 0;
            }

            const savedHistoryStart = localStorage.getItem('pomodoro-history-start');
            const savedHistoryEnd = localStorage.getItem('pomodoro-history-end');
            if(savedHistoryStart && savedHistoryEnd) {
              setHistoryRange({start: savedHistoryStart, end: savedHistoryEnd})
            }

            setAppState(prev => ({ ...prev, ...loadedState, timeRemaining: (savedSettings.focusDuration || 25) * 60, totalTime: (savedSettings.focusDuration || 25) * 60 }));
        } catch (e) {
            console.error("Failed to load from localStorage:", e);
        }
    }, []);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        try {
            const todayStr = getTodayDateString();
            const dailyLog: DailyLog = {
                completed: appState.completedToday,
                incomplete: appState.tasks,
                stats: {
                    completedSessions: appState.completedSessions,
                    totalFocusMinutes: appState.totalFocusMinutes,
                }
            };
            localStorage.setItem(`pomodoro-log-${todayStr}`, JSON.stringify(dailyLog));
            localStorage.setItem('pomodoro-pending-tasks', JSON.stringify(appState.tasks));
            localStorage.setItem('pomodoro-tasks-tomorrow', JSON.stringify(appState.tasksForTomorrow));
            localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
            localStorage.setItem('pomodoro-last-visited', todayStr);
            localStorage.setItem('pomodoro-history-start', historyRange.start);
            localStorage.setItem('pomodoro-history-end', historyRange.end);
        } catch (e) {
            console.error("Failed to save to localStorage:", e);
        }
    }, [appState, settings, historyRange]);

    const handleAddTask = (text: string, poms: number, isTomorrow: boolean) => {
        const newTask: Task = {
            id: Date.now().toString(),
            text,
            totalPoms: poms,
            completedPoms: 0,
            comments: []
        };
        if (isTomorrow) {
            setAppState(prev => ({ ...prev, tasksForTomorrow: [...prev.tasksForTomorrow, newTask] }));
        } else {
            setAppState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }));
        }
    };
    
    const handleDeleteTask = (id: string, isTomorrow: boolean) => {
        if (isTomorrow) {
            setAppState(prev => ({ ...prev, tasksForTomorrow: prev.tasksForTomorrow.filter(t => t.id !== id) }));
        } else {
            setAppState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
        }
    };

    const handleMoveTask = (id: string, action: 'postpone' | 'duplicate') => {
        const taskToMove = appState.tasks.find(t => t.id === id);
        if (!taskToMove) return;

        if (action === 'postpone') {
            setAppState(prev => ({
                ...prev,
                tasks: prev.tasks.filter(t => t.id !== id),
                tasksForTomorrow: [...prev.tasksForTomorrow, taskToMove]
            }));
        } else { // duplicate
            const duplicatedTask = { ...taskToMove, id: Date.now().toString(), completedPoms: 0, comments: [] };
            setAppState(prev => ({ ...prev, tasksForTomorrow: [...prev.tasksForTomorrow, duplicatedTask] }));
        }
    };

    const handleSaveSettings = (newSettings: Settings) => {
        setSettings(newSettings);
        resetTimer();
        setPage('timer'); // Navigate back to timer after saving
    };

    const renderPage = () => {
        switch (page) {
            case 'timer':
                return <TimerPage
                    appState={appState}
                    settings={settings}
                    startTimer={startTimer}
                    stopTimer={stopTimer}
                    resetTimer={resetTimer}
                    navigateToSettings={() => setPage('settings')}
                />;
            case 'plan':
                 return <PlanPage 
                    tasks={appState.tasks}
                    tasksForTomorrow={appState.tasksForTomorrow}
                    completedToday={appState.completedToday}
                    onAddTask={handleAddTask}
                    onDeleteTask={handleDeleteTask}
                    onMoveTask={handleMoveTask}
                    onReorderTasks={(reordered) => setAppState(p => ({ ...p, tasks: reordered }))}
                 />;
            case 'stats':
                return <StatsPage 
                    appState={appState}
                    historyRange={historyRange}
                    setHistoryRange={setHistoryRange}
                />;
            case 'ai':
                return <AICoachPage appState={appState} />;
            case 'settings':
                return <SettingsPage 
                    settings={settings}
                    onSave={handleSaveSettings}
                />;
            default:
                return <TimerPage
                    appState={appState}
                    settings={settings}
                    startTimer={startTimer}
                    stopTimer={stopTimer}
                    resetTimer={resetTimer}
                    navigateToSettings={() => setPage('settings')}
                />;
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto px-4">
            <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-4 sm:p-8 shadow-2xl border border-white/20 animate-slideIn">
                <Navbar currentPage={page} setPage={setPage} />
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
