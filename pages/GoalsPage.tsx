import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Goal, Target, Project, Task, PomodoroHistory, ProjectUpdate, Commitment } from '../types';
import Panel from '../components/common/Panel';
import { TrashIcon, EditIcon, StarIcon, LockIcon, CheckIcon, TargetIcon as GoalsIcon, RescheduleIcon, CalendarIcon, FilledStarIcon } from '../components/common/Icons';
import * as dbService from '../services/dbService';
import Spinner from '../components/common/Spinner';
import { getTodayDateString, getMonthStartDateString } from '../utils/date';
import PrioritySelector from '../components/common/PrioritySelector';
import ExplanationTooltip from '../components/common/ExplanationTooltip';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';


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

const isOverdueMoreThanTwoDays = (dateString: string): boolean => {
    if (!dateString) return false;
    const itemDate = new Date(dateString + 'T00:00:00Z'); // Treat date as UTC start of day
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Get UTC start of today

    if (itemDate >= today) return false; // Not overdue

    const diffTime = today.getTime() - itemDate.getTime();
    // Use floor to count full days passed
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 2; // More than 2 full days have passed
};


const getProjectDurationText = (project: Project): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start date is either specified or the creation date.
    const startDate = new Date((project.start_date || project.created_at.split('T')[0]) + 'T00:00:00');
    
    // 1. Upcoming projects
    if (project.start_date && startDate > today) {
         return `Starts on ${startDate.toLocaleDateString()}`;
    }
    
    // 2. Completed or Due projects have a fixed duration
    let fixedEndDate: Date | null = null;
    if (project.status === 'completed' && project.completed_at) {
        fixedEndDate = new Date(project.completed_at);
    } else if (project.status === 'due' && project.deadline) {
        fixedEndDate = new Date(project.deadline + 'T00:00:00');
    }

    if (fixedEndDate) {
        const effectiveStartDate = startDate > fixedEndDate ? new Date(project.created_at) : startDate;
        
        // Normalize dates to midnight to count days inclusively
        const endDay = new Date(fixedEndDate);
        endDay.setHours(0,0,0,0);
        const startDay = new Date(effectiveStartDate);
        startDay.setHours(0,0,0,0);
        
        const diffTime = endDay.getTime() - startDay.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        const dayCount = diffDays + 1;
        
        if (dayCount <= 0) return 'Took less than a day';
        return `Took ${dayCount} day${dayCount > 1 ? 's' : ''}`;
    }

    // 3. Active, ongoing projects
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    const dayCount = diffDays + 1;
    if (dayCount <= 0) return 'Started today';
    
    return `Ongoing for ${dayCount} day${dayCount > 1 ? 's' : ''}`;
};

