import React, { useState } from 'react';
import { Task, Project } from '../types';
import Panel from './common/Panel';
import { PostponeIcon, DuplicateIcon } from './common/Icons';

interface TaskItemProps {
    task: Task;
    isCompleted: boolean;
    isTomorrow: boolean;
    onDelete: (id: string) => void;
    onMove?: (id: string, action: 'postpone' | 'duplicate') => void;
    dragProps?: object;
    ref?: React.Ref<HTMLLIElement>;
}

const TaskItem = React.forwardRef<HTMLLIElement, TaskItemProps>(({ task, isCompleted, isTomorrow, onDelete, onMove, dragProps }, ref) => (
    <li
        ref={ref}
        className={`flex items-start justify-between gap-2 p-3 rounded-lg mb-2 transition-all duration-200 ${
            isCompleted 
                ? 'bg-white/5 text-white/50 cursor-default' 
                : isTomorrow
                ? 'bg-white/5 border border-dashed border-amber-400/30'
                : 'bg-white/10 hover:bg-white/20'
        }`}
        {...dragProps}
    >
        <div className="flex items-start gap-3 flex-grow min-w-0">
            {!isCompleted && !isTomorrow && <span className="text-white/70 cursor-grab pt-1">☰</span>}
            <div className="flex-grow min-w-0">
                <span className={`break-words ${isCompleted ? 'line-through' : ''}`}>{task.text}</span>
                <div className="flex items-center gap-2 mt-1 text-xs">
                    {task.projects && <span className="bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full">{task.projects.name}</span>}
                    {task.tags?.map(tag => <span key={tag} className="bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">{tag}</span>)}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
            <span className={`text-xs px-2 py-1 rounded ${isTomorrow ? 'bg-amber-400/20 text-amber-300' : 'bg-white/20'}`}>
                {task.completed_poms}/{task.total_poms}
            </span>
            {!isCompleted && !isTomorrow && onMove && (
                <>
                    <button onClick={() => onMove(task.id, 'postpone')} className="p-1 text-amber-300 hover:text-amber-200 transition" title="Postpone to Tomorrow"><PostponeIcon /></button>
                    <button onClick={() => onMove(task.id, 'duplicate')} className="p-1 text-amber-300 hover:text-amber-200 transition" title="Duplicate for Tomorrow"><DuplicateIcon /></button>
                </>
            )}
            {!isCompleted && (
                <button onClick={() => onDelete(task.id)} className="text-red-400 hover:text-red-300 text-2xl font-bold leading-none p-1 transition" title="Delete Task">&times;</button>
            )}
        </div>
    </li>
));


interface TaskInputGroupProps {
    onAddTask: (text: string, poms: number, projectId: string | null, tags: string[]) => void;
    placeholder: string;
    buttonText: string;
    buttonClass: string;
    projects: Project[];
    onAddProject: (name: string) => Promise<string | null>;
}

