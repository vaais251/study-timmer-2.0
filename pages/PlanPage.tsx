import React from 'react';
import { Task, Project, Settings } from '../types';
import TaskManager from '../components/TaskManager';

interface PlanPageProps {
    tasksToday: Task[];
    tasksForTomorrow: Task[];
    completedToday: Task[];
    projects: Project[];
    settings: Settings;
    onAddTask: (text: string, poms: number, isTomorrow: boolean, projectId: string | null, tags: string[]) => void;
    onAddProject: (name: string) => Promise<string | null>;
    onDeleteTask: (id: string) => void;
    onMoveTask: (id: string, action: 'postpone' | 'duplicate') => void;
    onReorderTasks: (reorderedTasks: Task[]) => void;
    onUpdateTaskTimers: (id: string, newTimers: { focus: number | null, break: number | null }) => void;
    onMarkTaskIncomplete: (id: string) => void;
}

const PlanPage: React.FC<PlanPageProps> = (props) => {
    return (
        <TaskManager
            tasksToday={props.tasksToday}
            tasksForTomorrow={props.tasksForTomorrow}
            completedToday={props.completedToday}
            projects={props.projects}
            settings={props.settings}
            onAddTask={props.onAddTask}
            onAddProject={props.onAddProject}
            onDeleteTask={props.onDeleteTask}
            onMoveTask={props.onMoveTask}
            onReorderTasks={props.onReorderTasks}
            onUpdateTaskTimers={props.onUpdateTaskTimers}
            onMarkTaskIncomplete={props.onMarkTaskIncomplete}
        />
    );
};

export default PlanPage;