import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, Project, Settings } from '../types';
import Panel from './common/Panel';
import { PostponeIcon, DuplicateIcon, MoreVerticalIcon, UndoIcon, EditIcon, BringForwardIcon, CalendarIcon } from './common/Icons';
import { getTodayDateString } from '../utils/date';
import PrioritySelector from './common/PrioritySelector';
import ExplanationTooltip from './common/ExplanationTooltip';

interface TaskSettingsDropdownProps {
    task: Task;
    settings: Settings;
    onSave: (id: string, newTimers: { focus: number | null, break: number | null }) => void;
    onClose: () => void;
}

const TaskSettingsDropdown: React.FC<TaskSettingsDropdownProps> = ({ task, settings, onSave, onClose }) => {
    const [focus, setFocus] = useState(task.custom_focus_duration || '');
    const [breakTime, setBreakTime] = useState(task.custom_break_duration || '');

    React.useEffect(() => {
        setFocus(task.custom_focus_duration || '');
        setBreakTime(task.custom_break_duration || '');
    }, [task.custom_focus_duration, task.custom_break_duration]);

    const handleSave = () => {
        onSave(task.id, {
            focus: focus ? parseInt(String(focus), 10) : null,
            break: breakTime ? parseInt(String(breakTime), 10) : null,
        });
        onClose();
    };

    const handleReset = () => {
        setFocus('');
        setBreakTime('');
        onSave(task.id, { focus: null, break: null });
        onClose();
    };

    return (
        <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-white/20 rounded-lg shadow-xl p-3 z-10 animate-slideUp">
            <label className="block text-xs text-white/70 mb-1">Custom Focus (mins)</label>
            <input type="number" value={focus} onChange={e => setFocus(e.target.value)} placeholder={`Default: ${settings.focusDuration}`} className="w-full text-center bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50 mb-2" />
            
            <label className="block text-xs text-white/70 mb-1">Custom Break (mins)</label>
            <input type="number" value={breakTime} onChange={e => setBreakTime(e.target.value)} placeholder={`Default: ${settings.breakDuration}`} className="w-full text-center bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50 mb-3" />
            
            <div className="flex gap-2 text-sm">
                <button onClick={handleSave} className="flex-1 p-2 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-cyan-600">Save</button>
                <button onClick={handleReset} className="flex-1 p-2 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-gray-500 to-gray-600">Reset</button>
            </div>
        </div>
    );
};


interface TaskItemProps {
    task: Task;
    isCompleted: boolean;
    settings: Settings;
    projects: Project[];
    onDelete: (id: string) => void;
    onMove?: (id: string, action: 'postpone' | 'duplicate') => void;
    onUpdateTaskTimers: (id: string, newTimers: { focus: number | null, break: number | null }) => void;
    onUpdateTask: (id: string, newText: string, newTags: string[], newPoms: number, projectId: string | null, priority: number | null) => void;
    onMarkTaskIncomplete?: (id: string) => void;
    isTomorrowTask?: boolean;
    displayDate?: string;
    onBringTaskForward?: (id: string) => void;
    dragProps?: object;
    ref?: React.Ref<HTMLLIElement>;
    isJustAdded?: boolean;
}

const priorityBorderColors: { [key: number]: string } = {
    1: 'border-l-4 border-red-500',
    2: 'border-l-4 border-amber-500',
    3: 'border-l-4 border-sky-500',
    4: 'border-l-4 border-slate-500',
};

