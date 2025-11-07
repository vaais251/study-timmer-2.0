import React from 'react';
import { Task } from '../types';
import Panel from './common/Panel';

interface FocusQueueProps {
    nextTasks: Task[];
}

const FocusQueue: React.FC<FocusQueueProps> = ({ nextTasks }) => {
    return (
        <Panel title="Up Next" className="h-full flex flex-col">
            <div className="flex-grow flex flex-col justify-center">
                {nextTasks.length > 0 ? (
                    <ul className="space-y-2">
                        {nextTasks.slice(0, 3).map((task, index) => (
                            <li 
                                key={task.id} 
                                className="bg-black/20 text-slate-300 p-3 rounded-lg text-sm truncate shadow-inner flex items-center gap-3"
                                style={{ animation: `fadeIn 0.5s ease-out ${index * 0.1}s forwards`, opacity: 0 }}
                            >
                                <span className="font-bold text-slate-500">{index + 1}.</span>
                                <span className="flex-grow">{task.text}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-slate-500 text-sm text-center italic p-4">
                        Queue is empty.
                    </p>
                )}
            </div>
        </Panel>
    );
};

export default FocusQueue;