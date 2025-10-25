

import { supabase } from './supabaseClient';
import { Settings, Task, DbDailyLog, Project, Goal, Target, PomodoroHistory } from '../types';
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
        .order('due_date', { ascending: true }) // Sort by date first
        .order('task_order', { ascending: true, nullsFirst: true }) // Then by custom order, putting unordered tasks first
        .order('created_at', { ascending: true }); // Fallback sort

    if (error) {
        console.error("Error fetching tasks:", error);
        return null;
    }
    
    return data;
};

export const addTask = async (text: string, poms: number, isTomorrow: boolean, projectId: string | null, tags: string[]): Promise<Task[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return null;
    }

    const dueDate = isTomorrow 
        ? getTodayDateString(new Date(Date.now() + 24 * 60 * 60 * 1000))
        : getTodayDateString();

    const { data: maxOrderData } = await supabase
        .from('tasks')
        .select('task_order')
        .eq('user_id', user.id)
        .eq('due_date', dueDate)
        .not('task_order', 'is', null) // Ensure we only get tasks with an order
        .order('task_order', { ascending: false })
        .limit(1)
        .single();
        
    const newOrder = (maxOrderData?.task_order ?? -1) + 1;

    const taskToInsert = {
        user_id: user.id,
        text,
        total_poms: poms,
        due_date: dueDate,
        completed_poms: 0,
        comments: [],
        project_id: projectId,
        tags: tags,
        task_order: newOrder,
    };
    
    const { error } = await supabase
        .from('tasks')
        .insert(taskToInsert)
        .select();
    
    if (error) {
        console.error("Error adding task:", error);
        return null;
    }
    
    return getTasks();
};

export const updateTask = async (id: string, updates: Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'projects'>>): Promise<Task | null> => {
    const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select('*, projects(name)')
        .single();

    if (error) {
        console.error("Error updating task:", error);
        return null;
    }

    return data;
};

export const updateTaskOrder = async (tasksToUpdate: { id: string, task_order: number }[]): Promise<Task[] | null> => {
    // Use Promise.all to run individual updates in parallel. This is safer than a single bulk upsert.
    const updatePromises = tasksToUpdate.map(task =>
        supabase
            .from('tasks')
            .update({ task_order: task.task_order })
            .eq('id', task.id)
    );

    try {
        const results = await Promise.all(updatePromises);
        // Check if any of the parallel updates resulted in an error
        const firstError = results.find(res => res.error);
        if (firstError) {
            throw firstError.error;
        }
    } catch (error) {
        console.error("Error during parallel task order update:", error);
        return null; // On failure, return null
    }

    // On success, refetch all tasks to ensure UI is in sync with DB
    return getTasks();
};


export const deleteTask = async (id: string): Promise<Task[] | null> => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
        console.error("Error deleting task:", error);
        return null;
    }
    return getTasks();
};

export const moveTask = async (id: string, action: 'postpone' | 'duplicate'): Promise<Task[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const tomorrow = getTodayDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
    
    const { data: maxOrderData } = await supabase
        .from('tasks')
        .select('task_order')
        .eq('user_id', user.id)
        .eq('due_date', tomorrow)
        .not('task_order', 'is', null)
        .order('task_order', { ascending: false })
        .limit(1)
        .single();
    
    const newOrderForTomorrow = (maxOrderData?.task_order ?? -1) + 1;

    if (action === 'postpone') {
        const { error } = await supabase
            .from('tasks')
            .update({ due_date: tomorrow, task_order: newOrderForTomorrow })
            .eq('id', id);
        if (error) console.error("Error postponing task:", error);
    } else { // duplicate
        const { data: original, error: fetchError } = await supabase.from('tasks').select('*').eq('id', id).single();
        if (fetchError || !original) {
            console.error("Error fetching original task to duplicate:", fetchError);
            return null;
        }
        
        const { error: insertError } = await supabase.from('tasks').insert({
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
            task_order: newOrderForTomorrow,
        });
         if (insertError) console.error("Error duplicating task:", insertError);
    }
    
    return getTasks();
};

