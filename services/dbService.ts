import { supabase } from './supabaseClient';
import { Settings, Task, DbDailyLog, Project, Goal, Target, PomodoroHistory, Commitment, ProjectUpdate, AiMemory, AppNotification, FocusLevel } from '../types';
import { getTodayDateString } from '../utils/date';

// --- Recalculation Logic ---

/**
 * Recalculates the progress for a given project from scratch based on its tasks.
 * This is the authoritative method for updating project progress.
 */
export const recalculateProjectProgress = async (projectId: string): Promise<void> => {
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('completion_criteria_type, completion_criteria_value, status, deadline') // Fetch status and deadline
        .eq('id', projectId)
        .single();

    if (projectError || !project) {
        console.error("Error fetching project for recalculation:", projectError);
        return;
    }

    let newProgressValue = 0;
    const updates: Partial<Project> = {};

    if (project.completion_criteria_type === 'task_count') {
        const { count, error: countError } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .not('completed_at', 'is', null);
        
        if (countError) {
            console.error("Error counting completed tasks for project:", countError);
            return;
        }
        newProgressValue = count || 0;

    } else if (project.completion_criteria_type === 'duration_minutes') {
        const { data: projectTasks, error: tasksError } = await supabase
            .from('tasks')
            .select('id')
            .eq('project_id', projectId)
            .not('completed_at', 'is', null);

        if (tasksError) {
            console.error("Error fetching tasks for project duration:", tasksError);
            return;
        }

        const taskIds = projectTasks.map(t => t.id);
        if (taskIds.length > 0) {
            const { data: histories, error: historyError } = await supabase
                .from('pomodoro_history')
                .select('duration_minutes')
                .in('task_id', taskIds);
            
            if (historyError) {
                console.error("Error fetching history for project duration:", historyError);
                return;
            }
            newProgressValue = histories.reduce((sum, h) => sum + (Number(h.duration_minutes) || 0), 0);
        }
    } else {
        // 'manual' completion type, no progress to calculate.
        return;
    }

    updates.progress_value = newProgressValue;

    // --- REFACTORED STATUS LOGIC ---
    let newStatus = project.status; // Default to current status

    // Check for completion first
    if (project.completion_criteria_value && newProgressValue >= project.completion_criteria_value) {
        if (project.status !== 'completed') {
            newStatus = 'completed';
            updates.completed_at = new Date().toISOString();
        }
    } else {
        // If progress is below target, it's not 'completed'.
        updates.completed_at = null;
        const today = getTodayDateString();
        
        // Check if it should be 'due' or 'active'
        if (project.deadline && project.deadline < today) {
            newStatus = 'due';
        } else {
            newStatus = 'active';
        }
    }

    // Only update the status if it has actually changed
    if (newStatus !== project.status) {
        updates.status = newStatus;
    }

    const { error: updateError } = await supabase.from('projects').update(updates).eq('id', projectId);
    if (updateError) {
        console.error("Error updating project after recalculation:", updateError);
    }
};


/**
 * Finds all time-based targets affected by a given set of tags and recalculates their progress.
 */
export const recalculateProgressForAffectedTargets = async (tags: string[], userId: string): Promise<void> => {
    if (!tags || tags.length === 0 || !userId) return;
    const lowerCaseTags = tags.map(t => t.toLowerCase());

    // 1. Find all potentially affected targets
    const { data: targets, error: targetsError } = await supabase
        .from('targets')
        .select('id, tags')
        .eq('user_id', userId)
        .eq('completion_mode', 'focus_minutes');
    
    if (targetsError || !targets) return;

    const affectedTargetIds = targets
        .filter(t => t.tags && t.tags.some(targetTag => lowerCaseTags.includes(targetTag.toLowerCase())))
        .map(t => t.id);

    if (affectedTargetIds.length === 0) return;

    // 2. Recalculate each affected target
    for (const targetId of affectedTargetIds) {
        await recalculateTargetProgress(targetId);
    }
};

/**
 * Recalculates a single time-based target's progress from scratch.
 */
export const recalculateTargetProgress = async (targetId: string): Promise<void> => {
    const { data: target, error: targetError } = await supabase
        .from('targets')
        .select('tags, user_id, target_minutes, created_at, start_date')
        .eq('id', targetId)
        .single();

    if (targetError || !target || !target.tags || target.tags.length === 0) {
        return;
    }

    // Determine the effective start date for counting progress.
    // Use the start_date if it exists, otherwise fall back to created_at.
    const progressStartDate = target.start_date || target.created_at;

    const lowerCaseTargetTags = target.tags.map(t => t.toLowerCase());

    // 1. Find all COMPLETED tasks that could contribute to this target.
    const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, tags')
        .eq('user_id', target.user_id)
        .not('tags', 'is', null)
        .not('completed_at', 'is', null); // Only fetch completed tasks

    if (tasksError || !tasks) {
        console.error("Error fetching tasks for target recalculation:", tasksError);
        return;
    }

    const contributingTaskIds = tasks
        .filter(t => t.tags && t.tags.some(taskTag => lowerCaseTargetTags.includes(taskTag.toLowerCase())))
        .map(t => t.id);

    if (contributingTaskIds.length === 0) {
        await supabase.from('targets').update({ progress_minutes: 0, completed_at: null }).eq('id', targetId);
        return;
    }

    // 2. Sum up history for those tasks, ensuring the history entry was created AFTER the target.
    const { data: histories, error: historyError } = await supabase
        .from('pomodoro_history')
        .select('duration_minutes')
        .in('task_id', contributingTaskIds)
        .gte('ended_at', progressStartDate); // Filter out history before the target existed

    if (historyError) {
        console.error("Error fetching pomodoro history for target recalculation:", historyError);
        return;
    }

    const newProgressMinutes = histories.reduce((sum, h) => sum + (Number(h.duration_minutes) || 0), 0);

    // 3. Update the target
    const updates: Partial<Target> = { progress_minutes: newProgressMinutes };
    if (target.target_minutes && newProgressMinutes >= target.target_minutes) {
        updates.completed_at = new Date().toISOString();
    } else {
        updates.completed_at = null;
    }

    const { error: updateError } = await supabase.from('targets').update(updates).eq('id', targetId);
    if (updateError) {
        console.error("Error updating target progress:", updateError);
    }
};


