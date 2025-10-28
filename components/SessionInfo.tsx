

import React from 'react';

interface SessionInfoProps {
    completedTasksToday: number;
    totalTasksToday: number;
    remainingTasksToday: number;
    focusLeft: string;
}

const InfoItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div className="text-center">
        <div className="text-xs sm:text-sm text-white/80 uppercase tracking-wider mb-1">{label}</div>
        <div className="text-2xl sm:text-3xl text-white font-semibold">{value}</div>
    </div>
);

const SessionInfo: React.FC<SessionInfoProps> = ({ completedTasksToday, totalTasksToday, remainingTasksToday, focusLeft }) => {
    return (
        <div className="grid grid-cols-3 gap-4">
            <InfoItem label="Tasks Done" value={`${completedTasksToday}/${totalTasksToday}`} />
            <InfoItem label="Remaining" value={remainingTasksToday} />
            <InfoItem label="Focus Left" value={focusLeft} />
        </div>
    );
};

export default SessionInfo;