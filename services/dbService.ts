

import { supabase } from './supabaseClient';
import { Settings, Task, DbDailyLog } from '../types';
import { getTodayDateString } from '../utils/date';

// --- Settings ---

export const getSettings = async (): Promise<Settings | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('settings')
        .select('focus_duration, break_duration, session_per_cycle')
        .eq('user_id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: "exact one row not found"
        return null;
    }
    
    if (!data) return null;

    return {
        focusDuration: data.focus_duration,
        breakDuration: data.break_duration,
        sessionsPerCycle: data.session_per_cycle
    };
};

export const updateSettings = async (settings: Settings): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('settings').upsert({
        user_id: user.id,
        focus_duration: settings.focusDuration,
        break_duration: settings.breakDuration,
        session_per_cycle: settings.sessionsPerCycle,
        updated_at: new Date().toISOString(),
    });

};


// --- Tasks ---

export const getTasks = async (): Promise<Task[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Fetch tasks due today or in the future
    const today = getTodayDateString();

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('due_date', today)
        .order('created_at', { ascending: true });

    if (error) {
        return null;
    }
    
    return data;
};

const fetchAllTasks = async (): Promise<Task[] | null> => {
    // This is a helper to refetch all tasks after a mutation
    return getTasks();
};

export const addTask = async (text: string, poms: number, isTomorrow: boolean): Promise<Task[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return null;
    }

    const dueDate = isTomorrow 
        ? getTodayDateString(new Date(Date.now() + 24 * 60 * 60 * 1000))
        : getTodayDateString();

    const taskToInsert = {
        user_id: user.id,
        text,
        total_poms: poms,
        due_date: dueDate,
        completed_poms: 0,
        comments: [],
    };
    
    const { data: insertedData, error } = await supabase
        .from('tasks')
        .insert(taskToInsert)
        .select();
    
    if (error) {
        return null;
    }

    if (!insertedData || insertedData.length === 0) {
        return null;
    }
    
    return fetchAllTasks();
};

export const updateTask = async (task: Task): Promise<Task[] | null> => {
    const { data: updatedData, error } = await supabase
        .from('tasks')
        .update({
            completed_poms: task.completed_poms,
            comments: task.comments,
            completed_at: task.completed_at,
        })
        .eq('id', task.id)
        .select();

    if (error) {
        return null;
    }

    if (!updatedData || updatedData.length === 0) {
        return null;
    }

    return fetchAllTasks();
};

export const deleteTask = async (id: string): Promise<Task[] | null> => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
        return null;
    }
    return fetchAllTasks();
};

export const moveTask = async (id: string, action: 'postpone' | 'duplicate'): Promise<Task[] | null> => {
    const tomorrow = getTodayDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
    
    if (action === 'postpone') {
        const { error } = await supabase
            .from('tasks')
            .update({ due_date: tomorrow })
            .eq('id', id);
        if (error) {}
    } else { // duplicate
        const { data: original, error: fetchError } = await supabase.from('tasks').select('*').eq('id', id).single();
        if (fetchError || !original) {
            return null;
        }
        
        const { error: insertError } = await supabase.from('tasks').insert({
            user_id: original.user_id,
            text: original.text,
            total_poms: original.total_poms,
            due_date: tomorrow,
            completed_poms: 0,
            comments: [],
        });
        if (insertError) {}
    }
    
    return fetchAllTasks();
};

// --- Daily Logs ---

export const getDailyLogForToday = async (): Promise<DbDailyLog | null> => {
     const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const today = getTodayDateString();
    const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        
    }

    return data || { date: today, completed_sessions: 0, total_focus_minutes: 0, user_id: user.id };
};

export const upsertDailyLog = async (log: DbDailyLog): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { error } = await supabase.from('daily_logs').upsert({
        user_id: user.id,
        date: log.date,
        completed_sessions: log.completed_sessions,
        total_focus_minutes: log.total_focus_minutes,
    }, { onConflict: 'user_id, date' });

    if (error) {}
};


export const getHistoricalLogs = async (startDate: string, endDate: string): Promise<DbDailyLog[]> => {
     const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

    if (error) {
        return [];
    }
    return data;
};

export const getHistoricalTasks = async (startDate: string, endDate: string): Promise<Task[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('due_date', startDate)
        .lte('due_date', endDate);
    
    if (error) {
        return [];
    }
    return data;
};