// --- Settings ---

export const getSettings = async (): Promise<Settings | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('settings')
        .select('focus_duration, break_duration, session_per_cycle, today_sort_by, daily_focus_target, daily_focus_targets_by_day')
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
        sessionsPerCycle: data.session_per_cycle,
        todaySortBy: data.today_sort_by || 'default',
        dailyFocusTarget: data.daily_focus_target,
        dailyFocusTargetsByDay: data.daily_focus_targets_by_day,
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
        today_sort_by: settings.todaySortBy,
        daily_focus_target: settings.dailyFocusTarget,
        daily_focus_targets_by_day: settings.dailyFocusTargetsByDay,
        updated_at: new Date().toISOString(),
    });

};


// --- Tasks ---

export const getTasks = async (): Promise<Task[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .eq('user_id', user.id)
        .eq('is_recurring', false) // Only get concrete, non-template tasks
        .order('due_date', { ascending: true })
        .order('task_order', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching tasks:", JSON.stringify(error, null, 2));
        return null;
    }
    
    return data;
};

export const addTask = async (text: string, poms: number, dueDate: string, projectId: string | null, tags: string[], priority: number | null): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: maxOrderData, error: maxOrderError } = await supabase
        .from('tasks')
        .select('task_order')
        .eq('user_id', user.id)
        .eq('due_date', dueDate)
        .not('task_order', 'is', null)
        .order('task_order', { ascending: false })
        .limit(1)
        .maybeSingle();
        
    if (maxOrderError) {
        console.error("Error fetching max task order:", maxOrderError);
    }
        
    const newOrder = (maxOrderData?.task_order ?? -1) + 1;

    const { error } = await supabase.from('tasks').insert({
        user_id: user.id, text, total_poms: poms, due_date: dueDate, project_id: projectId, tags, priority, task_order: newOrder,
    });
    
    if (error) {
        console.error("Error adding task:", error);
        return false;
    }
    
    // After adding, if it's part of a project, recalculate that project's progress
    if (projectId) {
        await recalculateProjectProgress(projectId);
    }
    
    return true;
};

export const updateTask = async (id: string, updates: Partial<Task>, options = { shouldRecalculate: true }): Promise<Task | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 1. Get original task state for comparison
    const { data: originalTask, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
    
    if (fetchError || !originalTask) {
        console.error("Error fetching original task for update:", fetchError);
        return null;
    }

    const wasCompleted = !!originalTask.completed_at;
    const newTotalPoms = updates.total_poms;

    // Scenario 1: A completed task is edited to require more poms, making it incomplete.
    const isNowIncomplete = wasCompleted && 
                            newTotalPoms !== undefined && 
                            newTotalPoms > originalTask.completed_poms;

    if (isNowIncomplete) {
        updates.completed_at = null;
    }

    // Scenario 2 (USER'S BUG): An incomplete task's total_poms is reduced, making it complete.
    const isNowComplete = !wasCompleted &&
                          newTotalPoms !== undefined &&
                          newTotalPoms > 0 && // Not a stopwatch task
                          originalTask.completed_poms >= newTotalPoms;
    
    if (isNowComplete) {
        updates.completed_at = new Date().toISOString();
    }

    // 2. Perform the update
    const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select('*, projects(name)')
        .single();

    if (updateError) {
        console.error("Error updating task:", updateError);
        return null;
    }
    
    if (!options.shouldRecalculate) {
        return updatedTask;
    }

    // 3. Recalculate progress if critical fields changed
    const originalProject = originalTask.project_id;
    const newProject = updatedTask.project_id;
    const originalTags = originalTask.tags || [];
    const newTags = updatedTask.tags || [];
    
    const projectsToRecalc = new Set<string>();
    
    const completionStatusChanged = (!!updatedTask.completed_at !== !!originalTask.completed_at);
    const projectChanged = originalProject !== newProject;

    if (projectChanged) {
        if(originalProject) projectsToRecalc.add(originalProject);
        if(newProject) projectsToRecalc.add(newProject);
    } else if (completionStatusChanged && newProject) {
        // If project didn't change but completion did, recalc the current project
        projectsToRecalc.add(newProject);
    }
    
    for (const projectId of projectsToRecalc) {
        await recalculateProjectProgress(projectId);
    }
    
    const tagsChanged = originalTags.length !== newTags.length || !originalTags.every(tag => newTags.includes(tag));
    if (tagsChanged) {
        const allAffectedTags = [...new Set([...originalTags, ...newTags])];
        await recalculateProgressForAffectedTargets(allAffectedTags, user.id);
    }

    return updatedTask;
};


export const updateTaskOrder = async (tasksToUpdate: { id: string, task_order: number }[]): Promise<Task[] | null> => {
    const updatePromises = tasksToUpdate.map(task =>
        supabase
            .from('tasks')
            .update({ task_order: task.task_order })
            .eq('id', task.id)
    );

    const results = await Promise.all(updatePromises);
    const firstError = results.find(res => res.error);
    if (firstError) {
        console.error("Error during task order update:", firstError.error);
        return null;
    }

    return getTasks();
};


