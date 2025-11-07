import React from 'react';
import { Task } from '../types';
import Panel from './common/Panel';

interface FocusQueueProps {
    currentTask?: Task;
    nextTasks: Task[];
}

const FocusQueue: React.FC<FocusQueueProps> = ({ currentTask, nextTasks }) => {
    return (
        <Panel title="Focus Queue" className="h-full flex flex-col">
            <div className="space-y-4 flex-grow flex flex-col justify-between">
                <div>
                    <h3 className="text-sm font-semibold uppercase text-teal-400 tracking-wider mb-2">Current</h3>
                    {currentTask ? (
                         <div className="bg-[#0f172a] border border-teal-500 p-4 rounded-lg text-center">
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-500 mb-2 text-teal-400">
                                ◎
                            </div>
                            <span className="font-semibold text-base block break-words">{currentTask.text}</span>
                        </div>
                    ) : (
                        <div className="bg-black/20 text-slate-400 p-3 rounded-lg shadow-inner text-center italic">
                            All tasks for today are complete!
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-sm font-semibold uppercase text-slate-400 tracking-wider mb-2 mt-4">Up Next</h3>
                    <ul className="space-y-2">
                        {nextTasks.slice(0, 3).map(task => (
                            <li key={task.id} className="bg-black/20 text-slate-300 p-2 rounded-lg text-sm truncate">
                                {task.text}
                            </li>
                        ))}
                        {nextTasks.length === 0 && (
                            <p className="text-slate-500 text-sm text-center italic">
                                Queue is empty.
                            </p>
                        )}
                    </ul>
                </div>
            </div>
        </Panel>
    );
};

export default FocusQueue;