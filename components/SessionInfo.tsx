
import React from 'react';

interface SessionInfoProps {
    completedTasksToday: number;
    totalTasksToday: number;
    remainingTasksToday: number;
}

const InfoItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div className="text-center">
        <div className="text-xs sm:text-sm text-white/80 uppercase tracking-wider mb-1">{label}</div>
        <div className="text-2xl sm:text-3xl text-white font-semibold">{value}</div>
    </div>
);

const SessionInfo: React.FC<SessionInfoProps> = ({ completedTasksToday, totalTasksToday, remainingTasksToday }) => {
    return (
        <div className="flex justify-around mb-6 p-4 bg-white/10 rounded-2xl">
            <InfoItem label="Tasks Done" value={`${completedTasksToday}/${totalTasksToday}`} />
            <InfoItem label="Remaining" value={remainingTasksToday} />
        </div>
    );
};

export default SessionInfo;