export const deleteTask = async (id: string): Promise<boolean> => {
    const { data: taskToDelete, error: fetchError } = await supabase
        .from('tasks')
        .select('project_id, tags, user_id, is_recurring')
        .eq('id', id)
        .single();

    if (fetchError || !taskToDelete) {
        console.error("Error finding task to delete:", fetchError);
        return false;
    }

    // SAFETY CHECK: Do not delete recurring templates via this function
    if (taskToDelete.is_recurring) {
        console.error("Attempted to delete a recurring template via deleteTask. Aborting.");
        return false;
    }

    // Delete associated history first
    const { error: historyDeleteError } = await supabase
        .from('pomodoro_history')
        .delete()
        .eq('user_id', taskToDelete.user_id)
        .eq('task_id', id);

    if (historyDeleteError) {
        console.error("Error deleting pomodoro history for task:", historyDeleteError);
        return false;
    }

    // Then delete the task
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id);
    if (deleteError) {
        console.error("Error deleting task:", deleteError);
        return false;
    }

    // Recalculate progress for affected project and targets
    if (taskToDelete.project_id) {
        await recalculateProjectProgress(taskToDelete.project_id);
    }
    if (taskToDelete.tags && taskToDelete.tags.length > 0) {
        await recalculateProgressForAffectedTargets(taskToDelete.tags, taskToDelete.user_id);
    }

    return true;
};


export const moveTask = async (id: string, action: 'postpone' | 'duplicate'): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const tomorrow = getTodayDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
    
    const { data: maxOrderData } = await supabase
        .from('tasks')
        .select('task_order')
        .eq('user_id', user.id)
        .eq('due_date', tomorrow)
        .not('task_order', 'is', null)
        .order('task_order', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    const newOrderForTomorrow = (maxOrderData?.task_order ?? -1) + 1;

    if (action === 'postpone') {
        const { error } = await supabase
            .from('tasks')
            .update({ due_date: tomorrow, task_order: newOrderForTomorrow })
            .eq('id', id);
        if (error) {
            console.error("Error postponing task:", error);
            return false;
        }
    } else { // duplicate
        const { data: original, error: fetchError } = await supabase.from('tasks').select('*').eq('id', id).single();
        if (fetchError || !original) {
            console.error("Error fetching original task to duplicate:", fetchError);
            return false;
        }
        
        const { error: insertError } = await supabase.from('tasks').insert({
            ...original,
            id: undefined, // Let Supabase generate a new ID
            created_at: undefined,
            due_date: tomorrow,
            completed_at: null,
            completed_poms: 0,
            comments: [],
            task_order: newOrderForTomorrow,
        });
        if (insertError) {
            console.error("Error duplicating task:", insertError);
            return false;
        }
    }
    
    return true;
};

export const bringTaskForward = async (id: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const today = getTodayDateString();

    const { data: maxOrderData } = await supabase
        .from('tasks')
        .select('task_order')
        .eq('user_id', user.id)
        .eq('due_date', today)
        .not('task_order', 'is', null)
        .order('task_order', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    const newOrderForToday = (maxOrderData?.task_order ?? -1) + 1;

    const { error } = await supabase
        .from('tasks')
        .update({ due_date: today, task_order: newOrderForToday })
        .eq('id', id);

    if (error) {
        console.error("Error bringing task forward:", error);
        return false;
    }

    return true;
};


export const markTaskIncomplete = async (id: string): Promise<boolean> => {
    const { data: task, error: findError } = await supabase.from('tasks').select('due_date, user_id, project_id, tags').eq('id', id).single();
    if (findError || !task) {
        console.error("Error finding task to mark incomplete:", findError);
        return false;
    }

    const { error: updateError } = await supabase
        .from('tasks')
        .update({ completed_at: null })
        .eq('id', id);

    if (updateError) {
        console.error("Error marking task as incomplete:", updateError);
        return false;
    }

    // After un-completing, recalculate progress for associated project and targets
    if (task.project_id) {
        await recalculateProjectProgress(task.project_id);
    }
    if (task.tags && task.tags.length > 0) {
        await recalculateProgressForAffectedTargets(task.tags, task.user_id);
    }
    
    return true;
};

// --- Recurring Tasks ---

export const getRecurringTasks = async (): Promise<Task[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .eq('user_id', user.id)
        .eq('is_recurring', true)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching recurring tasks:", error);
        return null;
    }
    return data;
};

