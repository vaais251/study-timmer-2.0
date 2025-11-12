import React, { useState } from 'react';
import { Task, Project, Settings } from '../types';
import TaskManager from '../components/TaskManager';
import ExpertiseTracker from '../components/ExpertiseTracker';
import AutomationsManager from '../components/AutomationsManager';

interface PlanPageProps {
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
    recurringTasks: Task[];
    onAddRecurringTask: (taskData: Partial<Task>) => void;
    onUpdateRecurringTask: (id: string, updates: Partial<Task>) => void;
    onDeleteRecurringTask: (id: string) => void;
    onSetRecurringTaskActive: (id: string, isActive: boolean) => void;
}

const PlanPage: React.FC<PlanPageProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'planner' | 'mastery' | 'automations'>('planner');

    return (
        <>
            <h1 className="text-3xl font-bold text-white mb-6 animate-slideInFromLeft">Plan Your Success</h1>
            {/* Tab Navigation */}
            <div className="mb-6 flex justify-center gap-2 bg-slate-800/50 p-1 rounded-full max-w-md mx-auto">
                <button
                    onClick={() => setActiveTab('planner')}
                    className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${
                        activeTab === 'planner'
                            ? 'bg-slate-700 text-white shadow-inner'
                            : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                    }`}
                >
                    Task Planner
                </button>
                <button
                    onClick={() => setActiveTab('mastery')}
                    className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${
                        activeTab === 'mastery'
                            ? 'bg-slate-700 text-white shadow-inner'
                            : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                    }`}
                >
                    Mastery Tracker
                </button>
                 <button
                    onClick={() => setActiveTab('automations')}
                    className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${
                        activeTab === 'automations'
                            ? 'bg-slate-700 text-white shadow-inner'
                            : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                    }`}
                >
                    Automations
                </button>
            </div>
            
            {/* Conditional Content */}
            <div key={activeTab} className="animate-fadeIn">
                {activeTab === 'planner' && (
                    <TaskManager
                        tasksToday={props.tasksToday}
                        tasksForTomorrow={props.tasksForTomorrow}
                        tasksFuture={props.tasksFuture}
                        completedToday={props.completedToday}
                        projects={props.projects}
                        settings={props.settings}
                        onAddTask={props.onAddTask}
                        onAddProject={props.onAddProject}
                        onDeleteTask={props.onDeleteTask}
                        onMoveTask={props.onMoveTask}
                        onBringTaskForward={props.onBringTaskForward}
                        onReorderTasks={props.onReorderTasks}
                        onUpdateTaskTimers={props.onUpdateTaskTimers}
                        onUpdateTask={props.onUpdateTask}
                        onMarkTaskIncomplete={props.onMarkTaskIncomplete}
                        todaySortBy={props.todaySortBy}
                        onSortTodayByChange={props.onSortTodayByChange}
                    />
                )}
                {activeTab === 'mastery' && (
                    <ExpertiseTracker />
                )}
                {activeTab === 'automations' && (
                     <AutomationsManager
                        recurringTasks={props.recurringTasks}
                        projects={props.projects}
                        onAddProject={props.onAddProject}
                        onAddRecurringTask={props.onAddRecurringTask}
                        onUpdateRecurringTask={props.onUpdateRecurringTask}
                        onDeleteRecurringTask={props.onDeleteRecurringTask}
                        onSetRecurringTaskActive={props.onSetRecurringTaskActive}
                    />
                )}
            </div>
        </>
    );
};

export default PlanPage;