export const markTaskIncomplete = async (id: string): Promise<Task[] | null> => {
    // First, find the task to get its due_date
    const { data: taskData, error: findError } = await supabase.from('tasks').select('due_date, user_id').eq('id', id).single();
    if (findError || !taskData) {
        console.error("Error finding task to mark incomplete:", findError);
        return null;
    }

    // Find the max order for that day to place the re-opened task at the end
    const { data: maxOrderData } = await supabase
        .from('tasks')
        .select('task_order')
        .eq('user_id', taskData.user_id)
        .eq('due_date', taskData.due_date)
        .not('task_order', 'is', null)
        .order('task_order', { ascending: false })
        .limit(1)
        .single();
    
    const newOrder = (maxOrderData?.task_order ?? -1) + 1;
    
    // Update the task to be incomplete and set its new order
    const { error: updateError } = await supabase
        .from('tasks')
        .update({ completed_at: null, task_order: newOrder })
        .eq('id', id);

    if (updateError) {
        console.error("Error marking task as incomplete:", updateError);
        return null;
    }
    
    return getTasks();
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

// --- Pomodoro History (for Heatmap) ---

export const getTodaysPomodoroHistory = async (): Promise<PomodoroHistory[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const today = getTodayDateString();

    const { data, error } = await supabase
        .from('pomodoro_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('ended_at', `${today}T00:00:00Z`)
        .lte('ended_at', `${today}T23:59:59Z`);

    if (error) {
        console.error("Error fetching today's pomodoro history:", error);
        return [];
    }
    return data;
};


export const addPomodoroHistory = async (taskId: string | null, duration: number): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // The `insert` method expects an array of objects.
    // We are also removing `ended_at` to let the database's `DEFAULT now()` function handle it.
    // This is more robust and avoids potential client-side timezone or formatting issues.
    const { error } = await supabase.from('pomodoro_history').insert([{
        user_id: user.id,
        task_id: taskId,
        duration_minutes: duration,
    }]);

    if (error) {
        // Log the full error for better debugging.
        console.error("Error adding pomodoro history:", JSON.stringify(error, null, 2));
    }
};

export const getPomodoroHistory = async (startDate: string, endDate: string): Promise<PomodoroHistory[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('pomodoro_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('ended_at', `${startDate}T00:00:00Z`)
        .lte('ended_at', `${endDate}T23:59:59Z`);

    if (error) {
        console.error("Error fetching pomodoro history:", error);
        return [];
    }
    return data;
};

export const getConsistencyLogs = async (days = 180): Promise<DbDailyLog[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateString = getTodayDateString(startDate);

    // Fetch all tasks due within the date range to get total and completed counts.
    const { data, error } = await supabase
        .from('tasks')
        .select('due_date, completed_at')
        .eq('user_id', user.id)
        .gte('due_date', startDateString);

    if (error) {
        console.error("Error fetching tasks for consistency logs:", error);
        return [];
    }

    // Aggregate counts and completion status by day.
    const statsByDay = new Map<string, { completed: number; total: number }>();
    if (data) {
        data.forEach(task => {
            const dateString = task.due_date;
            if (!statsByDay.has(dateString)) {
                statsByDay.set(dateString, { completed: 0, total: 0 });
            }
            const dayStat = statsByDay.get(dateString)!;
            dayStat.total++;
            if (task.completed_at) {
                dayStat.completed++;
            }
        });
    }

    // Map the aggregated data to the DbDailyLog structure, using the percentage for `completed_sessions`.
    return Array.from(statsByDay.entries()).map(([date, stats]) => ({
        date: date,
        completed_sessions: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        total_focus_minutes: 0, // Not used by the tracker, but required by the type
    }));
};