export const processRecurringTasks = async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const today = getTodayDateString();
    const dayOfWeek = new Date(`${today}T12:00:00`).getDay();

    const { data: templates, error: templateError } = await supabase
        .from('tasks')
        .select('*, projects(status)')
        .eq('user_id', user.id)
        .eq('is_recurring', true)
        .eq('is_active', true); // Only process active templates

    if (templateError) {
        console.error("Error fetching templates for processing:", templateError);
        return false;
    }
    if (!templates || templates.length === 0) {
        return false;
    }
    
    const templateIds = templates.map(t => t.id);
    const { data: existingTodayTasks, error: existingTasksError } = await supabase
        .from('tasks')
        .select('template_task_id')
        .in('template_task_id', templateIds)
        .eq('due_date', today);
    
    if (existingTasksError) {
        console.error("Error checking for existing recurring tasks for today:", existingTasksError);
        return false;
    }
    
    const existingTemplateIdsToday = new Set(existingTodayTasks?.map(t => t.template_task_id));
    const newTasksToCreate = [];

    for (const template of templates) {
        if (existingTemplateIdsToday.has(template.id)) continue;
        if (template.recurring_end_date && template.recurring_end_date < today) continue;

        const recurringDays = template.recurring_days;
        if (recurringDays && recurringDays.length > 0 && !recurringDays.includes(dayOfWeek)) {
            continue;
        }

        if (template.stop_on_project_completion && template.project_id && (template.projects?.status === 'completed' || template.projects?.status === 'due')) {
            continue;
        }

        const { id, created_at, is_recurring, recurring_days, recurring_end_date, stop_on_project_completion, is_active, projects, ...rest } = template;
        
        newTasksToCreate.push({
            ...rest,
            due_date: today,
            is_recurring: false,
            template_task_id: template.id,
            completed_at: null,
            completed_poms: 0,
            comments: [],
            task_order: null,
        });
    }

    if (newTasksToCreate.length > 0) {
        const { error: insertError } = await supabase.from('tasks').insert(newTasksToCreate);
        if (insertError) {
            console.error("Error creating daily recurring tasks:", insertError);
            return false;
        }
        return true;
    }
    
    return false;
};

export const addRecurringTask = async (taskData: Partial<Task>): Promise<Task | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            ...taskData,
            is_recurring: true,
            is_active: true, // New automations are active by default
            user_id: user.id,
        })
        .select()
        .single();
    
    if (error) {
        console.error("Error adding recurring task:", error);
        return null;
    }
    return data;
};

export const updateRecurringTask = async (id: string, updates: Partial<Task>): Promise<Task | null> => {
    const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error("Error updating recurring task:", error);
        return null;
    }
    return { id, ...updates } as Task;
};

export const deleteRecurringTask = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('is_recurring', true);
    
    if (error) {
        console.error("Error deleting recurring task:", error);
        return false;
    }
    return true;
};

// --- Projects ---

export const getProjects = async (): Promise<Project[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
    if (error) console.error("Error fetching projects:", JSON.stringify(error, null, 2));
    return error ? null : data;
}

export const addProject = async (
    name: string, 
    description: string | null,
    startDate: string | null,
    deadline: string | null, 
    criteriaType: Project['completion_criteria_type'],
    criteriaValue: number | null,
    priority: number | null,
    activeDays: number[] | null
): Promise<Project | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: newProject, error } = await supabase
        .from('projects')
        .insert({ 
            name, 
            description,
            user_id: user.id,
            start_date: startDate,
            deadline,
            completion_criteria_type: criteriaType,
            completion_criteria_value: criteriaValue,
            status: 'active',
            progress_value: 0,
            priority,
            active_days: activeDays,
            is_pinned: false,
        })
        .select()
        .single();
    if (error) {
      console.error("Error adding project:", JSON.stringify(error, null, 2));
    }
    return error ? null : newProject;
}

export const updateProject = async (id: string, updates: Partial<Project>): Promise<boolean> => {
    const { data: originalProject, error: fetchError } = await supabase
        .from('projects')
        .select('completion_criteria_type, completion_criteria_value')
        .eq('id', id)
        .single();
    
    if (fetchError) {
        console.error("Error fetching project before update:", JSON.stringify(fetchError, null, 2));
        return false;
    }

    const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id);
    
    if (error) {
      console.error("Error updating project:", JSON.stringify(error, null, 2));
      return false;
    }
    
    const criteriaChanged = (updates.completion_criteria_type && updates.completion_criteria_type !== originalProject.completion_criteria_type) ||
                            (updates.completion_criteria_value !== undefined && updates.completion_criteria_value !== originalProject.completion_criteria_value);

    if (criteriaChanged) {
        await recalculateProjectProgress(id);
    }
    
    return true;
}

export const deleteProject = async (id: string): Promise<{ success: boolean; error: string | null }> => {
    // Unlink non-recurring tasks
    const { error: unlinkError } = await supabase
        .from('tasks')
        .update({ project_id: null })
        .eq('project_id', id)
        .eq('is_recurring', false);
        
    if (unlinkError) {
        console.error("Error unlinking tasks from project:", unlinkError);
        return { success: false, error: "Failed to unlink tasks from project." };
    }

    // Unlink recurring task templates
    const { error: unlinkRecurringError } = await supabase
        .from('tasks')
        .update({ project_id: null })
        .eq('project_id', id)
        .eq('is_recurring', true);

    if (unlinkRecurringError) {
        console.error("Error unlinking recurring tasks from project:", unlinkRecurringError);
        // This is not a critical failure, so we can proceed
    }

    // Then delete the project
    const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

    if (deleteError) {
        console.error("Error deleting project:", deleteError);
        return { success: false, error: "Failed to delete project." };
    }

    return { success: true, error: null };
}

