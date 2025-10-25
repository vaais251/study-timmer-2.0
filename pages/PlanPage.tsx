
import React from 'react';
import { Task, Project } from '../types';
import TaskManager from '../components/TaskManager';

interface PlanPageProps {
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

const PlanPage: React.FC<PlanPageProps> = (props) => {
    return (
        <TaskManager
            tasksToday={props.tasksToday}
            tasksForTomorrow={props.tasksForTomorrow}
            completedToday={props.completedToday}
            projects={props.projects}
            onAddTask={props.onAddTask}
            onAddProject={props.onAddProject}
            onDeleteTask={props.onDeleteTask}
            onMoveTask={props.onMoveTask}
            onReorderTasks={props.onReorderTasks}
        />
    );
};

export default PlanPage;
