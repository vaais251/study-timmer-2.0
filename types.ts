
export type Mode = 'focus' | 'break';

export type Page = 'timer' | 'plan' | 'stats' | 'ai' | 'settings';

export interface Task {
    id: string;
    text: string;
    totalPoms: number;
    completedPoms: number;
    comments: string[];
}

export interface Settings {
    focusDuration: number;
    breakDuration: number;
    sessionsPerCycle: number;
}

export interface DailyLog {
    completed: Task[];
    incomplete: Task[];
    stats: {
        completedSessions: number;
        totalFocusMinutes: number;
    };
}

export interface AppState {
    mode: Mode;
    currentSession: number;
    timeRemaining: number;
    totalTime: number;
    isRunning: boolean;
    completedSessions: number;
    totalFocusMinutes: number;
    tasks: Task[];
    completedToday: Task[];
    tasksForTomorrow: Task[];
}
