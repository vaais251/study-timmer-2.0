
import React from 'react';
import { Task } from '../types';
import TaskManager from '../components/TaskManager';

interface PlanPageProps {
    tasks: Task[];
    tasksForTomorrow: Task[];
    completedToday: Task[];
    onAddTask: (text: string, poms: number, isTomorrow: boolean) => void;
    onDeleteTask: (id: string, isTomorrow: boolean) => void;
    onMoveTask: (id: string, action: 'postpone' | 'duplicate') => void;
    onReorderTasks: (reorderedTasks: Task[]) => void;
}

const PlanPage: React.FC<PlanPageProps> = (props) => {
    return (
        <TaskManager
            tasks={props.tasks}
            tasksForTomorrow={props.tasksForTomorrow}
            completedToday={props.completedToday}
            onAddTask={props.onAddTask}
            onDeleteTask={props.onDeleteTask}
            onMoveTask={props.onMoveTask}
            onReorderTasks={props.onReorderTasks}
        />
    );
};

export default PlanPage;
