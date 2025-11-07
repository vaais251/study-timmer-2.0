

import React from 'react';
import { CheckIcon, TargetIcon, TimerIcon, PlanIcon } from './common/Icons';

interface SessionInfoProps {
    completedTasksToday: number;
    totalTasksToday: number;
    remainingTasksToday: number;
    focusLeft: string;
}

const InfoItem: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex items-center gap-3">
        <div className="text-cyan-400 p-2 bg-black/20 rounded-full">{icon}</div>
        <div>
            <div className="text-lg font-bold text-white">{value}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">{label}</div>
        </div>
    </div>
);


const SessionInfo: React.FC<SessionInfoProps> = ({ completedTasksToday, totalTasksToday, remainingTasksToday, focusLeft }) => {
    return (
        <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-3 border border-slate-700/80 flex flex-wrap items-center justify-around gap-x-6 gap-y-3 animate-slideUp">
            <InfoItem label="Tasks Done" value={completedTasksToday} icon={<CheckIcon />} />
            <InfoItem label="Tasks Left" value={remainingTasksToday} icon={<TargetIcon />} />
            <InfoItem label="Est. Focus" value={focusLeft} icon={<TimerIcon />} />
            <InfoItem label="Total Today" value={totalTasksToday} icon={<PlanIcon />} />
        </div>
    );
};

export default SessionInfo;