export const rescheduleProject = async (projectId: string, newDeadline: string | null): Promise<Project[] | null> => {
    const { data: originalProject, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

    if (fetchError || !originalProject) {
        console.error('Error fetching project to reschedule:', fetchError);
        return null;
    }

    const { id, created_at, ...rest } = originalProject;

    const newProjectData = {
        ...rest,
        name: `${originalProject.name} (rescheduled)`,
        status: 'active' as const,
        start_date: getTodayDateString(),
        deadline: newDeadline,
        progress_value: 0,
        completed_at: null,
        priority: originalProject.priority,
    };

    const { error: insertError } = await supabase.from('projects').insert(newProjectData);

    if (insertError) {
        console.error('Error inserting rescheduled project:', insertError);
        return null;
    }

    return getProjects();
};


export const checkAndUpdateDueProjects = async (): Promise<Project[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const today = getTodayDateString();

    const { data: dueProjects, error } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .not('deadline', 'is', null)
        .lt('deadline', today);

    if (error) {
        console.error("Error fetching due projects:", JSON.stringify(error, null, 2));
        return null;
    }
    
    if (!dueProjects || dueProjects.length === 0) {
        return null;
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

    return getProjects();
};

// --- Project Updates ---

export const getProjectUpdates = async (projectId: string): Promise<ProjectUpdate[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('project_updates')
        .select('*, tasks(text)')
        .eq('project_id', projectId)
        .order('update_date', { ascending: false });
    if (error) {
        console.error("Error fetching project updates:", JSON.stringify(error, null, 2));
        return null;
    }
    return data;
}

export const addProjectUpdate = async (projectId: string, updateDate: string, description: string, taskId: string | null): Promise<ProjectUpdate[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { error } = await supabase
        .from('project_updates')
        .insert({
            project_id: projectId,
            user_id: user.id,
            update_date: updateDate,
            description: description,
            task_id: taskId
        });
    if (error) {
        console.error("Error adding project update:", JSON.stringify(error, null, 2));
        return null;
    }
    return getProjectUpdates(projectId);
}

export const deleteProjectUpdate = async (updateId: string, projectId: string): Promise<ProjectUpdate[] | null> => {
    const { error } = await supabase
        .from('project_updates')
        .delete()
        .eq('id', updateId);
    if (error) {
        console.error("Error deleting project update:", JSON.stringify(error, null, 2));
        return null;
    }
    return getProjectUpdates(projectId);
}


// --- Goals & Targets ---

export const getGoals = async (): Promise<Goal[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', user.id);
    return error ? null : data;
}

export const addGoal = async (text: string): Promise<Goal[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { error } = await supabase.from('goals').insert({ text, user_id: user.id });
    return error ? null : await getGoals();
}

export const updateGoal = async (id: string, updates: Partial<Goal>): Promise<Goal[] | null> => {
    const { error } = await supabase.from('goals').update(updates).eq('id', id);
    if (error) console.error("Error updating goal:", JSON.stringify(error, null, 2));
    return error ? null : await getGoals();
}

export const setGoalCompletion = async (id: string, completed_at: string | null): Promise<Goal[] | null> => {
    const { error } = await supabase.from('goals').update({ completed_at }).eq('id', id);
    if (error) {
        console.error("Error setting goal completion:", JSON.stringify(error, null, 2));
        return null;
    }
    return getGoals();
}

export const deleteGoal = async (id: string): Promise<Goal[] | null> => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    return error ? null : await getGoals();
}

export const getTargets = async (): Promise<Target[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from('targets').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    return error ? null : data;
}

export const addTarget = async (
    text: string, 
    deadline: string, 
    priority: number | null, 
    startDate: string | null, 
    completionMode: Target['completion_mode'], 
    tags: string[] | null, 
    targetMinutes: number | null
): Promise<Target[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { error } = await supabase.from('targets').insert({ 
        text, 
        deadline, 
        user_id: user.id, 
        priority,
        start_date: startDate,
        completion_mode: completionMode,
        tags: tags,
        target_minutes: targetMinutes,
        progress_minutes: 0,
        is_pinned: false,
    });
    if (error) {
        console.error("Error adding target:", JSON.stringify(error, null, 2));
    }
    return error ? null : await getTargets();
}

export const updateTarget = async (id: string, updates: Partial<Target>): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: originalTarget, error: fetchError } = await supabase
        .from('targets')
        .select('tags')
        .eq('id', id)
        .single();
    
    if (fetchError) return false;
    
    const { error } = await supabase.from('targets').update(updates).eq('id', id);
    if (error) {
        console.error("Error updating target:", error);
        return false;
    }

    const originalTags = originalTarget?.tags || [];
    const newTags = updates.tags || [];
    const allAffectedTags = [...new Set([...originalTags, ...newTags])];
    
    if (allAffectedTags.length > 0) {
        await recalculateProgressForAffectedTargets(allAffectedTags, user.id);
    }

    return true;
}

export const deleteTarget = async (id: string): Promise<Target[] | null> => {
    const { error } = await supabase.from('targets').delete().eq('id', id);
    return error ? null : await getTargets();
}

export const rescheduleTarget = async (targetId: string, newDeadline: string): Promise<Target[] | null> => {
    const { data: originalTarget, error: fetchError } = await supabase
        .from('targets')
        .select('*')
        .eq('id', targetId)
        .single();
    
    if (fetchError || !originalTarget) {
        console.error('Error fetching target to reschedule:', fetchError);
        return null;
    }

    const { id, created_at, status, ...rest } = originalTarget;

    const newTargetData = {
        ...rest,
        text: `${originalTarget.text} (rescheduled)`,
        deadline: newDeadline,
        completed_at: null,
        priority: originalTarget.priority,
    };

    const { error: insertError } = await supabase.from('targets').insert(newTargetData);

    if (insertError) {
        console.error('Error inserting rescheduled target:', insertError);
        return null;
    }

    return getTargets();
};

// --- Commitments ---

export const getCommitments = async (): Promise<Commitment[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('commitments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    if (error) {
        console.error("Error fetching commitments:", JSON.stringify(error, null, 2));
        return null;
    }
    return data;
}

export const addCommitment = async (text: string, dueDate: string | null): Promise<Commitment[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { error } = await supabase.from('commitments').insert({ text, user_id: user.id, due_date: dueDate });
    if (error) {
        console.error("Error adding commitment:", JSON.stringify(error, null, 2));
        return null;
    }
    return getCommitments();
}

