import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Goal, Target, Project, Task, PomodoroHistory, Commitment, ProjectUpdate } from '../types';
import Panel from '../components/common/Panel';
import { TrashIcon, EditIcon, StarIcon, LockIcon, CheckIcon } from '../components/common/Icons';
import * as dbService from '../services/dbService';
import Spinner from '../components/common/Spinner';
import { getTodayDateString, getMonthStartDateString } from '../utils/date';
import PrioritySelector from '../components/common/PrioritySelector';
import ExplanationTooltip from '../components/common/ExplanationTooltip';

const getDaysAgo = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
};

const isOlderThanOrEqualToTwoDays = (dateString: string): boolean => {
    if (!dateString) return false;
    const itemDate = new Date(dateString);
    const today = new Date();

    itemDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - itemDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 2;
};


const ProjectTimeAnalysisDashboard: React.FC<{
    allProjects: Project[];
    allTasks: Task[];
    allHistory: PomodoroHistory[];
}> = ({ allProjects, allTasks, allHistory }) => {
    const [dateRange, setDateRange] = useState({ start: getMonthStartDateString(), end: getTodayDateString() });
    const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'due'>('active');

    const projectTimeData = useMemo(() => {
        const isAllTime = !dateRange.start || !dateRange.end;

        const filteredHistory = isAllTime 
            ? allHistory 
            : allHistory.filter(h => {
                const hDate = h.ended_at.split('T')[0];
                return hDate >= dateRange.start && hDate <= dateRange.end;
            });

        const taskProjectMap = new Map<string, string>();
        allTasks.forEach(task => {
            if (task.project_id) {
                taskProjectMap.set(task.id, task.project_id);
            }
        });

        const timePerProject = new Map<string, number>();
        filteredHistory.forEach(h => {
            if (h.task_id) {
                const projectId = taskProjectMap.get(h.task_id);
                if (projectId) {
                    timePerProject.set(projectId, (timePerProject.get(projectId) || 0) + (Number(h.duration_minutes) || 0));
                }
            }
        });

        const tasksPerProject = new Map<string, number>();
        allTasks.forEach(task => {
            if (task.project_id) {
                tasksPerProject.set(task.project_id, (tasksPerProject.get(task.project_id) || 0) + 1);
            }
        });

        return allProjects.map(p => ({
            ...p,
            timeSpent: timePerProject.get(p.id) || 0,
            taskCount: tasksPerProject.get(p.id) || 0,
            targetTime: p.completion_criteria_type === 'duration_minutes' ? p.completion_criteria_value : null
        }));
    }, [allProjects, allTasks, allHistory, dateRange]);
    
    const filteredProjectData = useMemo(() => {
        return projectTimeData.filter(p => p.status === statusFilter);
    }, [projectTimeData, statusFilter]);

    const handleSetRangePreset = (preset: 'week' | 'month' | 'all') => {
        if (preset === 'all') {
            setDateRange({ start: '', end: '' });
        } else if (preset === 'week') {
            setDateRange({ start: getDaysAgo(6), end: getTodayDateString() });
        } else if (preset === 'month') {
            setDateRange({ start: getMonthStartDateString(), end: getTodayDateString() });
        }
    };
    
    const today = getTodayDateString();
    const isAllTime = !dateRange.start && !dateRange.end;
    const isThisWeek = dateRange.start === getDaysAgo(6) && dateRange.end === today;
    const isThisMonth = dateRange.start === getMonthStartDateString() && dateRange.end === today;


    const ProjectTimeBar: React.FC<{project: (typeof projectTimeData)[0]}> = ({ project }) => {
        const progress = (project.targetTime && project.targetTime > 0)
            ? Math.min(100, (project.timeSpent / project.targetTime) * 100)
            : -1;
        
        return (
             <div className="bg-black/20 p-3 rounded-lg">
                <div className="flex justify-between items-start text-sm mb-2">
                    <span className="font-bold text-white truncate pr-2">{project.name}</span>
                    <div className="flex flex-col items-end gap-1 text-white/80 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                            <span><span className="font-semibold text-white">{project.taskCount}</span> tasks</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span><span className="font-semibold text-white">{project.timeSpent}</span> min</span>
                        </div>
                    </div>
                </div>
                {progress !== -1 && (
                    <div>
                        <div className="flex justify-between items-center text-xs mb-1 text-white/70">
                            <span>Time Goal Progress</span>
                            <span>{project.timeSpent}m / {project.targetTime}m</span>
                        </div>
                        <div className="w-full bg-black/30 rounded-full h-2.5 shadow-inner">
                            <div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2.5 rounded-full" style={{width: `${progress}%`}}></div>
                        </div>
                    </div>
                )}
            </div>
        )
    };

    return (
        <Panel title="📊 Project Time Analysis">
            <div className="mb-4 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                     <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                    <button onClick={() => handleSetRangePreset('week')} className={`p-2 rounded-lg transition font-semibold ${isThisWeek ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'}`}>This Week</button>
                    <button onClick={() => handleSetRangePreset('month')} className={`p-2 rounded-lg transition font-semibold ${isThisMonth ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'}`}>This Month</button>
                    <button className={`p-2 rounded-lg transition font-semibold bg-white/10 hover:bg-white/20 text-white/80`}>Date Range</button>
                    <button onClick={() => handleSetRangePreset('all')} className={`p-2 rounded-lg transition font-semibold ${isAllTime ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'}`}>All Time</button>
                </div>
            </div>
             <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full">
                {(['active', 'completed', 'due'] as const).map(status => (
                    <button key={status} onClick={() => setStatusFilter(status)} className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${statusFilter === status ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {filteredProjectData.length > 0 ? (
                    filteredProjectData.map(p => <ProjectTimeBar key={p.id} project={p} />)
                ) : (
                    <p className="text-center text-sm text-white/60 py-4">No projects with tracked time found for this status and date range.</p>
                )}
            </div>
        </Panel>
    );
};

const ActivityLog: React.FC<{ projectId: string, tasks: Task[] }> = ({ projectId, tasks }) => {
    const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
    const [taskFocusTimes, setTaskFocusTimes] = useState<Map<string, number>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [newUpdateDesc, setNewUpdateDesc] = useState('');
    const [newUpdateDate, setNewUpdateDate] = useState(getTodayDateString());
    const [linkedTaskId, setLinkedTaskId] = useState<string>('none');
    
    const fetchUpdates = useCallback(async () => {
        setIsLoading(true);
        const fetchedUpdates = await dbService.getProjectUpdates(projectId);
        
        if (fetchedUpdates && fetchedUpdates.length > 0) {
            const taskIds = fetchedUpdates
                .map(u => u.task_id)
                .filter((id): id is string => id !== null);
            
            const newFocusTimes = new Map<string, number>();
            if (taskIds.length > 0) {
                const historyForTasks = await dbService.getPomodoroHistoryForTasks(taskIds);
                historyForTasks.forEach(h => {
                    if (h.task_id) {
                        const current = newFocusTimes.get(h.task_id) || 0;
                        newFocusTimes.set(h.task_id, current + (Number(h.duration_minutes) || 0));
                    }
                });
            }
            setTaskFocusTimes(newFocusTimes);
            setUpdates(fetchedUpdates);
        } else {
            setTaskFocusTimes(new Map());
            setUpdates([]);
        }
        
        setIsLoading(false);
    }, [projectId]);

    useEffect(() => {
        fetchUpdates();
    }, [fetchUpdates]);

    const handleAddUpdate = async () => {
        if (!newUpdateDesc.trim() || !newUpdateDate) {
            alert("Please provide a date and description for the update.");
            return;
        }
        const taskId = linkedTaskId === 'none' ? null : linkedTaskId;
        const newUpdates = await dbService.addProjectUpdate(projectId, newUpdateDate, newUpdateDesc.trim(), taskId);
        if (newUpdates) {
            setUpdates(newUpdates);
            setNewUpdateDesc('');
            setLinkedTaskId('none');
        }
    };
    
    const handleDeleteUpdate = async (updateId: string) => {
        if (window.confirm("Are you sure you want to delete this log entry?")) {
            const newUpdates = await dbService.deleteProjectUpdate(updateId, projectId);
            if (newUpdates) setUpdates(newUpdates);
        }
    }

    return (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-fadeIn">
            <h4 className="text-md font-bold text-white/90">Activity Log</h4>
            <div className="space-y-2 bg-black/20 p-3 rounded-lg">
                <textarea
                    value={newUpdateDesc}
                    onChange={e => setNewUpdateDesc(e.target.value)}
                    placeholder="Log an update for this project..."
                    className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                    rows={2}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input type="date" value={newUpdateDate} onChange={e => setNewUpdateDate(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                    <select value={linkedTaskId} onChange={e => setLinkedTaskId(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white focus:outline-none focus:bg-white/30 focus:border-white/50 w-full sm:col-span-2">
                        <option value="none" className="bg-gray-800">No linked task</option>
                        {tasks.map(t => <option key={t.id} value={t.id} className="bg-gray-800">{t.text}</option>)}
                    </select>
                </div>
                <button onClick={handleAddUpdate} className="w-full p-2 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-cyan-500 to-sky-600">Add Log Entry</button>
            </div>
            
            {isLoading ? <Spinner/> : (
                <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {updates.map(update => {
                        const focusTime = update.task_id ? taskFocusTimes.get(update.task_id) : null;
                        const focusTimeString = focusTime && focusTime > 0 ? ` - Focus: ${focusTime}m` : '';

                        return (
                            <li key={update.id} className="bg-black/20 p-2 rounded-md text-sm group relative">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-white/90">{update.description}</p>
                                        <p className="text-xs text-white/60 mt-1">
                                            {new Date(update.update_date + 'T00:00:00').toLocaleDateString()}
                                            {update.tasks ? ` - Ref: ${update.tasks.text}`:''}
                                            {focusTimeString && <span className="text-cyan-400 font-semibold">{focusTimeString}</span>}
                                        </p>
                                    </div>
                                    <button onClick={() => handleDeleteUpdate(update.id)} className="p-1 text-red-400 hover:text-red-300 transition opacity-0 group-hover:opacity-100 flex-shrink-0" title="Delete Log Entry"><TrashIcon /></button>
                                </div>
                            </li>
                        );
                    })}
                    {updates.length === 0 && <p className="text-center text-xs text-white/60 py-2">No activity logged yet.</p>}
                </ul>
            )}
        </div>
    );
};

const priorityBorderColors: { [key: number]: string } = {
    1: 'border-l-4 border-red-500',
    2: 'border-l-4 border-amber-500',
    3: 'border-l-4 border-sky-500',
    4: 'border-l-4 border-slate-500',
};

interface ProjectItemProps {
    project: Project;
    tasks: Task[];
    onUpdateProject: (id: string, updates: Partial<Project>) => void;
    onDeleteProject: (id: string) => void;
}

const ProjectItem: React.FC<ProjectItemProps> = ({ project, tasks, onUpdateProject, onDeleteProject }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(project.name);
    const [editDescription, setEditDescription] = useState(project.description || '');
    const [editDeadline, setEditDeadline] = useState(project.deadline || '');
    const [editCriteriaType, setEditCriteriaType] = useState(project.completion_criteria_type);
    const [editCriteriaValue, setEditCriteriaValue] = useState(project.completion_criteria_value?.toString() || '');
    const [editPriority, setEditPriority] = useState<number>(project.priority ?? 3);
    const [isLogVisible, setIsLogVisible] = useState(false);

    const { progress, progressText, isComplete, isDue, isManual, isEditable } = useMemo(() => {
        const isComplete = project.status === 'completed';
        const isDue = project.status === 'due';
        const isManual = project.completion_criteria_type === 'manual';
        const isOld = isOlderThanOrEqualToTwoDays(project.created_at);
        const isEditable = !isComplete && !isOld;

        if (isManual) return { progress: isComplete ? 100 : 0, progressText: '', isComplete, isDue, isManual, isEditable };
        
        const value = project.progress_value;
        const target = project.completion_criteria_value || 1; // Avoid division by zero
        const progress = Math.min(100, (value / target) * 100);

        let progressText = '';
        if (project.completion_criteria_type === 'task_count') {
            progressText = `${value}/${target} tasks`;
        } else if (project.completion_criteria_type === 'duration_minutes') {
            progressText = `${value}/${target} min`;
        }
        
        return { progress, progressText, isComplete, isDue, isManual, isEditable };
    }, [project]);

    const handleManualCompleteToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newStatus = e.target.checked ? 'completed' : 'active';
        onUpdateProject(project.id, { 
            status: newStatus,
            completed_at: e.target.checked ? new Date().toISOString() : null,
        });
    };
    
    const handleSave = () => {
        if (!editName.trim()) {
            alert("Project name cannot be empty.");
            return;
        }
        const value = editCriteriaType !== 'manual' && editCriteriaValue ? parseInt(editCriteriaValue, 10) : null;
        if (editCriteriaType !== 'manual' && (!value || value <= 0)) {
            alert("Please enter a valid, positive number for completion criteria.");
            return;
        }

        const updates: Partial<Project> = {
            name: editName.trim(),
            description: editDescription.trim() || null,
            deadline: editDeadline || null,
            completion_criteria_type: editCriteriaType,
            completion_criteria_value: value,
            priority: editPriority
        };
        onUpdateProject(project.id, updates);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditName(project.name);
        setEditDescription(project.description || '');
        setEditDeadline(project.deadline || '');
        setEditCriteriaType(project.completion_criteria_type);
        setEditCriteriaValue(project.completion_criteria_value?.toString() || '');
        setEditPriority(project.priority ?? 3);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="bg-white/20 p-3 rounded-lg ring-2 ring-cyan-400 space-y-2">
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Project Name" className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Project Description (Optional)" className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" rows={2}></textarea>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                    <select value={editCriteriaType} onChange={e => setEditCriteriaType(e.target.value as any)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white focus:outline-none focus:bg-white/30 focus:border-white/50 w-full">
                        <option value="manual" className="bg-gray-800">Manual</option>
                        <option value="task_count" className="bg-gray-800">Task Count</option>
                        <option value="duration_minutes" className="bg-gray-800">Time Duration</option>
                    </select>
                </div>
                {editCriteriaType !== 'manual' && (
                    <input type="number" value={editCriteriaValue} onChange={e => setEditCriteriaValue(e.target.value)} placeholder={editCriteriaType === 'task_count' ? '# of tasks' : 'Minutes of focus'} className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                )}
                <div className="flex justify-between items-center mt-2">
                    <PrioritySelector priority={editPriority} setPriority={setEditPriority} />
                    <div className="flex justify-end gap-2 text-sm">
                        <button onClick={handleCancel} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-gray-500 to-gray-600">Cancel</button>
                        <button onClick={handleSave} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-cyan-600">Save</button>
                    </div>
                </div>
            </div>
        );
    }
    
    const bgColor = isComplete ? 'bg-white/5 text-white/50' : isDue ? 'bg-red-900/40' : 'bg-white/10';
    const priorityClass = priorityBorderColors[project.priority as number] ?? '';

    return (
        <div className={`p-3 rounded-lg ${bgColor} ${priorityClass} transition-all`}>
            <div className="flex items-center justify-between">
                <div className="flex items-start gap-3 flex-grow min-w-0">
                    {isManual && (
                        <input 
                            type="checkbox" 
                            checked={isComplete} 
                            onChange={handleManualCompleteToggle} 
                            disabled={!isEditable}
                            className="h-5 w-5 rounded bg-white/20 border-white/30 text-green-400 focus:ring-green-400 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed mt-1" 
                            aria-label={`Mark project ${project.name} as complete`}
                        />
                    )}
                    <div className="flex-grow min-w-0">
                        <span className={`text-white font-bold ${isComplete ? 'line-through' : ''}`}>{project.name}</span>
                        {project.deadline && (
                            <span className={`block text-xs mt-1 ${isDue && !isComplete ? 'text-red-400 font-bold' : 'text-amber-300/80'}`}>
                                Due: {new Date(project.deadline + 'T00:00:00').toLocaleDateString()}
                            </span>
                        )}
                         {project.description && <p className="text-sm text-white/70 mt-1 italic">{project.description}</p>}
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    {isDue && !isComplete && <span className="text-xs bg-red-500/50 text-white px-2 py-1 rounded-full font-bold">DUE</span>}
                    {isComplete && <span className="text-xs bg-green-500/50 text-white px-2 py-1 rounded-full font-bold">COMPLETED</span>}
                    <button onClick={() => setIsEditing(true)} disabled={!isEditable} className="p-1 text-sky-300 hover:text-sky-200 transition disabled:text-sky-300/30 disabled:cursor-not-allowed" title={!isEditable ? "Editing is disabled for completed or old projects" : "Edit Project"}><EditIcon /></button>
                    <button onClick={() => {
                        if (window.confirm(`Are you sure you want to delete "${project.name}"? This will unlink it from all tasks.`)) {
                            onDeleteProject(project.id)
                        }
                    }} className="p-1 text-red-400 hover:text-red-300 transition" title="Delete Project"><TrashIcon /></button>
                 </div>
            </div>
            {!isManual && (
                <div className="mt-2 pl-2">
                    <div className="flex justify-between items-center mb-1 text-xs text-white/80">
                        <span>Progress</span>
                        <span>{progressText}</span>
                    </div>
                    <div className="w-full bg-black/30 rounded-full h-2.5 shadow-inner">
                        <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-cyan-400 to-blue-500'}`}
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            )}
            <div className="mt-2 text-center">
                <button onClick={() => setIsLogVisible(v => !v)} className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold px-3 py-1 rounded-full hover:bg-white/10 transition">
                    {isLogVisible ? '▼ Hide Activity Log' : '► Show Activity Log'}
                </button>
            </div>
            {isLogVisible && <ActivityLog projectId={project.id} tasks={tasks} />}
        </div>
    );
};

const TargetItem: React.FC<{
    target: Target;
    onUpdateTarget: (id: string, updates: Partial<Target>) => void;
    onDeleteTarget: (id: string) => void;
}> = ({ target, onUpdateTarget, onDeleteTarget }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(target.text);
    const [editDeadline, setEditDeadline] = useState(target.deadline);
    const [editPriority, setEditPriority] = useState<number>(target.priority ?? 3);
    
    const isCompleted = target.status === 'completed';
    const isIncomplete = target.status === 'incomplete';
    const isOld = isOlderThanOrEqualToTwoDays(target.created_at);

    const handleSave = () => {
        if (!editText.trim() || !editDeadline) {
            alert("Target text and deadline cannot be empty.");
            return;
        }
        onUpdateTarget(target.id, { text: editText.trim(), deadline: editDeadline, priority: editPriority });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditText(target.text);
        setEditDeadline(target.deadline);
        setEditPriority(target.priority ?? 3);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <li className="bg-white/20 p-3 rounded-lg ring-2 ring-cyan-400 space-y-2">
                <input type="text" value={editText} onChange={e => setEditText(e.target.value)} placeholder="Target description" className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                <div className="flex justify-between items-center mt-2">
                    <PrioritySelector priority={editPriority} setPriority={setEditPriority} />
                    <div className="flex justify-end gap-2 text-sm">
                        <button onClick={handleCancel} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-gray-500 to-gray-600">Cancel</button>
                        <button onClick={handleSave} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-cyan-600">Save</button>
                    </div>
                </div>
            </li>
        );
    }
    
    let bgColor = 'bg-white/10';
    let textColor = 'text-white';
    if (isCompleted) {
        bgColor = 'bg-white/5 text-white/50';
    } else if (isIncomplete) {
        bgColor = 'bg-red-900/40';
        textColor = 'text-red-300';
    }
    const priorityClass = priorityBorderColors[target.priority as number] ?? '';

    return (
        <li className={`flex items-center justify-between p-3 rounded-lg transition-all ${bgColor} ${priorityClass}`}>
            <div className="flex items-center gap-3 flex-grow min-w-0">
                <input 
                    type="checkbox" 
                    checked={isCompleted} 
                    onChange={(e) => onUpdateTarget(target.id, { completed_at: e.target.checked ? new Date().toISOString() : null })} 
                    disabled={isCompleted || isOld}
                    className="h-5 w-5 rounded bg-white/20 border-white/30 text-green-400 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0" 
                />
                <span className={`${isCompleted ? 'line-through' : ''} ${textColor}`}>
                    {target.text}
                </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {isIncomplete && <span className="text-xs bg-red-500/50 text-white px-2 py-1 rounded-full font-bold">INCOMPLETE</span>}
                {!isCompleted && !isOld && <button onClick={() => setIsEditing(true)} className="p-1 text-sky-300 hover:text-sky-200 transition" title="Edit Target"><EditIcon /></button>}
                <span className="text-xs bg-black/20 px-2 py-1 rounded-full">{new Date(target.deadline + 'T00:00:00').toLocaleDateString()}</span>
                <button onClick={() => onDeleteTarget(target.id)} className="p-1 text-red-400 hover:text-red-300 transition" title="Delete Target"><TrashIcon /></button>
            </div>
        </li>
    );
};

const GoalItem: React.FC<{
    goal: Goal;
    onUpdateGoal: (id: string, text: string) => void;
    onDeleteGoal: (id: string) => void;
    onSetCompletion: (id: string, isComplete: boolean) => void;
}> = ({ goal, onUpdateGoal, onDeleteGoal, onSetCompletion }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(goal.text);
    const isOld = isOlderThanOrEqualToTwoDays(goal.created_at);
    const isComplete = !!goal.completed_at;

    const handleSave = () => {
        if (editText.trim() && editText.trim() !== goal.text) {
            onUpdateGoal(goal.id, editText.trim());
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditText(goal.text);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
             <li className="bg-gradient-to-br from-purple-900/50 via-indigo-900/50 to-blue-900/50 border border-cyan-400 rounded-xl p-4 ring-2 ring-cyan-400/50">
                <div className="flex flex-col gap-3">
                     <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full bg-black/30 border-2 border-white/20 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50 transition-all resize-none"
                        aria-label="Edit goal text"
                        rows={3}
                        autoFocus
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSave();
                            }
                        }}
                    />
                    <div className="flex justify-end gap-2 text-sm">
                        <button onClick={handleCancel} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gray-600 hover:bg-gray-700">Cancel</button>
                        <button onClick={handleSave} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-blue-600 hover:bg-blue-700">Save</button>
                    </div>
                </div>
            </li>
        );
    }
    
    return (
        <li className={`bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-4 transform transition-all hover:scale-[1.02] hover:shadow-2xl hover:border-white/20 ${isComplete ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-grow min-w-0">
                     <input
                        type="checkbox"
                        checked={isComplete}
                        onChange={(e) => onSetCompletion(goal.id, e.target.checked)}
                        className="h-6 w-6 rounded bg-white/20 border-white/30 text-green-400 focus:ring-green-400 flex-shrink-0 cursor-pointer mt-1"
                        aria-label={`Mark goal as ${isComplete ? 'incomplete' : 'complete'}`}
                    />
                    <div className="text-amber-300 mt-1 flex-shrink-0">
                        <StarIcon />
                    </div>
                    <p className={`text-white/90 font-medium text-base flex-grow break-words ${isComplete ? 'line-through' : ''}`}>{goal.text}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                     <button onClick={() => setIsEditing(true)} disabled={isOld || isComplete} className="p-2 rounded-full text-sky-300 hover:bg-sky-500/20 transition disabled:text-sky-300/30 disabled:cursor-not-allowed" title={(isOld || isComplete) ? "Editing is disabled for completed or old goals" : "Edit Goal"}><EditIcon /></button>
                     <button onClick={() => onDeleteGoal(goal.id)} className="p-2 rounded-full text-red-400 hover:bg-red-500/20 transition" title="Delete Goal"><TrashIcon /></button>
                </div>
            </div>
        </li>
    );
};

// --- Commitments Components ---
const useCommitmentStatus = (commitment: Commitment) => {
    return useMemo(() => {
        const now = new Date();
        const createdAt = new Date(commitment.created_at);
        const ageInMillis = now.getTime() - createdAt.getTime();
        
        // Constants
        const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;
        const ONE_MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000; // Approx

        // Basic states
        const isCompleted = commitment.status === 'completed';
        const isBroken = commitment.status === 'broken';
        const isTerminated = isCompleted || isBroken;
        const isGracePeriod = ageInMillis <= TWO_HOURS_IN_MS;

        // Editability (only in grace period)
        const isEditable = !isTerminated && isGracePeriod;
        const isDeletable = !isTerminated && isGracePeriod;
        
        // New "canBeCompleted" logic
        let canBeCompleted = false;
        if (!isTerminated && !isGracePeriod) {
            if (commitment.due_date) {
                // With due date, can't be manually completed.
                canBeCompleted = false; 
            } else {
                // Without due date, can be completed after one month.
                canBeCompleted = ageInMillis > ONE_MONTH_IN_MS;
            }
        }

        // "canBeBroken" logic remains the same: any time after grace period.
        const canBeBroken = !isTerminated && !isGracePeriod;

        // New lock reason logic
        let lockReason = '';
        if (isTerminated) {
            lockReason = `This commitment is already ${commitment.status}.`;
        } else if (isGracePeriod) {
            const timeLeft = Math.ceil((TWO_HOURS_IN_MS - ageInMillis) / (60 * 1000));
            lockReason = `Editing is allowed for ${timeLeft} more minutes. Actions are locked during this grace period.`;
        } else { // After grace period
            if (commitment.due_date) {
                lockReason = "This commitment will complete automatically after its due date. It can be marked as broken at any time.";
            } else {
                if (ageInMillis <= ONE_MONTH_IN_MS) {
                    const daysLeft = 30 - Math.floor(ageInMillis / (24 * 60 * 60 * 1000));
                    lockReason = `This commitment is locked. You can mark it complete in ~${daysLeft} days, or break it now.`;
                } else {
                    lockReason = "This commitment is unlocked. You can now mark it as complete or broken.";
                }
            }
        }
        
        // Due date status for UI display
        const dueDate = commitment.due_date ? new Date(commitment.due_date + 'T23:59:59') : null;
        const isPastDue = dueDate ? now > dueDate : false;

        return {
            isCompleted,
            isBroken,
            isTerminated,
            isEditable,
            isDeletable,
            canBeCompleted,
            canBeBroken,
            lockReason,
            isPastDue,
            isGracePeriod
        };
    }, [commitment]);
};

const CommitmentItem: React.FC<{
    commitment: Commitment;
    onUpdate: (id: string, updates: { text: string; dueDate: string | null; }) => void;
    onDelete: (id: string) => void;
    onSetCompletion: (id: string, isComplete: boolean) => void;
    onMarkAsBroken: (id: string) => void;
}> = ({ commitment, onUpdate, onDelete, onSetCompletion, onMarkAsBroken }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(commitment.text);
    const [editDueDate, setEditDueDate] = useState(commitment.due_date || '');

    const { isTerminated, isEditable, isDeletable, canBeCompleted, canBeBroken, lockReason, isPastDue } = useCommitmentStatus(commitment);

    const handleSave = () => {
        if (editText.trim()) {
            onUpdate(commitment.id, { text: editText.trim(), dueDate: editDueDate || null });
            setIsEditing(false);
        }
    };
    
    if (isEditing) {
        return (
            <li className="bg-white/20 p-3 rounded-lg ring-2 ring-cyan-400 space-y-2">
                <input
                    type="text"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                    autoFocus
                />
                 <input
                    type="date"
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center"
                    style={{colorScheme: 'dark'}}
                />
                <div className="flex justify-end gap-2 text-sm mt-2">
                    <button onClick={() => setIsEditing(false)} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-gray-500 to-gray-600">Cancel</button>
                    <button onClick={handleSave} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-cyan-600">Save</button>
                </div>
            </li>
        )
    }

    const statusStyles = {
        active: 'bg-black/20',
        completed: 'bg-green-900/40 opacity-70',
        broken: 'bg-red-900/40 opacity-70',
    };

    return (
        <li className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-lg ${statusStyles[commitment.status]}`}>
             <div className="flex items-start gap-3 flex-grow min-w-0">
                <div className="flex-grow">
                    <p className={`text-white ${isTerminated ? 'line-through' : ''}`}>{commitment.text}</p>
                    <div className="text-xs text-white/60 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Committed: {new Date(commitment.created_at).toLocaleDateString()}</span>
                        {commitment.due_date && <span className={isPastDue && !isTerminated ? 'font-bold text-amber-400' : ''}>Due: {new Date(commitment.due_date+'T00:00:00').toLocaleDateString()}</span>}
                        {commitment.completed_at && <span className="text-green-400">Completed: {new Date(commitment.completed_at).toLocaleDateString()}</span>}
                        {commitment.broken_at && <span className="text-red-400">Broken: {new Date(commitment.broken_at).toLocaleDateString()}</span>}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 self-start sm:self-center">
                {!isTerminated && (
                    <>
                        <button onClick={() => onSetCompletion(commitment.id, true)} disabled={!canBeCompleted} className="p-2 text-green-400 hover:text-green-300 disabled:text-green-400/30 disabled:cursor-not-allowed transition" title={canBeCompleted ? "Mark as Completed" : lockReason}><CheckIcon /></button>
                        <button onClick={() => onMarkAsBroken(commitment.id)} disabled={!canBeBroken} className="p-2 text-red-400 hover:text-red-300 disabled:text-red-400/30 disabled:cursor-not-allowed transition" title={canBeBroken ? "Mark as Broken" : lockReason}>
                            <svg className="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </>
                )}
                {isEditable && isDeletable ? (
                    <>
                        <button onClick={() => setIsEditing(true)} className="p-2 text-sky-300 hover:text-sky-200 transition" title="Edit Commitment"><EditIcon /></button>
                        <button onClick={() => onDelete(commitment.id)} className="p-2 text-red-400 hover:text-red-300 transition" title="Delete Commitment"><TrashIcon /></button>
                    </>
                ) : (
                    !isTerminated && <div className="p-2 text-amber-400 flex items-center gap-2 text-sm" title={lockReason}>
                        <LockIcon />
                    </div>
                )}
            </div>
        </li>
    );
};

const CommitmentsPanel: React.FC<{
    commitments: Commitment[];
    onAdd: (text: string, dueDate: string | null) => void;
    onUpdate: (id: string, updates: { text: string; dueDate: string | null; }) => void;
    onDelete: (id: string) => void;
    onSetCompletion: (id: string, isComplete: boolean) => void;
    onMarkAsBroken: (id: string) => void;
}> = ({ commitments, onAdd, onUpdate, onDelete, onSetCompletion, onMarkAsBroken }) => {
    const [newCommitment, setNewCommitment] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [view, setView] = useState<'active' | 'completed' | 'broken'>('active');
    
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [showDateFilter, setShowDateFilter] = useState(false);

    const handleAdd = () => {
        if (newCommitment.trim()) {
            onAdd(newCommitment.trim(), newDueDate || null);
            setNewCommitment('');
            setNewDueDate('');
        }
    };
    
    const { active, completed, broken, hiddenCompletedCount, hiddenBrokenCount } = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const allActive = commitments.filter(c => c.status === 'active');
        const allCompleted = commitments.filter(c => c.status === 'completed');
        const allBroken = commitments.filter(c => c.status === 'broken');

        let filteredCompleted = allCompleted;
        let filteredBroken = allBroken;

        if (dateRange.start && dateRange.end) {
            filteredCompleted = allCompleted.filter(c => {
                if (!c.completed_at) return false;
                const completedDate = c.completed_at.split('T')[0];
                return completedDate >= dateRange.start && completedDate <= dateRange.end;
            });
            filteredBroken = allBroken.filter(c => {
                if (!c.broken_at) return false;
                const brokenDate = c.broken_at.split('T')[0];
                return brokenDate >= dateRange.start && brokenDate <= dateRange.end;
            });
        } else {
            filteredCompleted = allCompleted.filter(c => c.completed_at && new Date(c.completed_at) > thirtyDaysAgo);
            filteredBroken = allBroken.filter(c => c.broken_at && new Date(c.broken_at) > thirtyDaysAgo);
        }

        const hiddenCompletedCount = allCompleted.length - filteredCompleted.length;
        const hiddenBrokenCount = allBroken.length - filteredBroken.length;

        allActive.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        filteredCompleted.sort((a,b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime());
        filteredBroken.sort((a,b) => new Date(b.broken_at || 0).getTime() - new Date(a.broken_at || 0).getTime());

        return { 
            active: allActive, 
            completed: filteredCompleted, 
            broken: filteredBroken,
            hiddenCompletedCount,
            hiddenBrokenCount
        };
    }, [commitments, dateRange]);

    const handleClearFilter = () => {
        setDateRange({ start: '', end: '' });
        setShowDateFilter(false);
    };

    const lists = { active, completed, broken };
    const currentList = lists[view];
    const hiddenCount = view === 'completed' ? hiddenCompletedCount : hiddenBrokenCount;
    
    const FilterControls = () => {
        if (view !== 'completed' && view !== 'broken') return null;

        return (
            <div className="bg-black/20 p-2 rounded-lg mb-4 text-sm text-center">
                {!showDateFilter ? (
                    <div className="flex justify-center items-center gap-4 py-1">
                        <p className="text-white/70">
                            {dateRange.start && dateRange.end 
                                ? `Showing custom range.`
                                : `Showing last 30 days. ${hiddenCount > 0 ? `${hiddenCount} older items hidden.` : ''}`
                            }
                        </p>
                        <button onClick={() => setShowDateFilter(true)} className="font-semibold text-cyan-300 hover:text-cyan-200">
                            Filter Date
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2 p-2 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                            <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                            <span className="text-white/80">to</span>
                            <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                        </div>
                        <div className="flex justify-center gap-4 pt-1">
                            <button onClick={() => setShowDateFilter(false)} className="text-white/70 hover:text-white">Cancel</button>
                            <button onClick={handleClearFilter} className="font-semibold text-amber-400 hover:text-amber-300">Clear</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };
    
    return (
        <Panel title="💪 My Commitments">
            <div className="text-center mb-4 flex justify-center items-center gap-2">
                <p className="text-white/80 text-sm">What will you hold yourself accountable for?</p>
                 <ExplanationTooltip 
                    title="About Commitments"
                    content="Commitments are promises to yourself. They have a <strong>2-hour 'grace period'</strong> for edits, after which they lock to encourage reflection.<br/><br/>- After locking, you can mark a commitment as 'Completed' or 'Broken'.<br/>- If a due date is set, it completes automatically after it passes.<br/>- If no due date, you can manually complete it after one month."
                />
            </div>
            <div className="space-y-2 mb-4">
                <div className="relative">
                    <input
                        type="text"
                        value={newCommitment}
                        onChange={e => setNewCommitment(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleAdd()}
                        placeholder="I commit to..."
                        className="w-full bg-black/30 border-2 border-white/20 rounded-full py-3 pr-28 pl-6 text-white placeholder:text-white/50 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all"
                    />
                    <button onClick={handleAdd} className="absolute inset-y-1.5 right-1.5 px-6 rounded-full font-bold text-white transition-all duration-300 bg-gradient-to-br from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 hover:scale-105">
                        Commit
                    </button>
                </div>
                <div className="flex items-center gap-2 px-2">
                    <label htmlFor="commitment-due-date" className="text-sm text-white/70">Optional Due Date:</label>
                    <input
                        id="commitment-due-date"
                        type="date"
                        value={newDueDate}
                        onChange={e => setNewDueDate(e.target.value)}
                        className="bg-white/20 border border-white/30 rounded-lg p-1.5 text-white/80 w-full sm:w-auto text-center"
                        style={{colorScheme: 'dark'}}
                    />
                </div>
            </div>
             <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full">
                {(['active', 'completed', 'broken'] as const).map(status => (
                     <button key={status} onClick={() => setView(status)} className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${view === status ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)} ({status === 'active' ? lists.active.length : commitments.filter(c => c.status === status).length})
                    </button>
                ))}
            </div>
            
            <FilterControls />
            
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {currentList.map(c => <CommitmentItem key={c.id} commitment={c} onUpdate={onUpdate} onDelete={onDelete} onSetCompletion={onSetCompletion} onMarkAsBroken={onMarkAsBroken} />)}
                {currentList.length === 0 && <p className="text-center text-white/60 p-4">
                    {dateRange.start && dateRange.end ? `No ${view} commitments in this date range.` : `No ${view} commitments.`}
                </p>}
            </ul>
        </Panel>
    )
}


interface GoalsPageProps {
    goals: Goal[];
    targets: Target[];
    projects: Project[];
    commitments: Commitment[];
    onAddGoal: (text: string) => void;
    onUpdateGoal: (id: string, text: string) => void;
    onDeleteGoal: (id: string) => void;
    onSetGoalCompletion: (id: string, isComplete: boolean) => void;
    onAddTarget: (text: string, deadline: string, priority: number | null) => void;
    onUpdateTarget: (id: string, updates: Partial<Target>) => void;
    onDeleteTarget: (id: string) => void;
    onAddProject: (name: string, description: string | null, deadline: string | null, criteria: {type: Project['completion_criteria_type'], value: number | null}, priority: number | null) => Promise<string | null>;
    onUpdateProject: (id: string, updates: Partial<Project>) => void;
    onDeleteProject: (id: string) => void;
    onAddCommitment: (text: string, dueDate: string | null) => void;
    onUpdateCommitment: (id: string, updates: { text: string; dueDate: string | null; }) => void;
    onDeleteCommitment: (id: string) => void;
    onSetCommitmentCompletion: (id: string, isComplete: boolean) => void;
    onMarkCommitmentBroken: (id: string) => void;
}

const GoalsPage: React.FC<GoalsPageProps> = (props) => {
    const { goals, targets, projects, commitments, onAddGoal, onUpdateGoal, onDeleteGoal, onSetGoalCompletion, onAddTarget, onUpdateTarget, onDeleteTarget, onAddProject, onUpdateProject, onDeleteProject, onAddCommitment, onUpdateCommitment, onDeleteCommitment, onSetCommitmentCompletion, onMarkCommitmentBroken } = props;

    const [newGoal, setNewGoal] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newDeadline, setNewDeadline] = useState('');
    const [newTargetPriority, setNewTargetPriority] = useState<number>(3);
    const [showArchivedGoals, setShowArchivedGoals] = useState(false);
    
    // Target states
    const [targetView, setTargetView] = useState<'pending' | 'incomplete' | 'completed'>('pending');
    const [targetDateRange, setTargetDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [showTargetDateFilter, setShowTargetDateFilter] = useState(false);
    const [targetSortBy, setTargetSortBy] = useState<'default' | 'priority'>('default');
    
    // Project form state
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDescription, setNewProjectDescription] = useState('');
    const [newProjectDeadline, setNewProjectDeadline] = useState('');
    const [newProjectPriority, setNewProjectPriority] = useState<number>(3);
    const [criteriaType, setCriteriaType] = useState<Project['completion_criteria_type']>('manual');
    const [criteriaValue, setCriteriaValue] = useState('');
    
    // Data for stats dashboard
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [allHistory, setAllHistory] = useState<PomodoroHistory[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    // Project list filters
    const [projectStatusFilter, setProjectStatusFilter] = useState<'active' | 'completed' | 'due'>('active');
    const [projectDateRange, setProjectDateRange] = useState({ start: '', end: '' });
    const [showProjectDateFilter, setShowProjectDateFilter] = useState(false);
    const [projectSortBy, setProjectSortBy] = useState<'default' | 'priority'>('default');


    useEffect(() => {
        const fetchStatsData = async () => {
            setIsLoadingStats(true);
            const [tasks, history] = await Promise.all([
                dbService.getAllTasksForStats(),
                dbService.getAllPomodoroHistory()
            ]);
            setAllTasks(tasks || []);
            setAllHistory(history || []);
            setIsLoadingStats(false);
        };
        fetchStatsData();
    }, []);

    const handleAddProject = () => {
        if (newProjectName.trim()) {
            const value = criteriaType !== 'manual' && criteriaValue ? parseInt(criteriaValue, 10) : null;
            if (criteriaType !== 'manual' && (!value || value <= 0)) {
                alert('Please enter a valid, positive number for the completion criteria.');
                return;
            }

            onAddProject(newProjectName.trim(), newProjectDescription.trim() || null, newProjectDeadline || null, { type: criteriaType, value }, newProjectPriority);
            
            // Reset form
            setNewProjectName('');
            setNewProjectDescription('');
            setNewProjectDeadline('');
            setNewProjectPriority(3);
            setCriteriaType('manual');
            setCriteriaValue('');
        }
    };

    const handleAddGoal = () => {
        if (newGoal.trim()) {
            onAddGoal(newGoal.trim());
            setNewGoal('');
        }
    };

    const handleAddTarget = () => {
        if (newTarget.trim() && newDeadline) {
            onAddTarget(newTarget.trim(), newDeadline, newTargetPriority);
            setNewTarget('');
            setNewDeadline('');
            setNewTargetPriority(3);
        }
    };
    
    const oneMonthAgo = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d;
    }, []);

    const { visibleGoals, hiddenGoalsCount } = useMemo(() => {
        if (showArchivedGoals) {
            return { visibleGoals: goals, hiddenGoalsCount: 0 };
        }
        
        const visible = goals.filter(g => {
            if (!g.completed_at) return true;
            return new Date(g.completed_at) > oneMonthAgo;
        });

        return { visibleGoals: visible, hiddenGoalsCount: goals.length - visible.length };
    }, [goals, showArchivedGoals, oneMonthAgo]);

    const {
        activeProjects,
        visibleCompletedProjects,
        visibleDueProjects,
        hiddenCompletedProjectsCount,
        hiddenDueProjectsCount,
    } = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const allActive = projects.filter(p => p.status === 'active');
        const allCompleted = projects.filter(p => p.status === 'completed');
        const allDue = projects.filter(p => p.status === 'due');

        if (projectSortBy === 'priority') {
            const sortByPriority = (a: Project, b: Project) => {
                const priorityA = a.priority ?? 5;
                const priorityB = b.priority ?? 5;
                if (priorityA !== priorityB) return priorityA - priorityB;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            };
            allActive.sort(sortByPriority);
            allDue.sort(sortByPriority);
        }
        // Default sort by created_at is handled by the dbService fetch

        let visibleCompleted, visibleDue;

        if (projectDateRange.start && projectDateRange.end) {
            visibleCompleted = allCompleted.filter(p => {
                if (!p.completed_at) return false;
                const completedDate = p.completed_at.split('T')[0];
                return completedDate >= projectDateRange.start && completedDate <= projectDateRange.end;
            });
            visibleDue = allDue.filter(p => {
                if (!p.deadline) return false;
                return p.deadline >= projectDateRange.start && p.deadline <= projectDateRange.end;
            });
        } else {
            visibleCompleted = allCompleted.filter(p => p.completed_at && new Date(p.completed_at) > thirtyDaysAgo);
            visibleDue = allDue.filter(p => p.deadline && new Date(p.deadline) > thirtyDaysAgo);
        }

        const hiddenCompleted = allCompleted.length - visibleCompleted.length;
        const hiddenDue = allDue.length - visibleDue.length;

        visibleCompleted.sort((a,b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
        
        return {
            activeProjects: allActive,
            visibleCompletedProjects: visibleCompleted,
            visibleDueProjects: visibleDue,
            hiddenCompletedProjectsCount: hiddenCompleted,
            hiddenDueProjectsCount: hiddenDue,
        };
    }, [projects, projectDateRange, projectSortBy]);
    
    const {
        pendingTargets,
        incompleteTargets,
        completedTargets,
        hiddenIncompleteCount,
        hiddenCompletedCount,
    } = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const allActive = targets.filter(t => t.status === 'active');
        const allIncomplete = targets.filter(t => t.status === 'incomplete');
        const allCompleted = targets.filter(t => t.status === 'completed');

        if (targetSortBy === 'priority') {
             const sortByPriority = (a: Target, b: Target) => {
                const priorityA = a.priority ?? 5;
                const priorityB = b.priority ?? 5;
                if (priorityA !== priorityB) return priorityA - priorityB;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            };
            allActive.sort(sortByPriority);
            allIncomplete.sort(sortByPriority);
        }

        const pending = allActive;

        let visibleIncomplete = allIncomplete;
        let visibleCompleted = allCompleted;

        if (targetDateRange.start && targetDateRange.end) {
            visibleIncomplete = allIncomplete.filter(t => t.deadline >= targetDateRange.start && t.deadline <= targetDateRange.end);
            visibleCompleted = allCompleted.filter(t => {
                if (!t.completed_at) return false;
                const completedDate = t.completed_at.split('T')[0];
                return completedDate >= targetDateRange.start && completedDate <= targetDateRange.end;
            });
        } else {
            // Default view: hide if older than 30 days for completed/incomplete
            visibleIncomplete = allIncomplete.filter(t => new Date(t.deadline) >= thirtyDaysAgo);
            visibleCompleted = allCompleted.filter(t => t.completed_at && new Date(t.completed_at) >= thirtyDaysAgo);
        }

        const incomplete = visibleIncomplete;
        const completed = visibleCompleted.sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime());

        return {
            pendingTargets: pending,
            incompleteTargets: incomplete,
            completedTargets: completed,
            hiddenIncompleteCount: allIncomplete.length - visibleIncomplete.length,
            hiddenCompletedCount: allCompleted.length - visibleCompleted.length,
        };
    }, [targets, targetDateRange, targetSortBy]);

    const upcomingDeadlines = useMemo(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowString = tomorrow.toISOString().split('T')[0];

        const projectsDue = projects.filter(p => p.status === 'active' && p.deadline === tomorrowString);
        const targetsDue = targets.filter(t => t.status === 'active' && t.deadline === tomorrowString);

        return [...projectsDue, ...targetsDue];
    }, [projects, targets]);
    
    const handleClearTargetFilter = () => {
        setTargetDateRange({ start: '', end: '' });
        setShowTargetDateFilter(false);
    };
    
    const TargetFilterControls = () => {
        if (targetView !== 'completed' && targetView !== 'incomplete') return null;
        
        const hiddenCount = targetView === 'completed' ? hiddenCompletedCount : hiddenIncompleteCount;

        return (
            <div className="bg-black/20 p-2 rounded-lg my-4 text-sm text-center">
                {!showTargetDateFilter ? (
                    <div className="flex justify-center items-center gap-4 py-1">
                        <p className="text-white/70">
                            {targetDateRange.start && targetDateRange.end 
                                ? `Showing custom range.`
                                : `Showing last 30 days. ${hiddenCount > 0 ? `${hiddenCount} older items hidden.` : ''}`
                            }
                        </p>
                        <button onClick={() => setShowTargetDateFilter(true)} className="font-semibold text-cyan-300 hover:text-cyan-200">
                            Filter Date
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2 p-2 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                            <input type="date" value={targetDateRange.start} onChange={e => setTargetDateRange(p => ({...p, start: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                            <span className="text-white/80">to</span>
                            <input type="date" value={targetDateRange.end} onChange={e => setTargetDateRange(p => ({...p, end: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                        </div>
                        <div className="flex justify-center gap-4 pt-1">
                            <button onClick={() => setShowTargetDateFilter(false)} className="text-white/70 hover:text-white">Cancel</button>
                            <button onClick={handleClearTargetFilter} className="font-semibold text-amber-400 hover:text-amber-300">Clear</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };
    
    const ProjectFilterControls = () => {
        if (projectStatusFilter !== 'completed' && projectStatusFilter !== 'due') return null;
    
        const hiddenCount = projectStatusFilter === 'completed' ? hiddenCompletedProjectsCount : hiddenDueProjectsCount;
    
        const handleClearFilter = () => {
            setProjectDateRange({ start: '', end: '' });
            setShowProjectDateFilter(false);
        };
    
        return (
            <div className="bg-black/20 p-2 rounded-lg my-4 text-sm text-center">
                {!showProjectDateFilter ? (
                    <div className="flex justify-center items-center gap-4 py-1">
                        <p className="text-white/70">
                            {projectDateRange.start && projectDateRange.end 
                                ? `Showing custom range.`
                                : `Showing last 30 days. ${hiddenCount > 0 ? `${hiddenCount} older items hidden.` : ''}`
                            }
                        </p>
                        <button onClick={() => setShowProjectDateFilter(true)} className="font-semibold text-cyan-300 hover:text-cyan-200">
                            Filter Date
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2 p-2 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                            <input type="date" value={projectDateRange.start} onChange={e => setProjectDateRange(p => ({...p, start: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                            <span className="text-white/80">to</span>
                            <input type="date" value={projectDateRange.end} onChange={e => setProjectDateRange(p => ({...p, end: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                        </div>
                        <div className="flex justify-center gap-4 pt-1">
                            <button onClick={() => setShowProjectDateFilter(false)} className="text-white/70 hover:text-white">Cancel</button>
                            <button onClick={handleClearFilter} className="font-semibold text-amber-400 hover:text-amber-300">Clear & Show All</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div>
             {upcomingDeadlines.length > 0 && (
                <div className="bg-amber-500/30 border border-amber-500 text-amber-200 p-4 rounded-2xl mb-4 animate-pulse-slow">
                    <h3 className="font-bold text-lg text-center mb-2">🔥 Heads Up! Due Tomorrow:</h3>
                    <ul className="list-disc list-inside text-sm text-center">
                        {upcomingDeadlines.map(item => (
                            <li key={item.id}>{'name' in item ? `Project: ${item.name}` : `Target: ${item.text}`}</li>
                        ))}
                    </ul>
                </div>
            )}
            
            <Panel title="🌟 My Core Goals">
                <p className="text-white/80 text-center text-sm mb-4">Your guiding stars. What long-term ambitions are you working towards?</p>
                <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-amber-300">
                        <StarIcon />
                    </div>
                    <input
                        type="text"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddGoal()}
                        placeholder="What's your next big goal?"
                        className="w-full bg-black/30 border-2 border-white/20 rounded-full py-3 pr-28 pl-12 text-white placeholder:text-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50 transition-all"
                    />
                    <button onClick={handleAddGoal} className="absolute inset-y-1.5 right-1.5 px-6 rounded-full font-bold text-white transition-all duration-300 bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 hover:scale-105">
                        Add
                    </button>
                </div>
                 <div className="text-right mb-2">
                    {hiddenGoalsCount > 0 && (
                        <button onClick={() => setShowArchivedGoals(s => !s)} className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold px-3 py-1 rounded-full hover:bg-white/10 transition">
                            {showArchivedGoals ? 'Hide Archived' : `Show ${hiddenGoalsCount} Archived`}
                        </button>
                    )}
                </div>
                <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                    {visibleGoals.map(goal => (
                        <GoalItem key={goal.id} goal={goal} onUpdateGoal={onUpdateGoal} onDeleteGoal={onDeleteGoal} onSetCompletion={onSetGoalCompletion} />
                    ))}
                    {goals.length === 0 && <p className="text-center text-white/60 p-4 col-span-1 lg:col-span-2">Set your first high-level goal to get started!</p>}
                </ul>
            </Panel>

            <Panel title="🎯 Key Targets">
                <div className="text-center mb-4 flex justify-center items-center gap-2">
                    <p className="text-white/80 text-sm">Specific, measurable outcomes with a deadline to keep you on track.</p>
                    <ExplanationTooltip 
                        title="Goals vs. Targets"
                        content="A <strong>Target</strong> is a specific, measurable, and time-bound milestone (e.g., 'Finish Chapter 3 by Friday').<br/><br/>A <strong>Goal</strong> is a high-level, long-term ambition (e.g., 'Write a book').<br/><br/>Targets are the concrete steps to achieve your Goals."
                    />
                </div>
                <div className="flex flex-col gap-2 mb-4">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={newTarget}
                            onChange={(e) => setNewTarget(e.target.value)}
                            placeholder="Define a clear target..."
                            className="flex-grow bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                        />
                        <input
                            type="date"
                            value={newDeadline}
                            onChange={(e) => setNewDeadline(e.target.value)}
                            className="bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 text-center"
                            style={{colorScheme: 'dark'}}
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
                        <PrioritySelector priority={newTargetPriority} setPriority={setNewTargetPriority} />
                        <button onClick={handleAddTarget} className="w-full sm:w-auto p-3 px-6 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-sky-600">Add Target</button>
                    </div>
                </div>
                
                <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full">
                    <button onClick={() => setTargetView('pending')} className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${targetView === 'pending' ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
                        Pending ({pendingTargets.length})
                    </button>
                    <button onClick={() => setTargetView('incomplete')} className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${targetView === 'incomplete' ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
                        Incomplete ({targets.filter(t => t.status === 'incomplete').length})
                    </button>
                    <button onClick={() => setTargetView('completed')} className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${targetView === 'completed' ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
                        Completed ({targets.filter(t => t.status === 'completed').length})
                    </button>
                </div>

                <TargetFilterControls />

                <div className="flex justify-end mb-2 -mt-2">
                    <button
                        onClick={() => setTargetSortBy(s => s === 'default' ? 'priority' : 'default')}
                        className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold px-3 py-1 rounded-full hover:bg-white/10 transition"
                        aria-label={`Sort targets by ${targetSortBy === 'default' ? 'priority' : 'date'}`}
                    >
                        Sort by: {targetSortBy === 'default' ? 'Default' : 'Priority'}
                    </button>
                </div>
                
                {targetView === 'pending' && (
                    <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {pendingTargets.map(target => (
                            <TargetItem key={target.id} target={target} onUpdateTarget={onUpdateTarget} onDeleteTarget={onDeleteTarget} />
                        ))}
                        {pendingTargets.length === 0 && <p className="text-center text-white/60 p-4">No pending targets. Great job, or add a new one!</p>}
                    </ul>
                )}
                {targetView === 'incomplete' && (
                    <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {incompleteTargets.map(target => (
                            <TargetItem key={target.id} target={target} onUpdateTarget={onUpdateTarget} onDeleteTarget={onDeleteTarget} />
                        ))}
                        {incompleteTargets.length === 0 && <p className="text-center text-white/60 p-4">
                            {targetDateRange.start && targetDateRange.end ? 'No incomplete targets in this date range.' : 'No incomplete targets in the last 30 days.'}
                        </p>}
                    </ul>
                )}
                {targetView === 'completed' && (
                     <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {completedTargets.map(target => (
                            <TargetItem key={target.id} target={target} onUpdateTarget={onUpdateTarget} onDeleteTarget={onDeleteTarget} />
                        ))}
                        {completedTargets.length === 0 && <p className="text-center text-white/60 p-4">
                            {targetDateRange.start && targetDateRange.end ? 'No completed targets in this date range.' : 'No targets completed in the last 30 days.'}
                        </p>}
                    </ul>
                )}

            </Panel>
            
            <CommitmentsPanel 
                commitments={commitments}
                onAdd={onAddCommitment}
                onUpdate={onUpdateCommitment}
                onDelete={onDeleteCommitment}
                onSetCompletion={onSetCommitmentCompletion}
                onMarkAsBroken={onMarkCommitmentBroken}
            />
            
            <Panel title="🚀 Projects">
                <p className="text-white/80 text-center text-sm mb-4">Group your tasks into larger projects to track overall progress.</p>
                 <div className="bg-black/20 p-3 rounded-lg mb-4 space-y-2">
                    <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="New Project Name" className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                    <textarea value={newProjectDescription} onChange={e => setNewProjectDescription(e.target.value)} placeholder="Project Description (Optional)" className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" rows={2}></textarea>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-white/70 mb-1 flex items-center gap-1.5">
                                Deadline
                                <ExplanationTooltip title="Project Deadline" content="An optional due date for your project. The project's status will change to 'Due' if it's not completed by this date, reminding you to reassess." />
                            </label>
                            <input type="date" value={newProjectDeadline} onChange={e => setNewProjectDeadline(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                        </div>
                        <div>
                            <label className="text-xs text-white/70 mb-1 flex items-center gap-1.5">
                                Completion Criteria
                                <ExplanationTooltip title="Completion Criteria" content="How is this project 'done'?<br/><br/>- <strong>Manual:</strong> You decide when it's complete.<br/>- <strong>Task Count:</strong> Automatically completes after a set number of linked tasks are finished.<br/>- <strong>Time Duration:</strong> Automatically completes after you've logged a certain number of focus minutes on linked tasks." />
                            </label>
                            <select value={criteriaType} onChange={e => setCriteriaType(e.target.value as any)} className="bg-white/20 border border-white/30 rounded-lg p-3 text-white focus:outline-none focus:bg-white/30 focus:border-white/50 w-full">
                                <option value="manual" className="bg-gray-800">Manual Completion</option>
                                <option value="task_count" className="bg-gray-800">Complete by Task Count</option>
                                <option value="duration_minutes" className="bg-gray-800">Complete by Time Duration</option>
                            </select>
                        </div>
                    </div>
                    {criteriaType !== 'manual' && (
                        <input type="number" value={criteriaValue} onChange={e => setCriteriaValue(e.target.value)} placeholder={criteriaType === 'task_count' ? '# of tasks to complete' : 'Total minutes of focus'} className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                    )}
                    <div className="flex flex-col sm:flex-row gap-2 justify-between items-center pt-1">
                         <div>
                            <label className="text-xs text-white/70 mb-1 flex items-center gap-1.5">
                                Priority
                                <ExplanationTooltip title="Project Priority" content="Set a priority from 1 (Highest) to 4 (Lowest). This helps organize your projects list." />
                            </label>
                            <PrioritySelector priority={newProjectPriority} setPriority={setNewProjectPriority} />
                        </div>
                        <button onClick={handleAddProject} className="w-full sm:w-auto p-3 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-sky-600">Add Project</button>
                    </div>
                </div>
                
                 <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full">
                    {(['active', 'completed', 'due'] as const).map(status => (
                        <button key={status} onClick={() => setProjectStatusFilter(status)} className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${projectStatusFilter === status ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)} ({
                                status === 'active' ? activeProjects.length :
                                status === 'completed' ? projects.filter(p=>p.status === 'completed').length :
                                projects.filter(p=>p.status === 'due').length
                            })
                        </button>
                    ))}
                </div>

                <ProjectFilterControls />
                
                <div className="flex justify-end mb-2 -mt-2">
                    <button
                        onClick={() => setProjectSortBy(s => s === 'default' ? 'priority' : 'default')}
                        className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold px-3 py-1 rounded-full hover:bg-white/10 transition"
                        aria-label={`Sort projects by ${projectSortBy === 'default' ? 'priority' : 'date'}`}
                    >
                        Sort by: {projectSortBy === 'default' ? 'Default' : 'Priority'}
                    </button>
                </div>
                
                <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {(
                        projectStatusFilter === 'active' ? activeProjects :
                        projectStatusFilter === 'completed' ? visibleCompletedProjects :
                        visibleDueProjects
                    ).map(project => (
                        <li key={project.id}>
                            <ProjectItem project={project} tasks={allTasks} onUpdateProject={onUpdateProject} onDeleteProject={onDeleteProject} />
                        </li>
                    ))}
                    {(
                        projectStatusFilter === 'active' ? activeProjects :
                        projectStatusFilter === 'completed' ? visibleCompletedProjects :
                        visibleDueProjects
                    ).length === 0 && <p className="text-center text-white/60 p-4">No projects match the current filter.</p>}
                </ul>
            </Panel>
            
            {isLoadingStats ? <Spinner /> : (
                <ProjectTimeAnalysisDashboard allProjects={projects} allTasks={allTasks} allHistory={allHistory} />
            )}
        </div>
    );
};

export default GoalsPage;