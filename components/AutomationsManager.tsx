import React, { useState, useEffect } from 'react';
import { Task, Project } from '../types';
import Panel from './common/Panel';
import PrioritySelector from './common/PrioritySelector';
import DaySelector from './common/DaySelector';
import { EditIcon, TrashIcon, PlayIcon, PauseIcon } from './common/Icons';
import ExplanationTooltip from './common/ExplanationTooltip';
import { getTodayDateString } from '../utils/date';

interface AutomationsManagerProps {
    recurringTasks: Task[];
    projects: Project[];
    onAddProject: (name: string) => Promise<string | null>;
    onAddRecurringTask: (taskData: Partial<Task>) => void;
    onUpdateRecurringTask: (id: string, updates: Partial<Task>) => void;
    onDeleteRecurringTask: (id: string) => void;
    onSetRecurringTaskActive: (id: string, isActive: boolean) => void;
    taskToAutomate: Task | null;
    onClearTaskToAutomate: () => void;
}

interface RecurringTaskItemProps {
    task: Task;
    projects: Project[];
    onUpdate: (id: string, updates: Partial<Task>) => void;
    onDelete: (id: string) => void;
    onSetTaskActive: (id: string, isActive: boolean) => void;
}

const RecurringTaskItem: React.FC<RecurringTaskItemProps> = ({ task, projects, onUpdate, onDelete, onSetTaskActive }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(task.text);
    const [editPoms, setEditPoms] = useState(Math.abs(task.total_poms).toString());
    const [editIsStopwatch, setEditIsStopwatch] = useState(task.total_poms < 0);
    const [editProjectId, setEditProjectId] = useState(task.project_id || 'none');
    const [editTags, setEditTags] = useState(task.tags?.join(', ') || '');
    const [editPriority, setEditPriority] = useState(task.priority ?? 3);
    const [editRecurringDays, setEditRecurringDays] = useState<number[]>(task.recurring_days || []);
    const [editRecurringEndDate, setEditRecurringEndDate] = useState(task.recurring_end_date || '');
    const [editStopOnProjectCompletion, setEditStopOnProjectCompletion] = useState(task.stop_on_project_completion ?? true);
    
    useEffect(() => {
        if (!isEditing) {
            setEditText(task.text);
            setEditPoms(Math.abs(task.total_poms).toString());
            setEditIsStopwatch(task.total_poms < 0);
            setEditProjectId(task.project_id || 'none');
            setEditTags(task.tags?.join(', ') || '');
            setEditPriority(task.priority ?? 3);
            setEditRecurringDays(task.recurring_days || []);
            setEditRecurringEndDate(task.recurring_end_date || '');
            setEditStopOnProjectCompletion(task.stop_on_project_completion ?? true);
        }
    }, [isEditing, task]);

    const handleSave = () => {
        const pomsInt = editIsStopwatch ? -1 : parseInt(editPoms, 10);
        if (!editText.trim() || isNaN(pomsInt) || (!editIsStopwatch && pomsInt <= 0)) {
            alert('Task text and a valid positive pomodoro number are required.');
            return;
        }
        
        const updates: Partial<Task> = {
            text: editText.trim(),
            total_poms: pomsInt,
        };

        onUpdate(task.id, updates);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    const handleToggleActive = () => {
        const isActive = task.is_active ?? true;
        onSetTaskActive(task.id, !isActive);
    };

    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const recurringDaysText = task.recurring_days && task.recurring_days.length > 0
        ? task.recurring_days.sort().map(d => dayMap[d]).join(', ')
        : 'Every day';

    if (isEditing) {
        const todayString = getTodayDateString();
        const activeProjects = projects.filter(p => p.status === 'active' && (!p.start_date || p.start_date <= todayString));
        
        const currentProject = projects.find(p => p.id === task.project_id);
        const selectableProjects = [...activeProjects];
        if (currentProject && !selectableProjects.some(p => p.id === currentProject.id)) {
            selectableProjects.unshift(currentProject);
        }

        return (
             <div className="bg-slate-700/80 p-4 rounded-xl ring-2 ring-cyan-400 space-y-3">
                {/* Editable Fields */}
                <div>
                    <label className="text-xs text-slate-300 mb-1 block">Task Name</label>
                    <input type="text" value={editText} onChange={e => setEditText(e.target.value)} placeholder="Task Text" className="w-full bg-slate-800/80 border border-slate-600 rounded-lg p-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                </div>

                <div className="flex items-center gap-4 border border-slate-600 p-3 rounded-lg">
                    <label htmlFor={`edit-poms-${task.id}`} className="text-slate-300 text-sm">Poms:</label>
                    <input
                        id={`edit-poms-${task.id}`}
                        type="number"
                        value={editPoms}
                        onChange={e => setEditPoms(e.target.value)}
                        className="w-20 text-center bg-slate-800 border border-slate-600 rounded-lg p-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50"
                        disabled={editIsStopwatch}
                    />
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer text-sm">
                        <input
                            type="checkbox"
                            checked={editIsStopwatch}
                            onChange={e => setEditIsStopwatch(e.target.checked)}
                            className="h-4 w-4 rounded bg-slate-600 border-slate-500 text-teal-400 focus:ring-teal-400/50"
                        />
                        Stopwatch
                    </label>
                </div>

                {/* Disabled Fields */}
                <div className="space-y-3 opacity-60">
                    <p className="text-xs text-center text-slate-400 pt-2">To change schedule, project, or tags, please create a new automation.</p>
                    
                    <div>
                        <label className="text-xs text-slate-300 mb-1 block">Project</label>
                         <select value={editProjectId} disabled className="w-full bg-slate-800/80 border border-slate-600 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed">
                            <option value="none" className="bg-slate-900">No Project</option>
                            {selectableProjects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-slate-300 mb-1 block">Tags</label>
                        <input type="text" value={editTags} disabled className="w-full bg-slate-800/80 border border-slate-600 rounded-lg p-2 text-white placeholder:text-slate-400 disabled:cursor-not-allowed" />
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <label className="text-xs text-slate-300">Priority</label>
                        <div className="pointer-events-none">
                            <PrioritySelector priority={editPriority} setPriority={() => {}} />
                        </div>
                    </div>

                    <div className="space-y-2 text-center">
                        <label className="text-xs text-slate-300">Repeat On</label>
                        <div className="pointer-events-none">
                             <DaySelector selectedDays={editRecurringDays} onDayToggle={() => {}} />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-slate-300 mb-1 block">End Date</label>
                        <input type="date" value={editRecurringEndDate} disabled className="bg-slate-800/80 border border-slate-600 rounded-lg p-2 text-white/80 w-full text-center disabled:cursor-not-allowed" style={{colorScheme: 'dark'}} />
                    </div>
                </div>

                <div className="flex justify-end gap-2 text-sm pt-2">
                    <button onClick={handleCancel} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-slate-600 hover:bg-slate-700">Cancel</button>
                    <button onClick={handleSave} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-cyan-600 hover:bg-cyan-700">Save</button>
                </div>
            </div>
        )
    }

    const isActive = task.is_active ?? true;

    return (
        <li className={`bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 transition-all border border-slate-700/60 hover:border-slate-600 ${!isActive ? 'opacity-60' : ''}`}>
            <div className="flex justify-between items-start gap-3">
                <div className="flex-grow">
                    <p className={`font-bold text-white ${!isActive ? 'line-through' : ''}`}>{task.text}</p>
                    <div className="text-xs text-slate-300 mt-1 space-y-1">
                        <p>Repeats: <span className="font-semibold text-cyan-300">{recurringDaysText}</span></p>
                        {task.recurring_end_date && <p>Until: <span className="font-semibold text-cyan-300">{new Date(task.recurring_end_date + 'T00:00:00').toLocaleDateString()}</span></p>}
                        {task.project_id && <p>Stops with project: <span className="font-semibold text-cyan-300">{task.stop_on_project_completion ? 'Yes' : 'No'}</span></p>}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={handleToggleActive} className="p-2 rounded-full text-amber-400 hover:bg-amber-500/20 transition" title={isActive ? 'Pause Automation' : 'Resume Automation'}>
                        {isActive ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button onClick={() => setIsEditing(true)} className="p-2 rounded-full text-sky-300 hover:bg-sky-500/20 transition"><EditIcon /></button>
                    <button onClick={() => {
                        if (window.confirm("Are you sure you want to delete this automation? This cannot be undone.")) {
                            onDelete(task.id)
                        }
                    }} className="p-2 rounded-full text-red-400 hover:bg-red-500/20 transition"><TrashIcon /></button>
                </div>
            </div>
        </li>
    );
};

const AutomationsManager: React.FC<AutomationsManagerProps> = ({ recurringTasks, projects, onAddProject, onAddRecurringTask, onUpdateRecurringTask, onDeleteRecurringTask, onSetRecurringTaskActive, taskToAutomate, onClearTaskToAutomate }) => {
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [text, setText] = useState('');
    const [poms, setPoms] = useState('1');
    const [isStopwatch, setIsStopwatch] = useState(false);
    const [projectId, setProjectId] = useState('none');
    const [tags, setTags] = useState('');
    const [priority, setPriority] = useState(3);
    const [recurringDays, setRecurringDays] = useState<number[]>([]);
    const [recurringEndDate, setRecurringEndDate] = useState('');
    const [stopOnProjectCompletion, setStopOnProjectCompletion] = useState(true);

    useEffect(() => {
        if (taskToAutomate) {
            setIsFormVisible(true);
            setText(taskToAutomate.text);
            setPoms(Math.abs(taskToAutomate.total_poms).toString());
            setIsStopwatch(taskToAutomate.total_poms < 0);
            setProjectId(taskToAutomate.project_id || 'none');
            setTags(taskToAutomate.tags?.join(', ') || '');
            setPriority(taskToAutomate.priority ?? 3);
            
            // Reset schedule-specific fields
            setRecurringDays([]);
            setRecurringEndDate('');
            
            // Scroll to the top of the form for better UX
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            onClearTaskToAutomate();
        }
    }, [taskToAutomate, onClearTaskToAutomate]);

    const handleAdd = () => {
        const pomsInt = isStopwatch ? -1 : parseInt(poms, 10);
        if (!text.trim() || isNaN(pomsInt)) {
            alert("Task text and a valid pomodoro number are required.");
            return;
        }

        const taskData: Partial<Task> = {
            text: text.trim(),
            total_poms: pomsInt,
            project_id: projectId === 'none' ? null : projectId,
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            priority,
            recurring_days: recurringDays.length > 0 ? recurringDays.sort() : null,
            recurring_end_date: recurringEndDate || null,
            stop_on_project_completion: projectId !== 'none' ? stopOnProjectCompletion : false,
            completed_poms: 0,
            comments: [],
        };
        onAddRecurringTask(taskData);
        // Reset form
        setText(''); setPoms('1'); setIsStopwatch(false); setProjectId('none'); setTags(''); setPriority(3); setRecurringDays([]); setRecurringEndDate(''); setStopOnProjectCompletion(true);
        setIsFormVisible(false);
    };

    const handleDayToggle = (dayIndex: number) => {
        setRecurringDays(prev => 
            prev.includes(dayIndex) 
                ? prev.filter(d => d !== dayIndex)
                : [...prev, dayIndex]
        );
    };
    
    const todayString = getTodayDateString();
    const activeProjects = projects.filter(p => p.status === 'active' && (!p.start_date || p.start_date <= todayString));

    return (
        <div className="space-y-6">
            <Panel title="Task Automations">
                 {!isFormVisible && (
                    <div className="mb-4 text-center">
                        <button onClick={() => setIsFormVisible(true)} className="bg-slate-800/50 backdrop-blur-md hover:bg-slate-700/50 border-2 border-slate-700/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors w-full sm:w-auto">
                            + New Recurring Task
                        </button>
                    </div>
                )}
                {isFormVisible && (
                    <div className="bg-slate-900/50 p-4 rounded-xl space-y-4 mb-4 border border-slate-700 animate-fadeIn">
                        <h3 className="text-xl font-bold text-white text-center">Create New Automation</h3>
                        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Task to repeat (e.g., 'Review flashcards')" className="w-full bg-slate-800/80 border-2 border-slate-600 rounded-lg p-3 text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full bg-slate-800/80 border-2 border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400">
                                <option value="none" className="bg-slate-900">No Project</option>
                                {activeProjects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                            </select>
                            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (e.g., 'learning, japanese')" className="w-full bg-slate-800/80 border-2 border-slate-600 rounded-lg p-3 text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" />
                        </div>
                        {projectId !== 'none' && (
                             <label className="flex items-center gap-2 text-white/80 cursor-pointer text-sm p-2 bg-black/20 rounded-md animate-fadeIn">
                                <input type="checkbox" checked={stopOnProjectCompletion} onChange={e => setStopOnProjectCompletion(e.target.checked)} className="h-4 w-4 rounded bg-slate-600 border-slate-500 text-teal-400 focus:ring-teal-400/50" />
                                Stop this automation when project is complete
                            </label>
                        )}
                        <div className="space-y-2 text-center">
                            <label className="text-sm text-slate-300">Repeat On (leave blank for every day)</label>
                            <DaySelector selectedDays={recurringDays} onDayToggle={handleDayToggle} />
                        </div>
                        <div>
                            <label className="text-sm text-slate-300 flex items-center gap-1.5 justify-center">
                                End Date (Optional)
                                <ExplanationTooltip title="End Date" content="The task will stop repeating after this date."/>
                            </label>
                            <input type="date" value={recurringEndDate} onChange={(e) => setRecurringEndDate(e.target.value)} className="w-full bg-slate-800/80 border-2 border-slate-600 rounded-lg p-3 text-white/80 text-center" style={{colorScheme: 'dark'}} />
                        </div>

                         <div className="flex flex-wrap justify-between items-center gap-4 pt-1">
                            <div className="flex items-center gap-3">
                                <input type="number" max="10" min="1" value={poms} onChange={(e) => setPoms(e.target.value)} className="w-16 h-12 text-center bg-slate-800/80 border-2 border-slate-600 rounded-lg p-2 text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:opacity-50" disabled={isStopwatch} />
                                <label className="flex items-center gap-2 text-white/80 cursor-pointer text-sm">
                                    <input type="checkbox" checked={isStopwatch} onChange={e => setIsStopwatch(e.target.checked)} className="h-4 w-4 rounded bg-slate-600 border-slate-500 text-teal-400 focus:ring-teal-400/50" />
                                    Stopwatch
                                </label>
                            </div>
                            <PrioritySelector priority={priority} setPriority={setPriority} />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => { setIsFormVisible(false); onClearTaskToAutomate(); }} className="h-12 px-6 rounded-lg font-bold text-slate-300 hover:text-white transition bg-slate-600 hover:bg-slate-700">Cancel</button>
                            <button onClick={handleAdd} className="h-12 px-6 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-cyan-500 to-sky-600">Create Automation</button>
                        </div>
                    </div>
                )}

                <ul className="space-y-2">
                    {recurringTasks.map(task => (
                        <RecurringTaskItem key={task.id} task={task} projects={projects} onUpdate={onUpdateRecurringTask} onDelete={onDeleteRecurringTask} onSetTaskActive={onSetRecurringTaskActive} />
                    ))}
                    {recurringTasks.length === 0 && <p className="text-center text-slate-400 p-4">You have no recurring tasks. Create one to automate your daily planning!</p>}
                </ul>

                <details className="mt-6 bg-black/20 p-3 rounded-lg text-xs">
                    <summary className="cursor-pointer font-semibold text-slate-400">Database Schema (for developers)</summary>
                    <div className="mt-2 p-3 bg-slate-900 rounded-md">
                        <p className="text-slate-300 mb-2">The following SQL commands for PostgreSQL (used by Supabase) are needed to enable this feature. This project uses PostgreSQL, not MySQL.</p>
                        <pre className="text-cyan-300 whitespace-pre-wrap text-[11px] leading-relaxed"><code>
                            {`-- Add columns to support recurring tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurring_days INT[],
ADD COLUMN IF NOT EXISTS recurring_end_date DATE,
ADD COLUMN IF NOT EXISTS template_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS stop_on_project_completion BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add an index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_template_task_id ON public.tasks(template_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_recurring_active ON public.tasks(is_recurring, is_active);

-- Make sure Row Level Security is enabled on the tasks table.
-- Your existing policies should cover the new columns if they are permissive enough.
-- If you have column-specific policies, you will need to update them.
-- A general policy for tasks would look like this:
--
-- CREATE POLICY "Users can manage their own tasks"
-- ON public.tasks
-- FOR ALL
-- USING (auth.uid() = user_id)
-- WITH CHECK (auth.uid() = user_id);
`}
                        </code></pre>
                    </div>
                </details>
            </Panel>
        </div>
    );
};

export default AutomationsManager;