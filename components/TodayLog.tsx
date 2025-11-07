import React from 'react';
import { PomodoroHistory, Task } from '../types';
import Panel from './common/Panel';

interface TodayLogProps {
    todaysHistory: PomodoroHistory[];
    tasks: Task[];
}

const TodayLog: React.FC<TodayLogProps> = ({ todaysHistory, tasks }) => {
    const taskMap = new Map<string, string>();
    tasks.forEach(task => taskMap.set(task.id, task.text));

    const reversedHistory = [...todaysHistory].reverse();

    return (
        <Panel title="Today's Activity" className="h-full flex flex-col">
            <ul className="custom-scrollbar flex-grow space-y-1 overflow-y-auto pr-2 text-sm">
                {reversedHistory.length > 0 ? (
                    reversedHistory.map(item => {
                        const taskText = item.task_id ? taskMap.get(item.task_id) : 'Unspecified';
                        return (
                            <li key={item.id} className="flex justify-between items-center py-1">
                                <span className="text-slate-300 truncate" title={taskText || 'Unspecified'}>
                                    {taskText || 'Unspecified'}
                                </span>
                                <span className="font-semibold text-green-400 flex-shrink-0 ml-2">{item.duration_minutes} min</span>
                            </li>
                        );
                    })
                ) : (
                     <li className="text-center text-slate-500 h-full flex items-center justify-center">
                        <p>No sessions logged yet today.</p>
                    </li>
                )}
            </ul>
        </Panel>
    );
};

export default TodayLog;