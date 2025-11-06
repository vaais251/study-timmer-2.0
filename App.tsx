
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabaseClient';
import * as dbService from './services/dbService';
import { NewNotification } from './services/dbService';
import { Task, Settings, Mode, Page, DbDailyLog, Project, Goal, Target, AppState, PomodoroHistory, Commitment, ChatMessage, AiMemory, AppNotification, FocusLevel } from './types';
import { getTodayDateString } from './utils/date';
import { playFocusStartSound, playFocusEndSound, playBreakStartSound, playBreakEndSound, playAlertLoop, resumeAudioContext, playNotificationSound } from './utils/audio';

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
import CommandPalette from './components/CommandPalette';
import NotificationPanel from './components/common/NotificationPanel';
import { BellIcon } from './components/common/Icons';

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

const ToastNotification: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => {
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

const SyncIndicator: React.FC = () => (
    <div className="fixed top-20 md:top-6 right-6 z-50 flex items-center gap-2 bg-slate-800/80 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg border border-slate-700 animate-fadeIn">
        <div className="w-4 h-4 border-2 border-white/50 border-t-cyan-400 rounded-full animate-spin"></div>
        <span className="text-sm font-medium">Syncing...</span>
    </div>
);


// Helper to derive target status client-side for consistent UI
const augmentTargetsWithStatus = (targets: Target[]): Target[] => {
    const today = getTodayDateString();
    return targets.map(t => {
        let status: Target['status'];
        if (t.completed_at) {
            status = 'completed';
        } else if (t.completion_mode === 'focus_minutes' && t.target_minutes && t.progress_minutes >= t.target_minutes) {
            status = 'completed';
        } else if (t.deadline < today) {
            status = 'incomplete';
        } else {
            status = 'active';
        }
        return { ...t, status };
    });
};

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const fetchedForUserId = useRef<string | null>(null); // Prevents re-fetching data on tab focus

    // Initialize state synchronously from localStorage to prevent race conditions.
    const memoizedInitialState = useMemo(() => getInitialAppState(), []);
    const [appState, setAppState] = useState<AppState>(memoizedInitialState.initialState);
    const [phaseEndTime, setPhaseEndTime] = useState<number | null>(memoizedInitialState.initialPhaseEndTime);
    const [didRestoreFromStorage, setDidRestoreFromStorage] = useState<boolean>(memoizedInitialState.wasRestored);

    const [settings, setSettings] = useState<Settings>({
        focusDuration: 25,
        breakDuration: 5,
        sessionsPerCycle: 2,
        todaySortBy: 'default',
    });

    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [targets, setTargets] = useState<Target[]>([]);
    const [allCommitments, setAllCommitments] = useState<Commitment[]>([]);
    const [todaysHistory, setTodaysHistory] = useState<PomodoroHistory[]>([]);
    const [allPomodoroHistory, setAllPomodoroHistory] = useState<PomodoroHistory[]>([]);
    const [aiMemories, setAiMemories] = useState<AiMemory[]>([]);
    const [toastNotification, setToastNotification] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    
    // State for AI Coach Chat - lifted up for persistence
    const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([
        { role: 'model', text: 'Hello! I am your AI Coach. I have access to your goals, projects, and performance data. Ask me for insights, a weekly plan, or to add tasks for you!' }
    ]);

    const [page, setPage] = useState<Page>('timer');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', message: '', nextMode: 'focus' as Mode, showCommentBox: false });
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    
    // New state for in-app notification system
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const [clearedNotificationIds, setClearedNotificationIds] = useState<Set<string>>(new Set());
    const unreadNotificationCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
    
    // State for PWA installation prompt
    const [isStandalone, setIsStandalone] = useState(false);
    const [installPrompt, setInstallPrompt] = useState<any>(null);


    const timerInterval = useRef<number | null>(null);
    const notificationInterval = useRef<number | null>(null);
    const wakeLock = useRef<any | null>(null);
    const isInitialLoad = useRef(true);

    // Derived state for tasks
    const todayString = getTodayDateString();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowString = getTodayDateString(tomorrowDate);

    const tasksToday = useMemo(() => {
        const todayTasks = tasks.filter(t => t.due_date === todayString && !t.completed_at);
    
        if (settings.todaySortBy === 'priority') {
            // Sort by priority (1 is highest), then by the default task order as a tie-breaker.
            return todayTasks.sort((a, b) => {
                const priorityA = a.priority ?? 5; // Use a high number for null priority to sort it last
                const priorityB = b.priority ?? 5;
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                return (a.task_order ?? Infinity) - (b.task_order ?? Infinity);
            });
        }
        
        // For 'default', the list is already sorted by `task_order` from the database fetch.
        // The `.filter()` operation preserves this order.
        return todayTasks;
    }, [tasks, todayString, settings.todaySortBy]);

    const tasksForTomorrow = useMemo(() => tasks.filter(t => t.due_date === tomorrowString && !t.completed_at), [tasks, tomorrowString]);
    const tasksFuture = useMemo(() => tasks.filter(t => t.due_date > tomorrowString && !t.completed_at), [tasks, tomorrowString]);
    const completedToday = useMemo(() => tasks.filter(t => !!t.completed_at && t.due_date === todayString), [tasks, todayString]);
    
    const isStopwatchMode = useMemo(() => appState.mode === 'focus' && tasksToday[0]?.total_poms < 0, [appState.mode, tasksToday]);
    
    // Derived state for commitments: filter out expired ones for AI coach context
    const activeCommitments = useMemo(() => {
        return allCommitments.filter(c => c.status === 'active' && (!c.due_date || c.due_date >= todayString));
    }, [allCommitments, todayString]);

    // DERIVED STATE: Re-calculate daily logs whenever history or task completion status changes.
    const { dailyLog, historicalLogs } = useMemo(() => {
        const today = getTodayDateString();
        
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
        
        const logsByDate = new Map<string, DbDailyLog>();
        
        const loopDate = new Date(fourteenDaysAgo);
        const todayDate = new Date();
        todayDate.setHours(23, 59, 59, 999);
        while (loopDate <= todayDate) {
            const dateStr = getTodayDateString(loopDate);
            logsByDate.set(dateStr, {
                date: dateStr,
                completed_sessions: 0,
                total_focus_minutes: 0,
            });
            loopDate.setDate(loopDate.getDate() + 1);
        }
        
        // Sum up all pomodoro history entries. The previous logic was buggy.
        allPomodoroHistory.forEach(p => {
            const localDate = new Date(p.ended_at);
            const date = getTodayDateString(localDate);
            
            if (logsByDate.has(date)) {
                const log = logsByDate.get(date)!;
                log.completed_sessions += 1;
                log.total_focus_minutes += Number(p.duration_minutes) || 0;
            }
        });

        const newHistoricalLogs = Array.from(logsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
        const newDailyLog = logsByDate.get(today) || { date: today, completed_sessions: 0, total_focus_minutes: 0 };

        return { dailyLog: newDailyLog, historicalLogs: newHistoricalLogs };
    }, [allPomodoroHistory]);


    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Handle URL params from PWA shortcuts
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = urlParams.get('page');
        if (pageParam && ['timer', 'plan', 'stats', 'ai', 'settings', 'goals'].includes(pageParam)) {
            setPage(pageParam as Page);
            // Clean up URL to prevent re-triggering on hot reload
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const actionParam = urlParams.get('action');
        if (actionParam === 'start-focus') {
            setPage('timer');
            // Simply navigating to the timer page is the safest action.
            // Automatically starting the timer could be complex due to data loading states.
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []); // Run only once on component mount

    // --- START PERFORMANCE REFACTOR: GRANULAR REFRESH FUNCTIONS ---

    // Extracted logic to process pomodoro history into logs
    const processAndSetHistoryData = useCallback((history: PomodoroHistory[]) => {
        const today = getTodayDateString();
        const freshTodaysHistory = history.filter(p => p.ended_at.startsWith(today));
        
        setAllPomodoroHistory(history);
        setTodaysHistory(freshTodaysHistory);
    }, []);

    const refreshHistoryAndLogs = useCallback(async () => {
        if (!session) return;
        const today = getTodayDateString();
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
        const startDate = getTodayDateString(fourteenDaysAgo);

        const allPomodoroHistoryForRange = await dbService.getPomodoroHistory(startDate, today);
        processAndSetHistoryData(allPomodoroHistoryForRange);
    }, [session, processAndSetHistoryData]);

    const refreshTasks = useCallback(async () => {
        if (!session) return;
        const userTasks = await dbService.getTasks();
        if (userTasks) setTasks(userTasks);
    }, [session]);

    const refreshProjects = useCallback(async () => {
        if (!session) return;
        const updatedProjects = await dbService.checkAndUpdateDueProjects();
        if (updatedProjects) {
            setProjects(updatedProjects);
        } else {
            const userProjects = await dbService.getProjects();
            if (userProjects) setProjects(userProjects);
        }
    }, [session]);

    const refreshGoals = useCallback(async () => {
        if (!session) return;
        const userGoals = await dbService.getGoals();
        if (userGoals) setGoals(userGoals);
    }, [session]);
    
    const refreshTargets = useCallback(async () => {
        if (!session) return;
        const userTargets = await dbService.getTargets();
        if (userTargets) setTargets(augmentTargetsWithStatus(userTargets));
    }, [session]);

    const refreshCommitments = useCallback(async () => {
        if (!session) return;
        const updatedCommitments = await dbService.checkAndUpdatePastDueCommitments();
        if (updatedCommitments) {
            setAllCommitments(updatedCommitments);
        } else {
            const userCommitments = await dbService.getCommitments();
            if (userCommitments) setAllCommitments(userCommitments);
        }
    }, [session]);
    
    const refreshAiMemories = useCallback(async () => {
        if (!session) return;
        const memories = await dbService.getAiMemories();
        if (memories) setAiMemories(memories);
    }, [session]);

    const refreshNotifications = useCallback(async () => {
        if (!session) return;
        const userNotifications = await dbService.getNotifications();
        if (userNotifications) setNotifications(userNotifications);
    }, [session]);

    const fetchData = useCallback(async (showLoading = true) => {
        if (!session) return;
        if (showLoading) setIsLoading(true);
        try {
            // Fetch raw data sources first
            const [userSettings, userTasks, userProjects, userGoals, userTargets, userCommitments, allPomodoroHistoryForRange, userAiMemories, userNotifications] = await Promise.all([
                dbService.getSettings(),
                dbService.getTasks(),
                dbService.getProjects(),
                dbService.getGoals(),
                dbService.getTargets(),
                dbService.getCommitments(),
                dbService.getPomodoroHistory(getTodayDateString(new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)), getTodayDateString()),
                dbService.getAiMemories(),
                dbService.getNotifications()
            ]);

            // --- Process Pomodoro History to generate authoritative logs ---
            processAndSetHistoryData(allPomodoroHistoryForRange || []);

            // Set other state from fetched data
            if (userSettings) setSettings(userSettings);
            if (userTasks) setTasks(userTasks);
            
            const updatedProjects = await dbService.checkAndUpdateDueProjects();
            if (updatedProjects) {
                setProjects(updatedProjects);
            } else if (userProjects) {
                setProjects(userProjects);
            }

            const updatedCommitmentsAfterCheck = await dbService.checkAndUpdatePastDueCommitments();
            if (updatedCommitmentsAfterCheck) {
                setAllCommitments(updatedCommitmentsAfterCheck);
            } else if (userCommitments) {
                setAllCommitments(userCommitments);
            }

            if (userGoals) setGoals(userGoals);
            
            if (userTargets) {
                setTargets(augmentTargetsWithStatus(userTargets));
            }

            if (userAiMemories) setAiMemories(userAiMemories);
            if (userNotifications) setNotifications(userNotifications);
            
            if (showLoading && !didRestoreFromStorage) {
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
            if (showLoading) setIsLoading(false);
        }
    }, [session, didRestoreFromStorage, processAndSetHistoryData]);

    // --- END PERFORMANCE REFACTOR ---

    useEffect(() => {
        if (session?.user?.id && session.user.id !== fetchedForUserId.current) {
            // User is logged in, and we haven't fetched for this user yet.
            fetchedForUserId.current = session.user.id;
            fetchData();
        } else if (!session && fetchedForUserId.current) {
            // User logged out. Clear all user-specific data and reset the flag.
            fetchedForUserId.current = null;
            setIsLoading(false);
            
            // Clear state
            const { initialState } = getInitialAppState();
            setAppState(initialState);
            setPhaseEndTime(null);
            setDidRestoreFromStorage(false);
            setSettings({ focusDuration: 25, breakDuration: 5, sessionsPerCycle: 2, todaySortBy: 'default' });
            setTasks([]);
            setProjects([]);
            setGoals([]);
            setTargets([]);
            setAllCommitments([]);
            setTodaysHistory([]);
            setAllPomodoroHistory([]);
            setAiMemories([]);
            setNotifications([]);
            setAiChatMessages([{ role: 'model', text: 'Hello! I am your AI Coach. I have access to your goals, projects, and performance data. Ask me for insights, a weekly plan, or to add tasks for you!' }]);
            localStorage.removeItem('pomodoroAppState');
        } else if (!session) {
            // Initial state, no session, not loading.
            setIsLoading(false);
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

    // Animate background color on mode change
    useEffect(() => {
        const isFocus = appState.mode === 'focus';
        // Focus: slate-800, Break: a deep, calm purple
        document.body.style.backgroundColor = isFocus ? '#1e293b' : '#312e81';
    }, [appState.mode]);

    // Keyboard listener for command palette
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                setIsCommandPaletteOpen(o => !o);
            }
            if (event.key === 'Escape') {
                setIsCommandPaletteOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    
    // --- PWA Installation Logic ---
    useEffect(() => {
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        setIsStandalone(mediaQuery.matches);

        const handleChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setInstallPrompt(e);
        };

        if (!isStandalone) {
            window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        }

        return () => {
            if (!isStandalone) {
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            }
        };
    }, [isStandalone]);

    const handleInstallClick = async () => {
        if (!installPrompt) {
            return;
        }
        await installPrompt.prompt();
        // The prompt can only be used once. Clear it.
        setInstallPrompt(null);
    };

    // --- Notification System ---
    useEffect(() => {
        if (isLoading || !session) return;
    
        const existingIds = new Set(notifications.map(n => n.unique_id));
        const newNotifications: NewNotification[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
    
        const createNotificationPayload = (unique_id: string, message: string, type: AppNotification['type']) => {
            if (!existingIds.has(unique_id) && !clearedNotificationIds.has(unique_id)) {
                newNotifications.push({ unique_id, message, type });
            }
        };
    
        // 1. Deadline Reminders & Alerts
        const todayStr = getTodayDateString(today);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(today.getDate() + 3);
        const tomorrowStr = getTodayDateString(tomorrow);
        const threeDaysStr = getTodayDateString(threeDaysFromNow);
    
        [...projects, ...targets].forEach(item => {
            // NEW: Start date notifications
            if (item.start_date === todayStr) {
                const itemType = 'name' in item ? 'project' : 'target';
                const itemName = 'name' in item ? item.name : item.text;
                const itemTypeName = itemType.charAt(0).toUpperCase() + itemType.slice(1);
                createNotificationPayload(`${itemType}-start-today-${item.id}`, `🚀 ${itemTypeName} "${itemName}" starts today! Let's get to work.`, 'start');
            }

            // Ensure the item has a deadline and is currently active or due/incomplete
            if ('deadline' in item && item.deadline && (item.status === 'active' || item.status === 'due' || item.status === 'incomplete')) {
                const itemType = 'name' in item ? 'project' : 'target';
                const itemName = 'name' in item ? item.name : item.text;
                const itemTypeName = itemType.charAt(0).toUpperCase() + itemType.slice(1);
    
                // NEW: Critical Alert for overdue items
                if (item.status === 'due' || item.status === 'incomplete') {
                    const message = item.status === 'due'
                        ? `${itemTypeName} "${itemName}" is overdue!`
                        : `${itemTypeName} "${itemName}" was missed!`;
                    createNotificationPayload(`${itemType}-overdue-${item.id}`, message, 'alert');
                } else if (item.status === 'active') { // Only create warnings for active items
                    if (item.deadline === todayStr) {
                        createNotificationPayload(`${itemType}-due-today-${item.id}`, `${itemTypeName} "${itemName}" is due today!`, 'deadline');
                    } else if (item.deadline === tomorrowStr) {
                        createNotificationPayload(`${itemType}-due-1day-${item.id}`, `${itemTypeName} "${itemName}" is due tomorrow!`, 'deadline');
                    } else if (item.deadline === threeDaysStr) {
                        createNotificationPayload(`${itemType}-due-3day-${item.id}`, `Reminder: ${itemTypeName} "${itemName}" is due in 3 days.`, 'deadline');
                    }
                }
            }
        });
    
        // 2. Milestone/Streak Alerts
        const sortedLogs = [...historicalLogs].sort((a, b) => a.date.localeCompare(b.date));
        let streak = 0;
        if (sortedLogs.length > 0 && sortedLogs[sortedLogs.length - 1].date === getTodayDateString(today) && sortedLogs[sortedLogs.length - 1].total_focus_minutes > 0) {
            streak = 1;
            let lastDate = new Date(today);
            for (let i = sortedLogs.length - 2; i >= 0; i--) {
                const currentDate = new Date(sortedLogs[i].date + 'T00:00:00');
                const expectedPreviousDate = new Date(lastDate);
                expectedPreviousDate.setDate(lastDate.getDate() - 1);
                if (currentDate.getTime() === expectedPreviousDate.getTime() && sortedLogs[i].total_focus_minutes > 0) {
                    streak++;
                    lastDate = currentDate;
                } else if (currentDate < expectedPreviousDate) {
                    break;
                }
            }
        }
        
        const streakMilestones = [3, 7, 14, 30, 50, 100];
        if (streak > 0 && streakMilestones.includes(streak)) {
            createNotificationPayload(`streak-${streak}day`, `🎉 You've maintained a ${streak}-day focus streak! Keep it up!`, 'milestone');
        }
    
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekStartDateStr = getTodayDateString(weekStart);
        const weeklyMinutes = historicalLogs.filter(l => l.date >= weekStartDateStr).reduce((sum, l) => sum + l.total_focus_minutes, 0);
        const weeklyHours = weeklyMinutes / 60;
        const weeklyHourMilestones = [5, 10, 15, 20];
        
        for (const hours of weeklyHourMilestones) {
            const unique_id = `weekly-focus-${hours}hr-${weekStartDateStr}`;
            if (weeklyHours >= hours) {
                createNotificationPayload(unique_id, `Amazing work! You've logged over ${hours} hours of focus this week.`, 'milestone');
            }
        }

        // 3. Inactivity Notifications
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(today.getDate() - 5);
        const fiveDaysAgoStr = getTodayDateString(fiveDaysAgo);

        const taskMap = new Map<string, Task>(tasks.map(t => [t.id, t]));
        const projectLastActivity = new Map<string, string>();
        const targetLastActivity = new Map<string, string>();

        // Pre-calculate active time-based targets and their tags for efficiency
        const activeTimeTargets = targets.filter(t => t.status === 'active' && t.completion_mode === 'focus_minutes');
        const targetTagMap = new Map<string, string[]>();
        activeTimeTargets.forEach(t => {
            if (t.tags) {
                targetTagMap.set(t.id, t.tags.map(tag => tag.toLowerCase()));
            }
        });

        // Process all pomodoro history in the current range to find the last activity dates
        allPomodoroHistory.forEach(h => {
            if (h.task_id) {
                const task = taskMap.get(h.task_id);
                const activityDate = h.ended_at.split('T')[0];
                
                if (task) {
                    // Check for project activity
                    if (task.project_id) {
                        const currentLast = projectLastActivity.get(task.project_id);
                        if (!currentLast || activityDate > currentLast) {
                            projectLastActivity.set(task.project_id, activityDate);
                        }
                    }
                    
                    // Check for target activity
                    if (task.tags && task.tags.length > 0) {
                        const taskTagsLower = task.tags.map(t => t.toLowerCase());
                        for (const [targetId, targetTags] of targetTagMap.entries()) {
                            // Check if there's an intersection of tags
                            if (taskTagsLower.some(tTag => targetTags.includes(tTag))) {
                                const currentLast = targetLastActivity.get(targetId);
                                if (!currentLast || activityDate > currentLast) {
                                    targetLastActivity.set(targetId, activityDate);
                                }
                            }
                        }
                    }
                }
            }
        });

        // Check active projects for inactivity
        projects.forEach(p => {
            if (p.status === 'active') {
                const lastActivity = projectLastActivity.get(p.id);
                // Use last activity date, or fallback to start/creation date
                const referenceDateStr = lastActivity || p.start_date || p.created_at.split('T')[0];
                
                // If the reference date is 5 or more days ago, create a notification
                if (referenceDateStr <= fiveDaysAgoStr) {
                    createNotificationPayload(
                        `inactive-project-${p.id}`,
                        `You haven't worked on project "${p.name}" in 5 days. Time to make some progress?`,
                        'alert'
                    );
                }
            }
        });

        // Check active time-based targets for inactivity
        activeTimeTargets.forEach(t => {
            const lastActivity = targetLastActivity.get(t.id);
            // Use last activity date, or fallback to start/creation date
            const referenceDateStr = lastActivity || t.start_date || t.created_at.split('T')[0];
            
            // If the reference date is 5 or more days ago, create a notification
            if (referenceDateStr <= fiveDaysAgoStr) {
                createNotificationPayload(
                    `inactive-target-${t.id}`,
                    `You haven't made progress on your target "${t.text}" in 5 days.`,
                    'alert'
                );
            }
        });

        // 4. Daily Briefing Notification (once per day)
        const dailyBriefingId = `daily-briefing-${todayStr}`;
        if (!existingIds.has(dailyBriefingId) && !clearedNotificationIds.has(dailyBriefingId)) {
            const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
    
            // Find projects for today
            const projectsToday = projects.filter(p =>
                p.status === 'active' &&
                (!p.start_date || p.start_date <= todayStr) &&
                (!p.active_days || p.active_days.length === 0 || p.active_days.includes(dayOfWeek))
            ).map(p => p.name);
    
            // Find time-based targets with progress
            const timeTargets = targets.filter(t =>
                t.status === 'active' &&
                t.completion_mode === 'focus_minutes' &&
                t.target_minutes && t.progress_minutes < t.target_minutes
            ).map(t => `${t.text}: ${t.progress_minutes}/${t.target_minutes}m`);
    
            let messageParts: string[] = [];
            if (projectsToday.length > 0) {
                messageParts.push(`Projects: ${projectsToday.join(', ')}.`);
            }
            if (timeTargets.length > 0) {
                messageParts.push(`Targets: ${timeTargets.join(', ')}.`);
            }
    
            if (messageParts.length > 0) {
                const message = `☀️ Daily Briefing! ${messageParts.join(' ')} Let's make today productive!`;
                createNotificationPayload(dailyBriefingId, message, 'start');
            }
        }
    
        if (newNotifications.length > 0) {
            const addAndRefreshNotifications = async () => {
                await dbService.addNotifications(newNotifications);
                playNotificationSound();
                await refreshNotifications();
            };
            addAndRefreshNotifications();
        }
    }, [isLoading, session, tasks, projects, targets, historicalLogs, notifications, clearedNotificationIds, allPomodoroHistory, refreshNotifications]);

    const handleMarkNotificationRead = async (id: string) => {
        const updated = await dbService.markNotificationRead(id);
        if (updated) setNotifications(updated);
    };

    const handleMarkAllNotificationsRead = async () => {
        const updated = await dbService.markAllNotificationsRead();
        if (updated) setNotifications(updated);
    };

    const handleClearAllNotifications = async () => {
        if (window.confirm("Are you sure you want to clear all notifications? This cannot be undone.")) {
            const idsToClear = notifications.map(n => n.unique_id);
            const updated = await dbService.clearAllNotifications();
            if (updated) { // dbService returns [] on success
                setClearedNotificationIds(prev => new Set([...prev, ...idsToClear]));
                setNotifications(updated);
            }
        }
    };
    // --- End Notification System ---


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
    const checkProjectDurationCompletion = useCallback(async (taskId: string, durationAdded: number) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.project_id) return;

        const project = projects.find(p => p.id === task.project_id);
        if (!project || project.status !== 'active' || project.completion_criteria_type !== 'duration_minutes') return;
        
        await dbService.recalculateProjectProgress(project.id);
        await refreshProjects();
    }, [tasks, projects, refreshProjects]);

    // Phase Completion Logic
    const completePhase = useCallback(async () => {
        stopTimer();
        notificationInterval.current = window.setInterval(playAlertLoop, 3000);
        playAlertLoop();

        if (appState.mode === 'focus') {
            playFocusEndSound();
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
    }, [appState, settings, stopTimer, tasksToday]);
    
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
    const handleTaskCompletion = async (taskToComplete: Task, comment: string): Promise<Task | null> => {
        if (!taskToComplete) return null;
    
        const isStopwatch = taskToComplete.total_poms < 0;
    
        const updatedFields: Partial<Task> = {
            completed_poms: isStopwatch ? taskToComplete.completed_poms : taskToComplete.completed_poms + 1,
            comments: comment ? [...(taskToComplete.comments || []), comment] : taskToComplete.comments,
        };
        
        let taskIsNowComplete = false;
        if (!isStopwatch && updatedFields.completed_poms >= taskToComplete.total_poms) {
            updatedFields.completed_at = new Date().toISOString();
            taskIsNowComplete = true;
        }
        
        const updatedTask = await dbService.updateTask(taskToComplete.id, updatedFields, {
            shouldRecalculate: false // Defer recalculation
        });
    
        if (taskIsNowComplete && updatedTask && updatedTask.project_id) {
            await dbService.addProjectUpdate(
                updatedTask.project_id,
                getTodayDateString(),
                `Completed task: "${updatedTask.text}"`,
                updatedTask.id
            );
            await dbService.recalculateProjectProgress(updatedTask.project_id);
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
            await dbService.addPomodoroHistory(currentTask.id, sessionDurationMinutes, null);
        }
        
        // 2. Mark the task as complete
        await dbService.updateTask(currentTask.id, { completed_at: new Date().toISOString() }, {
            shouldRecalculate: true // Let updateTask handle the recalculations
        });
        
        // Add a project update after the task is marked as complete
        if (currentTask.project_id) {
            await dbService.addProjectUpdate(currentTask.project_id, todayString, `Completed task: "${currentTask.text}"`, currentTask.id);
        }
        
        // 3. Trigger a selective data refresh to sync UI
        await Promise.all([refreshTasks(), refreshHistoryAndLogs(), refreshProjects(), refreshTargets()]);
        
        // 4. Reset the timer for the next task
        const nextTask = tasks.filter(t => t.due_date === todayString && !t.completed_at)[0];
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
        setToastNotification('Task completed and time saved!');
    };

    // Modal Continue Handler
    const handleModalContinue = (comment: string, focusLevel: FocusLevel | null) => {
        if (isSyncing) return;
    
        // --- Immediate UI Updates ---
        if (notificationInterval.current) clearInterval(notificationInterval.current);
        setIsModalVisible(false);
        setIsSyncing(true);
        playStartSound();
    
        const wasFocusSession = modalContent.showCommentBox;
        const taskJustWorkedOn = tasksToday.find(t => !t.completed_at);
        const sessionTotalTime = appState.sessionTotalTime;
    
        // 1. Create a purely optimistic version of the task that was just worked on.
        let optimisticUpdatedTask: Task | null = null;
        if (wasFocusSession && taskJustWorkedOn) {
            optimisticUpdatedTask = {
                ...taskJustWorkedOn,
                completed_poms: taskJustWorkedOn.total_poms < 0
                    ? taskJustWorkedOn.completed_poms // Stopwatch poms don't increment this way
                    : taskJustWorkedOn.completed_poms + 1,
                comments: comment ? [...(taskJustWorkedOn.comments || []), comment] : taskJustWorkedOn.comments,
            };
    
            // If this pom completes the task, optimistically mark it so.
            if (taskJustWorkedOn.total_poms > 0 && optimisticUpdatedTask.completed_poms >= taskJustWorkedOn.total_poms) {
                optimisticUpdatedTask.completed_at = new Date().toISOString();
            }
        }
        
        // 2. Create the optimistic task list for UI state
        const optimisticTasks = optimisticUpdatedTask 
            ? tasks.map(t => t.id === optimisticUpdatedTask!.id ? optimisticUpdatedTask! : t)
            : tasks;
            
        // 3. Determine next timer state based on optimistic data
        const nextMode = modalContent.nextMode;
        const currentSessionNumber = appState.currentSession;
        const sessionsPerCycle = settings.sessionsPerCycle;
        
        const newCurrentSession = nextMode === 'focus' 
            ? (currentSessionNumber >= sessionsPerCycle ? 1 : currentSessionNumber + 1)
            : currentSessionNumber;
        
        let nextTaskForTimer: Task | undefined;
    
        if (nextMode === 'break') {
            nextTaskForTimer = taskJustWorkedOn;
        } else {
            const optimisticTasksToday = optimisticTasks.filter(t => t.due_date === todayString && !t.completed_at);
            if (settings.todaySortBy === 'priority') {
                optimisticTasksToday.sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5) || (a.task_order ?? Infinity) - (b.task_order ?? Infinity));
            }
            nextTaskForTimer = optimisticTasksToday[0];
        }
        
        let newTime;
        let newTotalTime;
    
        if (nextMode === 'break') {
            newTime = (taskJustWorkedOn?.custom_break_duration || settings.breakDuration) * 60;
            newTotalTime = newTime;
        } else { // focus
            const isNextStopwatch = nextTaskForTimer?.total_poms < 0;
            if (isNextStopwatch) {
                newTime = 0;
                newTotalTime = (nextTaskForTimer?.custom_focus_duration || settings.focusDuration) * 60;
            } else {
                newTime = (nextTaskForTimer?.custom_focus_duration || settings.focusDuration) * 60;
                newTotalTime = newTime;
            }
        }
        
        const newEndTime = nextMode === 'break' ? Date.now() + newTime * 1000 : null;
    
        // 4. Set all UI states at once
        setAppState(prev => ({
            ...prev,
            mode: nextMode,
            currentSession: newCurrentSession,
            timeRemaining: newTime,
            sessionTotalTime: newTotalTime,
            isRunning: true,
        }));
        setPhaseEndTime(newEndTime);
        setTasks(optimisticTasks); // This is crucial
    
        // --- Perform DB updates in the background ---
        const performAllUpdatesInBackground = async () => {
            try {
                if (wasFocusSession && taskJustWorkedOn) {
                    // @learn logic
                    let taskComment = comment;
                    const learnRegex = /@learn\s(.+)/i;
                    const learnMatch = comment.match(learnRegex);
    
                    if (learnMatch && learnMatch[1]) {
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
                        
                        dbService.addAiMemory('learning', cleanLearningContent, combinedTags, taskJustWorkedOn.id).then(newMemory => {
                            if (newMemory) {
                                setToastNotification('🧠 AI memory updated!');
                                refreshAiMemories();
                            }
                        });
                    }
                    
                    // Now run the DB updates
                    await handleTaskCompletion(taskJustWorkedOn, taskComment);
                    const focusDuration = Math.round(sessionTotalTime / 60);
                    await dbService.addPomodoroHistory(taskJustWorkedOn.id, focusDuration, focusLevel);
                    
                    const recalcPromises: Promise<any>[] = [];
                    if (taskJustWorkedOn.tags && taskJustWorkedOn.tags.length > 0) {
                       recalcPromises.push(dbService.recalculateProgressForAffectedTargets(taskJustWorkedOn.tags, session?.user.id || ''));
                    }
                    if (taskJustWorkedOn.project_id) {
                        recalcPromises.push(checkProjectDurationCompletion(taskJustWorkedOn.id, focusDuration));
                    }
                    await Promise.all(recalcPromises);
                }
            } catch (err) {
                console.error("Error during background data update:", err);
                setToastNotification("⚠️ Sync Error. Data might be stale.");
            } finally {
                // Refresh everything from DB to ensure consistency, then turn off sync indicator
                try {
                     await Promise.all([
                        refreshHistoryAndLogs(),
                        refreshTasks(),
                        refreshProjects(),
                        refreshTargets(),
                    ]);
                } catch (refreshErr) {
                    console.error("Error during final refresh:", refreshErr);
                    setToastNotification("⚠️ Sync Error. Please refresh the page.");
                } finally {
                    setIsSyncing(false);
                }
            }
        };
    
        performAllUpdatesInBackground();
    };
    
    const handleUpdateTaskTimers = async (id: string, newTimers: { focus: number | null, break: number | null }) => {
        await dbService.updateTask(id, {
            custom_focus_duration: newTimers.focus,
            custom_break_duration: newTimers.break,
        });
        await refreshTasks();
    };

    const handleUpdateTask = async (id: string, newText: string, newTags: string[], newPoms: number, projectId: string | null, priority: number | null) => {
        await dbService.updateTask(id, {
            text: newText,
            tags: newTags,
            total_poms: newPoms,
            project_id: projectId,
            priority: priority,
        });
        await Promise.all([refreshTasks(), refreshProjects(), refreshTargets()]);
    };

    const handleAddTask = async (text: string, poms: number, dueDate: string, projectId: string | null, tags: string[], priority: number | null) => {
        await dbService.addTask(text, poms, dueDate, projectId, tags, priority);
        await refreshTasks();
        if (projectId) {
            await refreshProjects();
        }
    };

    const handleDeleteTask = async (id: string) => {
        await dbService.deleteTask(id);
        await Promise.all([refreshTasks(), refreshProjects(), refreshTargets()]);
    };

    const handleMoveTask = async (id: string, action: 'postpone' | 'duplicate') => {
        await dbService.moveTask(id, action);
        await refreshTasks();
    };
    
    const handleBringTaskForward = async (id: string) => {
        await dbService.bringTaskForward(id);
        await refreshTasks();
    };

    const handleSortChange = async (newSortBy: 'default' | 'priority') => {
        const newSettings: Settings = { ...settings, todaySortBy: newSortBy };
        setSettings(newSettings); // Optimistic update
        await dbService.updateSettings(newSettings);
    };

    const handleReorderTasks = async (reorderedTasks: Task[]) => {
        handleSortChange('default');
        
        setTasks(currentTasks => {
            const reorderedIds = new Set(reorderedTasks.map(t => t.id));
            const otherTasks = currentTasks.filter(t => !reorderedIds.has(t.id));
            return [...otherTasks, ...reorderedTasks].sort((a,b) => (a.task_order ?? Infinity) - (b.task_order ?? Infinity));
        });

        await dbService.updateTaskOrder(reorderedTasks.map((task, index) => ({ id: task.id, task_order: index })));
        await refreshTasks();
    };

    const handleMarkTaskIncomplete = async (id: string) => {
        await dbService.markTaskIncomplete(id);
        await Promise.all([refreshTasks(), refreshProjects(), refreshTargets()]);
    };

    // --- Project Handlers ---
    const handleAddProject = async (name: string, description: string | null = null, startDate: string | null = null, deadline: string | null = null, criteria: {type: Project['completion_criteria_type'], value: number | null} = {type: 'manual', value: null}, priority: number | null = null, activeDays: number[] | null = null): Promise<string | null> => {
        const newProject = await dbService.addProject(name, description, startDate, deadline, criteria.type, criteria.value, priority, activeDays);
        if (newProject) {
            await refreshProjects();
            return newProject.id;
        }
        return null;
    };
    
    const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
        await dbService.updateProject(id, updates);
        await refreshProjects();
    };

    const handleDeleteProject = async (id: string) => {
        const result = await dbService.deleteProject(id);
        if (result.success) {
            await Promise.all([refreshProjects(), refreshTasks()]);
        } else if (result.error) {
            alert(`Error: ${result.error}`);
        }
    };
    
    // --- Goal Handlers ---
    const handleAddGoal = async (text: string) => {
        await dbService.addGoal(text);
        await refreshGoals();
    };
    
    const handleUpdateGoal = async (id: string, text: string) => {
        await dbService.updateGoal(id, { text });
        await refreshGoals();
    };

    const handleDeleteGoal = async (id: string) => {
        await dbService.deleteGoal(id);
        await refreshGoals();
    };

    const handleSetGoalCompletion = async (id: string, isComplete: boolean) => {
        await dbService.setGoalCompletion(id, isComplete ? new Date().toISOString() : null);
        await refreshGoals();
    };
    
    // --- Target Handlers ---
    const handleAddTarget = async (
        text: string, 
        deadline: string, 
        priority: number | null, 
        startDate: string | null, 
        completionMode: Target['completion_mode'], 
        tags: string[] | null, 
        targetMinutes: number | null
    ) => {
        await dbService.addTarget(text, deadline, priority, startDate, completionMode, tags, targetMinutes);
        await refreshTargets();
    };
    
    const handleUpdateTarget = async (id: string, updates: Partial<Target>) => {
        await dbService.updateTarget(id, updates);
        await refreshTargets();
    };

    const handleDeleteTarget = async (id: string) => {
        await dbService.deleteTarget(id);
        await refreshTargets();
    };

    // --- Spotlight/Pinning Handlers ---
    const handleSetPinnedItem = async (itemId: string, itemType: 'project' | 'target') => {
        const success = await dbService.setPinnedItem(itemId, itemType);
        if (success) {
            await Promise.all([refreshProjects(), refreshTargets()]);
            setToastNotification('Item pinned to spotlight!');
        } else {
            setToastNotification('Error pinning item.');
        }
    };

    const handleClearPins = async () => {
        const success = await dbService.clearAllPins();
        if (success) {
            await Promise.all([refreshProjects(), refreshTargets()]);
            setToastNotification('Spotlight cleared!');
        } else {
            setToastNotification('Error clearing pins.');
        }
    };

    // --- Commitment Handlers ---
    const handleAddCommitment = async (text: string, dueDate: string | null) => {
        await dbService.addCommitment(text, dueDate);
        await refreshCommitments();
    };

    const handleUpdateCommitment = async (id: string, updates: { text: string; dueDate: string | null }) => {
        await dbService.updateCommitment(id, updates);
        await refreshCommitments();
    };

    const handleDeleteCommitment = async (id: string) => {
        await dbService.deleteCommitment(id);
        await refreshCommitments();
    };

    const handleSetCommitmentCompletion = async (id: string, isComplete: boolean) => {
        await dbService.setCommitmentCompletion(id, isComplete);
        await refreshCommitments();
    };
    
    const handleMarkCommitmentBroken = async (id: string) => {
        await dbService.markCommitmentBroken(id);
        await refreshCommitments();
    };

    // --- Reschedule Handlers ---
    const handleRescheduleProject = async (id: string, newDeadline: string | null) => {
        await dbService.rescheduleProject(id, newDeadline);
        setToastNotification('Project rescheduled successfully!');
        await refreshProjects();
    };

    const handleRescheduleTarget = async (id: string, newDeadline: string) => {
        await dbService.rescheduleTarget(id, newDeadline);
        setToastNotification('Target rescheduled successfully!');
        await refreshTargets();
    };

    const handleRescheduleCommitment = async (id: string, newDueDate: string | null) => {
        await dbService.rescheduleCommitment(id, newDueDate);
        setToastNotification('Commitment rescheduled successfully!');
        await refreshCommitments();
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
        await dbService.addTask(text, poms, dueDate, projectId, tags, priority);
        await refreshTasks();
        if (projectId) await refreshProjects();
    };

    const handleMemoryChangeFromAI = async () => {
        await refreshAiMemories();
        setToastNotification('🧠 AI memory updated!');
    };
    
    const handleHistoryChangeFromAI = async () => {
        await Promise.all([
            refreshHistoryAndLogs(),
            refreshTasks(),
            refreshProjects(),
            refreshTargets(),
        ]);
        setToastNotification('🗓️ History data refreshed.');
    };

    // Settings
    const handleSaveSettings = async (newSettings: Settings) => {
        await dbService.updateSettings(newSettings);
        setSettings(newSettings);
        setToastNotification('Settings saved!');
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
                    onAddProject={(name) => handleAddProject(name, null, null, null, {type: 'manual', value: null}, null, null)}
                    onDeleteTask={handleDeleteTask}
                    onMoveTask={handleMoveTask}
                    onBringTaskForward={handleBringTaskForward}
                    onReorderTasks={handleReorderTasks}
                    onUpdateTaskTimers={handleUpdateTaskTimers}
                    onUpdateTask={handleUpdateTask}
                    onMarkTaskIncomplete={handleMarkTaskIncomplete}
                    todaySortBy={settings.todaySortBy}
                    onSortTodayByChange={handleSortChange}
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
                    onAddProject={handleAddProject}
                    onAddTarget={(text, deadline, priority) => handleAddTarget(text, deadline, priority, null, 'manual', null, null)}
                    onAddCommitment={handleAddCommitment}
                    onRescheduleItem={handleRescheduleItemFromAI}
                    chatMessages={aiChatMessages}
                    setChatMessages={setAiChatMessages}
                    aiMemories={aiMemories}
                    onMemoryChange={handleMemoryChangeFromAI}
                    onHistoryChange={handleHistoryChangeFromAI}
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
                    // FIX: Corrected typo from onSetCommitmentCompletion to handleSetCommitmentCompletion
                    onSetCommitmentCompletion={handleSetCommitmentCompletion}
                    onMarkCommitmentBroken={handleMarkCommitmentBroken}
                    onSetPinnedItem={handleSetPinnedItem}
                    onClearPins={handleClearPins}
                />;
            case 'settings':
                return <SettingsPage 
                    settings={settings} 
                    onSave={handleSaveSettings}
                    canInstall={!!installPrompt}
                    onInstall={handleInstallClick}
                    isStandalone={isStandalone}
                />;
            default:
                return <div>Page not found</div>;
        }
    };

    return (
        <div className="bg-slate-900 text-slate-200 min-h-screen" style={{fontFamily: `'Inter', sans-serif`}}>
            {toastNotification && <ToastNotification message={toastNotification} onDismiss={() => setToastNotification(null)} />}
            {isSyncing && <SyncIndicator />}
            <Navbar 
                currentPage={page} 
                setPage={setPage} 
                onLogout={() => supabase.auth.signOut()}
                unreadNotificationCount={unreadNotificationCount}
                onToggleNotifications={() => setIsNotificationPanelOpen(prev => !prev)}
            />
            
            {/* Notification button for mobile */}
            <button
                onClick={() => setIsNotificationPanelOpen(prev => !prev)}
                className="md:hidden fixed top-4 right-4 z-30 p-3 rounded-full bg-slate-800/50 backdrop-blur-lg border border-slate-700/80 text-slate-300 hover:text-white"
                aria-label={`View notifications (${unreadNotificationCount} unread)`}
            >
                <div className="relative">
                    <BellIcon />
                    {unreadNotificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-800">
                            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                        </span>
                    )}
                </div>
            </button>
            
            <main className="md:pl-20 lg:pl-56 transition-all duration-300">
                <div key={page} className="p-4 sm:p-6 pb-20 md:pb-6 max-w-4xl mx-auto animate-fadeIn">
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
                    isSyncing={isSyncing}
                />
            )}
            
            {isNotificationPanelOpen && (
                <NotificationPanel
                    notifications={notifications}
                    onMarkRead={handleMarkNotificationRead}
                    onMarkAllRead={handleMarkAllNotificationsRead}
                    onClearAll={handleClearAllNotifications}
                    onClose={() => setIsNotificationPanelOpen(false)}
                />
            )}

            {isCommandPaletteOpen && (
                <CommandPalette
                    onClose={() => setIsCommandPaletteOpen(false)}
                    setPage={setPage}
                    tasks={[...tasksToday, ...tasksForTomorrow, ...tasksFuture]}
                    projects={projects}
                    goals={goals}
                    targets={targets}
                />
            )}
        </div>
    );
};

export default App;
