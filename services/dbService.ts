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
        console.error("Error fetching settings:", JSON.stringify(error, null, 2));
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
        console.error("Error fetching tasks:", JSON.stringify(error, null, 2));
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
        console.error("Error adding task:", JSON.stringify(error, null, 2));
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
        console.error("Error updating task:", JSON.stringify(error, null, 2));
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
        console.error("Error during parallel task order update:", JSON.stringify(error, null, 2));
        return null; // On failure, return null
    }

    // On success, refetch all tasks to ensure UI is in sync with DB
    return getTasks();
};


export const deleteTask = async (id: string): Promise<Task[] | null> => {
    // Step 1: Delete associated pomodoro history. This ensures focus time is also removed.
    const { error: historyError } = await supabase
        .from('pomodoro_history')
        .delete()
        .eq('task_id', id);

    if (historyError) {
        console.error("Error deleting pomodoro history for task:", JSON.stringify(historyError, null, 2));
        // We will still attempt to delete the task itself.
    }

    // Step 2: Delete the task itself.
    const { error: taskError } = await supabase.from('tasks').delete().eq('id', id);
    if (taskError) {
        console.error("Error deleting task:", JSON.stringify(taskError, null, 2));
        return null;
    }

    // Step 3: Return the updated list of tasks. The calling component will handle state updates.
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
        if (error) console.error("Error postponing task:", JSON.stringify(error, null, 2));
    } else { // duplicate
        const { data: original, error: fetchError } = await supabase.from('tasks').select('*').eq('id', id).single();
        if (fetchError || !original) {
            console.error("Error fetching original task to duplicate:", JSON.stringify(fetchError, null, 2));
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
         if (insertError) console.error("Error duplicating task:", JSON.stringify(insertError, null, 2));
    }
    
    return getTasks();
};

export const markTaskIncomplete = async (id: string): Promise<Task[] | null> => {
    // First, find the task to get its due_date
    const { data: taskData, error: findError } = await supabase.from('tasks').select('due_date, user_id').eq('id', id).single();
    if (findError || !taskData) {
        console.error("Error finding task to mark incomplete:", JSON.stringify(findError, null, 2));
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
        console.error("Error marking task as incomplete:", JSON.stringify(updateError, null, 2));
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
    if (error) console.error("Error fetching projects:", JSON.stringify(error, null, 2));
    return error ? null : data;
}

export const addProject = async (
    name: string, 
    deadline: string | null, 
    criteriaType: Project['completion_criteria_type'],
    criteriaValue: number | null
): Promise<Project | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: newProject, error } = await supabase
        .from('projects')
        .insert({ 
            name, 
            user_id: user.id, 
            deadline,
            completion_criteria_type: criteriaType,
            completion_criteria_value: criteriaValue,
            status: 'active',
            progress_value: 0
        })
        .select()
        .single();
    if (error) {
      console.error("Error adding project:", JSON.stringify(error, null, 2));
    }
    return error ? null : newProject;
}

export const updateProject = async (id: string, updates: Partial<Project>): Promise<Project[] | null> => {
    const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id);
    
    if (error) {
      console.error("Error updating project:", JSON.stringify(error, null, 2));
    }
    return error ? null : await getProjects();
}

export const deleteProject = async (id: string): Promise<{ success: boolean; data: { projects: Project[], tasks: Task[] } | null; error: string | null }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, data: null, error: "User not authenticated." };

    // STEP 1: Manually unlink all tasks associated with this project.
    // This bypasses reliance on the ON DELETE SET NULL constraint and makes RLS issues more explicit.
    const { error: unlinkError } = await supabase
        .from('tasks')
        .update({ project_id: null })
        .eq('project_id', id);

    if (unlinkError) {
        console.error("Error unlinking tasks from project:", JSON.stringify(unlinkError, null, 2));
        let userFriendlyError = `Failed at step 1: Unlinking tasks. Reason: ${unlinkError.message}.`;
        if (unlinkError.message.includes('permission denied')) {
            userFriendlyError += " This almost certainly means your Row Level Security (RLS) policy on the 'tasks' table is missing or incorrect. It needs to allow the UPDATE operation for authenticated users on their own tasks.";
        }
        return { success: false, data: null, error: userFriendlyError };
    }

    // STEP 2: Delete the project now that it has no dependencies.
    const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

    if (deleteError) {
        console.error("Error deleting project:", JSON.stringify(deleteError, null, 2));
        let userFriendlyError = `Failed at step 2: Deleting project. Reason: ${deleteError.message}.`;
        if (deleteError.message.includes('permission denied')) {
             userFriendlyError += " This almost certainly means your Row Level Security (RLS) policy on the 'projects' table is missing or incorrect. It needs to allow the DELETE operation for authenticated users on their own projects.";
        }
        return { success: false, data: null, error: userFriendlyError };
    }

    // STEP 3: On success, refetch both projects and tasks to ensure the UI is in a consistent state.
    const [newProjects, newTasks] = await Promise.all([
        getProjects(),
        getTasks()
    ]);

    if (newProjects === null || newTasks === null) {
        return { success: false, data: null, error: "Project deleted, but failed to refetch updated data." };
    }

    return { success: true, data: { projects: newProjects, tasks: newTasks }, error: null };
}