// FIX: Renamed destructured prop from `onBringForward` to `onBringTaskForward` to match `TaskItemProps`.
const TaskItem = React.forwardRef<HTMLLIElement, TaskItemProps>(({ task, isCompleted, settings, projects, onDelete, onMove, onUpdateTaskTimers, onUpdateTask, onMarkTaskIncomplete, dragProps, isTomorrowTask, onBringTaskForward, displayDate, isJustAdded }, ref) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(task.text);
    const [editTags, setEditTags] = useState(task.tags?.join(', ') || '');
    const [editPoms, setEditPoms] = useState(Math.abs(task.total_poms).toString());
    const [editIsStopwatch, setEditIsStopwatch] = useState(task.total_poms < 0);
    const [editProjectId, setEditProjectId] = useState<string>(task.project_id || 'none');
    const [editPriority, setEditPriority] = useState<number>(task.priority ?? 3);
    const [isDeleting, setIsDeleting] = useState(false);
    const isDraggable = !isCompleted && dragProps;

    useEffect(() => {
        setEditText(task.text);
        setEditTags(task.tags?.join(', ') || '');
        setEditPoms(Math.abs(task.total_poms).toString());
        setEditIsStopwatch(task.total_poms < 0);
        setEditProjectId(task.project_id || 'none');
        setEditPriority(task.priority ?? 3);
    }, [task]);
    
    const handleSave = () => {
        if (editText.trim() === '') {
            alert("Task text cannot be empty.");
            return;
        }
        const newPoms = editIsStopwatch ? -1 : parseInt(editPoms, 10);
        if (isNaN(newPoms)) {
            alert("Pomodoros must be a number.");
            return;
        }
        if (!editIsStopwatch && newPoms <= 0) {
            alert("Pomodoros must be a positive number for regular tasks.");
            return;
        }

        const newTags = editTags.split(',').map(t => t.trim()).filter(Boolean);
        const finalProjectId = editProjectId === 'none' ? null : editProjectId;
        onUpdateTask(task.id, editText.trim(), newTags, newPoms, finalProjectId, editPriority);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditText(task.text);
        setEditTags(task.tags?.join(', ') || '');
        setEditPoms(Math.abs(task.total_poms).toString());
        setEditIsStopwatch(task.total_poms < 0);
        setEditProjectId(task.project_id || 'none');
        setEditPriority(task.priority ?? 3);
        setIsEditing(false);
    };

    const handleDelete = () => {
        setIsDeleting(true);
        setTimeout(() => {
            onDelete(task.id);
        }, 400); // Corresponds to animation duration
    };
    
    if (isEditing) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const todayString = getTodayDateString(today);
        const activeProjects = projects.filter(p => p.status === 'active' && (!p.start_date || p.start_date <= todayString) && (!p.active_days || p.active_days.length === 0 || p.active_days.includes(dayOfWeek)));
        return (
            <li ref={ref} className="bg-white/20 p-3 rounded-lg mb-2 ring-2 ring-cyan-400 animate-pulse-once">
                <div className="flex flex-col gap-2">
                    <input
                        type="text"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                        aria-label="Edit task text"
                    />
                    <input
                        type="text"
                        value={editTags}
                        onChange={e => setEditTags(e.target.value)}
                        placeholder="Tags (comma-separated)"
                        className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                        aria-label="Edit task tags"
                    />
                    <select value={editProjectId} onChange={e => setEditProjectId(e.target.value)} className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-white focus:outline-none focus:bg-white/30 focus:border-white/50">
                        <option value="none" className="bg-gray-800">No Project</option>
                        {activeProjects.map(p => <option key={p.id} value={p.id} className="bg-gray-800">{p.name}</option>)}
                    </select>
                     <div className="flex justify-between items-center gap-2 text-sm mt-2">
                        <div className="flex items-center gap-4">
                            <label htmlFor={`edit-poms-${task.id}`} className="text-white/70">Poms:</label>
                            <input
                                id={`edit-poms-${task.id}`}
                                type="number"
                                value={editPoms}
                                onChange={e => setEditPoms(e.target.value)}
                                title="Number of Pomodoros"
                                className="w-20 text-center bg-white/20 border border-white/30 rounded-lg p-2 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50 disabled:opacity-50"
                                aria-label="Edit pomodoros"
                                disabled={editIsStopwatch}
                            />
                            <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editIsStopwatch}
                                    onChange={e => setEditIsStopwatch(e.target.checked)}
                                    className="h-4 w-4 rounded bg-slate-600 border-slate-500 text-teal-400 focus:ring-teal-400/50"
                                />
                                Stopwatch
                            </label>
                        </div>
                        <PrioritySelector priority={editPriority} setPriority={setEditPriority} />
                    </div>
                     <div className="flex justify-end gap-2 mt-2">
                        <button onClick={handleCancel} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-gray-500 to-gray-600">Cancel</button>
                        <button onClick={handleSave} className="p-2 px-4 rounded-md font-bold text-white transition hover:scale-105 bg-gradient-to-br from-blue-500 to-cyan-600">Save</button>
                    </div>
                </div>
            </li>
        )
    }

    const priorityClass = priorityBorderColors[task.priority as number] ?? '';
    const animationClass = isDeleting ? 'animate-item-delete' : isJustAdded ? 'animate-item-add' : '';

    return (
    <li
        ref={ref}
        className={`flex flex-col sm:flex-row items-start sm:justify-between gap-2 p-3 rounded-lg mb-2 transition-all duration-200 ${
            isCompleted 
                ? 'bg-white/5 text-white/50 cursor-default' 
                : isDraggable
                ? 'bg-white/10 hover:bg-white/20'
                : 'bg-white/10'
        } ${priorityClass} ${animationClass}`}
        {...dragProps}
    >
        <div className="flex items-start gap-3 flex-grow min-w-0 w-full">
            {isDraggable && <span className="text-white/70 cursor-grab pt-1">☰</span>}
            <div className="flex-grow min-w-0">
                <span className={`break-words ${isCompleted ? 'line-through' : ''}`}>{task.text}</span>
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1 text-xs">
                    {displayDate && <span className="bg-slate-500/30 text-slate-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1"><CalendarIcon/> {new Date(displayDate + 'T00:00:00').toLocaleDateString()}</span>}
                    {task.projects && <span className="bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full">{task.projects.name}</span>}
                    {task.tags?.map(tag => <span key={tag} className="bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">{tag}</span>)}
                    {(task.custom_focus_duration || task.custom_break_duration) && 
                        <span className="bg-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-full" title={`Focus: ${task.custom_focus_duration || 'Default'}m, Break: ${task.custom_break_duration || 'Default'}m`}>
                            Custom Time
                        </span>
                    }
                </div>
            </div>
        </div>
        <div className="flex items-center justify-end gap-2 flex-shrink-0 w-full sm:w-auto pt-1 relative">
            <span className={`text-xs px-2 py-1 rounded ${isCompleted ? 'bg-white/10' : 'bg-white/20'}`}>
                {task.total_poms < 0 ? (
                     <span title="Stopwatch Task">⏱️</span>
                ) : (
                    `${task.completed_poms}/${task.total_poms}`
                )}
            </span>
            {/* FIX: Use correct `onBringTaskForward` prop. */}
            {isTomorrowTask && onBringTaskForward && (
                <button onClick={() => onBringTaskForward(task.id)} className="p-1 text-green-300 hover:text-green-200 transition" title="Move to Today">
                    <BringForwardIcon />
                </button>
            )}
            {onMove && (
                <>
                    <button onClick={() => onMove(task.id, 'postpone')} className="p-1 text-amber-300 hover:text-amber-200 transition" title="Postpone to Tomorrow"><PostponeIcon /></button>
                    <button onClick={() => onMove(task.id, 'duplicate')} className="p-1 text-amber-300 hover:text-amber-200 transition" title="Duplicate for Tomorrow"><DuplicateIcon /></button>
                </>
            )}
             {!isCompleted && (
                <>
                    <button onClick={() => setIsEditing(true)} className="p-1 text-sky-300 hover:text-sky-200 transition" title="Edit Task"><EditIcon /></button>
                    <button onClick={() => setIsSettingsOpen(o => !o)} className="p-1 text-cyan-300 hover:text-cyan-200 transition" title="Custom Timers"><MoreVerticalIcon /></button>
                </>
            )}
            {isCompleted && onMarkTaskIncomplete && (
                <button onClick={() => onMarkTaskIncomplete(task.id)} className="p-1 text-amber-300 hover:text-amber-200 transition" title="Mark as Incomplete">
                    <UndoIcon />
                </button>
            )}
            {!isCompleted && (
                <button onClick={handleDelete} className="text-red-400 hover:text-red-300 text-2xl font-bold leading-none p-1 transition" title="Delete Task">&times;</button>
            )}

            {isSettingsOpen && (
                <TaskSettingsDropdown task={task} settings={settings} onSave={onUpdateTaskTimers} onClose={() => setIsSettingsOpen(false)} />
            )}
        </div>
    </li>
)});