const TaskInputGroup: React.FC<TaskInputGroupProps> = ({ onAddTask, placeholder, buttonText, buttonClass, projects, onAddProject }) => {
    const [text, setText] = useState('');
    const [poms, setPoms] = useState('1');
    const [selectedProject, setSelectedProject] = useState<string>('none');
    const [tags, setTags] = useState('');
    
    const activeProjects = projects.filter(p => !p.completed_at);

    const handleAdd = () => {
        if (text.trim() && parseInt(poms) > 0) {
            const projectId = selectedProject === 'none' ? null : selectedProject;
            const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
            onAddTask(text.trim(), parseInt(poms), projectId, tagList);
            setText('');
            setPoms('1');
            setTags('');
        }
    };
    
    const handleProjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === 'new') {
            const currentSelection = selectedProject;
            const newProjectName = prompt("Enter new project name:");

            if (newProjectName && newProjectName.trim()) {
                const newProjectId = await onAddProject(newProjectName.trim());
                if (newProjectId) {
                    setSelectedProject(newProjectId);
                } else {
                    alert("Failed to create the project.");
                    setSelectedProject(currentSelection);
                }
            } else {
                setSelectedProject(currentSelection);
            }
        } else {
            setSelectedProject(e.target.value);
        }
    };

    return (
        <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
                <input 
                    type="text" 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder={placeholder}
                    className="flex-grow bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                />
                <input 
                    type="number"
                    min="1" max="10"
                    value={poms}
                    onChange={(e) => setPoms(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Poms"
                    className="w-full sm:w-20 text-center bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                 <select value={selectedProject} onChange={handleProjectChange} className="flex-grow bg-white/20 border border-white/30 rounded-lg p-3 text-white focus:outline-none focus:bg-white/30 focus:border-white/50">
                    <option value="none" className="bg-gray-800">No Project</option>
                    {activeProjects.map(p => <option key={p.id} value={p.id} className="bg-gray-800">{p.name}</option>)}
                    <option value="new" className="text-blue-300 bg-gray-800">-- Create New Project --</option>
                </select>
                <input 
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Tags (comma-separated)"
                    className="flex-grow bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                />
                <button onClick={handleAdd} className={`p-3 sm:px-4 rounded-lg font-bold text-white transition hover:scale-105 ${buttonClass}`}>{buttonText}</button>
            </div>
        </div>
    );
};

interface TaskManagerProps {
    tasksToday: Task[];
    tasksForTomorrow: Task[];
    completedToday: Task[];
    projects: Project[];
    onAddTask: (text: string, poms: number, isTomorrow: boolean, projectId: string | null, tags: string[]) => void;
    onAddProject: (name: string) => Promise<string | null>;
    onDeleteTask: (id: string) => void;
    onMoveTask: (id: string, action: 'postpone' | 'duplicate') => void;
    onReorderTasks: (reorderedTasks: Task[]) => void;
}

const TaskManager: React.FC<TaskManagerProps> = ({ tasksToday, tasksForTomorrow, completedToday, projects, onAddTask, onAddProject, onDeleteTask, onMoveTask, onReorderTasks }) => {
    
    const dragItem = React.useRef<number | null>(null);
    const dragOverItem = React.useRef<number | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, position: number) => {
        dragItem.current = position;
    };

    const handleDragEnter = (e: React.DragEvent<HTMLLIElement>, position: number) => {
        dragOverItem.current = position;
    };

    const handleDrop = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        
        const reordered = [...tasksToday];
        const dragItemContent = reordered[dragItem.current];
        reordered.splice(dragItem.current, 1);
        reordered.splice(dragOverItem.current, 0, dragItemContent);
        
        dragItem.current = null;
        dragOverItem.current = null;
        onReorderTasks(reordered);
    };

    return (
        <>
            <Panel title="📝 Today's Tasks">
                <TaskInputGroup 
                    onAddTask={(text, poms, projectId, tags) => onAddTask(text, poms, false, projectId, tags)}
                    placeholder="Enter a new task..."
                    buttonText="Add"
                    buttonClass="bg-gradient-to-br from-green-500 to-emerald-600"
                    projects={projects}
                    onAddProject={onAddProject}
                />
                <ul 
                    className="max-h-64 overflow-y-auto pr-2"
                    onDragOver={(e) => e.preventDefault()}
                >
                    {tasksToday.map((task, index) => (
                        <TaskItem 
                            key={task.id} 
                            task={task} 
                            isCompleted={false} 
                            isTomorrow={false}
                            onDelete={onDeleteTask} 
                            onMove={onMoveTask} 
                            dragProps={{ 
                                draggable: true, 
                                onDragStart: (e) => handleDragStart(e, index),
                                onDragEnter: (e) => handleDragEnter(e, index),
                                onDragEnd: handleDrop
                            }}
                        />
                    ))}
                    {completedToday.map(task => (
                        <TaskItem key={task.id} task={task} isCompleted={true} isTomorrow={false} onDelete={onDeleteTask} />
                    ))}
                    {tasksToday.length === 0 && completedToday.length === 0 && <p className="text-center text-white/60 p-4">All done! Add a new task to get started.</p>}
                </ul>
            </Panel>
            
            <Panel title="🗓️ Tomorrow's Tasks">
                <TaskInputGroup 
                    onAddTask={(text, poms, projectId, tags) => onAddTask(text, poms, true, projectId, tags)}
                    placeholder="Plan for tomorrow..."
                    buttonText="Plan"
                    buttonClass="bg-gradient-to-br from-amber-500 to-orange-600"
                    projects={projects}
                    onAddProject={onAddProject}
                />
                <ul className="max-h-48 overflow-y-auto pr-2">
                    {tasksForTomorrow.map(task => (
                        <TaskItem key={task.id} task={task} isCompleted={false} isTomorrow={true} onDelete={onDeleteTask} />
                    ))}
                    {tasksForTomorrow.length === 0 && <p className="text-center text-white/60 p-4">No tasks planned for tomorrow.</p>}
                </ul>
            </Panel>
        </>
    );
};

export default TaskManager;