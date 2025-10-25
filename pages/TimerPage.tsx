

import React from 'react';
import { AppState, Settings, Task, DbDailyLog } from '../types';
import Header from '../components/Header';
import SessionInfo from '../components/SessionInfo';
import ModeIndicator from '../components/ModeIndicator';
import TimerDisplay from '../components/TimerDisplay';
import Controls from '../components/Controls';
import StatsPanel from '../components/StatsPanel';

interface TimerPageProps {
    appState: AppState;
    settings: Settings;
    tasksToday: Task[];
    completedToday: Task[];
    dailyLog: DbDailyLog;
    startTimer: () => void;
    stopTimer: () => void;
    resetTimer: () => void;
    navigateToSettings: () => void;
}

const TimerPage: React.FC<TimerPageProps> = (props) => {
    const { appState, settings, tasksToday, completedToday, dailyLog, startTimer, stopTimer, resetTimer, navigateToSettings } = props;
    
    const totalTime = appState.mode === 'focus' ? settings.focusDuration * 60 : settings.breakDuration * 60;

    return (
        <>
            <Header />
            <SessionInfo
                currentSession={appState.currentSession}
                sessionsPerCycle={settings.sessionsPerCycle}
                completedSessions={dailyLog.completed_sessions}
            />
            <ModeIndicator mode={appState.mode} />
            <TimerDisplay
                timeRemaining={appState.timeRemaining}
                totalTime={totalTime}
            />
            <Controls
                isRunning={appState.isRunning}
                startTimer={startTimer}
                stopTimer={stopTimer}
                resetTimer={resetTimer}
                navigateToSettings={navigateToSettings}
            />
            <StatsPanel
                completedToday={completedToday}
                tasksToday={tasksToday}
                totalFocusMinutes={dailyLog.total_focus_minutes}
                completedSessions={dailyLog.completed_sessions}
            />
        </>
    );
};

export default TimerPage;