const DeadlineItemCard: React.FC<{ item: (Project & { itemType: 'project' }) | (Target & { itemType: 'target' }) }> = ({ item }) => {
    const { daysLeft, isOverdue, timeProgress } = useMemo(() => {
        const deadline = new Date(item.deadline + 'T00:00:00Z');
        const startDateString = item.start_date || item.created_at.split('T')[0];
        const startDate = new Date(startDateString + 'T00:00:00Z');
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const msPerDay = 1000 * 60 * 60 * 24;

        const totalDuration = Math.max(1, (deadline.getTime() - startDate.getTime()) / msPerDay);
        const elapsedDuration = (today.getTime() - startDate.getTime()) / msPerDay;

        const progress = totalDuration > 0 ? Math.min(100, (elapsedDuration / totalDuration) * 100) : 0;
        
        const remainingMs = deadline.getTime() - today.getTime();
        const daysRemaining = Math.round(remainingMs / msPerDay);
        
        return {
            daysLeft: daysRemaining,
            isOverdue: daysRemaining < 0,
            timeProgress: Math.max(0, progress)
        };
    }, [item]);
    
    const name = item.itemType === 'project' ? item.name : item.text;

    let urgencyClass = 'border-l-cyan-400';
    let urgencyText = `${daysLeft} days left`;
    let urgencyTextClass = 'text-white';
    
    if (isOverdue) {
        urgencyClass = 'border-l-red-500';
        urgencyText = `${Math.abs(daysLeft)} days overdue`;
        urgencyTextClass = 'text-red-400';
    } else if (daysLeft <= 3) {
        urgencyClass = 'border-l-amber-500';
        urgencyTextClass = 'text-amber-400';
    }

    if (daysLeft === 0) urgencyText = "Due today";
    if (daysLeft === 1) urgencyText = "1 day left";
    
    const badgeClass = item.itemType === 'project' ? 'bg-blue-500/30 text-blue-300' : 'bg-purple-500/30 text-purple-300';

    return (
        <div className={`bg-slate-800/50 rounded-lg p-4 border-l-4 ${urgencyClass} space-y-3`}>
            <div className="flex justify-between items-start gap-4">
                <div className="flex-grow">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badgeClass}`}>{item.itemType}</span>
                    <h4 className="text-white font-bold mt-1">{name}</h4>
                </div>
                <div className="text-right flex-shrink-0">
                    <div className={`font-bold text-lg ${urgencyTextClass}`}>{urgencyText}</div>
                    <div className="text-xs text-slate-400">Deadline: {new Date(item.deadline + 'T00:00:00').toLocaleDateString()}</div>
                </div>
            </div>
            <div>
                 <div className="flex justify-between items-center mb-1 text-xs text-slate-400">
                    <span>Timeline</span>
                    <span>{timeProgress.toFixed(0)}% elapsed</span>
                </div>
                <div className="w-full bg-black/30 rounded-full h-2.5 shadow-inner">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : daysLeft <= 3 ? 'bg-amber-500' : 'bg-cyan-500'}`}
                        style={{ width: `${timeProgress}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};


const ProjectDailyFocusChart: React.FC<{
    projectId: string | null;
    projectName: string | null;
    allTasks: Task[];
    allHistory: PomodoroHistory[];
}> = ({ projectId, projectName, allTasks, allHistory }) => {
    const chartData = useMemo(() => {
        if (!projectId) return [];

        const projectTaskIds = new Set(
            allTasks.filter(t => t.project_id === projectId).map(t => t.id)
        );

        if (projectTaskIds.size === 0) return [];

        const dataByDate = new Map<string, number>();

        const historyForProject = allHistory.filter(h => h.task_id && projectTaskIds.has(h.task_id));

        for (const h of historyForProject) {
            const date = h.ended_at.split('T')[0];
            const minutes = Number(h.duration_minutes) || 0;
            
            if (minutes > 0) {
                dataByDate.set(date, (dataByDate.get(date) || 0) + minutes);
            }
        }
        
        return Array.from(dataByDate.entries())
            .map(([date, minutes]) => ({
                date,
                displayDate: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                minutes,
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    }, [projectId, allTasks, allHistory]);

    if (!projectId) {
        return null;
    }

    return (
        <div className="mt-8 pt-6 border-t border-slate-700 animate-fadeIn">
             <h3 className="text-lg font-bold text-white text-center mb-4">Daily Focus Minutes: <span className="text-cyan-300">{projectName}</span></h3>
            {chartData.length === 0 ? (
                 <div className="p-4 text-center text-sm text-white/60 bg-black/20 rounded-lg">
                    No focus time recorded for "{projectName}".
                </div>
            ) : (
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="displayDate" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                            <YAxis stroke="rgba(255,255,255,0.7)" unit="m" allowDecimals={false} />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                                contentStyle={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                                itemStyle={{ color: '#67e8f9' }} // cyan-300
                                labelStyle={{ color: 'white', fontWeight: 'bold' }}
                            />
                            <Bar dataKey="minutes" fill="#22d3ee" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

const ProjectBurndownChart: React.FC<{
    project: Project | undefined;
    allTasks: Task[];
    allHistory: PomodoroHistory[];
}> = ({ project, allTasks, allHistory }) => {
    const chartData = useMemo(() => {
        if (!project || !project.deadline || (project.completion_criteria_type !== 'task_count' && project.completion_criteria_type !== 'duration_minutes') || !project.completion_criteria_value) {
            return null;
        }

        const startDate = new Date((project.start_date || project.created_at.split('T')[0]) + 'T00:00:00');
        const deadline = new Date(project.deadline + 'T00:00:00');
        
        if (startDate > deadline) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const completionDate = project.completed_at ? new Date(project.completed_at) : null;
        if (completionDate) completionDate.setHours(0, 0, 0, 0);
        
        const totalWork = project.completion_criteria_value;
        const totalDays = Math.max(1, Math.round((deadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const idealBurnPerDay = totalWork / (totalDays > 1 ? totalDays - 1 : 1);

        const data: any[] = [];
        
        const projectTasks = allTasks.filter(t => t.project_id === project.id);
        
        const workCompletedByDate = new Map<string, number>();
        if (project.completion_criteria_type === 'task_count') {
            projectTasks.forEach(t => {
                if (t.completed_at) {
                    const dateStr = t.completed_at.split('T')[0];
                    workCompletedByDate.set(dateStr, (workCompletedByDate.get(dateStr) || 0) + 1);
                }
            });
        } else { // duration_minutes
            const projectTaskIds = new Set(projectTasks.map(t => t.id));
            const projectHistory = allHistory.filter(h => h.task_id && projectTaskIds.has(h.task_id));
            projectHistory.forEach(h => {
                const dateStr = h.ended_at.split('T')[0];
                workCompletedByDate.set(dateStr, (workCompletedByDate.get(dateStr) || 0) + (Number(h.duration_minutes) || 0));
            });
        }

        let cumulativeCompletedWork = 0;

        for (let i = 0; i < totalDays; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateString = currentDate.toISOString().split('T')[0];
            
            const idealRemaining = Math.max(0, totalWork - (i * idealBurnPerDay));
            
            let actualRemaining;
            
            if (completionDate && currentDate >= completionDate) {
                actualRemaining = 0;
            } 
            else if (!completionDate && currentDate > today) {
                actualRemaining = null;
            } 
            else {
                cumulativeCompletedWork += workCompletedByDate.get(dateString) || 0;
                actualRemaining = Math.max(0, totalWork - cumulativeCompletedWork);
            }

            data.push({
                date: new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                ideal: idealRemaining,
                actual: actualRemaining,
            });
        }
        return data;
    }, [project, allTasks, allHistory]);

    if (!project || (project.completion_criteria_type !== 'task_count' && project.completion_criteria_type !== 'duration_minutes')) {
        return null; // Don't show for manual projects
    }
    
    if (!chartData) {
        return (
            <div className="mt-8 pt-6 border-t border-slate-700">
                <h3 className="text-lg font-bold text-white text-center mb-4">Project Burndown</h3>
                <div className="p-4 text-center text-sm text-white/60 bg-black/20 rounded-lg h-64 flex items-center justify-center">
                    <p>A burndown chart requires a deadline to be set for the project.</p>
                </div>
            </div>
        );
    }

    const yAxisLabel = project.completion_criteria_type === 'task_count' ? 'Tasks Remaining' : 'Minutes Remaining';

    return (
        <div className="mt-8 pt-6 border-t border-slate-700 animate-fadeIn">
            <h3 className="text-lg font-bold text-white text-center mb-4">Project Burndown</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                        <YAxis stroke="rgba(255,255,255,0.7)" allowDecimals={false} label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.7)', dy: 40 }} />
                        <Tooltip
                            contentStyle={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                            itemStyle={{ color: 'white' }}
                            labelStyle={{ color: 'white', fontWeight: 'bold' }}
                            formatter={(value: number, name: string) => [value !== null ? Math.round(value) : 'N/A', name.charAt(0).toUpperCase() + name.slice(1)]}
                        />
                        <Legend />
                        <Line type="monotone" name="Ideal" dataKey="ideal" stroke="#a78bfa" strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} />
                        <Line type="monotone" name="Actual" dataKey="actual" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 8 }} connectNulls={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const TargetBurndownChart: React.FC<{
    target: Target | undefined;
    allTasks: Task[];
    allHistory: PomodoroHistory[];
}> = ({ target, allTasks, allHistory }) => {
     const chartData = useMemo(() => {
        if (!target || !target.deadline || target.completion_mode !== 'focus_minutes' || !target.target_minutes) {
            return null;
        }

        const startDate = new Date((target.start_date || target.created_at.split('T')[0]) + 'T00:00:00');
        const deadline = new Date(target.deadline + 'T00:00:00');

        if (startDate > deadline) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const completionDate = target.completed_at ? new Date(target.completed_at) : null;
        if (completionDate) completionDate.setHours(0, 0, 0, 0);

        const totalWork = target.target_minutes;
        const totalDays = Math.max(1, Math.round((deadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const idealBurnPerDay = totalWork / (totalDays > 1 ? totalDays - 1 : 1);

        const data: any[] = [];

        const targetTags = new Set(target.tags?.map(t => t.toLowerCase()));
        const relevantTaskIds = new Set(
            allTasks.filter(t => t.tags?.some(tag => targetTags.has(tag.toLowerCase()))).map(t => t.id)
        );
        
        const workCompletedByDate = new Map<string, number>();
        const relevantHistory = allHistory.filter(h => h.task_id && relevantTaskIds.has(h.task_id));
        relevantHistory.forEach(h => {
            const dateStr = h.ended_at.split('T')[0];
            workCompletedByDate.set(dateStr, (workCompletedByDate.get(dateStr) || 0) + (Number(h.duration_minutes) || 0));
        });

        let cumulativeCompletedWork = 0;

        for (let i = 0; i < totalDays; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateString = currentDate.toISOString().split('T')[0];

            const idealRemaining = Math.max(0, totalWork - (i * idealBurnPerDay));
            
            let actualRemaining;
            
            if (completionDate && currentDate >= completionDate) {
                actualRemaining = 0;
            } 
            else if (!completionDate && currentDate > today) {
                actualRemaining = null;
            } 
            else {
                cumulativeCompletedWork += workCompletedByDate.get(dateString) || 0;
                actualRemaining = Math.max(0, totalWork - cumulativeCompletedWork);
            }

            data.push({
                date: new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                ideal: idealRemaining,
                actual: actualRemaining,
            });
        }
        return data;
    }, [target, allTasks, allHistory]);

    if (target?.completion_mode !== 'focus_minutes') {
        return null; // Don't render for manual targets
    }

    if (!chartData) {
        return (
            <div className="mt-8 pt-6 border-t border-slate-700">
                <h3 className="text-lg font-bold text-white text-center mb-4">Target Burndown</h3>
                <div className="p-4 text-center text-sm text-white/60 bg-black/20 rounded-lg h-64 flex items-center justify-center">
                    <p>A burndown chart requires a deadline to be set for the target.</p>
                </div>
            </div>
        );
    }
    
    return (
         <div className="mt-8 pt-6 border-t border-slate-700 animate-fadeIn">
            <h3 className="text-lg font-bold text-white text-center mb-4">Target Burndown</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                        <YAxis stroke="rgba(255,255,255,0.7)" allowDecimals={false} label={{ value: 'Minutes Remaining', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.7)', dy: 40 }} />
                        <Tooltip
                            contentStyle={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                            itemStyle={{ color: 'white' }}
                            labelStyle={{ color: 'white', fontWeight: 'bold' }}
                            formatter={(value: number, name: string) => [value !== null ? Math.round(value) : 'N/A', name.charAt(0).toUpperCase() + name.slice(1)]}
                        />
                        <Legend />
                        <Line type="monotone" name="Ideal" dataKey="ideal" stroke="#a78bfa" strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} />
                        <Line type="monotone" name="Actual" dataKey="actual" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 8 }} connectNulls={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}


const ActivityLog: React.FC<{ projectId: string, tasks: Task[] }> = ({ projectId, tasks }) => {
    const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
    const [taskFocusTimes, setTaskFocusTimes] = useState<Map<string, number>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [newUpdateDesc, setNewUpdateDesc] = useState('');
    const [newUpdateDate, setNewUpdateDate] = useState(getTodayDateString());
    const [linkedTaskId, setLinkedTaskId] = useState<string>('none');
    const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
    
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
                         const task = update.task_id ? tasks.find(t => t.id === update.task_id) : null;
                         const focusTime = task ? taskFocusTimes.get(task.id) : null;
                         const focusTimeString = focusTime && focusTime > 0 ? ` - Focus: ${focusTime}m` : '';
                         const hasComments = task && task.comments && task.comments.length > 0;
                         const isExpanded = expandedUpdateId === update.id;
 
                         return (
                             <li
                                 key={update.id}
                                 className={`bg-black/20 rounded-md text-sm group relative transition-all duration-300 ${hasComments ? 'cursor-pointer hover:bg-black/40' : ''}`}
                                 onClick={() => hasComments && setExpandedUpdateId(isExpanded ? null : update.id)}
                             >
                                 <div className="p-2 flex justify-between items-start gap-2">
                                     <div className="flex items-start gap-2 flex-grow min-w-0">
                                         {hasComments && (
                                             <svg className={`w-3 h-3 mt-1 text-white/50 transform transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                                             </svg>
                                         )}
                                         <div className="flex-grow min-w-0">
                                             <p className="text-white/90 break-words">{update.description}</p>
                                             <p className="text-xs text-white/60 mt-1">
                                                 {new Date(update.update_date + 'T00:00:00').toLocaleDateString()}
                                                 {task ? <span className="italic"> - Ref: {task.text}</span> : (update.tasks ? ` - Ref: ${update.tasks.text}` : '')}
                                                 {focusTimeString && <span className="text-cyan-400 font-semibold">{focusTimeString}</span>}
                                             </p>
                                         </div>
                                     </div>
                                     <button onClick={(e) => { e.stopPropagation(); handleDeleteUpdate(update.id); }} className="p-1 text-red-400 hover:text-red-300 transition opacity-0 group-hover:opacity-100 flex-shrink-0" title="Delete Log Entry">
                                         <TrashIcon />
                                     </button>
                                 </div>
                                 
                                 {isExpanded && hasComments && task.comments && (
                                     <div className="px-2 pb-2 animate-fadeIn">
                                         <div className="bg-slate-900/50 ml-5 p-2 rounded-md border-l-2 border-cyan-400">
                                             <h5 className="text-xs font-bold text-white/70 mb-1">Session Notes:</h5>
                                             <ul className="list-disc list-inside ml-2 text-xs text-white/80 space-y-1">
                                                 {task.comments.map((comment, index) => (
                                                     <li key={index}>{comment}</li>
                                                 ))}
                                             </ul>
                                         </div>
                                     </div>
                                 )}
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
    1: 'border-red-500',
    2: 'border-amber-500',
    3: 'border-sky-500',
    4: 'border-slate-500',
};

