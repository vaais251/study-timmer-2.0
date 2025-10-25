
import { supabase } from './supabaseClient';
import { Settings, Task, DbDailyLog, Project, Goal, Target } from '../types';
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

    const today = getTodayDateString();

    const { data, error } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .eq('user_id', user.id)
        .gte('due_date', today)
        .order('created_at', { ascending: true });

    if (error) {
        return null;
    }
    
    return data;
};

const fetchAllTasks = async (): Promise<Task[] | null> => {
    return getTasks();
};

export const addTask = async (text: string, poms: number, isTomorrow: boolean, projectId: string | null, tags: string[]): Promise<Task[] | null> => {
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
        project_id: projectId,
        tags: tags,
    };
    
    const { error } = await supabase
        .from('tasks')
        .insert(taskToInsert)
        .select();
    
    if (error) {
        return null;
    }
    
    return fetchAllTasks();
};

export const updateTask = async (id: string, updates: Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'projects'>>): Promise<Task | null> => {
    const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select('*, projects(name)')
        .single();

    if (error) {
        return null;
    }

    return data;
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
        await supabase
            .from('tasks')
            .update({ due_date: tomorrow })
            .eq('id', id);
    } else { // duplicate
        const { data: original, error: fetchError } = await supabase.from('tasks').select('*').eq('id', id).single();
        if (fetchError || !original) {
            return null;
        }
        
        await supabase.from('tasks').insert({
            user_id: original.user_id,
            text: original.text,
            total_poms: original.total_poms,
            due_date: tomorrow,
            completed_poms: 0,
            comments: [],
            project_id: original.project_id,
            tags: original.tags,
            custom_focus_duration: original.custom_focus_duration,
            custom_break_duration: original.custom_break_duration,
        });
    }
    
    return fetchAllTasks();
};

// --- Projects ---

export const getProjects = async (): Promise<Project[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
    return error ? null : data;
}

export const addProject = async (name: string, deadline: string | null): Promise<Project | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: newProject, error } = await supabase
        .from('projects')
        .insert({ name, user_id: user.id, deadline })
        .select()
        .single();
    return error ? null : newProject;
}

export const updateProjectStatus = async (id: string, completed: boolean): Promise<Project[] | null> => {
    const { error } = await supabase
        .from('projects')
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq('id', id);
    
    return error ? null : await getProjects();
}

export const deleteProject = async (id: string): Promise<Project[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 1. Unlink tasks
    await supabase
        .from('tasks')
        .update({ project_id: null })
        .eq('user_id', user.id)
        .eq('project_id', id);

    // 2. Delete project
    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

    return error ? null : await getProjects();
}

// --- Goals & Targets ---

export const getGoals = async (): Promise<Goal[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('goals').select('id, text').eq('user_id', user.id);
    return error ? null : data;
}

export const addGoal = async (text: string): Promise<Goal[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { error } = await supabase.from('goals').insert({ text, user_id: user.id });
    return error ? null : await getGoals();
}

export const deleteGoal = async (id: string): Promise<Goal[] | null> => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    return error ? null : await getGoals();
}

export const getTargets = async (): Promise<Target[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('targets').select('*').eq('user_id', user.id).order('deadline');
    return error ? null : data;
}

export const addTarget = async (text: string, deadline: string): Promise<Target[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { error } = await supabase.from('targets').insert({ text, deadline, user_id: user.id });
    return error ? null : await getTargets();
}

export const updateTarget = async (id: string, completed: boolean): Promise<Target[] | null> => {
    const { error } = await supabase.from('targets').update({ completed_at: completed ? new Date().toISOString() : null }).eq('id', id);
    return error ? null : await getTargets();
}

export const deleteTarget = async (id: string): Promise<Target[] | null> => {
    const { error } = await supabase.from('targets').delete().eq('id', id);
    return error ? null : await getTargets();
}


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
        .select('*, projects(name)')
        .eq('user_id', user.id)
        .gte('due_date', startDate)
        .lte('due_date', endDate);
    
    if (error) {
        return [];
    }
    return data;
};

export const getAllTasksForStats = async (): Promise<Task[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);
    
    if (error) {
        return [];
    }
    return data;
};

export const getHistoricalProjects = async (startDate: string, endDate: string): Promise<Project[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_at', startDate)
        .lte('completed_at', `${endDate}T23:59:59Z`);
    
    if (error) {
        return [];
    }
    return data;
};

export const getHistoricalTargets = async (startDate: string, endDate:string): Promise<Target[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('targets')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_at', startDate)
        .lte('completed_at', `${endDate}T23:59:59Z`);

    if (error) {
        return [];
    }
    return data;
};
