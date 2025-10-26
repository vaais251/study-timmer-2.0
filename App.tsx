



import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabaseClient';
import * as dbService from './services/dbService';
import { Task, Settings, Mode, Page, DbDailyLog, Project, Goal, Target, AppState, PomodoroHistory } from './types';
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
import LoadingAnimation from './components/common/LoadingAnimation';
import GoalsPage from './pages/GoalsPage';

// Reads from localStorage to initialize the timer state synchronously.
const getInitialAppState = (): { initialState: AppState; initialPhaseEndTime: number | null; wasRestored: boolean } => {
    const defaultState: AppState = {
        mode: 'focus',
        currentSession: 1,
        timeRemaining: 25 * 60,
        sessionTotalTime: 25 * 60,
        isRunning: false,
    };

    const savedStateJSON = localStorage.getItem('pomodoroAppState');

    if (savedStateJSON) {
        try {
            const { savedAppState, savedPhaseEndTime } = JSON.parse(savedStateJSON);
            
            // If the timer was running, calculate the correct remaining time from phaseEndTime
            if (savedAppState.isRunning && savedPhaseEndTime) {
                const newTimeRemaining = Math.max(0, Math.round((savedPhaseEndTime - Date.now()) / 1000));
                const finalState = { ...savedAppState, timeRemaining: newTimeRemaining };
                return { initialState: finalState, initialPhaseEndTime: savedPhaseEndTime, wasRestored: true };
            }
            
            // If it was paused, the saved state is accurate.
            return { initialState: savedAppState, initialPhaseEndTime: null, wasRestored: true };
        } catch (e) {
            console.error("Failed to parse saved state:", e);
            localStorage.removeItem('pomodoroAppState');
        }
    }
    
    return { initialState: defaultState, initialPhaseEndTime: null, wasRestored: false };
};