export const updateCommitment = async (id: string, updates: { text: string; dueDate: string | null; }): Promise<Commitment[] | null> => {
    const { error } = await supabase.from('commitments').update({ text: updates.text, due_date: updates.dueDate }).eq('id', id);
    if (error) {
        console.error("Error updating commitment:", JSON.stringify(error, null, 2));
        return null;
    }
    return getCommitments();
}

export const setCommitmentCompletion = async (id: string, isComplete: boolean): Promise<Commitment[] | null> => {
    const updates = isComplete
        ? { completed_at: new Date().toISOString(), status: 'completed' as const, broken_at: null }
        : { completed_at: null, status: 'active' as const, broken_at: null };

    const { error } = await supabase.from('commitments').update(updates).eq('id', id);
    if (error) {
        console.error("Error setting commitment completion:", JSON.stringify(error, null, 2));
        return null;
    }
    return getCommitments();
};

export const markCommitmentBroken = async (id: string): Promise<Commitment[] | null> => {
    const updates = {
        status: 'broken' as const,
        broken_at: new Date().toISOString(),
        completed_at: null,
    };
    const { error } = await supabase.from('commitments').update(updates).eq('id', id);
    if (error) {
        console.error("Error marking commitment as broken:", JSON.stringify(error, null, 2));
        return null;
    }
    return getCommitments();
};


export const deleteCommitment = async (id: string): Promise<Commitment[] | null> => {
    const { error } = await supabase.from('commitments').delete().eq('id', id);
    if (error) {
        console.error("Error deleting commitment:", JSON.stringify(error, null, 2));
        return null;
    }
    return getCommitments();
}

export const rescheduleCommitment = async (commitmentId: string, newDueDate: string | null): Promise<Commitment[] | null> => {
    const { data: originalCommitment, error: fetchError } = await supabase
        .from('commitments')
        .select('*')
        .eq('id', commitmentId)
        .single();

    if (fetchError || !originalCommitment) {
        console.error('Error fetching commitment to reschedule:', fetchError);
        return null;
    }

    const { id, created_at, ...rest } = originalCommitment;

    const newCommitmentData = {
        ...rest,
        text: `${originalCommitment.text} (rescheduled)`,
        status: 'active' as const,
        due_date: newDueDate,
        completed_at: null,
        broken_at: null,
    };

    const { error: insertError } = await supabase.from('commitments').insert(newCommitmentData);

    if (insertError) {
        console.error('Error inserting rescheduled commitment:', insertError);
        return null;
    }

    return getCommitments();
};

export const checkAndUpdatePastDueCommitments = async (): Promise<Commitment[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const today = getTodayDateString();

    const { data: pastDueCommitments, error: findError } = await supabase
        .from('commitments')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .not('due_date', 'is', null)
        .lt('due_date', today);
    
    if (findError) {
        console.error("Error finding past due commitments:", JSON.stringify(findError, null, 2));
        return null;
    }

    if (!pastDueCommitments || pastDueCommitments.length === 0) {
        return null;
    }

    const idsToUpdate = pastDueCommitments.map(c => c.id);

    const { error: updateError } = await supabase
        .from('commitments')
        .update({
            status: 'broken',
            broken_at: new Date().toISOString(),
        })
        .in('id', idsToUpdate);
    
    if (updateError) {
        console.error("Error updating past due commitments:", JSON.stringify(updateError, null, 2));
        return null;
    }

    return getCommitments();
};



// --- Daily Logs ---

export const upsertDailyLog = async (log: DbDailyLog): Promise<{ error: any }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error("User not found") };

    const logData = {
        user_id: user.id,
        date: log.date,
        completed_sessions: log.completed_sessions,
        total_focus_minutes: log.total_focus_minutes,
        // Only include these if they are defined to avoid overwriting with null unnecessarily
        ...(log.challenges !== undefined && { challenges: log.challenges }),
        ...(log.improvements !== undefined && { improvements: log.improvements }),
    };

    const { data: existingLog, error: selectError } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', log.date)
        .maybeSingle();

    if (selectError) {
        console.error("Error checking for existing daily log:", selectError);
        return { error: selectError };
    }
    
    if (existingLog) {
        const { error: updateError } = await supabase
            .from('daily_logs')
            .update(logData)
            .eq('id', existingLog.id);
        
        if (updateError) console.error("Error updating daily log:", updateError);
        return { error: updateError };
    } else {
        const { error: insertError } = await supabase
            .from('daily_logs')
            .insert(logData);
            
        if (insertError) console.error("Error inserting daily log:", insertError);
        return { error: insertError };
    }
};

export const saveDailyReflection = async (date: string, challenges: string, improvements: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: existingLog } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle();

    if (existingLog) {
        const { error } = await supabase
            .from('daily_logs')
            .update({ challenges, improvements })
            .eq('id', existingLog.id);
        return !error;
    } else {
        const { error } = await supabase
            .from('daily_logs')
            .insert({ 
                user_id: user.id, 
                date, 
                challenges, 
                improvements, 
                total_focus_minutes: 0, 
                completed_sessions: 0 
            });
        return !error;
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
        console.error("Error fetching historical logs:", JSON.stringify(error, null, 2));
        return [];
    }
    return data || [];
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
        console.error("Error fetching historical tasks:", JSON.stringify(error, null, 2));
        return [];
    }
    return data || [];
};

export const getAllTasksForStats = async (): Promise<Task[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);
    
    if (error) {
        console.error("Error fetching all tasks for stats:", JSON.stringify(error, null, 2));
        return [];
    }
    return data || [];
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
        console.error("Error fetching historical projects:", JSON.stringify(error, null, 2));
        return [];
    }
    return data || [];
};

