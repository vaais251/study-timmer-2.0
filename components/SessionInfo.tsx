
import React from 'react';

interface SessionInfoProps {
    currentSession: number;
    sessionsPerCycle: number;
    completedSessions: number;
}

const InfoItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div className="text-center">
        <div className="text-xs sm:text-sm text-white/80 uppercase tracking-wider mb-1">{label}</div>
        <div className="text-2xl sm:text-3xl text-white font-semibold">{value}</div>
    </div>
);

const SessionInfo: React.FC<SessionInfoProps> = ({ currentSession, sessionsPerCycle, completedSessions }) => {
    return (
        <div className="flex justify-around mb-6 p-4 bg-white/10 rounded-2xl">
            <InfoItem label="Sessions" value={`${currentSession}/${sessionsPerCycle}`} />
            <InfoItem label="Completed" value={completedSessions} />
        </div>
    );
};

export default SessionInfo;