const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize state synchronously from localStorage to prevent race conditions.
    const memoizedInitialState = useMemo(() => getInitialAppState(), []);
    const [appState, setAppState] = useState<AppState>(memoizedInitialState.initialState);
    const [phaseEndTime, setPhaseEndTime] = useState<number | null>(memoizedInitialState.initialPhaseEndTime);
    const [didRestoreFromStorage, setDidRestoreFromStorage] = useState<boolean>(memoizedInitialState.wasRestored);

    const [settings, setSettings] = useState<Settings>({
        focusDuration: 25,
        breakDuration: 5,
        sessionsPerCycle: 2,
    });

    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [targets, setTargets] = useState<Target[]>([]);
    const [todaysHistory, setTodaysHistory] = useState<PomodoroHistory[]>([]);
    
    const [dailyLog, setDailyLog] = useState<DbDailyLog>({
        date: getTodayDateString(),
        completed_sessions: 0,
        total_focus_minutes: 0,
    });

    const [page, setPage] = useState<Page>('timer');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', message: '', nextMode: 'focus' as Mode, showCommentBox: false });

    const timerInterval = useRef<number | null>(null);
    const notificationInterval = useRef<number | null>(null);
    const wakeLock = useRef<any | null>(null);
    const isInitialLoad = useRef(true);

    // Derived state for tasks
    const todayString = getTodayDateString();
    const tasksToday = tasks.filter(t => t.due_date === todayString && !t.completed_at);
    const tasksForTomorrow = tasks.filter(t => t.due_date > todayString && !t.completed_at);
    const completedToday = tasks.filter(t => !!t.completed_at && t.due_date === todayString);


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
            const [userSettings, userTasks, userDailyLog, userProjects, userGoals, userTargets, fetchedTodaysHistory] = await Promise.all([
                dbService.getSettings(),
                dbService.getTasks(),
                dbService.getDailyLogForToday(),
                dbService.getProjects(),
                dbService.getGoals(),
                dbService.getTargets(),
                dbService.getTodaysPomodoroHistory()
            ]);
            
            setTodaysHistory(fetchedTodaysHistory);

            if (userSettings) setSettings(userSettings);
            if (userTasks) setTasks(userTasks);
            if (userProjects) setProjects(userProjects);
            if (userGoals) setGoals(userGoals);
            if (userTargets) setTargets(userTargets);
            
            // Authoritative calculation for today's focus minutes from pomodoro_history
            const authoritativeFocusMinutes = fetchedTodaysHistory.reduce((sum, record) => sum + (Number(record.duration_minutes) || 0), 0);

            if (userDailyLog) {
                // Overwrite the potentially stale value from the DB with the fresh calculation
                setDailyLog({ ...userDailyLog, total_focus_minutes: authoritativeFocusMinutes });
            }
            
            // Only set the initial time if state was NOT restored from localStorage.
            // This prevents overwriting the timer when the tab is reloaded.
            if (!didRestoreFromStorage) {
                const firstTask = userTasks?.filter(t => t.due_date === getTodayDateString() && !t.completed_at)[0];
                const initialFocusTime = firstTask?.custom_focus_duration || userSettings?.focusDuration || 25;

                setAppState(prev => ({
                    ...prev,
                    timeRemaining: initialFocusTime * 60,
                    sessionTotalTime: initialFocusTime * 60,
                }));
            }

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [session, didRestoreFromStorage]);

    useEffect(() => {
        if (session) {
            fetchData();
        } else {
            setIsLoading(false); // Not logged in, stop loading
        }
    }, [session, fetchData]);
    
    // This effect ensures the timer display is always in sync with the current task's settings when paused.
    useEffect(() => {
        // On the first render after loading is complete, we want to skip this effect
        // to avoid resetting a restored timer due to race conditions.
        if (isLoading || isInitialLoad.current) {
            if (!isLoading) {
                isInitialLoad.current = false;
            }
            return;
        }

        if (appState.isRunning) {
            return;
        }

        // Only adjust the timer if it hasn't been started for the current phase.
        // This prevents a paused timer from being reset to full duration if tasks/settings change.
        if (appState.timeRemaining !== appState.sessionTotalTime) {
            return;
        }

        if (appState.mode === 'focus') {
            const currentTask = tasks.find(t => t.due_date === getTodayDateString() && !t.completed_at);
            const newTotalTime = (currentTask?.custom_focus_duration || settings.focusDuration) * 60;

            if (appState.sessionTotalTime !== newTotalTime) {
                setAppState(prev => ({
                    ...prev,
                    timeRemaining: newTotalTime,
                    sessionTotalTime: newTotalTime,
                }));
            }
        }
    }, [isLoading, tasks, settings.focusDuration, appState.isRunning, appState.mode, appState.sessionTotalTime, appState.timeRemaining]);


    // Stop Timer Logic
    const stopTimer = useCallback(() => {
        setAppState(prev => ({ ...prev, isRunning: false }));
        setPhaseEndTime(null);
    }, []);

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
    const startTimer = useCallback(async () => {
        if (appState.isRunning) return;
        resumeAudioContext();
        setPhaseEndTime(Date.now() + appState.timeRemaining * 1000);
        setAppState(prev => ({ ...prev, isRunning: true }));
    }, [appState.isRunning, appState.timeRemaining]);
    
    const playStartSound = useCallback(() => {
         if (appState.mode === 'focus') playFocusStartSound(); else playBreakStartSound();
    }, [appState.mode]);


    // Phase Completion Logic
    const completePhase = useCallback(async () => {
        stopTimer();
        notificationInterval.current = window.setInterval(playAlertLoop, 3000);
        playAlertLoop();

        if (appState.mode === 'focus') {
            playFocusEndSound();
            const currentTask = tasksToday.find(t => !t.completed_at);
            const focusDuration = currentTask?.custom_focus_duration || settings.focusDuration;

            // Optimistic UI update for daily log
            const newLog = {
                ...dailyLog,
                completed_sessions: dailyLog.completed_sessions + 1,
                total_focus_minutes: dailyLog.total_focus_minutes + focusDuration
            };
            setDailyLog(newLog);
            
            // Log the individual pomodoro session for authoritative tracking
            await dbService.addPomodoroHistory(currentTask?.id || null, focusDuration);
            
            // Optimistically update history for immediate UI feedback
            if (session) {
                const newHistoryRecord: PomodoroHistory = {
                    id: `temp-${Date.now()}`,
                    user_id: session.user.id,
                    task_id: currentTask?.id || null,
                    ended_at: new Date().toISOString(),
                    duration_minutes: focusDuration,
                };
                setTodaysHistory(prev => [...prev, newHistoryRecord]);
            }
            
            // Also update the daily log in the DB (mainly for session count)
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
    }, [appState, settings, stopTimer, tasksToday, dailyLog, session]);
    
    useEffect(() => {
        if (appState.isRunning && appState.timeRemaining <= 0) {
            completePhase();
        }
        document.title = `${Math.floor(appState.timeRemaining / 60).toString().padStart(2, '0')}:${(appState.timeRemaining % 60).toString().padStart(2, '0')} - ${appState.mode === 'focus' ? 'Focus' : 'Break'}`;
    }, [appState.timeRemaining, appState.isRunning, appState.mode, completePhase]);
    
    // --- STATE PERSISTENCE LOGIC ---
    // Save state to localStorage whenever it changes
    useEffect(() => {
        if (!session) return;
        const isPristine = !appState.isRunning && appState.timeRemaining === appState.sessionTotalTime;
        if (!isPristine) {
            const stateToSave = {
                savedAppState: appState,
                savedPhaseEndTime: phaseEndTime,
            };
            localStorage.setItem('pomodoroAppState', JSON.stringify(stateToSave));
        } else {
            localStorage.removeItem('pomodoroAppState');
        }
    }, [appState, phaseEndTime, session]);
    
    // This effect handles the timer interval and wake lock. It's robust against tab throttling.
    useEffect(() => {
        const requestWakeLock = async () => {
             if ('wakeLock' in navigator && !wakeLock.current) {
                try {
                    wakeLock.current = await navigator.wakeLock.request('screen');
                } catch (err) {}
            }
        };

        const releaseWakeLock = () => {
            if (wakeLock.current) {
                wakeLock.current.release().then(() => { wakeLock.current = null; });
            }
        };

        if (appState.isRunning && phaseEndTime) {
            requestWakeLock();
            timerInterval.current = window.setInterval(() => {
                const newTimeRemaining = Math.max(0, Math.round((phaseEndTime - Date.now()) / 1000));
                setAppState(prev => ({ ...prev, timeRemaining: newTimeRemaining }));
            }, 1000);
        } else {
            releaseWakeLock();
            if (timerInterval.current) {
                clearInterval(timerInterval.current);
                timerInterval.current = null;
            }
        }
        return () => {
            if (timerInterval.current) clearInterval(timerInterval.current);
            releaseWakeLock();
        }
    }, [appState.isRunning, phaseEndTime]);
    // --- END STATE PERSISTENCE LOGIC ---

    const handleStartClick = () => {
        playStartSound();
        startTimer();
    }
    
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
        
        // Return the updated task from the DB, but do not set state here.
        return await dbService.updateTask(currentTask.id, updatedFields);
    };

    // Modal Continue Handler
    const handleModalContinue = async (comment: string) => {
        if (notificationInterval.current) clearInterval(notificationInterval.current);
        
        let finalTasksState = [...tasks];
        const wasFocusSession = modalContent.showCommentBox;

        // Use the tasks state from this render to find the task that just finished.
        const taskJustWorkedOn = tasks.find(t => t.due_date === getTodayDateString() && !t.completed_at);

        if (wasFocusSession && taskJustWorkedOn) {
            const updatedTask = await handleTaskCompletion(comment);
            if (updatedTask) {
                // Create the definitive new task list for this scope
                finalTasksState = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
                // And commit it to React state.
                setTasks(finalTasksState);
            }
        }

        const nextMode = modalContent.nextMode;
        const newCurrentSession = nextMode === 'focus' 
            ? (appState.currentSession >= settings.sessionsPerCycle ? 1 : appState.currentSession + 1)
            : appState.currentSession;
        
        // Use the fresh `finalTasksState` to determine what's next
        const updatedTasksToday = finalTasksState.filter(t => t.due_date === getTodayDateString() && !t.completed_at);
        let newTime;

        if (nextMode === 'break') {
            newTime = (taskJustWorkedOn?.custom_break_duration || settings.breakDuration) * 60;
        } else {
            const nextTask = updatedTasksToday[0];
            newTime = (nextTask?.custom_focus_duration || settings.focusDuration) * 60;
        }

        const newEndTime = Date.now() + newTime * 1000;

        setAppState(prev => ({
            ...prev,
            mode: nextMode,
            currentSession: newCurrentSession,
            timeRemaining: newTime,
            sessionTotalTime: newTime,
            isRunning: true, // Start timer immediately
        }));
        setPhaseEndTime(newEndTime);

        setIsModalVisible(false);
        playStartSound();
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
        if (newTasks) {
            setTasks(newTasks);
            
            // After task and its history are deleted from DB, we need to refresh the local state.
            const fetchedTodaysHistory = await dbService.getTodaysPomodoroHistory();
            setTodaysHistory(fetchedTodaysHistory);
            
            // Recalculate stats for today
            const authoritativeFocusMinutes = fetchedTodaysHistory.reduce((sum, record) => sum + (Number(record.duration_minutes) || 0), 0);
            const newCompletedSessions = fetchedTodaysHistory.length;
            
            const newLog = {
                ...dailyLog, // preserve id and user_id if they exist
                completed_sessions: newCompletedSessions,
                total_focus_minutes: authoritativeFocusMinutes
            };

            setDailyLog(newLog);
            
            // And update the daily log in the DB.
            await dbService.upsertDailyLog(newLog);
        }
    };

    const handleMarkTaskIncomplete = async (id: string) => {
        const newTasks = await dbService.markTaskIncomplete(id);
        if (newTasks) {
            setTasks(newTasks);
        }
    };

    const handleMoveTask = async (id: string, action: 'postpone' | 'duplicate') => {
        const newTasks = await dbService.moveTask(id, action);
        if (newTasks) setTasks(newTasks);
    };
    
    const handleReorderTasks = async (reorderedDayTasks: Task[]) => {
        if (!reorderedDayTasks.length) return;

        // Optimistic UI update: Replace the old items with the newly ordered ones.
        const reorderedIds = new Set(reorderedDayTasks.map(t => t.id));
        const otherTasks = tasks.filter(t => !reorderedIds.has(t.id));
        setTasks([...reorderedDayTasks, ...otherTasks]);

        // Prepare the data for the database update by assigning the new order index.
        const tasksToUpdate = reorderedDayTasks.map((task, index) => ({
            id: task.id,
            task_order: index,
        }));

        // Call the service to persist the new order.
        const updatedTasksFromDB = await dbService.updateTaskOrder(tasksToUpdate);
        
        // On success or failure, resync with the authoritative list from the DB.
        if (updatedTasksFromDB) {
            setTasks(updatedTasksFromDB);
        } else {
            console.error("Failed to save new task order. Reverting.");
            fetchData();
        }
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
        localStorage.removeItem('pomodoroAppState');
        await supabase.auth.signOut();
        setTasks([]);
        setProjects([]);
        setGoals([]);
        setTargets([]);
        setTodaysHistory([]);
        setDidRestoreFromStorage(false); // Reset persistence flag on logout
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
                    startTimer={handleStartClick}
                    stopTimer={stopTimer}
                    resetTimer={resetTimer}
                    navigateToSettings={() => setPage('settings')}
                    todaysHistory={todaysHistory}
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
                    onMarkTaskIncomplete={handleMarkTaskIncomplete}
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
                    startTimer={handleStartClick}
                    stopTimer={stopTimer}
                    resetTimer={resetTimer}
                    navigateToSettings={() => setPage('settings')}
                    todaysHistory={todaysHistory}
                />;
        }
    };
    
    // Main Component Render
    if (isLoading) {
        return <LoadingAnimation />;
    }

    if (!session) {
        return <AuthPage />;
    }
    
    const bgClass = appState.mode === 'focus'
        ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2]'
        : 'bg-gradient-to-br from-[#a8e063] to-[#56ab2f]';

    return (
        <div 
          className={`min-h-screen w-full flex justify-center items-start pt-10 pb-10 ${bgClass}`}
          style={{fontFamily: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`}}
        >
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
        </div>
    );
};

export default App;