export const getHistoricalTargets = async (startDate: string, endDate:string): Promise<Target[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('targets')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_at', `${startDate}T00:00:00Z`)
        .lte('completed_at', `${endDate}T23:59:59Z`);

    if (error) {
        console.error("Error fetching historical targets:", JSON.stringify(error, null, 2));
        return [];
    }
    return data || [];
};

// --- Spotlight Pinning ---
export const setPinnedItem = async (itemId: string, itemType: 'project' | 'target'): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Unpin all other items first.
    const { error: unpinProjectsError } = await supabase.from('projects').update({ is_pinned: false }).eq('user_id', user.id).eq('is_pinned', true);
    const { error: unpinTargetsError } = await supabase.from('targets').update({ is_pinned: false }).eq('user_id', user.id).eq('is_pinned', true);

    if (unpinProjectsError || unpinTargetsError) {
        console.error("Error clearing existing pins:", JSON.stringify(unpinProjectsError || unpinTargetsError, null, 2));
        return false;
    }

    // Pin the new item
    const tableName = itemType === 'project' ? 'projects' : 'targets';
    const { error: pinError } = await supabase.from(tableName).update({ is_pinned: true }).eq('id', itemId);

    if (pinError) {
        console.error(`Error pinning ${itemType}:`, JSON.stringify(pinError, null, 2));
        return false;
    }

    return true;
};

export const clearAllPins = async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    
    const { error: unpinProjectsError } = await supabase.from('projects').update({ is_pinned: false }).eq('user_id', user.id).eq('is_pinned', true);
    const { error: unpinTargetsError } = await supabase.from('targets').update({ is_pinned: false }).eq('user_id', user.id).eq('is_pinned', true);

    if (unpinProjectsError || unpinTargetsError) {
        console.error("Error clearing all pins:", JSON.stringify(unpinProjectsError || unpinTargetsError, null, 2));
        return false;
    }
    
    return true;
};


// --- Pomodoro History ---

export const logPomodoroCompletion = async (
  taskToComplete: Task,
  comment: string,
  durationMinutes: number,
  focusLevel: FocusLevel | null
): Promise<Task | null> => {
  // This function should only be called for countdown-style pomodoros.
  if (taskToComplete.total_poms < 0) {
      console.warn("logPomodoroCompletion called for a stopwatch task. This is unexpected.");
      return null;
  }
  
  // Prepare the optimistic update for the task.
  const originalPoms = taskToComplete.completed_poms;
  const originalComments = taskToComplete.comments;
  
  const updatedFields: Partial<Task> = {
    completed_poms: originalPoms + 1,
    comments: comment ? [...(taskToComplete.comments || []), comment] : taskToComplete.comments,
  };

  let taskIsNowComplete = false;
  if (updatedFields.completed_poms >= taskToComplete.total_poms) {
    updatedFields.completed_at = new Date().toISOString();
    taskIsNowComplete = true;
  }

  // 1. Attempt to update the task first.
  const { data: updatedTask, error: taskUpdateError } = await supabase
    .from('tasks')
    .update(updatedFields)
    .eq('id', taskToComplete.id)
    .select('*')
    .single();
  
  if (taskUpdateError || !updatedTask) {
    console.error("Initial task update failed during pomodoro completion:", taskUpdateError);
    return null;
  }

  // 2. Attempt to add the history record.
  const { error: historyError } = await addPomodoroHistory(updatedTask.id, durationMinutes, focusLevel);

  if (historyError) {
    console.error("Pomodoro history insertion failed. Attempting to roll back task update.", historyError);
    // 3. ROLLBACK! History insertion failed, so revert the task update.
    const { error: rollbackError } = await supabase
      .from('tasks')
      .update({ 
        completed_poms: originalPoms, 
        completed_at: null, // Always revert completion status
        comments: originalComments,
      })
      .eq('id', taskToComplete.id);
    
    if (rollbackError) {
      console.error("CRITICAL: FAILED TO ROLL BACK TASK UPDATE. Database is now in an inconsistent state.", rollbackError);
    }
    return null; 
  }
  
  // 4. If both succeeded, handle post-completion logic for projects.
  if (taskIsNowComplete && updatedTask.project_id) {
      await addProjectUpdate(
          updatedTask.project_id,
          getTodayDateString(),
          `Completed task: "${updatedTask.text}"`,
          updatedTask.id
      );
      await recalculateProjectProgress(updatedTask.project_id);
  }
  
  return updatedTask;
};

export const addPomodoroHistory = async (taskId: string | null, duration: number, difficulty: FocusLevel | null): Promise<{ error: any }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: new Error("User not found") };

    const endedAtDate = new Date();
    const ended_at = endedAtDate.toISOString();
    const date = getTodayDateString(endedAtDate); // Use local date

    const { error } = await supabase.from('pomodoro_history').insert([{
        user_id: user.id,
        task_id: taskId,
        duration_minutes: duration,
        difficulty: difficulty,
        ended_at: ended_at,
    }]);

    if (error) {
        console.error("Error adding pomodoro history:", JSON.stringify(error, null, 2));
        return { error };
    }
    
    // Authoritatively update daily_logs based on user's local day
    const startOfDayLocal = new Date(`${date}T00:00:00`);
    const endOfDayLocal = new Date(`${date}T23:59:59.999`);

    const { data: todaysHistory, error: historyError } = await supabase
        .from('pomodoro_history')
        .select('duration_minutes')
        .eq('user_id', user.id)
        .gte('ended_at', startOfDayLocal.toISOString())
        .lte('ended_at', endOfDayLocal.toISOString());

    if (historyError) {
        console.error("Error fetching today's history for log update:", historyError);
        return { error: historyError };
    }

    const total_focus_minutes = todaysHistory.reduce((sum, h) => sum + (Number(h.duration_minutes) || 0), 0);
    const completed_sessions = todaysHistory.length;

    const { error: upsertError } = await upsertDailyLog({
        date,
        completed_sessions,
        total_focus_minutes
    });

    return { error: upsertError };
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
    return data || [];
};

