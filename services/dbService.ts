import { supabase } from './supabaseClient';
import { Settings, Task, DbDailyLog, Project, Goal, Target, PomodoroHistory, Commitment, ProjectUpdate, AiMemory } from '../types';
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
        .order('task_order', { ascending: true, nullsFirst: true }) // Then by custom order
        .order('created_at', { ascending: true }); // Fallback sort

    if (error) {
        console.error("Error fetching tasks:", JSON.stringify(error, null, 2));
        return null;
    }
    
    return data;
};

export const addTask = async (text: string, poms: number, dueDate: string, projectId: string | null, tags: string[], priority: number | null): Promise<Task[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return null;
    }

    const { data: maxOrderData, error: maxOrderError } = await supabase
        .from('tasks')
        .select('task_order')
        .eq('user_id', user.id)
        .eq('due_date', dueDate)
        .not('task_order', 'is', null) // Ensure we only get tasks with an order
        .order('task_order', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle to prevent error on no rows
        
    if (maxOrderError) {
        console.error("Error fetching max task order:", JSON.stringify(maxOrderError, null, 2));
        // Do not block, but log the error. The fallback logic is safe.
    }
        
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
        priority,
    };
    
    // Pass an array to insert, and remove the unnecessary .select()
    const { error } = await supabase
        .from('tasks')
        .insert([taskToInsert]);
    
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


export const deleteTask = async (id: string): Promise<{ tasks: Task[] | null; projects: Project[] | null }> => {
    // 1. Fetch the task to be deleted to get its details before it's gone.
    const { data: taskToDelete, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
    
    if (fetchError || !taskToDelete) {
        console.error("Error finding task to delete:", JSON.stringify(fetchError, null, 2));
        return { tasks: null, projects: null };
    }

    // 2. If the task contributed to a project's progress, roll it back.
    if (taskToDelete.project_id) {
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', taskToDelete.project_id)
            .single();

        if (project && !projectError) {
            let progressToDecrement = 0;
            let shouldUpdateProject = false;
            
            // For 'task_count' projects, if the task was completed, we decrement by 1.
            if (project.completion_criteria_type === 'task_count' && taskToDelete.completed_at) {
                progressToDecrement = 1;
                shouldUpdateProject = true;
            } 
            // For 'duration_minutes' projects, we sum up all pomodoros for that task.
            else if (project.completion_criteria_type === 'duration_minutes') {
                const { data: history, error: historyError } = await supabase
                    .from('pomodoro_history')
                    .select('duration_minutes')
                    .eq('task_id', id);
                
                if (history && !historyError) {
                    progressToDecrement = history.reduce((sum, item) => sum + (Number(item.duration_minutes) || 0), 0);
                    if (progressToDecrement > 0) {
                        shouldUpdateProject = true;
                    }
                }
            }
            
            if (shouldUpdateProject) {
                const newProgress = Math.max(0, project.progress_value - progressToDecrement);
                
                const updates: Partial<Project> = { progress_value: newProgress };
                
                // If project was previously completed, check if this change makes it incomplete again.
                if (project.status === 'completed' && project.completion_criteria_value && newProgress < project.completion_criteria_value) {
                    updates.status = 'active';
                    updates.completed_at = null; // Reset completion date
                }

                const { error: updateProjectError } = await supabase
                    .from('projects')
                    .update(updates)
                    .eq('id', project.id);
                
                if (updateProjectError) {
                    console.error("Error rolling back project progress:", JSON.stringify(updateProjectError, null, 2));
                    // Don't abort, just log. The task deletion is the primary goal.
                }
            }
        }
    }
    
    // 3. Delete associated pomodoro history. This is critical for accurate time tracking.
    const { error: historyError } = await supabase.from('pomodoro_history').delete().eq('task_id', id);
    if (historyError) {
        console.error("Error deleting pomodoro history for task:", JSON.stringify(historyError, null, 2));
    }

    // 4. Delete the task itself.
    const { error: taskError } = await supabase.from('tasks').delete().eq('id', id);
    if (taskError) {
        console.error("Error deleting task:", JSON.stringify(taskError, null, 2));
        const currentProjects = await getProjects();
        // Return projects even if task deletion fails, but null for tasks to signal failure.
        return { tasks: null, projects: currentProjects };
    }

    // 5. On success, return fresh lists of tasks and projects to ensure UI consistency.
    const [newTasks, newProjects] = await Promise.all([getTasks(), getProjects()]);
    return { tasks: newTasks, projects: newProjects };
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
            priority: original.priority,
        });
         if (insertError) console.error("Error duplicating task:", JSON.stringify(insertError, null, 2));
    }
    
    return getTasks();
};