interface TaskInputGroupProps {
    onAddTask: (text: string, poms: number, dueDate: string, projectId: string | null, tags: string[], priority: number | null) => void;
    placeholder: string;
    buttonText: string;
    buttonClass: string;
    projects: Project[];
    onAddProject: (name: string) => Promise<string | null>;
    isPlanning?: boolean;
}

const TaskInputGroup: React.FC<TaskInputGroupProps> = ({ onAddTask, placeholder, buttonText, buttonClass, projects, onAddProject, isPlanning }) => {
    const [text, setText] = useState('');
    const [poms, setPoms] = useState('1');
    const [selectedProject, setSelectedProject] = useState<string>('none');
    const [tags, setTags] = useState('');
    const [priority, setPriority] = useState<number>(3);
    const [isStopwatch, setIsStopwatch] = useState(false);
    
    const getTomorrow = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return getTodayDateString(d);
    };
    const [dueDate, setDueDate] = useState(getTomorrow());

    const today = new Date();
    const dayOfWeek = today.getDay();
    const todayString = getTodayDateString(today);
    const activeProjects = projects.filter(p => p.status === 'active' && (!p.start_date || p.start_date <= todayString) && (!p.active_days || p.active_days.length === 0 || p.active_days.includes(dayOfWeek)));

    const handleAdd = () => {
        const pomsInt = isStopwatch ? -1 : parseInt(poms, 10);
        if (text.trim() && !isNaN(pomsInt)) {
            const projectId = selectedProject === 'none' ? null : selectedProject;
            const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
            const dateToAdd = isPlanning ? dueDate : getTodayDateString();
            onAddTask(text.trim(), pomsInt, dateToAdd, projectId, tagList, priority);
            setText('');
            setPoms('1');
            setTags('');
            setPriority(3);
            setIsStopwatch(false);
        }
    };
    
    const handleProjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === 'new') {
            const currentSelection = selectedProject;
            setSelectedProject(currentSelection);
            
            const newProjectName = prompt("Enter new project name:");

            if (newProjectName && newProjectName.trim()) {
                const newProjectId = await onAddProject(newProjectName.trim());
                if (newProjectId) {
                    setSelectedProject(newProjectId);
                } else {
                    alert("Failed to create the project.");
                }
            }
        } else {
            setSelectedProject(e.target.value);
        }
    };

    return (
        <div className="flex flex-col gap-3 mb-4">
            <input 
                type="text" 
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                placeholder={placeholder}
                className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-white/70 mb-1 flex items-center gap-1.5">
                        Project
                        <ExplanationTooltip title="Projects" content="Assign this task to a larger project to track progress towards a bigger goal." />
                    </label>
                    <select value={selectedProject} onChange={handleProjectChange} className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white focus:outline-none focus:bg-white/30 focus:border-white/50">
                        <option value="none" className="bg-gray-800">No Project</option>
                        {activeProjects.map(p => <option key={p.id} value={p.id} className="bg-gray-800">{p.name}</option>)}
                        <option value="new" className="text-blue-300 bg-gray-800">-- Create New Project --</option>
                    </select>
                </div>
                 <div>
                     <label className="text-xs text-white/70 mb-1 flex items-center gap-1.5">
                        Tags
                        <ExplanationTooltip title="Tags" content="Add comma-separated tags (e.g., 'coding', 'research') to categorize your work. This powers the Mastery Tracker and helps you see where your time goes." />
                    </label>
                    <input 
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="e.g., coding, research"
                        className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                    />
                </div>
            </div>
            {isPlanning && (
                <div>
                    <label className="text-xs text-white/70 mb-1">Due Date</label>
                    <input 
                        type="date"
                        value={dueDate}
                        min={getTomorrow()}
                        onChange={e => setDueDate(e.target.value)}
                        className="w-full bg-white/20 border border-white/30 rounded-lg p-3 text-white/80 focus:outline-none focus:bg-white/30 focus:border-white/50 text-center"
                        style={{colorScheme: 'dark'}}
                    />
                </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center sm:items-end">
                <div className="flex items-end gap-4">
                    <div>
                        <label className="text-xs text-white/70 mb-1 flex items-center gap-1.5">
                            Poms
                            <ExplanationTooltip title="What are 'Poms'?" content="Stands for Pomodoro sessions. Estimate how many focus sessions (e.g., 25 minutes) this task will take. This is for planning and tracking your effort." />
                        </label>
                        <input 
                            type="number"
                            max="10"
                            min="1"
                            value={poms}
                            onChange={(e) => setPoms(e.target.value)}
                            className="w-20 text-center bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50 disabled:opacity-50"
                            disabled={isStopwatch}
                        />
                    </div>
                     <label className="flex items-center gap-2 text-white/80 cursor-pointer text-sm pb-2">
                        <input
                            type="checkbox"
                            checked={isStopwatch}
                            onChange={e => setIsStopwatch(e.target.checked)}
                            className="h-4 w-4 rounded bg-slate-600 border-slate-500 text-teal-400 focus:ring-teal-400/50"
                        />
                        Stopwatch
                        <ExplanationTooltip title="Stopwatch Mode" content="For open-ended tasks where you don't know the duration. The timer will count up. Your total focus time is logged when you manually complete the task." />
                    </label>
                </div>
                 <div className="flex items-end gap-3">
                     <div>
                         <label className="text-xs text-white/70 mb-1 flex items-center gap-1.5">
                            Priority
                            <ExplanationTooltip title="Task Priority" content="Set a priority from 1 (Highest) to 4 (Lowest). This helps you decide what to work on next and can be used for sorting your task list." />
                        </label>
                        <PrioritySelector priority={priority} setPriority={setPriority} />
                    </div>
                    <button onClick={handleAdd} className={`self-end p-3 sm:px-4 rounded-lg font-bold text-white transition hover:scale-105 ${buttonClass}`}>{buttonText}</button>
                </div>
            </div>
        </div>
    );
};

interface CategoryFocusDropdownProps {
    tasks: Task[];
    settings: Settings;
    title: string;
}

const CategoryFocusDropdown: React.FC<CategoryFocusDropdownProps> = ({ tasks, settings, title }) => {
    const [isOpen, setIsOpen] = useState(false);

    const categoryData = useMemo(() => {
        const categoryMap = new Map<string, number>();

        tasks.forEach(task => {
            const remainingPoms = task.total_poms - task.completed_poms;
            if (remainingPoms > 0 && task.tags && task.tags.length > 0) {
                const focusDuration = task.custom_focus_duration || settings.focusDuration;
                const remainingMinutes = remainingPoms * focusDuration;
                
                task.tags.forEach(tag => {
                    const normalizedTag = tag.trim().toLowerCase();
                    if (normalizedTag) {
                        categoryMap.set(normalizedTag, (categoryMap.get(normalizedTag) || 0) + remainingMinutes);
                    }
                });
            }
        });

        return Array.from(categoryMap.entries())
            .map(([name, minutes]) => ({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                minutes
            }))
            .sort((a, b) => b.minutes - a.minutes);

    }, [tasks, settings]);

    if (categoryData.length === 0) {
        return null;
    }

    const topCategory = categoryData[0];

    return (
        <div className="relative mb-3">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-black/20 p-3 rounded-lg flex items-center justify-between transition hover:bg-black/30"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-cyan-300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zM13 15v-3h8.92c-.04.33-.08.66-.08 1 0 4.08-3.05 7.44-7 7.93v-1.93c-1.1 0-2-.9-2-2v-1h3zM13 4.07c1.02.32 1.94.8 2.75 1.42l-2.75 2.75V4.07zM4.93 7.5c1.4-1.4 3.3-2.17 5.07-1.93v2.68L4.93 7.5z"/></svg>
                    <span className="text-sm text-white/80">{title}:</span>
                    <span className="font-bold text-white">{topCategory.name} - {topCategory.minutes}m</span>
                </div>
                <svg className={`w-5 h-5 text-white/70 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-xl p-3 z-10 animate-slideUp">
                    <ul className="space-y-2">
                        {categoryData.map(item => (
                            <li key={item.name} className="flex justify-between items-center text-sm">
                                <span className="text-white/90">{item.name}</span>
                                <span className="font-semibold text-white bg-black/20 px-2 py-0.5 rounded">{item.minutes}m</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

interface TaskManagerProps {
    tasksToday: Task[];
    tasksForTomorrow: Task[];
    tasksFuture: Task[];
    completedToday: Task[];
    projects: Project[];
    settings: Settings;
    onAddTask: (text: string, poms: number, dueDate: string, projectId: string | null, tags: string[], priority: number | null) => void;
    onAddProject: (name: string) => Promise<string | null>;
    onDeleteTask: (id: string) => void;
    onMoveTask: (id: string, action: 'postpone' | 'duplicate') => void;
    onBringTaskForward: (id: string) => void;
    onReorderTasks: (reorderedTasks: Task[]) => void;
    onUpdateTaskTimers: (id: string, newTimers: { focus: number | null, break: number | null }) => void;
    onUpdateTask: (id: string, newText: string, newTags: string[], newPoms: number, projectId: string | null, priority: number | null) => void;
    onMarkTaskIncomplete: (id: string) => void;
    todaySortBy: 'default' | 'priority';
    onSortTodayByChange: (sortBy: 'default' | 'priority') => void;
}

const TaskManager: React.FC<TaskManagerProps> = ({ tasksToday, tasksForTomorrow, tasksFuture, completedToday, projects, settings, onAddTask, onAddProject, onDeleteTask, onMoveTask, onBringTaskForward, onReorderTasks, onUpdateTaskTimers, onUpdateTask, onMarkTaskIncomplete, todaySortBy, onSortTodayByChange }) => {
    
    const dragItemToday = React.useRef<number | null>(null);
    const dragOverItemToday = React.useRef<number | null>(null);

    const allTasks = useMemo(() => [...tasksToday, ...tasksForTomorrow, ...tasksFuture, ...completedToday], [tasksToday, tasksForTomorrow, tasksFuture, completedToday]);
    const [justAddedTaskId, setJustAddedTaskId] = useState<string | null>(null);
    const prevTasksCount = useRef(allTasks.length);

    useEffect(() => {
        if (allTasks.length > prevTasksCount.current) {
            const sortedTasks = [...allTasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            if (sortedTasks.length > 0) {
                const latestTask = sortedTasks[0];
                if (latestTask) {
                    setJustAddedTaskId(latestTask.id);
                    const timer = setTimeout(() => setJustAddedTaskId(null), 500);
                    return () => clearTimeout(timer);
                }
            }
        }
        prevTasksCount.current = allTasks.length;
    }, [allTasks]);

    const handleDragStartToday = (_: React.DragEvent<HTMLLIElement>, position: number) => { dragItemToday.current = position; };
    const handleDragEnterToday = (_: React.DragEvent<HTMLLIElement>, position: number) => { dragOverItemToday.current = position; };
    const handleDropToday = () => {
        if (dragItemToday.current === null || dragOverItemToday.current === null) return;
        const reordered = [...tasksToday];
        const dragItemContent = reordered[dragItemToday.current];
        reordered.splice(dragItemToday.current, 1);
        reordered.splice(dragOverItemToday.current, 0, dragItemContent);
        dragItemToday.current = null;
        dragOverItemToday.current = null;
        onReorderTasks(reordered);
    };

    const dragItemTomorrow = React.useRef<number | null>(null);
    const dragOverItemTomorrow = React.useRef<number | null>(null);
    
    const handleDragStartTomorrow = (_: React.DragEvent<HTMLLIElement>, position: number) => { dragItemTomorrow.current = position; };
    const handleDragEnterTomorrow = (_: React.DragEvent<HTMLLIElement>, position: number) => { dragOverItemTomorrow.current = position; };
    const handleDropTomorrow = () => {
        if (dragItemTomorrow.current === null || dragOverItemTomorrow.current === null) return;
        const reordered = [...tasksForTomorrow];
        const dragItemContent = reordered[dragItemTomorrow.current];
        reordered.splice(dragItemTomorrow.current, 1);
        reordered.splice(dragOverItemTomorrow.current, 0, dragItemContent);
        dragItemTomorrow.current = null;
        dragOverItemTomorrow.current = null;
        onReorderTasks(reordered);
    };

    const dragItemFuture = React.useRef<number | null>(null);
    const dragOverItemFuture = React.useRef<number | null>(null);
    
    const handleDragStartFuture = (_: React.DragEvent<HTMLLIElement>, position: number) => { dragItemFuture.current = position; };
    const handleDragEnterFuture = (_: React.DragEvent<HTMLLIElement>, position: number) => { dragOverItemFuture.current = position; };
    const handleDropFuture = () => {
        if (dragItemFuture.current === null || dragOverItemFuture.current === null) return;
        const reordered = [...tasksFuture];
        const dragItemContent = reordered[dragItemFuture.current];
        reordered.splice(dragItemFuture.current, 1);
        reordered.splice(dragOverItemFuture.current, 0, dragItemContent);
        dragItemFuture.current = null;
        dragOverItemFuture.current = null;
        onReorderTasks(reordered);
    };

    const tomorrowTasksCount = tasksForTomorrow.length;
    const tomorrowFocusTime = useMemo(() => {
        return tasksForTomorrow.reduce((total, task) => {
            const focusDuration = task.custom_focus_duration || settings.focusDuration;
            // For future tasks, all pomodoros are remaining
            return total + (task.total_poms * focusDuration);
        }, 0);
    }, [tasksForTomorrow, settings.focusDuration]);

    return (
        <>
            <Panel title="📝 Today's Tasks">
                <TaskInputGroup 
                    onAddTask={onAddTask}
                    placeholder="Enter a new task..."
                    buttonText="Add"
                    buttonClass="bg-gradient-to-br from-green-500 to-emerald-600"
                    projects={projects}
                    onAddProject={onAddProject}
                />
                <CategoryFocusDropdown tasks={tasksToday} settings={settings} title="Est. Focus by Category" />
                <div className="flex justify-end mb-2">
                    <button
                        onClick={() => onSortTodayByChange(todaySortBy === 'default' ? 'priority' : 'default')}
                        className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold px-3 py-1 rounded-full hover:bg-white/10 transition"
                        aria-label={`Sort tasks by ${todaySortBy === 'default' ? 'priority' : 'default order'}`}
                    >
                        Sort by: {todaySortBy === 'default' ? 'Default' : 'Priority'}
                    </button>
                </div>
                <ul 
                    className="max-h-64 overflow-y-auto pr-2"
                    onDragOver={(e) => e.preventDefault()}
                >
                    {tasksToday.map((task) => (
                        <TaskItem 
                            key={task.id} 
                            task={task} 
                            isCompleted={false} 
                            settings={settings}
                            projects={projects}
                            onDelete={onDeleteTask} 
                            onMove={onMoveTask}
                            onUpdateTaskTimers={onUpdateTaskTimers}
                            onUpdateTask={onUpdateTask}
                            isJustAdded={task.id === justAddedTaskId}
                            dragProps={todaySortBy === 'default' ? { 
                                draggable: true, 
                                onDragStart: (e: React.DragEvent<HTMLLIElement>) => handleDragStartToday(e, tasksToday.findIndex(t => t.id === task.id)),
                                onDragEnter: (e: React.DragEvent<HTMLLIElement>) => handleDragEnterToday(e, tasksToday.findIndex(t => t.id === task.id)),
                                onDragEnd: handleDropToday
                            } : undefined}
                        />
                    ))}
                    {completedToday.map(task => (
                        <TaskItem key={task.id} task={task} isCompleted={true} settings={settings} projects={projects} onDelete={onDeleteTask} onUpdateTaskTimers={onUpdateTaskTimers} onUpdateTask={onUpdateTask} onMarkTaskIncomplete={onMarkTaskIncomplete} />
                    ))}
                    {tasksToday.length === 0 && completedToday.length === 0 && <p className="text-center text-white/60 p-4">All done! Add a new task to get started.</p>}
                </ul>
            </Panel>
            
            <Panel title="🗓️ Plan a Task">
                <TaskInputGroup 
                    onAddTask={onAddTask}
                    placeholder="Plan for the future..."
                    buttonText="Plan"
                    buttonClass="bg-gradient-to-br from-amber-500 to-orange-600"
                    projects={projects}
                    onAddProject={onAddProject}
                    isPlanning={true}
                />
                <div className="flex justify-between items-baseline mb-2 mt-4">
                    <h3 className="text-lg font-bold text-white">Tomorrow's Tasks</h3>
                    {tomorrowTasksCount > 0 && (
                        <div className="text-xs text-white/80 flex items-center gap-3">
                            <span>Total Tasks: <span className="font-bold text-white">{tomorrowTasksCount}</span></span>
                            <span>Total Focus: <span className="font-bold text-white">{tomorrowFocusTime}m</span></span>
                        </div>
                    )}
                </div>
                <CategoryFocusDropdown tasks={tasksForTomorrow} settings={settings} title="Est. Focus by Category" />
                <ul className="max-h-48 overflow-y-auto pr-2" onDragOver={(e) => e.preventDefault()}>
                    {tasksForTomorrow.map((task, index) => (
                        <TaskItem 
                           key={task.id} 
                           task={task} 
                           isCompleted={false} 
                           settings={settings} 
                           projects={projects}
                           onDelete={onDeleteTask} 
                           onUpdateTaskTimers={onUpdateTaskTimers}
                           onUpdateTask={onUpdateTask}
                           isTomorrowTask={true}
                           isJustAdded={task.id === justAddedTaskId}
                           onBringTaskForward={onBringTaskForward}
                           dragProps={{
                               draggable: true,
                               onDragStart: (e) => handleDragStartTomorrow(e, index),
                               onDragEnter: (e) => handleDragEnterTomorrow(e, index),
                               onDragEnd: handleDropTomorrow,
                           }}
                        />
                    ))}
                    {tasksForTomorrow.length === 0 && <p className="text-center text-white/60 p-4">No tasks planned for tomorrow.</p>}
                </ul>
            </Panel>

            <Panel title="🛰️ Future Tasks">
                 <ul className="max-h-48 overflow-y-auto pr-2" onDragOver={(e) => e.preventDefault()}>
                    {tasksFuture.map((task, index) => (
                        <TaskItem 
                           key={task.id} 
                           task={task} 
                           isCompleted={false} 
                           settings={settings} 
                           projects={projects}
                           onDelete={onDeleteTask} 
                           onUpdateTaskTimers={onUpdateTaskTimers}
                           onUpdateTask={onUpdateTask}
                           isTomorrowTask={true}
                           displayDate={task.due_date}
                           isJustAdded={task.id === justAddedTaskId}
                           // FIX: Corrected typo from onBringForward to onBringTaskForward
                           onBringTaskForward={onBringTaskForward}
                           dragProps={{
                               draggable: true,
                               onDragStart: (e) => handleDragStartFuture(e, index),
                               onDragEnter: (e) => handleDragEnterFuture(e, index),
                               onDragEnd: handleDropFuture,
                           }}
                        />
                    ))}
                    {tasksFuture.length === 0 && <p className="text-center text-white/60 p-4">No future tasks scheduled.</p>}
                </ul>
            </Panel>
        </>
    );
};

export default TaskManager;