export const getPomodoroHistoryForTasks = async (taskIds: string[]): Promise<PomodoroHistory[]> => {
    if (!taskIds || taskIds.length === 0) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('pomodoro_history')
        .select('*')
        .in('task_id', taskIds);

    if (error) {
        console.error("Error fetching pomodoro history for tasks:", JSON.stringify(error, null, 2));
        return [];
    }
    return data || [];
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
    return data || [];
};

export const deletePomodoroHistoryById = async (historyId: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Get task_id before deleting to trigger recalculation later.
    const { data: historyItem, error: fetchError } = await supabase
        .from('pomodoro_history')
        .select('task_id')
        .eq('id', historyId)
        .eq('user_id', user.id)
        .single();
    
    if (fetchError) {
        console.error("Error finding pomodoro history item to delete:", fetchError);
        // If it doesn't exist, it might have been deleted already. Let's consider it a "success" from the user's POV.
        return true; 
    }
    
    if (!historyItem) {
        // Not found, maybe already deleted.
        return true;
    }

    const { error: deleteError } = await supabase
        .from('pomodoro_history')
        .delete()
        .eq('id', historyId);

    if (deleteError) {
        console.error("Error deleting pomodoro history:", deleteError);
        return false;
    }
    
    // If the deleted history was associated with a task, we need to recalculate progress.
    if (historyItem.task_id) {
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('project_id, tags')
            .eq('id', historyItem.task_id)
            .single();

        if (task) {
            if (task.project_id) {
                await recalculateProjectProgress(task.project_id);
            }
            if (task.tags && task.tags.length > 0) {
                await recalculateProgressForAffectedTargets(task.tags, user.id);
            }
        }
    }

    return true;
};


export const getConsistencyLogs = async (days?: number, year?: number): Promise<DbDailyLog[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let startDateString: string;
    let endDateString: string;

    if (year) {
        startDateString = `${year}-01-01`;
        endDateString = `${year}-12-31`;
    } else {
        const numDays = days || 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - numDays);
        startDateString = getTodayDateString(startDate);
        endDateString = getTodayDateString();
    }

    const { data, error } = await supabase
        .from('daily_logs')
        .select('date, completed_sessions, total_focus_minutes')
        .eq('user_id', user.id)
        .gte('date', startDateString)
        .lte('date', endDateString);

    if (error) {
        console.error("Error fetching consistency logs:", JSON.stringify(error, null, 2));
        return [];
    }
    
    return data || [];
};

// --- AI Memories ---

export const getAiMemories = async (): Promise<AiMemory[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('ai_memories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching AI memories:", JSON.stringify(error, null, 2));
        return [];
    }
    return data || [];
};

export const addAiMemory = async (
    type: AiMemory['type'], 
    content: string, 
    tags: string[] | null, 
    source_task_id: string | null = null
): Promise<AiMemory | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('ai_memories')
        .insert({
            user_id: user.id,
            type,
            content,
            tags,
            source_task_id,
        })
        .select()
        .single();
    
    if (error) {
        console.error(`Error adding AI memory:`, JSON.stringify(error, null, 2));
        return null;
    }
    return data;
};

export const updateAiMemory = async (id: string, updates: Partial<AiMemory>): Promise<AiMemory | null> => {
    const { data, error } = await supabase
        .from('ai_memories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error("Error updating AI memory:", JSON.stringify(error, null, 2));
        return null;
    }
    return data;
};

export const deleteAiMemory = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('ai_memories')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Error deleting AI memory:", JSON.stringify(error, null, 2));
        return false;
    }
    return true;
};

// --- Notifications ---

export const getNotifications = async (): Promise<AppNotification[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('notifications')
        .select('id, created_at, message, type, read, unique_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching notifications:", JSON.stringify(error, null, 2));
        return null;
    }
    return data;
};

export type NewNotification = {
    message: string;
    type: AppNotification['type'];
    unique_id: string;
};

export const addNotifications = async (notifications: NewNotification[]): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || notifications.length === 0) return;

    const notificationsToInsert = notifications.map(n => ({
        ...n,
        user_id: user.id,
    }));
    const { error } = await supabase
        .from('notifications')
        .upsert(notificationsToInsert, { onConflict: 'user_id, unique_id', ignoreDuplicates: true });

    if (error) {
        console.error("Error adding notifications:", JSON.stringify(error, null, 2));
    }
};

export const markNotificationRead = async (id: string): Promise<AppNotification[] | null> => {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

    if (error) {
        console.error("Error marking notification as read:", JSON.stringify(error, null, 2));
        return null;
    }
    return getNotifications();
};

export const markAllNotificationsRead = async (): Promise<AppNotification[] | null> => {
     const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

    if (error) {
        console.error("Error marking all notifications as read:", JSON.stringify(error, null, 2));
        return null;
    }
    return getNotifications();
};

export const clearAllNotifications = async (): Promise<AppNotification[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

    if (error) {
        console.error("Error clearing all notifications:", JSON.stringify(error, null, 2));
        return null;
    }
    return [];
};