export const checkAndUpdateDueProjects = async (): Promise<Project[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const today = getTodayDateString();

    // Find projects that are active, have a deadline, and the deadline has passed.
    const { data: dueProjects, error } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .not('deadline', 'is', null)
        .lt('deadline', today);

    if (error) {
        console.error("Error fetching due projects:", JSON.stringify(error, null, 2));
        // Return null on error so the caller knows something went wrong
        return null;
    }
    
    if (!dueProjects || dueProjects.length === 0) {
        // No projects to update, just return the current full list
        return getProjects();
    }
    
    const dueProjectIds = dueProjects.map(p => p.id);

    const { error: updateError } = await supabase
      .from('projects')
      .update({ status: 'due' })
      .in('id', dueProjectIds);
      
    if (updateError) {
        console.error("Error updating due projects:", JSON.stringify(updateError, null, 2));
        return null;
    }

    // Return the fresh list of all projects after the update
    return getProjects();
};


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
        console.error("Error fetching daily log for today:", JSON.stringify(error, null, 2));
    }

    return data || { date: today, completed_sessions: 0, total_focus_minutes: 0, user_id: user.id };
};

export const upsertDailyLog = async (log: DbDailyLog): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // The 'upsert' with 'onConflict' requires a UNIQUE constraint on (user_id, date) in the database.
    // The error "there is no unique or exclusion constraint matching the ON CONFLICT specification"
    // indicates this constraint is missing.
    // To fix this without altering the database schema, we perform a manual upsert:
    // 1. Check if a log for the user and date exists.
    // 2. If it exists, update it.
    // 3. If it does not exist, insert it.

    const logData = {
        user_id: user.id,
        date: log.date,
        completed_sessions: log.completed_sessions,
        total_focus_minutes: log.total_focus_minutes,
    };

    // Step 1: Check for an existing log
    const { data: existingLog, error: selectError } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', log.date)
        .maybeSingle(); // Use maybeSingle to avoid an error if no row is found. It returns null instead.

    if (selectError) {
        console.error("Error checking for existing daily log:", JSON.stringify(selectError, null, 2));
        return;
    }
    
    if (existingLog) {
        // Step 2: Log exists, so we update it.
        const { error: updateError } = await supabase
            .from('daily_logs')
            .update({ // Only update the fields that can change
                completed_sessions: logData.completed_sessions,
                total_focus_minutes: logData.total_focus_minutes,
            })
            .eq('id', existingLog.id);
        
        if (updateError) {
            console.error("Error updating daily log:", JSON.stringify(updateError, null, 2));
        }
    } else {
        // Step 3: Log does not exist, so we insert it.
        const { error: insertError } = await supabase
            .from('daily_logs')
            .insert(logData);
            
        if (insertError) {
            console.error("Error inserting daily log:", JSON.stringify(insertError, null, 2));
        }
    }
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
        .eq('status', 'completed')
        .gte('completed_at', `${startDate}T00:00:00Z`)
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
        console.error("Error fetching today's pomodoro history:", JSON.stringify(error, null, 2));
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
        console.error("Error fetching pomodoro history:", JSON.stringify(error, null, 2));
        return [];
    }
    return data;
};

export const getAllPomodoroHistory = async (): Promise<PomodoroHistory[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('pomodoro_history')
        .select('*')
        .eq('user_id', user.id)
        .order('ended_at', { ascending: false });

    if (error) {
        console.error("Error fetching all pomodoro history:", JSON.stringify(error, null, 2));
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
        console.error("Error fetching tasks for consistency logs:", JSON.stringify(error, null, 2));
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