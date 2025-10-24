
import React, { useState } from 'react';
import { Task } from '../types';
import Panel from './common/Panel';
import { PostponeIcon, DuplicateIcon } from './common/Icons';

interface TaskItemProps {
    task: Task;
    isCompleted: boolean;
    isTomorrow: boolean;
    onDelete: (id: string, isTomorrow: boolean) => void;
    onMove?: (id: string, action: 'postpone' | 'duplicate') => void;
    dragProps?: object;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, isCompleted, isTomorrow, onDelete, onMove, dragProps }) => (
    <li
        className={`flex items-center justify-between gap-2 p-3 rounded-lg mb-2 transition-all duration-200 ${
            isCompleted 
                ? 'bg-white/5 text-white/50 cursor-default' 
                : isTomorrow
                ? 'bg-white/5 border border-dashed border-amber-400/30'
                : 'bg-white/10 hover:bg-white/20 hover:scale-102'
        }`}
        {...dragProps}
    >
        <div className="flex items-center gap-3 flex-grow min-w-0">
            {!isCompleted && !isTomorrow && <span className="text-white/70 cursor-grab">☰</span>}
            <span className={`flex-grow min-w-0 break-words ${isCompleted ? 'line-through' : ''}`}>{task.text}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs px-2 py-1 rounded ${isTomorrow ? 'bg-amber-400/20 text-amber-300' : 'bg-white/20'}`}>
                {task.completedPoms}/{task.totalPoms}
            </span>
            {!isCompleted && !isTomorrow && onMove && (
                <>
                    <button onClick={() => onMove(task.id, 'postpone')} className="p-1 text-amber-300 hover:text-amber-200 transition" title="Postpone to Tomorrow"><PostponeIcon /></button>
                    <button onClick={() => onMove(task.id, 'duplicate')} className="p-1 text-amber-300 hover:text-amber-200 transition" title="Duplicate for Tomorrow"><DuplicateIcon /></button>
                </>
            )}
            {!isCompleted && (
                <button onClick={() => onDelete(task.id, isTomorrow)} className="text-red-400 hover:text-red-300 text-2xl font-bold leading-none p-1 transition" title="Delete Task">&times;</button>
            )}
        </div>
    </li>
);

interface TaskInputGroupProps {
    onAddTask: (text: string, poms: number) => void;
    placeholder: string;
    buttonText: string;
    buttonClass: string;
}

const TaskInputGroup: React.FC<TaskInputGroupProps> = ({ onAddTask, placeholder, buttonText, buttonClass }) => {
    const [text, setText] = useState('');
    const [poms, setPoms] = useState('');

    const handleAdd = () => {
        if (text.trim() && (parseInt(poms) > 0 || poms === '')) {
            onAddTask(text.trim(), parseInt(poms) || 1);
            setText('');
            setPoms('');
        }
    };
    
    return (
        <div className="flex gap-2 mb-4">
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
                className="w-20 text-center bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
            />
            <button onClick={handleAdd} className={`px-4 rounded-lg font-bold text-white transition hover:scale-105 ${buttonClass}`}>{buttonText}</button>
        </div>
    );
};

interface TaskManagerProps {
    tasks: Task[];
    tasksForTomorrow: Task[];
    completedToday: Task[];
    onAddTask: (text: string, poms: number, isTomorrow: boolean) => void;
    onDeleteTask: (id: string, isTomorrow: boolean) => void;
    onMoveTask: (id: string, action: 'postpone' | 'duplicate') => void;
    onReorderTasks: (reorderedTasks: Task[]) => void;
}

const TaskManager: React.FC<TaskManagerProps> = ({ tasks, tasksForTomorrow, completedToday, onAddTask, onDeleteTask, onMoveTask, onReorderTasks }) => {
    
    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
        e.dataTransfer.setData("taskIndex", index.toString());
    };

    const handleDrop = (e: React.DragEvent<HTMLUListElement>, targetIndex: number) => {
        const sourceIndex = parseInt(e.dataTransfer.getData("taskIndex"));
        if (sourceIndex === targetIndex) return;

        const reordered = [...tasks];
        const [movedTask] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, movedTask);
        onReorderTasks(reordered);
    };

    return (
        <>
            <Panel title="📝 Today's Tasks">
                <TaskInputGroup 
                    onAddTask={(text, poms) => onAddTask(text, poms, false)}
                    placeholder="Enter a new task..."
                    buttonText="Add"
                    buttonClass="bg-gradient-to-br from-green-500 to-emerald-600"
                />
                <ul 
                    className="max-h-64 overflow-y-auto pr-2"
                    onDragOver={(e) => e.preventDefault()}
                >
                    {tasks.map((task, index) => (
                        <TaskItem 
                            key={task.id} 
                            task={task} 
                            isCompleted={false} 
                            isTomorrow={false}
                            onDelete={onDeleteTask} 
                            onMove={onMoveTask} 
                            dragProps={{ draggable: true, onDragStart: (e) => handleDragStart(e, index), onDrop: (e) => handleDrop(e, index) }}
                        />
                    ))}
                    {completedToday.map(task => (
                        <TaskItem key={task.id} task={task} isCompleted={true} isTomorrow={false} onDelete={onDeleteTask} />
                    ))}
                    {tasks.length === 0 && completedToday.length === 0 && <p className="text-center text-white/60 p-4">All done! Add a new task to get started.</p>}
                </ul>
            </Panel>
            
            <Panel title="🗓️ Tomorrow's Tasks">
                <TaskInputGroup 
                    onAddTask={(text, poms) => onAddTask(text, poms, true)}
                    placeholder="Plan for tomorrow..."
                    buttonText="Plan"
                    buttonClass="bg-gradient-to-br from-amber-500 to-orange-600"
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
