

import { Session, User } from '@supabase/supabase-js';

export type Mode = 'focus' | 'break';

export type Page = 'timer' | 'plan' | 'stats' | 'ai' | 'settings' | 'goals';

// Corresponds to the `projects` table
export interface Project {
    id: string;
    name: string;
    deadline: string | null;
    status: 'active' | 'completed' | 'due';
    completed_at: string | null; // Set when status becomes 'completed'
    completion_criteria_type: 'manual' | 'task_count' | 'duration_minutes';
    completion_criteria_value: number | null;
    progress_value: number; // stores completed tasks or minutes
}

// Corresponds to the `goals` table
export interface Goal {
    id: string;
    text: string;
}

// Corresponds to the `targets` table
export interface Target {
    id: string;
    text: string;
    deadline: string;
    completed_at: string | null;
}

// Corresponds to the `tasks` table
export interface Task {
    id: string;
    user_id: string;
    created_at: string;
    text: string;
    total_poms: number;
    completed_poms: number;
    comments: string[];
    due_date: string; // YYYY-MM-DD
    completed_at: string | null;
    project_id: string | null;
    tags: string[];
    task_order: number | null;
    projects?: { name: string } | null; // For joined data
    custom_focus_duration: number | null;
    custom_break_duration: number | null;
}

// Corresponds to the `settings` table (without user_id)
export interface Settings {
    focusDuration: number;
    breakDuration: number;
    sessionsPerCycle: number;
}
export interface DbSettings extends Settings {
    user_id: string;
    updated_at: string;
}

// Corresponds to the `daily_logs` table
export interface DbDailyLog {
    id?: string;
    user_id?: string;
    date: string; // YYYY-MM-DD
    completed_sessions: number;
    total_focus_minutes: number;
}

// Corresponds to the new `pomodoro_history` table
export interface PomodoroHistory {
    id: string;
    user_id: string;
    task_id: string | null;
    ended_at: string;
    duration_minutes: number;
}


// Legacy types for compatibility during refactor
export interface AppState {
    mode: Mode;
    currentSession: number;
    timeRemaining: number;
    isRunning: boolean;
    sessionTotalTime: number;
}

// Supabase session and user for auth
export type { Session, User };