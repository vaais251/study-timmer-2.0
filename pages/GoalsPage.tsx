

import React, { useState, useMemo, useEffect } from 'react';
import { Goal, Target, Project, Task, PomodoroHistory, Commitment } from '../types';
import Panel from '../components/common/Panel';
import { TrashIcon, EditIcon, StarIcon, LockIcon, CheckIcon } from '../components/common/Icons';
import * as dbService from '../services/dbService';
import Spinner from '../components/common/Spinner';

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
    const [dateRange, setDateRange] = useState({ start: getDaysAgo(30), end: new Date().toISOString().split('T')[0] });
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

        return allProjects.map(p => ({
            ...p,
            timeSpent: timePerProject.get(p.id) || 0,
            targetTime: p.completion_criteria_type === 'duration_minutes' ? p.completion_criteria_value : null
        }));
    }, [allProjects, allTasks, allHistory, dateRange]);
    
    const filteredProjectData = useMemo(() => {
        return projectTimeData.filter(p => p.status === statusFilter);
    }, [projectTimeData, statusFilter]);

    const handleSetRange = (days: number | null) => {
        if (days === null) {
            setDateRange({ start: '', end: '' });
        } else {
            setDateRange({ start: getDaysAgo(days), end: new Date().toISOString().split('T')[0] });
        }
    };
    
    const ProjectTimeBar: React.FC<{project: typeof projectTimeData[0]}> = ({ project }) => {
        const progress = (project.targetTime && project.targetTime > 0)
            ? Math.min(100, (project.timeSpent / project.targetTime) * 100)
            : -1;
        
        return (
             <div className="bg-black/20 p-3 rounded-lg">
                <div className="flex justify-between items-center text-sm mb-1">
                    <span className="font-bold text-white truncate pr-2">{project.name}</span>
                    <span className="text-white/80 whitespace-nowrap">
                        {project.timeSpent}m
                        {progress !== -1 && ` / ${project.targetTime}m`}
                    </span>
                </div>
                {progress !== -1 ? (
                    <div className="w-full bg-black/30 rounded-full h-2.5 shadow-inner">
                        <div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2.5 rounded-full" style={{width: `${progress}%`}}></div>
                    </div>
                ) : null}
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
                    <button onClick={() => handleSetRange(7)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white">Last 7 Days</button>
                    <button onClick={() => handleSetRange(30)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white">Last 30 Days</button>
                    <button onClick={() => handleSetRange(new Date().getDate() - 1)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white">This Month</button>
                    <button onClick={() => handleSetRange(null)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white">All Time</button>
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


interface ProjectItemProps {
    project: Project;
    onUpdateProject: (id: string, updates: Partial<Project>) => void;
    onDeleteProject: (id: string) => void;
}

const ProjectItem: React.FC<ProjectItemProps> = ({ project, onUpdateProject, onDeleteProject }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(project.name);
    const [editDeadline, setEditDeadline] = useState(project.deadline || '');
    const [editCriteriaType, setEditCriteriaType] = useState(project.completion_criteria_type);
    const [editCriteriaValue, setEditCriteriaValue] = useState(project.completion_criteria_value?.toString() || '');

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
            deadline: editDeadline || null,
            completion_criteria_type: editCriteriaType,
            completion_criteria_value: value
        };
        onUpdateProject(project.id, updates);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditName(project.name);
        setEditDeadline(project.deadline || '');
        setEditCriteriaType(project.completion_criteria_type);
        setEditCriteriaValue(project.completion_criteria_value?.toString() || '');
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="bg-white/20 p-3 rounded-lg ring-2 ring-cyan-400 space-y-2">
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Project Name" className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
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
                <div className="flex justify-end gap-2 text-sm mt-2">
                    <button onClick={handleCancel} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-gray-500 to-gray-600">Cancel</button>
                    <button onClick={handleSave} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-cyan-600">Save</button>
                </div>
            </div>
        );
    }
    
    const bgColor = isComplete ? 'bg-white/5 text-white/50' : isDue ? 'bg-red-900/40' : 'bg-white/10';

    return (
        <div className={`p-3 rounded-lg ${bgColor} transition-all`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-grow min-w-0">
                    {isManual && (
                        <input 
                            type="checkbox" 
                            checked={isComplete} 
                            onChange={handleManualCompleteToggle} 
                            disabled={!isEditable}
                            className="h-5 w-5 rounded bg-white/20 border-white/30 text-green-400 focus:ring-green-400 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed" 
                            aria-label={`Mark project ${project.name} as complete`}
                        />
                    )}
                    <div className="flex-grow min-w-0">
                        <span className={`text-white ${isComplete ? 'line-through' : ''}`}>{project.name}</span>
                        {project.deadline && (
                            <span className={`block text-xs mt-1 ${isDue && !isComplete ? 'text-red-400 font-bold' : 'text-amber-300/80'}`}>
                                Due: {new Date(project.deadline + 'T00:00:00').toLocaleDateString()}
                            </span>
                        )}
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
    
    const todayString = new Date().toISOString().split('T')[0];
    const isCompleted = !!target.completed_at;
    const isDue = !isCompleted && target.deadline < todayString;
    const isOld = isOlderThanOrEqualToTwoDays(target.created_at);

    const handleSave = () => {
        if (!editText.trim() || !editDeadline) {
            alert("Target text and deadline cannot be empty.");
            return;
        }
        onUpdateTarget(target.id, { text: editText.trim(), deadline: editDeadline });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditText(target.text);
        setEditDeadline(target.deadline);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <li className="bg-white/20 p-3 rounded-lg ring-2 ring-cyan-400 space-y-2">
                <input type="text" value={editText} onChange={e => setEditText(e.target.value)} placeholder="Target description" className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                <div className="flex justify-end gap-2 text-sm mt-2">
                    <button onClick={handleCancel} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-gray-500 to-gray-600">Cancel</button>
                    <button onClick={handleSave} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-cyan-600">Save</button>
                </div>
            </li>
        );
    }
    
    let bgColor = 'bg-white/10';
    let textColor = 'text-white';
    if (isCompleted) {
        bgColor = 'bg-white/5 text-white/50';
    } else if (isDue) {
        bgColor = 'bg-red-900/40';
        textColor = 'text-red-300';
    }

    return (
        <li className={`flex items-center justify-between p-3 rounded-lg transition-all ${bgColor}`}>
            <div className="flex items-center gap-3 flex-grow min-w-0">
                <input 
                    type="checkbox" 
                    checked={isCompleted} 
                    onChange={(e) => onUpdateTarget(target.id, { completed_at: e.target.checked ? new Date().toISOString() : null })} 
                    disabled={isCompleted || isDue || isOld}
                    className="h-5 w-5 rounded bg-white/20 border-white/30 text-green-400 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0" 
                />
                <span className={`${isCompleted ? 'line-through' : ''} ${textColor}`}>
                    {target.text}
                </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {isDue && <span className="text-xs bg-red-500/50 text-white px-2 py-1 rounded-full font-bold">DUE</span>}
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
}> = ({ goal, onUpdateGoal, onDeleteGoal }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(goal.text);
    const isOld = isOlderThanOrEqualToTwoDays(goal.created_at);

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
        <li className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-4 transform transition-all hover:scale-[1.02] hover:shadow-2xl hover:border-white/20">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-grow min-w-0">
                    <div className="text-amber-300 mt-1 flex-shrink-0">
                        <StarIcon />
                    </div>
                    <p className="text-white/90 font-medium text-base flex-grow break-words">{goal.text}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                     <button onClick={() => setIsEditing(true)} disabled={isOld} className="p-2 rounded-full text-sky-300 hover:bg-sky-500/20 transition disabled:text-sky-300/30 disabled:cursor-not-allowed" title={isOld ? "Editing is disabled for old goals" : "Edit Goal"}><EditIcon /></button>
                     <button onClick={() => onDeleteGoal(goal.id)} className="p-2 rounded-full text-red-400 hover:bg-red-500/20 transition" title="Delete Goal"><TrashIcon /></button>
                </div>
            </div>
        </li>
    );
};

// --- Commitments Components ---
const CommitmentItem: React.FC<{
    commitment: Commitment;
    onUpdate: (id: string, updates: { text: string; dueDate: string | null; }) => void;
    onDelete: (id: string) => void;
}> = ({ commitment, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(commitment.text);
    const [editDueDate, setEditDueDate] = useState(commitment.due_date || '');

    const { isEditable, reason } = useMemo(() => {
        const ageInMillis = new Date().getTime() - new Date(commitment.created_at).getTime();
        const oneDayInMillis = 24 * 60 * 60 * 1000;
        const twentyOneDaysInMillis = 21 * oneDayInMillis;
        
        if (ageInMillis <= oneDayInMillis) {
            return { isEditable: true, reason: 'Editable for the first 24 hours.' };
        }
        if (ageInMillis > twentyOneDaysInMillis) {
            return { isEditable: true, reason: 'Editing re-enabled after 21 days.' };
        }
        
        const daysRemaining = Math.ceil((twentyOneDaysInMillis - ageInMillis) / oneDayInMillis);
        return { isEditable: false, reason: `Locked for reflection. Unlocks in ${daysRemaining} day(s).` };
    }, [commitment.created_at]);
    

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

    return (
        <li className="flex items-start justify-between gap-4 p-4 rounded-lg bg-black/20">
            <div className="flex-grow min-w-0">
                <p className="text-white">{commitment.text}</p>
                <div className="text-xs text-white/60 mt-1 flex gap-4">
                    <span>Committed: {new Date(commitment.created_at).toLocaleDateString()}</span>
                    {commitment.due_date && <span>Due: {new Date(commitment.due_date+'T00:00:00').toLocaleDateString()}</span>}
                </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                {isEditable ? (
                    <>
                        <button onClick={() => setIsEditing(true)} className="p-2 text-sky-300 hover:text-sky-200 transition" title="Edit Commitment"><EditIcon /></button>
                        <button onClick={() => onDelete(commitment.id)} className="p-2 text-red-400 hover:text-red-300 transition" title="Delete Commitment"><TrashIcon /></button>
                    </>
                ) : (
                    <div className="p-2 text-amber-400 flex items-center gap-2 text-sm" title={reason}>
                        <LockIcon />
                        <span className="hidden sm:inline">Locked</span>
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
}> = ({ commitments, onAdd, onUpdate, onDelete }) => {
    const [newCommitment, setNewCommitment] = useState('');
    const [newDueDate, setNewDueDate] = useState('');

    const handleAdd = () => {
        if (newCommitment.trim()) {
            onAdd(newCommitment.trim(), newDueDate || null);
            setNewCommitment('');
            setNewDueDate('');
        }
    };

    return (
        <Panel title="💪 My Commitments">
            <p className="text-white/80 text-center text-sm mb-4">What will you hold yourself accountable for today? Commitments lock after 24 hours.</p>
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
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {commitments.map(c => <CommitmentItem key={c.id} commitment={c} onUpdate={onUpdate} onDelete={onDelete} />)}
                {commitments.length === 0 && <p className="text-center text-white/60 p-4">Make a commitment to start your day with intention.</p>}
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
    onAddTarget: (text: string, deadline: string) => void;
    onUpdateTarget: (id: string, updates: Partial<Target>) => void;
    onDeleteTarget: (id: string) => void;
    onAddProject: (name: string, deadline: string | null, criteria: {type: Project['completion_criteria_type'], value: number | null}) => Promise<string | null>;
    onUpdateProject: (id: string, updates: Partial<Project>) => void;
    onDeleteProject: (id: string) => void;
    onAddCommitment: (text: string, dueDate: string | null) => void;
    onUpdateCommitment: (id: string, updates: { text: string; dueDate: string | null; }) => void;
    onDeleteCommitment: (id: string) => void;
}

const GoalsPage: React.FC<GoalsPageProps> = (props) => {
    const { goals, targets, projects, commitments, onAddGoal, onUpdateGoal, onDeleteGoal, onAddTarget, onUpdateTarget, onDeleteTarget, onAddProject, onUpdateProject, onDeleteProject, onAddCommitment, onUpdateCommitment, onDeleteCommitment } = props;

    const [newGoal, setNewGoal] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newDeadline, setNewDeadline] = useState('');
    
    // Project form state
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDeadline, setNewProjectDeadline] = useState('');
    const [criteriaType, setCriteriaType] = useState<Project['completion_criteria_type']>('manual');
    const [criteriaValue, setCriteriaValue] = useState('');
    
    // Data for stats dashboard
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [allHistory, setAllHistory] = useState<PomodoroHistory[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    // Project list filter
    const [projectStatusFilter, setProjectStatusFilter] = useState<'active' | 'completed' | 'due'>('active');

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

            onAddProject(newProjectName.trim(), newProjectDeadline || null, { type: criteriaType, value });
            
            // Reset form
            setNewProjectName('');
            setNewProjectDeadline('');
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
            onAddTarget(newTarget.trim(), newDeadline);
            setNewTarget('');
            setNewDeadline('');
        }
    };

    const filteredProjects = useMemo(() => {
        return projects.filter(p => p.status === projectStatusFilter);
    }, [projects, projectStatusFilter]);
    
    const sortedTargets = useMemo(() => {
        const todayString = new Date().toISOString().split('T')[0];
        return [...targets].sort((a, b) => {
            const aIsCompleted = !!a.completed_at;
            const bIsCompleted = !!b.completed_at;
            const aIsDue = !aIsCompleted && a.deadline < todayString;
            const bIsDue = !bIsCompleted && b.deadline < todayString;

            // Group by status: active -> due -> completed
            if (aIsCompleted !== bIsCompleted) return aIsCompleted ? 1 : -1;
            if (!aIsCompleted && aIsDue !== bIsDue) return aIsDue ? 1 : -1;
            
            // Within each group, sort by deadline
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
    }, [targets]);

    const upcomingDeadlines = useMemo(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowString = tomorrow.toISOString().split('T')[0];

        const projectsDue = projects.filter(p => p.status === 'active' && p.deadline === tomorrowString);
        const targetsDue = targets.filter(t => !t.completed_at && t.deadline === tomorrowString);

        return [...projectsDue, ...targetsDue];
    }, [projects, targets]);

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
            
            <Panel title="🎯 My Core Goals">
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
                <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                    {goals.map(goal => (
                        <GoalItem key={goal.id} goal={goal} onUpdateGoal={onUpdateGoal} onDeleteGoal={onDeleteGoal} />
                    ))}
                    {goals.length === 0 && <p className="text-center text-white/60 p-4 col-span-full">Define your core purpose. What are you striving for?</p>}
                </ul>
            </Panel>

            <Panel title="🏁 Key Targets">
                 <p className="text-white/80 text-center text-sm mb-4">Specific, measurable objectives with a deadline.</p>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                        type="text"
                        value={newTarget}
                        onChange={(e) => setNewTarget(e.target.value)}
                        placeholder="e.g., Finish history essay draft"
                        className="flex-grow bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                    />
                    <input
                        type="date"
                        value={newDeadline}
                        onChange={(e) => setNewDeadline(e.target.value)}
                        className="bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 w-full sm:w-auto text-center"
                        style={{colorScheme: 'dark'}}
                    />
                    <button onClick={handleAddTarget} className="p-3 sm:px-4 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-cyan-600">Add Target</button>
                </div>
                 <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {sortedTargets.map(target => (
                        <TargetItem 
                            key={target.id}
                            target={target}
                            onUpdateTarget={onUpdateTarget}
                            onDeleteTarget={onDeleteTarget}
                        />
                    ))}
                    {targets.length === 0 && <p className="text-center text-white/60 p-4">No key targets defined yet.</p>}
                </ul>
            </Panel>

            <Panel title="📂 Project Management">
                <div className="bg-black/20 p-4 rounded-xl mb-4">
                    <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Add a new project..."
                        className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50 mb-2"
                    />
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                        <input
                            type="date"
                            value={newProjectDeadline}
                            onChange={(e) => setNewProjectDeadline(e.target.value)}
                            className="bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 w-full text-center"
                            style={{colorScheme: 'dark'}}
                            title="Optional deadline"
                        />
                         <select value={criteriaType} onChange={e => setCriteriaType(e.target.value as any)} className="bg-white/20 border border-white/30 rounded-lg p-3 text-white focus:outline-none focus:bg-white/30 focus:border-white/50 w-full">
                            <option value="manual" className="bg-gray-800">Manual Completion</option>
                            <option value="task_count" className="bg-gray-800">By Task Count</option>
                            <option value="duration_minutes" className="bg-gray-800">By Time Duration</option>
                        </select>
                    </div>
                     {criteriaType !== 'manual' && (
                         <input
                            type="number"
                            value={criteriaValue}
                            onChange={(e) => setCriteriaValue(e.target.value)}
                            placeholder={criteriaType === 'task_count' ? 'Number of tasks to complete' : 'Minutes of focus to complete'}
                            className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50 mb-2"
                        />
                     )}
                     <button onClick={handleAddProject} className="w-full p-3 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-purple-500 to-indigo-600">Add Project</button>
                </div>

                <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full">
                    {(['active', 'completed', 'due'] as const).map(status => (
                        <button key={status} onClick={() => setProjectStatusFilter(status)} className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${projectStatusFilter === status ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)} ({projects.filter(p => p.status === status).length})
                        </button>
                    ))}
                </div>

                 <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {filteredProjects.map(project => (
                        <ProjectItem
                            key={project.id}
                            project={project}
                            onUpdateProject={onUpdateProject}
                            onDeleteProject={onDeleteProject}
                        />
                    ))}
                    {filteredProjects.length === 0 && <p className="text-center text-sm text-white/60 py-2">No {projectStatusFilter} projects.</p>}
                </div>
            </Panel>
            
            {isLoadingStats ? <Spinner /> : 
                <ProjectTimeAnalysisDashboard 
                    allProjects={projects} 
                    allTasks={allTasks} 
                    allHistory={allHistory} 
                />
            }
            
            <CommitmentsPanel
                commitments={commitments}
                onAdd={onAddCommitment}
                onUpdate={onUpdateCommitment}
                onDelete={onDeleteCommitment}
            />
            
             <style>{`
              @keyframes pulse-slow {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.02); opacity: 0.95; }
              }
              .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

export default GoalsPage;