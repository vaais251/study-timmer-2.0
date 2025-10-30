
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabaseClient';
import * as dbService from './services/dbService';
import { Task, Settings, Mode, Page, DbDailyLog, Project, Goal, Target, AppState, PomodoroHistory, Commitment, ChatMessage, AiMemory } from './types';
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

const Notification: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 3000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-slideDown">
            {message}
             <style>{`
              @keyframes slideDown { from { opacity: 0; transform: translate(-50%, -50px); } to { opacity: 1; transform: translate(-50%, 0); } }
              .animate-slideDown { animation: slideDown 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
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
    const [allCommitments, setAllCommitments] = useState<Commitment[]>([]);
    const [todaysHistory, setTodaysHistory] = useState<PomodoroHistory[]>([]);
    const [historicalLogs, setHistoricalLogs] = useState<DbDailyLog[]>([]);
    const [aiMemories, setAiMemories] = useState<AiMemory[]>([]);
    const [notification, setNotification] = useState<string | null>(null);
    
    // State for AI Coach Chat - lifted up for persistence
    const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([
        { role: 'model', text: 'Hello! I am your AI Coach. I have access to your goals, projects, and performance data. Ask me for insights, a weekly plan, or to add tasks for you!' }
    ]);

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
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowString = getTodayDateString(tomorrowDate);

    const tasksToday = useMemo(() => tasks.filter(t => t.due_date === todayString && !t.completed_at), [tasks, todayString]);
    const tasksForTomorrow = useMemo(() => tasks.filter(t => t.due_date === tomorrowString && !t.completed_at), [tasks, tomorrowString]);
    const tasksFuture = useMemo(() => tasks.filter(t => t.due_date > tomorrowString && !t.completed_at), [tasks, tomorrowString]);
    const completedToday = useMemo(() => tasks.filter(t => !!t.completed_at && t.due_date === todayString), [tasks, todayString]);
    
    const isStopwatchMode = useMemo(() => appState.mode === 'focus' && tasksToday[0]?.total_poms < 0, [appState.mode, tasksToday]);
    
    // Derived state for commitments: filter out expired ones for AI coach context
    const activeCommitments = useMemo(() => {
        return allCommitments.filter(c => c.status === 'active' && (!c.due_date || c.due_date >= todayString));
    }, [allCommitments, todayString]);


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
            const today = getTodayDateString();
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13); // Today + 13 previous days for week-over-week
            const startDate = getTodayDateString(fourteenDaysAgo);

            // Fetch raw data sources first
            const [userSettings, userTasks, userProjects, userGoals, userTargets, userCommitments, allPomodoroHistoryForRange, userAiMemories] = await Promise.all([
                dbService.getSettings(),
                dbService.getTasks(),
                dbService.getProjects(),
                dbService.getGoals(),
                dbService.getTargets(),
                dbService.getCommitments(),
                dbService.getPomodoroHistory(startDate, today), // Fetch raw history as the source of truth
                dbService.getAiMemories()
            ]);

            // --- Process Pomodoro History to generate authoritative logs ---
            const logsByDate = new Map<string, DbDailyLog>();
            
            // Initialize map for all days in range to handle days with no activity
            const loopDate = new Date(fourteenDaysAgo);
            const todayDate = new Date();
            todayDate.setHours(23, 59, 59, 999); // Ensure today is included
            while (loopDate <= todayDate) {
                const dateStr = getTodayDateString(loopDate);
                logsByDate.set(dateStr, {
                    date: dateStr,
                    completed_sessions: 0,
                    total_focus_minutes: 0,
                });
                loopDate.setDate(loopDate.getDate() + 1);
            }
            
            allPomodoroHistoryForRange.forEach(p => {
                const localDate = new Date(p.ended_at);
                const date = getTodayDateString(localDate);
                
                if (logsByDate.has(date)) {
                    const log = logsByDate.get(date)!;
                    log.completed_sessions += 1;
                    log.total_focus_minutes += Number(p.duration_minutes) || 0;
                }
            });

            const authoritativeHistoricalLogs = Array.from(logsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
            const freshTodaysHistory = allPomodoroHistoryForRange.filter(p => p.ended_at.startsWith(today));
            const freshTodayLog = logsByDate.get(today) || { date: today, completed_sessions: 0, total_focus_minutes: 0 };
            
            // --- Set React state with fresh, calculated data ---
            setTodaysHistory(freshTodaysHistory);
            setHistoricalLogs(authoritativeHistoricalLogs);
            setDailyLog(freshTodayLog);

            // Set other state from fetched data
            if (userSettings) setSettings(userSettings);
            if (userTasks) setTasks(userTasks);
            
            const updatedProjects = await dbService.checkAndUpdateDueProjects();
            if (updatedProjects) {
                setProjects(updatedProjects);
            } else if (userProjects) {
                setProjects(userProjects);
            }

            // Check for and auto-complete past-due commitments
            const updatedCommitmentsAfterCheck = await dbService.checkAndUpdatePastDueCommitments();
            if (updatedCommitmentsAfterCheck) {
                setAllCommitments(updatedCommitmentsAfterCheck);
            } else if (userCommitments) {
                setAllCommitments(userCommitments);
            }

            if (userGoals) setGoals(userGoals);
            
            // FIX: The `status` column doesn't exist. Derive it on the client-side.
            if (userTargets) {
                const augmentedTargets = userTargets.map(t => {
                    const status: Target['status'] = t.completed_at
                        ? 'completed'
                        : t.deadline < today
                        ? 'incomplete'
                        : 'active';
                    return { ...t, status };
                });
                setTargets(augmentedTargets);
            }


            if (userAiMemories) setAiMemories(userAiMemories);
            
            if (!didRestoreFromStorage) {
                const firstTask = userTasks?.filter(t => t.due_date === getTodayDateString() && !t.completed_at)[0];
                const isStopwatch = firstTask?.total_poms < 0;
                const initialFocusTime = isStopwatch ? 0 : (firstTask?.custom_focus_duration || userSettings?.focusDuration || 25) * 60;
                const initialTotalTime = isStopwatch ? (firstTask?.custom_focus_duration || userSettings?.focusDuration || 25) * 60 : initialFocusTime;

                setAppState(prev => ({
                    ...prev,
                    timeRemaining: initialFocusTime,
                    sessionTotalTime: initialTotalTime,
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
        if (isLoading || isInitialLoad.current) {
            if (!isLoading) isInitialLoad.current = false;
            return;
        }
        if (appState.isRunning) return;

        const currentTask = tasksToday[0];
        const isCurrentStopwatch = currentTask?.total_poms < 0;

        // If a session (countdown or stopwatch chunk) is paused mid-way, don't reset it.
        if (appState.timeRemaining > 0 && appState.timeRemaining < appState.sessionTotalTime) return;
        
        // Sync a pristine timer with the current task.
        if (appState.mode === 'focus') {
            const newTime = isCurrentStopwatch ? 0 : (currentTask?.custom_focus_duration || settings.focusDuration) * 60;
            const newTotalTime = isCurrentStopwatch ? (currentTask?.custom_focus_duration || settings.focusDuration) * 60 : newTime;

            if (appState.timeRemaining !== newTime || appState.sessionTotalTime !== newTotalTime) {
                setAppState(prev => ({
                    ...prev,
                    timeRemaining: newTime,
                    sessionTotalTime: newTotalTime,
                }));
            }
        }
    }, [isLoading, isInitialLoad, appState.isRunning, appState.mode, appState.timeRemaining, appState.sessionTotalTime, tasksToday, settings.focusDuration]);


    // Stop Timer Logic
    const stopTimer = useCallback(() => {
        setAppState(prev => ({ ...prev, isRunning: false }));
        // For countdown timers, we clear the end time when pausing.
        // For stopwatch, there's no end time to clear.
        if (!isStopwatchMode) {
            setPhaseEndTime(null);
        }
    }, [isStopwatchMode]);

    // Reset Timer Logic
    const resetTimer = useCallback(() => {
        stopTimer();
        const firstTask = tasksToday.find(t => !t.completed_at);
        const isStopwatch = firstTask?.total_poms < 0;
        
        let time, totalTime;
        if (isStopwatch) {
            time = 0; // Stopwatch resets to 0
            totalTime = (firstTask?.custom_focus_duration || settings.focusDuration) * 60;
        } else {
            time = (firstTask?.custom_focus_duration || settings.focusDuration) * 60;
            totalTime = time;
        }

        setAppState(prev => ({
            ...prev,
            mode: 'focus',
            currentSession: 1,
            timeRemaining: time,
            sessionTotalTime: totalTime,
        }));
    }, [stopTimer, settings.focusDuration, tasksToday]);

    // Start Timer Logic
    const startTimer = useCallback(async () => {
        if (appState.isRunning) return;
        resumeAudioContext();
        
        if (!isStopwatchMode) {
            setPhaseEndTime(Date.now() + appState.timeRemaining * 1000);
        }
        
        setAppState(prev => ({ ...prev, isRunning: true }));
    }, [appState.isRunning, appState.timeRemaining, isStopwatchMode]);
    
    const playStartSound = useCallback(() => {
         if (appState.mode === 'focus') playFocusStartSound(); else playBreakStartSound();
    }, [appState.mode]);

    // Check project completion after a focus session
    const checkProjectDurationCompletion = async (taskId: string, durationAdded: number) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.project_id) return;

        const project = projects.find(p => p.id === task.project_id);
        if (!project || project.status !== 'active' || project.completion_criteria_type !== 'duration_minutes') return;
        
        const newProgress = project.progress_value + durationAdded;
        let updates: Partial<Project> = { progress_value: newProgress };
        
        if (project.completion_criteria_value && newProgress >= project.completion_criteria_value) {
            updates.status = 'completed';
            updates.completed_at = new Date().toISOString();
        }
        
        const updatedProjects = await dbService.updateProject(project.id, updates);
        if (updatedProjects) setProjects(updatedProjects);
    };

    // Phase Completion Logic
    const completePhase = useCallback(async () => {
        stopTimer();
        notificationInterval.current = window.setInterval(playAlertLoop, 3000);
        playAlertLoop();

        if (appState.mode === 'focus') {
            playFocusEndSound();
            const currentTask = tasksToday.find(t => !t.completed_at);
            
            // For both stopwatch and regular, the duration of the completed chunk is the sessionTotalTime.
            const focusDuration = Math.round(appState.sessionTotalTime / 60);

            // Optimistic UI update for daily log
            const newLog = {
                ...dailyLog,
                completed_sessions: dailyLog.completed_sessions + 1,
                total_focus_minutes: dailyLog.total_focus_minutes + focusDuration
            };
            setDailyLog(newLog);
            
            // Log the individual pomodoro session for authoritative tracking
            await dbService.addPomodoroHistory(currentTask?.id || null, focusDuration);

            // Check for project completion by duration
            if (currentTask?.id) {
                await checkProjectDurationCompletion(currentTask.id, focusDuration);
            }
            
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
                // Also update the historical logs state for live updates to charts
                setHistoricalLogs(prevLogs => {
                    const newLogs = [...prevLogs];
                    const todayLogIndex = newLogs.findIndex(l => l.date === todayString);
                    if (todayLogIndex > -1) {
                        newLogs[todayLogIndex] = newLog;
                    } else {
                        newLogs.push(newLog);
                    }
                    return newLogs;
                });
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
    }, [appState, settings, stopTimer, tasksToday, dailyLog, session, todayString]);
    
    useEffect(() => {
        const currentTask = tasksToday[0];
        const isCurrentTaskStopwatch = appState.mode === 'focus' && currentTask?.total_poms < 0;

        if (appState.isRunning) {
            if (!isCurrentTaskStopwatch && appState.timeRemaining <= 0) {
                completePhase();
            } else if (isCurrentTaskStopwatch && appState.sessionTotalTime > 0 && appState.timeRemaining >= appState.sessionTotalTime) {
                completePhase();
            }
        }
        
        let totalTimeForTitle = appState.timeRemaining;
        if (isCurrentTaskStopwatch && currentTask) {
             const baseTime = todaysHistory
                .filter(h => h.task_id === currentTask.id)
                .reduce((total, h) => total + (Number(h.duration_minutes) || 0), 0) * 60;
            totalTimeForTitle = baseTime + appState.timeRemaining;
        }

        document.title = `${Math.floor(totalTimeForTitle / 60).toString().padStart(2, '0')}:${(totalTimeForTitle % 60).toString().padStart(2, '0')} - ${appState.mode === 'focus' ? 'Focus' : 'Break'} | FocusFlow`;
    }, [appState, settings.focusDuration, completePhase, tasksToday, todaysHistory]);
    
    // --- STATE PERSISTENCE LOGIC ---
    // Save state to localStorage whenever it changes
    useEffect(() => {
        if (!session) return;
        const currentTask = tasksToday[0];
        const isCurrentStopwatch = currentTask?.total_poms < 0;
        
        const isPristineCountdown = !isCurrentStopwatch && appState.timeRemaining === appState.sessionTotalTime;
        const isPristineStopwatch = isCurrentStopwatch && appState.timeRemaining === 0;

        if (!appState.isRunning && (isPristineCountdown || isPristineStopwatch)) {
             localStorage.removeItem('pomodoroAppState');
        } else {
            const stateToSave = {
                savedAppState: appState,
                savedPhaseEndTime: phaseEndTime,
            };
            localStorage.setItem('pomodoroAppState', JSON.stringify(stateToSave));
        }
    }, [appState, phaseEndTime, session, tasksToday]);
    
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

        if (appState.isRunning) {
            requestWakeLock();
            if (isStopwatchMode) {
                timerInterval.current = window.setInterval(() => {
                    setAppState(prev => ({ ...prev, timeRemaining: prev.timeRemaining + 1 }));
                }, 1000);
            } else if (phaseEndTime) {
                timerInterval.current = window.setInterval(() => {
                    const newTimeRemaining = Math.max(0, Math.round((phaseEndTime - Date.now()) / 1000));
                    setAppState(prev => ({ ...prev, timeRemaining: newTimeRemaining }));
                }, 1000);
            }
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
    }, [appState.isRunning, phaseEndTime, isStopwatchMode]);
    // --- END STATE PERSISTENCE LOGIC ---

    const handleStartClick = () => {
        playStartSound();
        startTimer();
    }
    
    // Task Handlers
    const handleTaskCompletion = async (comment: string): Promise<Task | null> => {
        const currentTask = tasksToday.find(t => t.completed_at === null);
        if (!currentTask) return null;

        const isStopwatch = currentTask.total_poms < 0;

        const updatedFields: Partial<Task> = {
            // Only increment poms for non-stopwatch tasks
            completed_poms: isStopwatch ? currentTask.completed_poms : currentTask.completed_poms + 1,
            comments: comment ? [...(currentTask.comments || []), comment] : currentTask.comments,
        };
        
        let taskIsNowComplete = false;
        // For stopwatch tasks, this condition will never be met.
        if (!isStopwatch && updatedFields.completed_poms >= currentTask.total_poms) {
            updatedFields.completed_at = new Date().toISOString();
            taskIsNowComplete = true;
        }
        
        const updatedTask = await dbService.updateTask(currentTask.id, updatedFields);

        // Check for project completion by task count if task was just completed
        if (taskIsNowComplete && updatedTask && updatedTask.project_id) {
            // Automatically log an update for the project
            await dbService.addProjectUpdate(
                updatedTask.project_id,
                getTodayDateString(),
                `Completed task: "${updatedTask.text}"`,
                updatedTask.id
            );

            const project = projects.find(p => p.id === updatedTask.project_id);
            if (project && project.status === 'active' && project.completion_criteria_type === 'task_count') {
                const newProgress = project.progress_value + 1;
                let projectUpdates: Partial<Project> = { progress_value: newProgress };
                if (project.completion_criteria_value && newProgress >= project.completion_criteria_value) {
                    projectUpdates.status = 'completed';
                    projectUpdates.completed_at = new Date().toISOString();
                }
                const updatedProjects = await dbService.updateProject(project.id, projectUpdates);
                if (updatedProjects) setProjects(updatedProjects);
            }
        }
        
        return updatedTask;
    };

    const handleCompleteStopwatchTask = async () => {
        const currentTask = tasksToday.find(t => !t.completed_at);
        if (!currentTask || currentTask.total_poms >= 0) {
            console.warn("Attempted to complete a non-stopwatch task via stopwatch handler.");
            return;
        }
    
        stopTimer();
        const sessionDurationMinutes = Math.round(appState.timeRemaining / 60);
    
        // 1. If there's time on the clock, save it as a focus session.
        if (sessionDurationMinutes > 0) {
            const newLog = {
                ...dailyLog,
                completed_sessions: dailyLog.completed_sessions + 1,
                total_focus_minutes: dailyLog.total_focus_minutes + sessionDurationMinutes
            };
            setDailyLog(newLog);
            
            await dbService.addPomodoroHistory(currentTask.id, sessionDurationMinutes);
            await checkProjectDurationCompletion(currentTask.id, sessionDurationMinutes);
            
            if (session) {
                const newHistoryRecord: PomodoroHistory = {
                    id: `temp-${Date.now()}`,
                    user_id: session.user.id,
                    task_id: currentTask.id,
                    ended_at: new Date().toISOString(),
                    duration_minutes: sessionDurationMinutes,
                };
                setTodaysHistory(prev => [...prev, newHistoryRecord]);
                 setHistoricalLogs(prevLogs => {
                    const newLogs = [...prevLogs];
                    const todayLogIndex = newLogs.findIndex(l => l.date === todayString);
                    if (todayLogIndex > -1) newLogs[todayLogIndex] = newLog;
                    else newLogs.push(newLog);
                    return newLogs;
                });
            }
            await dbService.upsertDailyLog(newLog);
        }
        
        // 2. Mark the task as complete
        const updatedTask = await dbService.updateTask(currentTask.id, { completed_at: new Date().toISOString() });
        
        let finalTasksState = tasks;
        if (updatedTask) {
            finalTasksState = tasks.map(t => (t.id === updatedTask.id ? updatedTask : t));
            setTasks(finalTasksState);
    
            if (updatedTask.project_id) {
                await dbService.addProjectUpdate(updatedTask.project_id, todayString, `Completed task: "${updatedTask.text}"`, updatedTask.id);
                const project = projects.find(p => p.id === updatedTask.project_id);
                if (project && project.status === 'active' && project.completion_criteria_type === 'task_count') {
                    const newProgress = project.progress_value + 1;
                    let projectUpdates: Partial<Project> = { progress_value: newProgress };
                    if (project.completion_criteria_value && newProgress >= project.completion_criteria_value) {
                        projectUpdates.status = 'completed';
                        projectUpdates.completed_at = new Date().toISOString();
                    }
                    const updatedProjects = await dbService.updateProject(project.id, projectUpdates);
                    if (updatedProjects) setProjects(updatedProjects);
                }
            }
        }
        
        // 3. Reset the timer for the next task
        const nextTask = finalTasksState.filter(t => t.due_date === todayString && !t.completed_at)[0];
        const isNextStopwatch = nextTask?.total_poms < 0;
        const newTime = isNextStopwatch ? 0 : (nextTask?.custom_focus_duration || settings.focusDuration) * 60;
        const newTotalTime = isNextStopwatch ? (nextTask?.custom_focus_duration || settings.focusDuration) * 60 : newTime;
    
        setAppState({
            mode: 'focus',
            currentSession: 1,
            timeRemaining: newTime,
            sessionTotalTime: newTotalTime,
            isRunning: false,
        });
        setPhaseEndTime(null);
        setNotification('Task completed and time saved!');
    };

    // Modal Continue Handler
    const handleModalContinue = async (comment: string) => {
        if (notificationInterval.current) clearInterval(notificationInterval.current);
        
        let finalTasksState = [...tasks];
        const wasFocusSession = modalContent.showCommentBox;

        const taskJustWorkedOn = tasks.find(t => t.due_date === getTodayDateString() && !t.completed_at);

        // @learn logic
        let taskComment = comment;
        const learnRegex = /@learn\s(.+)/i;
        const learnMatch = comment.match(learnRegex);

        if (learnMatch && learnMatch[1] && taskJustWorkedOn) {
            taskComment = comment.substring(0, learnMatch.index).trim();
            const learningContentRaw = learnMatch[1].trim();

            const hashtagRegex = /#(\w+)/g;
            const tagsFromLearn: string[] = [];
            let match;
            while ((match = hashtagRegex.exec(learningContentRaw)) !== null) {
                tagsFromLearn.push(match[1]);
            }

            const cleanLearningContent = learningContentRaw.replace(hashtagRegex, '').trim();
            const combinedTags = [...new Set([...(taskJustWorkedOn.tags || []), ...tagsFromLearn])];

            const newMemory = await dbService.addAiMemory('learning', cleanLearningContent, combinedTags, taskJustWorkedOn.id);
            if (newMemory) {
                setAiMemories(prev => [newMemory, ...prev]);
                setNotification('🧠 AI memory updated!');
            }
        }

        if (wasFocusSession && taskJustWorkedOn) {
            const updatedTask = await handleTaskCompletion(taskComment);
            if (updatedTask) {
                finalTasksState = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
                setTasks(finalTasksState);
            }
        }

        const nextMode = modalContent.nextMode;
        const newCurrentSession = nextMode === 'focus' 
            ? (appState.currentSession >= settings.sessionsPerCycle ? 1 : appState.currentSession + 1)
            : appState.currentSession;
        
        const updatedTasksToday = finalTasksState.filter(t => t.due_date === getTodayDateString() && !t.completed_at);
        let newTime;
        let newTotalTime;

        if (nextMode === 'break') {
            newTime = (taskJustWorkedOn?.custom_break_duration || settings.breakDuration) * 60;
            newTotalTime = newTime;
        } else {
            const nextTask = updatedTasksToday[0];
            const isNextStopwatch = nextTask?.total_poms < 0;
            if (isNextStopwatch) {
                newTime = 0; // Start new stopwatch chunk from 0
                newTotalTime = (nextTask?.custom_focus_duration || settings.focusDuration) * 60;
            } else {
                newTime = (nextTask?.custom_focus_duration || settings.focusDuration) * 60;
                newTotalTime = newTime;
            }
        }

        const newEndTime = nextMode === 'break' ? Date.now() + newTime * 1000 : null;

        setAppState(prev => ({
            ...prev,
            mode: nextMode,
            currentSession: newCurrentSession,
            timeRemaining: newTime,
            sessionTotalTime: newTotalTime,
            isRunning: true,
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

    const handleUpdateTask = async (id: string, newText: string, newTags: string[], newPoms: number, projectId: string | null, priority: number | null) => {
        const updates = {
            text: newText,
            tags: newTags,
            total_poms: newPoms,
            project_id: projectId,
            priority: priority,
        };
        const updatedTask = await dbService.updateTask(id, updates);
        if (updatedTask) {
             setTasks(prevTasks => prevTasks.map(t => (t.id === id ? updatedTask : t)));
        }
    };

    const handleAddTask = async (text: string, poms: number, dueDate: string, projectId: string | null, tags: string[], priority: number | null) => {
        const newTasks = await dbService.addTask(text, poms, dueDate, projectId, tags, priority);
        if (newTasks) {
            setTasks(newTasks);
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this task? This cannot be undone.")) {
            const result = await dbService.deleteTask(id);
            if (result.tasks) setTasks(result.tasks);
            if (result.projects) setProjects(result.projects); // Also update projects if progress was rolled back
        }
    };

    const handleMoveTask = async (id: string, action: 'postpone' | 'duplicate') => {
        const newTasks = await dbService.moveTask(id, action);
        if (newTasks) setTasks(newTasks);
    };
    
    const handleBringTaskForward = async (id: string) => {
        const newTasks = await dbService.bringTaskForward(id);
        if (newTasks) setTasks(newTasks);
    };

    const handleReorderTasks = async (reorderedTasks: Task[]) => {
        // Optimistically update UI to feel snappy
        setTasks(currentTasks => {
            const reorderedIds = new Set(reorderedTasks.map(t => t.id));
            const otherTasks = currentTasks.filter(t => !reorderedIds.has(t.id));
            const newTaskList = [...otherTasks, ...reorderedTasks].sort((a,b) => {
                if (a.due_date < b.due_date) return -1;
                if (a.due_date > b.due_date) return 1;
                return (a.task_order ?? Infinity) - (b.task_order ?? Infinity);
            });
            return newTaskList;
        });

        // Prepare data for DB update
        const tasksToUpdate = reorderedTasks.map((task, index) => ({
            id: task.id,
            task_order: index,
        }));

        // Update DB and fetch definitive state
        const finalTasks = await dbService.updateTaskOrder(tasksToUpdate);
        if (finalTasks) {
            setTasks(finalTasks);
        }
    };

    const handleMarkTaskIncomplete = async (id: string) => {
        const newTasks = await dbService.markTaskIncomplete(id);
        if (newTasks) setTasks(newTasks);
    };

    // --- Project Handlers ---
    const handleAddProject = async (name: string, description: string | null = null, deadline: string | null = null, criteria: {type: Project['completion_criteria_type'], value: number | null} = {type: 'manual', value: null}, priority: number | null = null): Promise<string | null> => {
        const newProject = await dbService.addProject(name, description, deadline, criteria.type, criteria.value, priority);
        if (newProject) {
            setProjects(prev => [...prev, newProject].sort((a, b) => a.name.localeCompare(b.name)));
            return newProject.id;
        }
        return null;
    };
    
    const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
        const updatedProjects = await dbService.updateProject(id, updates);
        if (updatedProjects) setProjects(updatedProjects);
    };

    const handleDeleteProject = async (id: string) => {
        const result = await dbService.deleteProject(id);
        if (result.success && result.data) {
            setProjects(result.data.projects);
            setTasks(result.data.tasks); // Tasks might be unlinked, so we need to refresh them.
        } else if (result.error) {
            alert(`Error: ${result.error}`);
        }
    };
    
    // --- Goal Handlers ---
    const handleAddGoal = async (text: string) => {
        const newGoals = await dbService.addGoal(text);
        if (newGoals) setGoals(newGoals);
    };
    
    const handleUpdateGoal = async (id: string, text: string) => {
        const newGoals = await dbService.updateGoal(id, { text });
        if (newGoals) setGoals(newGoals);
    };

    const handleDeleteGoal = async (id: string) => {
        if (window.confirm("Delete this goal?")) {
            const newGoals = await dbService.deleteGoal(id);
            if (newGoals) setGoals(newGoals);
        }
    };

    const handleSetGoalCompletion = async (id: string, isComplete: boolean) => {
        const newGoals = await dbService.setGoalCompletion(id, isComplete ? new Date().toISOString() : null);
        if (newGoals) setGoals(newGoals);
    };
    
    // --- Target Handlers ---
    const handleAddTarget = async (text: string, deadline: string, priority: number | null) => {
        const newTargets = await dbService.addTarget(text, deadline, priority);
        if (newTargets) {
            const today = getTodayDateString();
            const augmentedTargets = newTargets.map(t => {
                const status: Target['status'] = t.completed_at
                    ? 'completed'
                    : t.deadline < today
                    ? 'incomplete'
                    : 'active';
                return { ...t, status };
            });
            setTargets(augmentedTargets);
        }
    };
    
    const handleUpdateTarget = async (id: string, updates: Partial<Target>) => {
        const newTargets = await dbService.updateTarget(id, updates);
        if (newTargets) {
            const today = getTodayDateString();
            const augmentedTargets = newTargets.map(t => {
                const status: Target['status'] = t.completed_at
                    ? 'completed'
                    : t.deadline < today
                    ? 'incomplete'
                    : 'active';
                return { ...t, status };
            });
            setTargets(augmentedTargets);
        }
    };

    const handleDeleteTarget = async (id: string) => {
         if (window.confirm("Delete this target?")) {
            const newTargets = await dbService.deleteTarget(id);
            if (newTargets) {
                 const today = getTodayDateString();
                const augmentedTargets = newTargets.map(t => {
                    const status: Target['status'] = t.completed_at
                        ? 'completed'
                        : t.deadline < today
                        ? 'incomplete'
                        : 'active';
                    return { ...t, status };
                });
                setTargets(augmentedTargets);
            }
        }
    };

    // --- Commitment Handlers ---
    const handleAddCommitment = async (text: string, dueDate: string | null) => {
        const newCommitments = await dbService.addCommitment(text, dueDate);
        if (newCommitments) setAllCommitments(newCommitments);
    };

    const handleUpdateCommitment = async (id: string, updates: { text: string; dueDate: string | null }) => {
        const newCommitments = await dbService.updateCommitment(id, updates);
        if (newCommitments) setAllCommitments(newCommitments);
    };

    const handleDeleteCommitment = async (id: string) => {
        if (window.confirm("Delete this commitment?")) {
            const newCommitments = await dbService.deleteCommitment(id);
            if (newCommitments) setAllCommitments(newCommitments);
        }
    };

    const handleSetCommitmentCompletion = async (id: string, isComplete: boolean) => {
        const newCommitments = await dbService.setCommitmentCompletion(id, isComplete);
        if (newCommitments) setAllCommitments(newCommitments);
    };
    
    const handleMarkCommitmentBroken = async (id: string) => {
        const newCommitments = await dbService.markCommitmentBroken(id);
        if (newCommitments) setAllCommitments(newCommitments);
    };

    // --- Reschedule Handlers ---
    const handleRescheduleProject = async (id: string, newDeadline: string | null) => {
        const newProjects = await dbService.rescheduleProject(id, newDeadline);
        if (newProjects) {
            setProjects(newProjects);
            setNotification('Project rescheduled successfully!');
        }
    };

    const handleRescheduleTarget = async (id: string, newDeadline: string) => {
        const newTargets = await dbService.rescheduleTarget(id, newDeadline);
        if (newTargets) {
            const today = getTodayDateString();
            const augmentedTargets = newTargets.map(t => ({
                ...t,
                status: t.completed_at ? 'completed' as const : t.deadline < today ? 'incomplete' as const : 'active' as const,
            }));
            setTargets(augmentedTargets);
            setNotification('Target rescheduled successfully!');
        }
    };

    const handleRescheduleCommitment = async (id: string, newDueDate: string | null) => {
        const newCommitments = await dbService.rescheduleCommitment(id, newDueDate);
        if (newCommitments) {
            setAllCommitments(newCommitments);
            setNotification('Commitment rescheduled successfully!');
        }
    };

    const handleRescheduleItemFromAI = async (itemId: string, itemType: 'project' | 'target' | 'commitment', newDate: string | null): Promise<void> => {
        switch (itemType) {
            case 'project':
                await handleRescheduleProject(itemId, newDate);
                break;
            case 'target':
                if (!newDate) throw new Error("A new deadline is required to reschedule a target.");
                await handleRescheduleTarget(itemId, newDate);
                break;
            case 'commitment':
                await handleRescheduleCommitment(itemId, newDate);
                break;
            default:
                throw new Error(`Unknown item type for rescheduling: ${itemType}`);
        }
    };


    // --- AI Coach Specific Task Adder (for promise-based flow) ---
    const handleAddTaskFromAI = async (text: string, poms: number, dueDate: string, projectId: string | null, tags: string[], priority: number | null): Promise<void> => {
        const newTasks = await dbService.addTask(text, poms, dueDate, projectId, tags, priority);
        if (newTasks) {
            setTasks(newTasks);
        }
    };

    const refreshAiMemories = async () => {
        const memories = await dbService.getAiMemories();
        if (memories) {
            setAiMemories(memories);
        }
        setNotification('🧠 AI memory updated!');
    };

    // Settings
    const handleSaveSettings = async (newSettings: Settings) => {
        await dbService.updateSettings(newSettings);
        setSettings(newSettings);
    };

    if (!session) {
        return <AuthPage />;
    }
    
    if (isLoading) {
        return <LoadingAnimation />;
    }

    const renderPage = () => {
        switch (page) {
            case 'timer':
                return <TimerPage
                    appState={appState}
                    settings={settings}
                    tasksToday={tasksToday}
                    completedToday={completedToday}
                    dailyLog={dailyLog}
                    startTimer={handleStartClick}
                    stopTimer={stopTimer}
                    resetTimer={resetTimer}
                    navigateToSettings={() => setPage('settings')}
                    currentTask={tasksToday[0]}
                    todaysHistory={todaysHistory}
                    historicalLogs={historicalLogs}
                    isStopwatchMode={isStopwatchMode}
                    completeStopwatchTask={handleCompleteStopwatchTask}
                />;
            case 'plan':
                return <PlanPage
                    tasksToday={tasksToday}
                    tasksForTomorrow={tasksForTomorrow}
                    tasksFuture={tasksFuture}
                    completedToday={completedToday}
                    projects={projects}
                    settings={settings}
                    onAddTask={handleAddTask}
                    onAddProject={(name) => handleAddProject(name, null, null, {type: 'manual', value: null}, null)}
                    onDeleteTask={handleDeleteTask}
                    onMoveTask={handleMoveTask}
                    onBringTaskForward={handleBringTaskForward}
                    onReorderTasks={handleReorderTasks}
                    onUpdateTaskTimers={handleUpdateTaskTimers}
                    onUpdateTask={handleUpdateTask}
                    onMarkTaskIncomplete={handleMarkTaskIncomplete}
                />;
            case 'stats':
                return <StatsPage />;
            case 'ai':
                return <AICoachPage 
                    goals={goals}
                    targets={targets}
                    projects={projects}
                    allCommitments={activeCommitments}
                    onAddTask={handleAddTaskFromAI}
                    onAddProject={(name, desc, deadline, criteria, priority) => handleAddProject(name, desc, deadline, criteria, priority)}
                    onAddTarget={(text, deadline, priority) => handleAddTarget(text, deadline, priority)}
                    onAddCommitment={handleAddCommitment}
                    onRescheduleItem={handleRescheduleItemFromAI}
                    chatMessages={aiChatMessages}
                    setChatMessages={setAiChatMessages}
                    aiMemories={aiMemories}
                    onMemoryChange={refreshAiMemories}
                />;
            case 'goals':
                return <GoalsPage 
                    goals={goals}
                    targets={targets}
                    projects={projects}
                    commitments={allCommitments}
                    onAddGoal={handleAddGoal}
                    onUpdateGoal={handleUpdateGoal}
                    onDeleteGoal={handleDeleteGoal}
                    onSetGoalCompletion={handleSetGoalCompletion}
                    onAddTarget={handleAddTarget}
                    onUpdateTarget={handleUpdateTarget}
                    onDeleteTarget={handleDeleteTarget}
                    onAddProject={handleAddProject}
                    onUpdateProject={handleUpdateProject}
                    onDeleteProject={handleDeleteProject}
                    onAddCommitment={handleAddCommitment}
                    onUpdateCommitment={handleUpdateCommitment}
                    onDeleteCommitment={handleDeleteCommitment}
                    onSetCommitmentCompletion={handleSetCommitmentCompletion}
                    onMarkCommitmentBroken={handleMarkCommitmentBroken}
                />;
            case 'settings':
                return <SettingsPage settings={settings} onSave={handleSaveSettings} />;
            default:
                return <div>Page not found</div>;
        }
    };

    return (
        <div className="bg-slate-900 text-slate-200 min-h-screen" style={{fontFamily: `'Inter', sans-serif`}}>
            {notification && <Notification message={notification} onDismiss={() => setNotification(null)} />}
            <Navbar currentPage={page} setPage={setPage} onLogout={() => supabase.auth.signOut()} />
            
            <main className="md:pl-20 lg:pl-56 transition-all duration-300">
                <div className="p-4 sm:p-6 pb-20 md:pb-6 max-w-4xl mx-auto">
                    {renderPage()}
                </div>
            </main>

            {isModalVisible && (
                <CompletionModal
                    title={modalContent.title}
                    message={modalContent.message}
                    nextMode={modalContent.nextMode}
                    showCommentBox={modalContent.showCommentBox}
                    onContinue={handleModalContinue}
                />
            )}
        </div>
    );
};

export default App;
