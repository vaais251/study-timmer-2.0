
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabaseClient';
import * as dbService from './services/dbService';
import { Task, Settings, Mode, Page, DbDailyLog, Project, Goal, Target, AppState } from './types';
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
import GoalsPage from './pages/GoalsPage';

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isStateRestored, setIsStateRestored] = useState(false);

    const [settings, setSettings] = useState<Settings>({
        focusDuration: 25,
        breakDuration: 5,
        sessionsPerCycle: 2,
    });

    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [targets, setTargets] = useState<Target[]>([]);
    
    const [dailyLog, setDailyLog] = useState<DbDailyLog>({
        date: getTodayDateString(),
        completed_sessions: 0,
        total_focus_minutes: 0,
    });

    const [appState, setAppState] = useState<AppState>({
        mode: 'focus',
        currentSession: 1,
        timeRemaining: settings.focusDuration * 60,
        sessionTotalTime: settings.focusDuration * 60,
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
            const [userSettings, userTasks, userDailyLog, userProjects, userGoals, userTargets] = await Promise.all([
                dbService.getSettings(),
                dbService.getTasks(),
                dbService.getDailyLogForToday(),
                dbService.getProjects(),
                dbService.getGoals(),
                dbService.getTargets()
            ]);

            if (userSettings) setSettings(userSettings);
            if (userTasks) setTasks(userTasks);
            if (userDailyLog) setDailyLog(userDailyLog);
            if (userProjects) setProjects(userProjects);
            if (userGoals) setGoals(userGoals);
            if (userTargets) setTargets(userTargets);
            
            const firstTask = userTasks?.filter(t => t.due_date === getTodayDateString() && !t.completed_at)[0];
            const initialFocusTime = firstTask?.custom_focus_duration || userSettings?.focusDuration || 25;

            setAppState(prev => ({
                ...prev,
                timeRemaining: initialFocusTime * 60,
                sessionTotalTime: initialFocusTime * 60,
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
    
    // This effect ensures the timer display is always in sync with the current task's settings when paused.
    useEffect(() => {
        // This effect's job is to sync the PAUSED timer to the CURRENT task's settings.
        if (appState.isRunning) {
            return; // Don't interfere with a running timer.
        }

        if (appState.mode === 'focus') {
            const currentTask = tasks.find(t => t.due_date === getTodayDateString() && !t.completed_at);
            const newTimeInSeconds = (currentTask?.custom_focus_duration || settings.focusDuration) * 60;
            
            // Only update state if the time is actually different.
            if (appState.timeRemaining !== newTimeInSeconds) {
                setAppState(prev => ({
                    ...prev,
                    timeRemaining: newTimeInSeconds,
                    sessionTotalTime: newTimeInSeconds,
                }));
            }
        }
        // No 'else' for break mode. The break timer is set when a focus session ends, which is sufficient.
    }, [tasks, appState.isRunning, appState.mode, settings.focusDuration]);


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
        const firstTask = tasksToday.find(t => !t.completed_at);
        const focusTime = (firstTask?.custom_focus_duration || settings.focusDuration) * 60;

        setAppState(prev => ({
            ...prev,
            mode: 'focus',
            currentSession: 1,
            timeRemaining: focusTime,
            sessionTotalTime: focusTime,
        }));
    }, [stopTimer, settings.focusDuration, tasksToday]);

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
            
            const currentTask = tasksToday.find(t => !t.completed_at);
            const focusDuration = currentTask?.custom_focus_duration || settings.focusDuration;
            newLog.total_focus_minutes += focusDuration;
            
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
    
    // --- STATE PERSISTENCE LOGIC ---
    useEffect(() => {
        const handleBeforeUnload = () => {
            const isPristine = !appState.isRunning && appState.timeRemaining === appState.sessionTotalTime;
            if (!isPristine) {
                const stateToSave = {
                    savedAppState: appState,
                    timestamp: Date.now(),
                };
                localStorage.setItem('pomodoroAppState', JSON.stringify(stateToSave));
            } else {
                localStorage.removeItem('pomodoroAppState');
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [appState]);

    useEffect(() => {
        if (!isLoading && session && !isStateRestored) {
            const savedStateJSON = localStorage.getItem('pomodoroAppState');
            if (savedStateJSON) {
                try {
                    const { savedAppState, timestamp } = JSON.parse(savedStateJSON);

                    if (savedAppState.isRunning) {
                        const elapsedSeconds = Math.floor((Date.now() - timestamp) / 1000);
                        const newTimeRemaining = savedAppState.timeRemaining - elapsedSeconds;

                        if (newTimeRemaining > 0) {
                            const restoredState = { ...savedAppState, timeRemaining: newTimeRemaining };
                            setAppState(restoredState);
                            timerInterval.current = window.setInterval(() => {
                                setAppState(prev => ({ ...prev, timeRemaining: prev.timeRemaining - 1 }));
                            }, 1000);
                            if ('wakeLock' in navigator) {
                                navigator.wakeLock.request('screen').then(lock => {
                                    wakeLock.current = lock;
                                }).catch(() => {});
                            }
                        } else {
                            setAppState({ ...savedAppState, timeRemaining: 0 });
                        }
                    } else {
                        setAppState(savedAppState);
                    }
                } catch (e) {
                    localStorage.removeItem('pomodoroAppState');
                }
            }
            setIsStateRestored(true);
        }
    }, [isLoading, session, isStateRestored]);
    // --- END STATE PERSISTENCE LOGIC ---

    // Modal Continue Handler
    const handleModalContinue = async (comment: string) => {
        if (notificationInterval.current) clearInterval(notificationInterval.current);
        
        let updatedTasks = [...tasks];
        const wasFocusSession = modalContent.showCommentBox;

        const taskJustWorkedOn = tasksToday.find(t => t.completed_at === null);

        if (wasFocusSession) {
            const result = await handleTaskCompletion(comment);
            if (result) {
                updatedTasks = tasks.map(t => t.id === result.id ? result : t);
            }
        }

        const nextMode = modalContent.nextMode;
        const newCurrentSession = nextMode === 'focus' 
            ? (appState.currentSession >= settings.sessionsPerCycle ? 1 : appState.currentSession + 1)
            : appState.currentSession;
        
        let newTime;
        const updatedTasksToday = updatedTasks.filter(t => t.due_date === getTodayDateString() && !t.completed_at);

        if (nextMode === 'break') {
            newTime = (taskJustWorkedOn?.custom_break_duration || settings.breakDuration) * 60;
        } else {
            const nextTask = updatedTasksToday[0];
            newTime = (nextTask?.custom_focus_duration || settings.focusDuration) * 60;
        }

        setAppState(prev => ({
            ...prev,
            mode: nextMode,
            currentSession: newCurrentSession,
            timeRemaining: newTime,
            sessionTotalTime: newTime,
        }));

        setIsModalVisible(false);
        startTimer();
    };
    
    // Task Handlers
    const handleTaskCompletion = async (comment: string): Promise<Task | null> => {
        const currentTask = tasksToday.find(t => t.completed_at === null);
        if (!currentTask) return null;

        const updatedFields: Partial<Task> = {
            completed_poms: currentTask.completed_poms + 1,
            comments: comment ? [...(currentTask.comments || []), comment] : currentTask.comments,
        };

        if (updatedFields.completed_poms >= currentTask.total_poms) {
            updatedFields.completed_at = new Date().toISOString();
        }
        
        const updatedTask = await dbService.updateTask(currentTask.id, updatedFields);
        if (updatedTask) {
            setTasks(prevTasks => prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t));
        }
        return updatedTask;
    };
    
    const handleUpdateTaskTimers = async (id: string, newTimers: { focus: number | null, break: number | null }) => {
        const updates = {
            custom_focus_duration: newTimers.focus,
            custom_break_duration: newTimers.break,
        };
        const updatedTask = await dbService.updateTask(id, updates);
        
        if (updatedTask) {
             setTasks(prevTasks => prevTasks.map(t => (t.id === id ? updatedTask : t)));
        }
    };


    const handleAddTask = async (text: string, poms: number, isTomorrow: boolean, projectId: string | null, tags: string[]) => {
        const newTasks = await dbService.addTask(text, poms, isTomorrow, projectId, tags);
        if (newTasks) {
            setTasks(newTasks);
        }
    };

    const handleAddProject = async (name: string, deadline: string | null): Promise<string | null> => {
        const newProject = await dbService.addProject(name, deadline);
        if (newProject) {
            setProjects(prev => [...prev, newProject].sort((a, b) => a.name.localeCompare(b.name)));
            return newProject.id;
        }
        return null;
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
        const otherTasks = tasks.filter(t => t.due_date !== todayString || t.completed_at !== null);
        setTasks([...reorderedTasks, ...otherTasks]);
    };

    // Goal, Target, & Project Handlers
    const handleAddGoal = async (text: string) => {
        const newGoals = await dbService.addGoal(text);
        if (newGoals) setGoals(newGoals);
    };
    const handleDeleteGoal = async (id: string) => {
        const newGoals = await dbService.deleteGoal(id);
        if (newGoals) setGoals(newGoals);
    };
    const handleAddTarget = async (text: string, deadline: string) => {
        const newTargets = await dbService.addTarget(text, deadline);
        if (newTargets) setTargets(newTargets);
    };
    const handleUpdateTarget = async (id: string, completed: boolean) => {
        const newTargets = await dbService.updateTarget(id, completed);
        if (newTargets) setTargets(newTargets);
    };
    const handleDeleteTarget = async (id: string) => {
        const newTargets = await dbService.deleteTarget(id);
        if (newTargets) setTargets(newTargets);
    };
    const handleUpdateProjectStatus = async (id: string, completed: boolean) => {
        const newProjects = await dbService.updateProjectStatus(id, completed);
        if (newProjects) setProjects(newProjects);
    };
     const handleDeleteProject = async (id: string) => {
        const newProjects = await dbService.deleteProject(id);
        if (newProjects) {
            setProjects(newProjects);
            // Manually update tasks in state to remove project association
            setTasks(prevTasks => prevTasks.map(t => {
                if (t.project_id === id) {
                    return { ...t, project_id: null, projects: null };
                }
                return t;
            }));
        }
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
        setProjects([]);
        setGoals([]);
        setTargets([]);
        setDailyLog({ date: getTodayDateString(), completed_sessions: 0, total_focus_minutes: 0 });
        setPage('timer');
    };

    // Page Rendering Logic
    const renderPage = () => {
        const currentTask = tasksToday.find(t => !t.completed_at);

        switch (page) {
            case 'timer':
                return <TimerPage
                    currentTask={currentTask}
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
                    projects={projects}
                    settings={settings}
                    onAddTask={handleAddTask}
                    onAddProject={handleAddProject}
                    onDeleteTask={handleDeleteTask}
                    onMoveTask={handleMoveTask}
                    onReorderTasks={handleReorderTasks}
                    onUpdateTaskTimers={handleUpdateTaskTimers}
                 />;
            case 'goals':
                return <GoalsPage 
                    goals={goals}
                    targets={targets}
                    projects={projects}
                    onAddGoal={handleAddGoal}
                    onDeleteGoal={handleDeleteGoal}
                    onAddTarget={handleAddTarget}
                    onUpdateTarget={handleUpdateTarget}
                    onDeleteTarget={handleDeleteTarget}
                    onAddProject={handleAddProject}
                    onUpdateProject={handleUpdateProjectStatus}
                    onDeleteProject={handleDeleteProject}
                />;
            case 'stats':
                return <StatsPage />;
            case 'ai':
                return <AICoachPage 
                            completedTasks={allCompletedTasks} 
                            incompleteTasks={allIncompleteTasks}
                            goals={goals}
                            targets={targets}
                            projects={projects}
                       />;
            case 'settings':
                return <SettingsPage 
                    settings={settings}
                    onSave={handleSaveSettings}
                />;
            default:
                return <TimerPage
                    currentTask={currentTask}
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