const DaySelector: React.FC<{ selectedDays: number[], onDayToggle: (dayIndex: number) => void }> = ({ selectedDays, onDayToggle }) => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return (
        <div className="flex justify-center gap-1.5">
            {days.map((day, index) => {
                const isSelected = selectedDays.includes(index);
                return (
                    <button
                        key={index}
                        type="button"
                        onClick={() => onDayToggle(index)}
                        className={`w-9 h-9 rounded-full text-xs font-bold transition-all transform hover:scale-110 ${
                            isSelected ? 'bg-cyan-500 text-white shadow-md' : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                        }`}
                        title={`Toggle ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index]}`}
                    >
                        {day}
                    </button>
                );
            })}
        </div>
    );
};


interface ProjectItemProps {
    project: Project;
    tasks: Task[];
    onUpdateProject: (id: string, updates: Partial<Project>) => void;
    onDeleteProject: (id: string) => void;
    isSelected: boolean;
    onSelect: () => void;
    onSetPinnedItem: (id: string, itemType: 'project' | 'target') => void;
}

const ProjectItem: React.FC<ProjectItemProps> = ({ project, tasks, onUpdateProject, onDeleteProject, isSelected, onSelect, onSetPinnedItem }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(project.name);
    const [editDescription, setEditDescription] = useState(project.description || '');
    const [editStartDate, setEditStartDate] = useState(project.start_date || '');
    const [editDeadline, setEditDeadline] = useState(project.deadline || '');
    const [editCriteriaType, setEditCriteriaType] = useState(project.completion_criteria_type);
    const [editCriteriaValue, setEditCriteriaValue] = useState(project.completion_criteria_value?.toString() || '');
    const [editPriority, setEditPriority] = useState<number>(project.priority ?? 3);
    const [editActiveDays, setEditActiveDays] = useState<number[]>(project.active_days || []);
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
            start_date: editStartDate || null,
            deadline: editDeadline || null,
            completion_criteria_type: editCriteriaType,
            completion_criteria_value: value,
            priority: editPriority,
            active_days: editActiveDays.length > 0 ? editActiveDays : null,
        };
        onUpdateProject(project.id, updates);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditName(project.name);
        setEditDescription(project.description || '');
        setEditStartDate(project.start_date || '');
        setEditDeadline(project.deadline || '');
        setEditCriteriaType(project.completion_criteria_type);
        setEditCriteriaValue(project.completion_criteria_value?.toString() || '');
        setEditPriority(project.priority ?? 3);
        setEditActiveDays(project.active_days || []);
        setIsEditing(false);
    };

    const handleDayToggle = (dayIndex: number) => {
        setEditActiveDays(prev => 
            prev.includes(dayIndex) 
                ? prev.filter(d => d !== dayIndex)
                : [...prev, dayIndex]
        );
    };

    const activeDaysString = useMemo(() => {
        if (!project.active_days || project.active_days.length === 0) return null;
        const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return project.active_days.sort().map(d => dayMap[d]).join(', ');
    }, [project.active_days]);

    if (isEditing) {
        return (
            <div className="bg-white/20 p-3 rounded-xl ring-2 ring-cyan-400 space-y-3">
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Project Name" className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Project Description (Optional)" className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" rows={2}></textarea>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                    <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-white/70">Active Days (leave blank for all days)</label>
                    <DaySelector selectedDays={editActiveDays} onDayToggle={handleDayToggle} />
                </div>
                <select value={editCriteriaType} onChange={e => setEditCriteriaType(e.target.value as any)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white focus:outline-none focus:bg-white/30 focus:border-white/50 w-full">
                    <option value="manual" className="bg-gray-800">Manual</option>
                    <option value="task_count" className="bg-gray-800">Task Count</option>
                    <option value="duration_minutes" className="bg-gray-800">Time Duration</option>
                </select>
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
    
    const priorityClass = `border-l-4 ${priorityBorderColors[project.priority as number] ?? 'border-l-transparent'}`;
    const bgColor = isSelected ? 'bg-slate-700/50' : isComplete ? 'bg-slate-800/50' : isDue ? 'bg-red-900/40' : 'bg-slate-800';

    return (
        <div className={`rounded-xl ${priorityClass} ${bgColor} transition-all duration-300 ${isComplete ? 'opacity-60' : ''} ${isSelected ? 'ring-2 ring-cyan-400' : ''}`}>
            <div className="p-4 cursor-pointer" onClick={onSelect}>
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-grow min-w-0">
                         <h4 className={`font-bold text-lg ${isComplete ? 'line-through text-white/60' : 'text-white'}`}>{project.name}</h4>
                        <p className="text-xs text-white/50 mt-0.5">{getProjectDurationText(project)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={project.status} />
                        {isManual && (
                            <input 
                                type="checkbox" 
                                checked={isComplete} 
                                onChange={handleManualCompleteToggle} 
                                onClick={e => e.stopPropagation()}
                                disabled={!isEditable}
                                className="h-5 w-5 rounded bg-white/20 border-white/30 text-green-400 focus:ring-green-400 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed" 
                                aria-label={`Mark project ${project.name} as complete`}
                            />
                        )}
                    </div>
                </div>
                {project.description && <p className="text-sm text-white/70 mt-2 italic">{project.description}</p>}
                {!isManual && (
                    <div className="mt-4">
                        <div className="flex justify-between items-center mb-1 text-xs text-white/80">
                            <span>Progress</span>
                            <span className="font-semibold text-white">{progressText}</span>
                        </div>
                        <div className="w-full bg-black/30 rounded-full h-2.5 shadow-inner relative">
                            <div
                                className={`h-2.5 rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-cyan-400 to-blue-500'}`}
                                style={{ width: `${progress}%` }}
                            ></div>
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-black/50">{progress.toFixed(0)}%</div>
                        </div>
                    </div>
                )}
            </div>
             <div className="bg-black/20 px-4 py-2 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                    {project.deadline && <MetadataPill icon={<CalendarIcon/>} text={new Date(project.deadline + 'T00:00:00').toLocaleDateString()} />}
                    {activeDaysString && <MetadataPill icon={<span>📅</span>} text={activeDaysString} />}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onSetPinnedItem(project.id, 'project'); }} className="p-2 rounded-full text-yellow-400 hover:bg-yellow-500/20 transition" title="Pin to Spotlight">
                        {project.is_pinned ? <FilledStarIcon className="w-5 h-5" /> : <StarIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => setIsLogVisible(v => !v)} className="p-2 rounded-full text-slate-300 hover:bg-slate-700/50 transition" title="Toggle Activity Log">{isLogVisible ? '▼' : '►'}</button>
                    <button onClick={() => setIsEditing(true)} disabled={!isEditable} className="p-2 rounded-full text-sky-300 hover:bg-sky-500/20 transition disabled:text-sky-300/30 disabled:cursor-not-allowed" title={!isEditable ? "Editing is disabled for completed or old projects" : "Edit Project"}><EditIcon /></button>
                    <button onClick={() => {
                        if (window.confirm(`Are you sure you want to delete "${project.name}"? This will unlink it from all tasks.`)) {
                            onDeleteProject(project.id)
                        }
                    }} className="p-2 rounded-full text-red-400 hover:bg-red-500/20 transition" title="Delete Project"><TrashIcon /></button>
                 </div>
            </div>
            {isLogVisible && <div className="p-4 border-t border-slate-700"><ActivityLog projectId={project.id} tasks={tasks} /></div>}
        </div>
    );
};

const StatusBadge: React.FC<{ status: Project['status'] }> = ({ status }) => {
    const styles = {
        active: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
        completed: 'bg-green-500/20 text-green-300 border border-green-500/30',
        due: 'bg-red-500/20 text-red-300 border border-red-500/30',
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status]} capitalize`}>{status}</span>;
}

const MetadataPill: React.FC<{ icon: React.ReactNode, text: string, className?: string }> = ({ icon, text, className }) => {
    return (
        <span className={`inline-flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-full text-xs text-slate-300 ${className}`}>
            {icon}
            {text}
        </span>
    );
};

interface TargetItemProps {
    target: Target;
    onUpdateTarget: (id: string, updates: Partial<Target>) => void;
    onDeleteTarget: (id: string) => void;
    isSelected: boolean;
    onSelect: () => void;
    onSetPinnedItem: (id: string, itemType: 'project' | 'target') => void;
}

const TargetItem: React.FC<TargetItemProps> = ({ target, onUpdateTarget, onDeleteTarget, isSelected, onSelect, onSetPinnedItem }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(target.text);
    const [editDeadline, setEditDeadline] = useState(target.deadline);
    const [editPriority, setEditPriority] = useState<number>(target.priority ?? 3);
    const [editStartDate, setEditStartDate] = useState(target.start_date || '');
    const [editCompletionMode, setEditCompletionMode] = useState(target.completion_mode);
    const [editTags, setEditTags] = useState(target.tags?.join(', ') || '');
    const [editTargetMinutes, setEditTargetMinutes] = useState(target.target_minutes?.toString() || '');
    
    const isCompleted = target.status === 'completed';
    const isIncomplete = target.status === 'incomplete';
    const isOld = isOlderThanOrEqualToTwoDays(target.created_at);

    const handleSave = () => {
        if (!editText.trim() || !editDeadline) {
            alert("Target text and deadline cannot be empty.");
            return;
        }

        const updates: Partial<Target> = {
            text: editText.trim(),
            deadline: editDeadline,
            priority: editPriority,
            start_date: editStartDate || null,
            completion_mode: editCompletionMode,
        };
        
        if (editCompletionMode === 'focus_minutes') {
            const minutes = editTargetMinutes ? parseInt(editTargetMinutes, 10) : null;
            if (!minutes || minutes <= 0) {
                alert("Target duration must be a positive number of minutes.");
                return;
            }
            updates.tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
            updates.target_minutes = minutes;
        } else {
            updates.tags = null;
            updates.target_minutes = null;
        }

        onUpdateTarget(target.id, updates);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditText(target.text);
        setEditDeadline(target.deadline);
        setEditPriority(target.priority ?? 3);
        setEditStartDate(target.start_date || '');
        setEditCompletionMode(target.completion_mode);
        setEditTags(target.tags?.join(', ') || '');
        setEditTargetMinutes(target.target_minutes?.toString() || '');
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <li className="bg-white/20 p-3 rounded-lg ring-2 ring-cyan-400 space-y-3">
                <input type="text" value={editText} onChange={e => setEditText(e.target.value)} placeholder="Target description" className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-white/70 mb-1">Start Date</label>
                        <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                    </div>
                    <div>
                        <label className="text-xs text-white/70 mb-1">Deadline</label>
                        <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-white/70 mb-1">Completion Mode</label>
                    <select value={editCompletionMode} onChange={e => setEditCompletionMode(e.target.value as Target['completion_mode'])} className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white focus:outline-none focus:bg-white/30 focus:border-white/50">
                        <option value="manual" className="bg-gray-800">Manual</option>
                        <option value="focus_minutes" className="bg-gray-800">Focus Minutes</option>
                    </select>
                </div>
                {editCompletionMode === 'focus_minutes' && (
                    <div className="space-y-2 animate-fadeIn">
                        <input type="text" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="Tags (comma-separated)" className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                        <input type="number" value={editTargetMinutes} onChange={e => setEditTargetMinutes(e.target.value)} placeholder="Target Minutes" className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                    </div>
                )}
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
    
    let bgColor = 'bg-slate-800';
    let textColor = 'text-white';
    if (isCompleted) {
        bgColor = 'bg-slate-800/50 opacity-60';
    } else if (isIncomplete) {
        bgColor = 'bg-red-900/40';
        textColor = 'text-red-300';
    }
    const priorityClass = `border-l-4 ${priorityBorderColors[target.priority as number] ?? 'border-l-transparent'}`;

    const isTimeBased = target.completion_mode === 'focus_minutes';
    const progress = isTimeBased ? Math.min(100, ((target.progress_minutes || 0) / (target.target_minutes || 1)) * 100) : 0;
    const progressText = isTimeBased ? `${target.progress_minutes || 0} / ${target.target_minutes || 0} min` : '';
    const isEditable = !isCompleted && !isOld;

    return (
        <li className={`rounded-lg transition-all ${bgColor} ${priorityClass} ${isSelected ? 'ring-2 ring-cyan-400' : ''}`}>
            <div className="p-4 cursor-pointer" onClick={onSelect}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-grow min-w-0">
                        {!isTimeBased && (
                            <input 
                                type="checkbox" 
                                checked={isCompleted} 
                                onChange={(e) => {
                                    e.stopPropagation();
                                    onUpdateTarget(target.id, { completed_at: e.target.checked ? new Date().toISOString() : null })
                                }} 
                                disabled={!isEditable}
                                className="h-5 w-5 rounded bg-white/20 border-white/30 text-green-400 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mt-0.5" 
                            />
                        )}
                        <div className="flex-grow">
                            <span className={`${isCompleted ? 'line-through' : ''} ${textColor}`}>{target.text}</span>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70 mt-1">
                                {target.tags && target.tags.map(tag => <span key={tag} className="bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">{tag}</span>)}
                            </div>
                        </div>
                    </div>
                     <div className="flex flex-col items-end gap-2 flex-shrink-0">
                         <span className={`text-xs bg-black/20 px-2 py-1 rounded-full ${isIncomplete ? 'text-red-300' : ''}`}>{new Date(target.deadline + 'T00:00:00').toLocaleDateString()}</span>
                    </div>
                </div>
                {isTimeBased && !isCompleted && (
                     <div className="mt-2">
                        <div className="flex justify-between items-center mb-1 text-xs text-white/80">
                            <span>Progress</span>
                            <span>{progressText}</span>
                        </div>
                        <div className="w-full bg-black/30 rounded-full h-2.5 shadow-inner">
                            <div
                                className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>
             <div className="bg-black/20 px-4 py-1.5 flex justify-end items-center text-xs rounded-b-lg">
                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onSetPinnedItem(target.id, 'target'); }} className="p-2 rounded-full text-yellow-400 hover:bg-yellow-500/20 transition" title="Pin to Spotlight">
                        {target.is_pinned ? <FilledStarIcon className="w-5 h-5" /> : <StarIcon className="w-5 h-5" />}
                    </button>
                    {isEditable && <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-2 rounded-full text-sky-300 hover:bg-sky-500/20 transition" title="Edit Target"><EditIcon /></button>}
                    <button onClick={(e) => { e.stopPropagation(); onDeleteTarget(target.id); }} className="p-2 rounded-full text-red-400 hover:bg-red-500/20 transition" title="Delete Target"><TrashIcon /></button>
                </div>
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
             <li className="bg-slate-700/50 border border-cyan-400 rounded-xl p-4 ring-2 ring-cyan-400/50">
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
        <li className={`bg-slate-800 rounded-xl p-4 transition-all hover:bg-slate-700/50 ${isComplete ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-grow min-w-0">
                     <input
                        type="checkbox"
                        checked={isComplete}
                        onChange={(e) => onSetCompletion(goal.id, e.target.checked)}
                        className="h-6 w-6 rounded bg-slate-700 border-slate-600 text-green-400 focus:ring-green-400 flex-shrink-0 cursor-pointer mt-0.5"
                        aria-label={`Mark goal as ${isComplete ? 'incomplete' : 'complete'}`}
                    />
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
        active: 'border-l-cyan-400 bg-slate-800',
        completed: 'border-l-green-500 bg-slate-800/60 opacity-70',
        broken: 'border-l-red-500 bg-slate-800/60 opacity-70',
    };

    return (
        <li className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-lg border-l-4 ${statusStyles[commitment.status]}`}>
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
    
    const commitmentCounts = useMemo(() => ({
        active: commitments.filter(c => c.status === 'active').length,
        completed: commitments.filter(c => c.status === 'completed').length,
        broken: commitments.filter(c => c.status === 'broken').length,
    }), [commitments]);

    const handleAdd = () => {
        if (newCommitment.trim()) {
            onAdd(newCommitment.trim(), newDueDate || null);
            setNewCommitment('');
            setNewDueDate('');
        }
    };
    
    const visibleCommitments = useMemo(() => {
        return commitments.filter(c => c.status === view).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [commitments, view]);

    return (
        <Panel title="My Commitments">
            <details className="group bg-slate-900/30 rounded-xl transition-[max-height] duration-500 overflow-hidden mb-4">
                <summary className="p-3 font-semibold text-white cursor-pointer list-none flex justify-between items-center hover:bg-slate-700/20">
                    🤝 Add New Commitment
                    <svg className="w-4 h-4 text-white/70 transform transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </summary>
                <div className="p-4 border-t border-slate-700 space-y-3">
                    <p className="text-white/80 text-center text-sm">
                        What will you hold yourself accountable for? 
                        <ExplanationTooltip 
                            title="About Commitments"
                            content="Commitments are promises to yourself. They have a <strong>2-hour 'grace period'</strong> for edits, after which they lock to encourage reflection.<br/><br/>- After locking, you can mark a commitment as 'Completed' or 'Broken'.<br/>- If a due date is set, it completes automatically after it passes.<br/>- If no due date, you can manually complete it after one month."
                        />
                    </p>
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
            </details>

             <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full">
                {(['active', 'completed', 'broken'] as const).map(status => (
                     <button key={status} onClick={() => setView(status)} className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${view === status ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)} ({commitmentCounts[status]})
                    </button>
                ))}
            </div>
            
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {visibleCommitments.map(c => <CommitmentItem key={c.id} commitment={c} onUpdate={onUpdate} onDelete={onDelete} onSetCompletion={onSetCompletion} onMarkAsBroken={onMarkAsBroken} />)}
                {visibleCommitments.length === 0 && <p className="text-center text-white/60 p-4">
                    No {view} commitments.
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
    onAddTarget: (
        text: string, 
        deadline: string, 
        priority: number | null, 
        startDate: string | null, 
        completionMode: Target['completion_mode'], 
        tags: string[] | null, 
        targetMinutes: number | null
    ) => void;
    onUpdateTarget: (id: string, updates: Partial<Target>) => void;
    onDeleteTarget: (id: string) => void;
    onAddProject: (name: string, description: string | null, startDate: string | null, deadline: string | null, criteria: {type: Project['completion_criteria_type'], value: number | null}, priority: number | null, activeDays: number[] | null) => Promise<string | null>;
    onUpdateProject: (id: string, updates: Partial<Project>) => void;
    onDeleteProject: (id: string) => void;
    onAddCommitment: (text: string, dueDate: string | null) => void;
    onUpdateCommitment: (id: string, updates: { text: string; dueDate: string | null; }) => void;
    onDeleteCommitment: (id: string) => void;
    onSetCommitmentCompletion: (id: string, isComplete: boolean) => void;
    onMarkCommitmentBroken: (id: string) => void;
    onSetPinnedItem: (itemId: string, itemType: 'project' | 'target') => void;
    onClearPins: () => void;
}

const GoalsPage: React.FC<GoalsPageProps> = (props) => {
    const { goals, targets, projects, commitments, onAddGoal, onUpdateGoal, onDeleteGoal, onSetGoalCompletion, onAddTarget, onUpdateTarget, onDeleteTarget, onAddProject, onUpdateProject, onDeleteProject, onAddCommitment, onUpdateCommitment, onDeleteCommitment, onSetCommitmentCompletion, onMarkCommitmentBroken, onSetPinnedItem, onClearPins } = props;

    const [activeTab, setActiveTab] = useState<'projects' | 'targets' | 'overview' | 'deadline'>('projects');

    const [newGoal, setNewGoal] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newDeadline, setNewDeadline] = useState('');
    const [newTargetPriority, setNewTargetPriority] = useState<number>(3);
    const [showArchivedGoals, setShowArchivedGoals] = useState(false);
    
    // New Target Form State
    const [newTargetStartDate, setNewTargetStartDate] = useState('');
    const [newCompletionMode, setNewCompletionMode] = useState<Target['completion_mode']>('manual');
    const [newTags, setNewTags] = useState('');
    const [newTargetMinutes, setNewTargetMinutes] = useState('');

    // Target list states
    const [targetView, setTargetView] = useState<'pending' | 'incomplete' | 'completed'>('pending');
    const [targetDateRange, setTargetDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [showTargetDateFilter, setShowTargetDateFilter] = useState(false);
    const [targetSortBy, setTargetSortBy] = useState<'default' | 'priority'>('default');
    const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
    
    // Project form state
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDescription, setNewProjectDescription] = useState('');
    const [newProjectStartDate, setNewProjectStartDate] = useState('');
    const [newProjectDeadline, setNewProjectDeadline] = useState('');
    const [newProjectPriority, setNewProjectPriority] = useState<number>(3);
    const [newProjectActiveDays, setNewProjectActiveDays] = useState<number[]>([]);
    const [criteriaType, setCriteriaType] = useState<Project['completion_criteria_type']>('manual');
    const [criteriaValue, setCriteriaValue] = useState('');
    
    // Data for charts
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [allHistory, setAllHistory] = useState<PomodoroHistory[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    // Project list filters
    const [projectStatusFilter, setProjectStatusFilter] = useState<'active' | 'completed' | 'due'>('active');
    const [projectDateRange, setProjectDateRange] = useState({ start: '', end: '' });
    const [showProjectDateFilter, setShowProjectDateFilter] = useState(false);
    const [projectSortBy, setProjectSortBy] = useState<'default' | 'priority'>('default');
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    const todayString = getTodayDateString();

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

            onAddProject(
                newProjectName.trim(), 
                newProjectDescription.trim() || null, 
                newProjectStartDate || null, 
                newProjectDeadline || null, 
                { type: criteriaType, value }, 
                newProjectPriority,
                newProjectActiveDays.length > 0 ? newProjectActiveDays : null
            );
            
            // Reset form
            setNewProjectName('');
            setNewProjectDescription('');
            setNewProjectStartDate('');
            setNewProjectDeadline('');
            setNewProjectPriority(3);
            setNewProjectActiveDays([]);
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
        if (!newTarget.trim() || !newDeadline) {
            alert("Target text and deadline are required.");
            return;
        }

        let tags: string[] | null = null;
        let targetMinutes: number | null = null;

        if (newCompletionMode === 'focus_minutes') {
            tags = newTags.split(',').map(t => t.trim()).filter(Boolean);
            targetMinutes = newTargetMinutes ? parseInt(newTargetMinutes, 10) : null;
            if (!targetMinutes || targetMinutes <= 0) {
                alert("Target duration must be a positive number of minutes.");
                return;
            }
        }
        
        onAddTarget(newTarget.trim(), newDeadline, newTargetPriority, newTargetStartDate || null, newCompletionMode, tags, targetMinutes);
        
        // Reset form
        setNewTarget('');
        setNewDeadline('');
        setNewTargetPriority(3);
        setNewTargetStartDate('');
        setNewCompletionMode('manual');
        setNewTags('');
        setNewTargetMinutes('');
    };
    
    const handleNewProjectDayToggle = (dayIndex: number) => {
        setNewProjectActiveDays(prev =>
            prev.includes(dayIndex)
                ? prev.filter(d => d !== dayIndex)
                : [...prev, dayIndex]
        );
    };
    
    const fiveDaysAgo = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 5);
        return d;
    }, []);

    const { visibleGoals, hiddenGoalsCount } = useMemo(() => {
        if (showArchivedGoals) {
            return { visibleGoals: goals, hiddenGoalsCount: 0 };
        }
        
        const visible = goals.filter(g => {
            if (!g.completed_at) return true;
            return new Date(g.completed_at) > fiveDaysAgo;
        });

        return { visibleGoals: visible, hiddenGoalsCount: goals.length - visible.length };
    }, [goals, showArchivedGoals, fiveDaysAgo]);

    const deadlineItems = useMemo(() => {
        const relevantProjects = projects
            .filter(p => {
                if (!p.deadline) return false;
                if (p.status === 'completed') return false;
                if (p.start_date && p.start_date > todayString) return false;
                if (p.status === 'active') return true;
                if (p.status === 'due' && !isOverdueMoreThanTwoDays(p.deadline)) return true;
                return false;
            })
            .map(p => ({ ...p, itemType: 'project' as const }));

        const relevantTargets = targets
            .filter(t => {
                if (!t.deadline) return false;
                if (t.status === 'completed') return false;
                if (t.start_date && t.start_date > todayString) return false;
                if (t.status === 'active') return true;
                if (t.status === 'incomplete' && !isOverdueMoreThanTwoDays(t.deadline)) return true;
                return false;
            })
            .map(t => ({ ...t, itemType: 'target' as const }));

        const combined = [...relevantProjects, ...relevantTargets];
        combined.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
        return combined;
    }, [projects, targets, todayString]);

    const upcomingProjects = useMemo(() => {
        return projects
            .filter(p => p.start_date && p.start_date > todayString && p.status !== 'completed')
            .sort((a,b) => (a.start_date || '').localeCompare(b.start_date || ''));
    }, [projects, todayString]);

    const {
        activeProjects,
        visibleCompletedProjects,
        visibleDueProjects,
        hiddenCompletedProjectsCount,
        hiddenDueProjectsCount,
    } = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const nonUpcomingProjects = projects.filter(p => !upcomingProjects.some(up => up.id === p.id));

        const allActive = nonUpcomingProjects.filter(p => p.status === 'active');
        const allCompleted = nonUpcomingProjects.filter(p => p.status === 'completed');
        const allDue = nonUpcomingProjects.filter(p => p.status === 'due');

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
    }, [projects, upcomingProjects, projectDateRange, projectSortBy]);
    
    const projectsActiveToday = useMemo(() => {
        const dayOfWeek = new Date().getDay();
        return activeProjects.filter(p => 
            !p.active_days || p.active_days.length === 0 || p.active_days.includes(dayOfWeek)
        );
    }, [activeProjects]);

    const projectsInactiveToday = useMemo(() => {
        const dayOfWeek = new Date().getDay();
        return activeProjects.filter(p => 
            p.active_days && p.active_days.length > 0 && !p.active_days.includes(dayOfWeek)
        );
    }, [activeProjects]);
    
    const {
        upcomingTargets,
        pendingTargets,
        incompleteTargets,
        completedTargets,
        hiddenIncompleteCount,
        hiddenCompletedCount,
    } = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const allUpcoming = targets.filter(t => t.start_date && t.start_date > todayString && t.status !== 'completed');
        const otherTargets = targets.filter(t => !allUpcoming.some(ut => ut.id === t.id));

        const allActive = otherTargets.filter(t => t.status === 'active');
        const allIncomplete = otherTargets.filter(t => t.status === 'incomplete');
        const allCompleted = otherTargets.filter(t => t.status === 'completed');

        if (targetSortBy === 'priority') {
             const sortByPriority = (a: Target, b: Target) => {
                const priorityA = a.priority ?? 5;
                const priorityB = b.priority ?? 5;
                if (priorityA !== priorityB) return priorityA - priorityB;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            };
            allActive.sort(sortByPriority);
            allIncomplete.sort(sortByPriority);
            allUpcoming.sort(sortByPriority);
        }

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
            visibleIncomplete = allIncomplete.filter(t => new Date(t.deadline) >= thirtyDaysAgo);
            visibleCompleted = allCompleted.filter(t => t.completed_at && new Date(t.completed_at) >= thirtyDaysAgo);
        }

        return {
            upcomingTargets: allUpcoming,
            pendingTargets: allActive,
            incompleteTargets: visibleIncomplete,
            completedTargets: visibleCompleted.sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()),
            hiddenIncompleteCount: allIncomplete.length - visibleIncomplete.length,
            hiddenCompletedCount: allCompleted.length - visibleCompleted.length,
        };
    }, [targets, targetDateRange, targetSortBy, todayString]);
    
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
    
    const projectCounts = useMemo(() => ({
        active: projects.filter(p => p.status === 'active').length,
        completed: projects.filter(p => p.status === 'completed').length,
        due: projects.filter(p => p.status === 'due').length,
    }), [projects]);
    
    const targetCounts = useMemo(() => ({
        pending: targets.filter(t => t.status === 'active').length,
        incomplete: targets.filter(t => t.status === 'incomplete').length,
        completed: targets.filter(t => t.status === 'completed').length,
    }), [targets]);

    const handleClearProjectFilter = () => {
        setProjectDateRange({ start: '', end: '' });
        setShowProjectDateFilter(false);
    };

    const ProjectFilterControls = () => {
        if (projectStatusFilter !== 'completed' && projectStatusFilter !== 'due') return null;
    
        const hiddenCount = projectStatusFilter === 'completed' ? hiddenCompletedProjectsCount : hiddenDueProjectsCount;
    
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
                            <button onClick={handleClearProjectFilter} className="font-semibold text-amber-400 hover:text-amber-300">Clear & Show All</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };
    
    const tabConfig = {
        projects: { icon: <GoalsIcon />, label: "Projects" },
        targets: { icon: <CheckIcon />, label: "Targets" },
        overview: { icon: <StarIcon />, label: "Overview" },
        deadline: { icon: <RescheduleIcon />, label: "Deadlines" },
    };

    const renderProjectsList = () => {
        let listToShow;
        if (projectStatusFilter === 'active') {
             return (
                <div className="space-y-6">
                    {projectsActiveToday.length > 0 && (
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2 text-center">Active Today</h3>
                             <ul className="space-y-3">
                                {projectsActiveToday.map(project => (
                                    <li key={project.id}>
                                        <ProjectItem 
                                            project={project} 
                                            tasks={allTasks} 
                                            onUpdateProject={onUpdateProject} 
                                            onDeleteProject={onDeleteProject} 
                                            isSelected={project.id === selectedProjectId}
                                            onSelect={() => setSelectedProjectId(prev => prev === project.id ? null : project.id)}
                                            onSetPinnedItem={onSetPinnedItem}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                     {projectsInactiveToday.length > 0 && (
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2 text-center">Inactive Today</h3>
                             <ul className="space-y-3">
                                {projectsInactiveToday.map(project => (
                                    <li key={project.id}>
                                        <ProjectItem 
                                            project={project} 
                                            tasks={allTasks} 
                                            onUpdateProject={onUpdateProject} 
                                            onDeleteProject={onDeleteProject} 
                                            isSelected={project.id === selectedProjectId}
                                            onSelect={() => setSelectedProjectId(prev => prev === project.id ? null : project.id)}
                                            onSetPinnedItem={onSetPinnedItem}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {activeProjects.length === 0 && <p className="text-center text-white/60 p-4">No active projects. Add one to get started!</p>}
                </div>
             )
        } else if (projectStatusFilter === 'completed') {
            listToShow = visibleCompletedProjects;
        } else { // 'due'
            listToShow = visibleDueProjects;
        }

        return (
             <ul className="space-y-3">
                {listToShow.map(project => (
                     <li key={project.id}>
                        <ProjectItem 
                            project={project} 
                            tasks={allTasks} 
                            onUpdateProject={onUpdateProject} 
                            onDeleteProject={onDeleteProject} 
                            isSelected={project.id === selectedProjectId}
                            onSelect={() => setSelectedProjectId(prev => prev === project.id ? null : project.id)}
                            onSetPinnedItem={onSetPinnedItem}
                        />
                    </li>
                ))}
                {listToShow.length === 0 && <p className="text-center text-white/60 p-4">No projects match the current filter.</p>}
            </ul>
        );
    };

    const pinnedItem = useMemo(() => {
        const pinnedProject = projects.find(p => p.is_pinned);
        if (pinnedProject) {
            return { ...pinnedProject, itemType: 'project' as const };
        }
        const pinnedTarget = targets.find(t => t.is_pinned);
        if (pinnedTarget) {
            return { ...pinnedTarget, itemType: 'target' as const };
        }
        return null;
    }, [projects, targets]);
    
    const spotlightGoal = useMemo(() => {
        return goals.find(g => !g.completed_at);
    }, [goals]);

    return (
        <div className="space-y-6">
            <Panel title="Spotlight">
                {pinnedItem ? (
                    <div>
                        {pinnedItem.itemType === 'project' ? (
                            <ProjectItem 
                                project={pinnedItem} 
                                tasks={allTasks}
                                onUpdateProject={onUpdateProject} 
                                onDeleteProject={onDeleteProject} 
                                isSelected={pinnedItem.id === selectedProjectId}
                                onSelect={() => setSelectedProjectId(prev => prev === pinnedItem.id ? null : pinnedItem.id)}
                                onSetPinnedItem={onSetPinnedItem}
                            />
                        ) : (
                            <ul>
                                <TargetItem 
                                    target={pinnedItem}
                                    onUpdateTarget={onUpdateTarget}
                                    onDeleteTarget={onDeleteTarget}
                                    isSelected={pinnedItem.id === selectedTargetId}
                                    onSelect={() => setSelectedTargetId(prev => prev === pinnedItem.id ? null : pinnedItem.id)}
                                    onSetPinnedItem={onSetPinnedItem}
                                />
                            </ul>
                        )}
                        <div className="text-center mt-4">
                            <button 
                                onClick={onClearPins}
                                className="text-xs text-slate-400 hover:text-white font-semibold px-3 py-1 rounded-full hover:bg-slate-700/50 transition"
                            >
                                Clear Spotlight
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-slate-400 p-4">Pin a project or target to feature it in the spotlight.</p>
                )}
            </Panel>

            <div className="flex justify-center gap-1 sm:gap-2 bg-slate-800/50 p-1 rounded-full max-w-xl mx-auto">
                {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map(key => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex-grow md:flex-grow-0 md:flex-1 p-2.5 text-xs sm:text-sm rounded-full font-bold transition-colors flex items-center justify-center gap-2 ${
                            activeTab === key
                                ? 'bg-slate-700 text-white shadow-inner'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                        }`}
                    >
                        {tabConfig[key].icon}
                        <span className="hidden md:inline whitespace-nowrap">{tabConfig[key].label}</span>
                    </button>
                ))}
            </div>

            <div key={activeTab}>
                 {activeTab === 'deadline' && (
                    <div className="animate-fadeIn">
                        <Panel title="Deadline Tracker">
                            <p className="text-white/70 text-center text-sm -mt-2 mb-6">
                                Showing all active and recently overdue projects and targets.
                            </p>
                            {deadlineItems.length > 0 ? (
                                <div className="space-y-4">
                                    {deadlineItems.map(item => (
                                        <DeadlineItemCard key={`${item.itemType}-${item.id}`} item={item as any} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-slate-400 p-4">
                                    No active or recently due deadlines to track!
                                </p>
                            )}
                        </Panel>
                    </div>
                )}
                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-fadeIn">
                        {spotlightGoal && (
                             <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-400/50 rounded-xl p-4 shadow-2xl">
                                <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider mb-2 text-center">Top Goal</h3>
                                 <GoalItem 
                                     goal={spotlightGoal} 
                                     onUpdateGoal={onUpdateGoal} 
                                     onDeleteGoal={onDeleteGoal} 
                                     onSetCompletion={onSetGoalCompletion} 
                                 />
                             </div>
                        )}
                        <Panel title="My Core Goals">
                            <details className="group bg-slate-900/30 rounded-xl transition-[max-height] duration-500 overflow-hidden mb-4">
                                <summary className="p-3 font-semibold text-white cursor-pointer list-none flex justify-between items-center hover:bg-slate-700/20">
                                    ⭐ Add New Goal
                                    <svg className="w-4 h-4 text-white/70 transform transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </summary>
                                <div className="p-4 border-t border-slate-700">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newGoal}
                                            onChange={(e) => setNewGoal(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddGoal()}
                                            placeholder="What's your next big ambition?"
                                            className="w-full bg-black/30 border-2 border-white/20 rounded-full py-3 pr-28 pl-6 text-white placeholder:text-white/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50 transition-all"
                                        />
                                        <button onClick={handleAddGoal} className="absolute inset-y-1.5 right-1.5 px-6 rounded-full font-bold text-white transition-all duration-300 bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 hover:scale-105">
                                            Add Goal
                                        </button>
                                    </div>
                                </div>
                            </details>

                            <ul className="space-y-2">
                                {visibleGoals.map(goal => (
                                    <GoalItem key={goal.id} goal={goal} onUpdateGoal={onUpdateGoal} onDeleteGoal={onDeleteGoal} onSetCompletion={onSetGoalCompletion} />
                                ))}
                            </ul>
                            {hiddenGoalsCount > 0 && (
                                <button onClick={() => setShowArchivedGoals(true)} className="text-xs text-cyan-300 hover:text-cyan-200 mt-2">
                                    Show {hiddenGoalsCount} archived goal{hiddenGoalsCount > 1 ? 's' : ''}
                                </button>
                            )}
                            {goals.length === 0 && <p className="text-center text-white/60 p-4">Set your first high-level goal!</p>}
                        </Panel>
                        <CommitmentsPanel 
                            commitments={commitments}
                            onAdd={onAddCommitment}
                            onUpdate={onUpdateCommitment}
                            onDelete={onDeleteCommitment}
                            onSetCompletion={onSetCommitmentCompletion}
                            onMarkAsBroken={onMarkCommitmentBroken}
                        />
                    </div>
                )}
                {activeTab === 'projects' && (
                    <div className="space-y-6 animate-fadeIn">
                        
                        <details className="group bg-slate-800/50 rounded-xl border border-slate-700/80 transition-[max-height] duration-500 overflow-hidden">
                            <summary className="p-4 font-bold text-lg text-white cursor-pointer list-none flex justify-between items-center hover:bg-slate-700/20">
                                ✨ Add New Project
                                <svg className="w-5 h-5 text-white/70 transform transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </summary>
                            <div className="p-4 border-t border-slate-700">
                                 <div className="space-y-4">
                                    <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Project Name" className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                                    <textarea value={newProjectDescription} onChange={e => setNewProjectDescription(e.target.value)} placeholder="Project Description (Optional)" className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" rows={2}></textarea>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-white/70 mb-1">Start Date</label>
                                            <input type="date" value={newProjectStartDate} onChange={e => setNewProjectStartDate(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/70 mb-1">Deadline</label>
                                            <input type="date" value={newProjectDeadline} onChange={e => setNewProjectDeadline(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-white/70">Active Days (leave blank for all days)</label>
                                        <DaySelector selectedDays={newProjectActiveDays} onDayToggle={handleNewProjectDayToggle} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/70 mb-1 flex items-center gap-1.5">
                                            Completion Criteria
                                            <ExplanationTooltip title="Completion Criteria" content="How will this project be marked as complete?<br/><strong>Manual:</strong> You check it off yourself.<br/><strong>Task Count:</strong> Completes after a set number of linked tasks are done.<br/><strong>Time Duration:</strong> Completes after a total number of focus minutes are logged on linked tasks." />
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <select value={criteriaType} onChange={e => setCriteriaType(e.target.value as any)} className="bg-white/20 border border-white/30 rounded-lg p-3 text-white focus:outline-none focus:bg-white/30 focus:border-white/50">
                                                <option value="manual" className="bg-gray-800">Manual</option>
                                                <option value="task_count" className="bg-gray-800">Task Count</option>
                                                <option value="duration_minutes" className="bg-gray-800">Time Duration</option>
                                            </select>
                                            <input type="number" value={criteriaValue} onChange={e => setCriteriaValue(e.target.value)} placeholder="Target Value" disabled={criteriaType === 'manual'} className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50 disabled:opacity-50" />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap justify-between items-end gap-4 pt-1">
                                        <div>
                                            <label className="text-xs text-white/70 mb-1">Priority</label>
                                            <PrioritySelector priority={newProjectPriority} setPriority={setNewProjectPriority} />
                                        </div>
                                        <button onClick={handleAddProject} className="h-12 px-6 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-sky-600">Add Project</button>
                                    </div>
                                </div>
                            </div>
                        </details>

                        <Panel title="My Projects">
                            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                                <div className="flex justify-center gap-1 bg-slate-800 p-1 rounded-full w-full max-w-sm">
                                    {(['active', 'completed', 'due'] as const).map(status => (
                                        <button key={status} onClick={() => setProjectStatusFilter(status)} className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${projectStatusFilter === status ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}>
                                            {status.charAt(0).toUpperCase() + status.slice(1)} ({projectCounts[status]})
                                        </button>
                                    ))}
                                </div>
                                 <button onClick={() => setProjectSortBy(prev => prev === 'default' ? 'priority' : 'default')} className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold px-3 py-1 rounded-full hover:bg-white/10 transition">
                                    Sort by: {projectSortBy}
                                </button>
                            </div>
                            <ProjectFilterControls />
                            {renderProjectsList()}

                            {projectStatusFilter === 'active' && upcomingProjects.length > 0 && (
                                <details className="mt-6 group">
                                    <summary className="text-lg font-bold text-white/80 mb-2 text-center cursor-pointer list-none hover:text-white">
                                        Upcoming Projects ({upcomingProjects.length})
                                    </summary>
                                    <ul className="space-y-3 pt-2">
                                        {upcomingProjects.map(p => <li key={p.id}><ProjectItem project={p} tasks={allTasks} onUpdateProject={onUpdateProject} onDeleteProject={onDeleteProject} isSelected={p.id === selectedProjectId} onSelect={() => setSelectedProjectId(prev => prev === p.id ? null : p.id)} onSetPinnedItem={onSetPinnedItem} /></li>)}
                                    </ul>
                                </details>
                            )}

                            {isLoadingStats ? <Spinner/> : selectedProjectId && (
                                <>
                                    <ProjectDailyFocusChart projectId={selectedProjectId} projectName={projects.find(p=>p.id===selectedProjectId)?.name || null} allTasks={allTasks} allHistory={allHistory} />
                                    <ProjectBurndownChart project={projects.find(p=>p.id===selectedProjectId)} allTasks={allTasks} allHistory={allHistory} />
                                </>
                            )}
                        </Panel>
                    </div>
                )}
                {activeTab === 'targets' && (
                     <div className="space-y-6 animate-fadeIn">
                        
                        <details className="group bg-slate-800/50 rounded-xl border border-slate-700/80 transition-[max-height] duration-500 overflow-hidden">
                             <summary className="p-4 font-bold text-lg text-white cursor-pointer list-none flex justify-between items-center hover:bg-slate-700/20">
                                ✨ Add New Target
                                <svg className="w-5 h-5 text-white/70 transform transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </summary>
                            <div className="p-4 border-t border-slate-700">
                               <div className="space-y-4">
                                    <input type="text" value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="What's a specific, measurable goal?" className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-white/70 mb-1">Start Date</label>
                                            <input type="date" value={newTargetStartDate} onChange={e => setNewTargetStartDate(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/70 mb-1">Deadline *</label>
                                            <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} required className="bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/70 mb-1 flex items-center gap-1.5">
                                            Completion Mode
                                            <ExplanationTooltip title="Completion Mode" content="<strong>Manual:</strong> You check off the target yourself.<br/><strong>Focus Minutes:</strong> Automatically completes when you log enough focus minutes on tasks with specific tags." />
                                        </label>
                                        <select value={newCompletionMode} onChange={e => setNewCompletionMode(e.target.value as any)} className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white focus:outline-none focus:bg-white/30 focus:border-white/50">
                                            <option value="manual" className="bg-gray-800">Manual</option>
                                            <option value="focus_minutes" className="bg-gray-800">Focus Minutes</option>
                                        </select>
                                    </div>
                                    {newCompletionMode === 'focus_minutes' && (
                                         <div className="space-y-2 animate-fadeIn">
                                            <input type="text" value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="Tags to track (e.g., coding, research)" className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                                            <input type="number" value={newTargetMinutes} onChange={e => setNewTargetMinutes(e.target.value)} placeholder="Target Minutes (e.g., 600 for 10h)" className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50" />
                                        </div>
                                    )}
                                    <div className="flex flex-wrap justify-between items-end gap-4 pt-1">
                                        <div>
                                            <label className="text-xs text-white/70 mb-1">Priority</label>
                                            <PrioritySelector priority={newTargetPriority} setPriority={setNewTargetPriority} />
                                        </div>
                                        <button onClick={handleAddTarget} className="h-12 px-6 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-purple-500 to-indigo-600">Add Target</button>
                                    </div>
                               </div>
                            </div>
                        </details>

                        <Panel title="Key Targets">
                            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                                 <div className="flex justify-center gap-1 bg-slate-800 p-1 rounded-full w-full max-w-sm">
                                    {(['pending', 'incomplete', 'completed'] as const).map(status => (
                                         <button key={status} onClick={() => setTargetView(status)} className={`flex-1 px-4 py-1.5 text-sm rounded-full font-bold transition-colors ${targetView === status ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}>
                                            {status.charAt(0).toUpperCase() + status.slice(1)} ({targetCounts[status]})
                                         </button>
                                    ))}
                                </div>
                                <button onClick={() => setTargetSortBy(prev => prev === 'default' ? 'priority' : 'default')} className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold px-3 py-1 rounded-full hover:bg-white/10 transition">
                                    Sort by: {targetSortBy}
                                </button>
                            </div>
                            <TargetFilterControls />
                            
                            <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                {targetView === 'pending' && pendingTargets.map(t => <TargetItem key={t.id} target={t} onUpdateTarget={onUpdateTarget} onDeleteTarget={onDeleteTarget} isSelected={t.id === selectedTargetId} onSelect={() => setSelectedTargetId(prev => prev === t.id ? null : t.id)} onSetPinnedItem={onSetPinnedItem} />)}
                                {targetView === 'incomplete' && incompleteTargets.map(t => <TargetItem key={t.id} target={t} onUpdateTarget={onUpdateTarget} onDeleteTarget={onDeleteTarget} isSelected={t.id === selectedTargetId} onSelect={() => setSelectedTargetId(prev => prev === t.id ? null : t.id)} onSetPinnedItem={onSetPinnedItem} />)}
                                {targetView === 'completed' && completedTargets.map(t => <TargetItem key={t.id} target={t} onUpdateTarget={onUpdateTarget} onDeleteTarget={onDeleteTarget} isSelected={t.id === selectedTargetId} onSelect={() => setSelectedTargetId(prev => prev === t.id ? null : t.id)} onSetPinnedItem={onSetPinnedItem} />)}
                            </ul>

                            {targetView === 'pending' && upcomingTargets.length > 0 && (
                                <details className="mt-6 group">
                                    <summary className="text-lg font-bold text-white/80 mb-2 text-center cursor-pointer list-none hover:text-white">
                                        Upcoming Targets ({upcomingTargets.length})
                                    </summary>
                                    <ul className="space-y-2 pt-2">
                                        {upcomingTargets.map(t => <TargetItem key={t.id} target={t} onUpdateTarget={onUpdateTarget} onDeleteTarget={onDeleteTarget} isSelected={t.id === selectedTargetId} onSelect={() => setSelectedTargetId(prev => prev === t.id ? null : t.id)} onSetPinnedItem={onSetPinnedItem} />)}
                                    </ul>
                                </details>
                            )}
                            
                            {isLoadingStats ? <Spinner/> : selectedTargetId && (
                                <TargetBurndownChart target={targets.find(t => t.id === selectedTargetId)} allTasks={allTasks} allHistory={allHistory} />
                            )}
                        </Panel>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GoalsPage;