export const bringTaskForward = async (id: string): Promise<Task[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const today = getTodayDateString();

    const { data: maxOrderData } = await supabase
        .from('tasks')
        .select('task_order')
        .eq('user_id', user.id)
        .eq('due_date', today)
        .not('task_order', 'is', null)
        .order('task_order', { ascending: false })
        .limit(1)
        .single();
    
    const newOrderForToday = (maxOrderData?.task_order ?? -1) + 1;

    const { error } = await supabase
        .from('tasks')
        .update({ due_date: today, task_order: newOrderForToday })
        .eq('id', id);

    if (error) {
        console.error("Error bringing task forward:", JSON.stringify(error, null, 2));
        return null;
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
        .order('created_at', { ascending: true });
    if (error) console.error("Error fetching projects:", JSON.stringify(error, null, 2));
    return error ? null : data;
}

export const addProject = async (
    name: string, 
    description: string | null,
    deadline: string | null, 
    criteriaType: Project['completion_criteria_type'],
    criteriaValue: number | null,
    priority: number | null
): Promise<Project | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: newProject, error } = await supabase
        .from('projects')
        .insert({ 
            name, 
            description,
            user_id: user.id, 
            deadline,
            completion_criteria_type: criteriaType,
            completion_criteria_value: criteriaValue,
            status: 'active',
            progress_value: 0,
            priority,
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

export const addTarget = async (text: string, deadline: string, priority: number | null): Promise<Target[] | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { error } = await supabase.from('targets').insert({ text, deadline, user_id: user.id, priority });
    return error ? null : await getTargets();
}

export const updateTarget = async (id: string, updates: Partial<Target>): Promise<Target[] | null> => {
    // The logic to set 'status' has been removed as the 'status' column does not exist in the DB.
    // The status is now derived on the client-side.
    const { error } = await supabase.from('targets').update(updates).eq('id', id);
    if (error) console.error("Error updating target:", JSON.stringify(error, null, 2));
    return error ? null : await getTargets();
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

export const checkAndUpdatePastDueTargets = async (): Promise<Target[] | null> => {
    // This function was causing an error because the 'targets.status' column does not exist.
    // The logic to determine a target's status is now handled on the client-side
    // by deriving it from 'completed_at' and 'deadline' fields.
    // This function now returns null to prevent any database operations and errors.
    return null;
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

    // Find active commitments with a due date that has passed.
    const { data: pastDueCommitments, error: findError } = await supabase
        .from('commitments')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .not('due_date', 'is', null)
        .lt('due_date', today);
    
    if (findError) {
        console.error("Error finding past due commitments:", JSON.stringify(findError, null, 2));
        return null; // Return null on error, don't proceed.
    }

    if (!pastDueCommitments || pastDueCommitments.length === 0) {
        return null; // No commitments to update, return null to signal no state change needed.
    }

    const idsToUpdate = pastDueCommitments.map(c => c.id);

    const { error: updateError } = await supabase
        .from('commitments')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
        })
        .in('id', idsToUpdate);
    
    if (updateError) {
        console.error("Error updating past due commitments:", JSON.stringify(updateError, null, 2));
        return null;
    }

    // On success, return the fresh list of all commitments.
    return getCommitments();
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

export const getConsistencyLogs = async (days = 180): Promise<DbDailyLog[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateString = getTodayDateString(startDate);
    const todayString = getTodayDateString();

    // Fetch all tasks due within the date range to get total and completed counts.
    const { data, error } = await supabase
        .from('tasks')
        .select('due_date, completed_at')
        .eq('user_id', user.id)
        .gte('due_date', startDateString)
        .lte('due_date', todayString);

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