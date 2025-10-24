
import React from 'react';
import { AppState, Settings } from '../types';
import Header from '../components/Header';
import SessionInfo from '../components/SessionInfo';
import ModeIndicator from '../components/ModeIndicator';
import TimerDisplay from '../components/TimerDisplay';
import Controls from '../components/Controls';
import StatsPanel from '../components/StatsPanel';

interface TimerPageProps {
    appState: AppState;
    settings: Settings;
    startTimer: () => void;
    stopTimer: () => void;
    resetTimer: () => void;
    navigateToSettings: () => void;
}

const TimerPage: React.FC<TimerPageProps> = (props) => {
    const { appState, settings, startTimer, stopTimer, resetTimer, navigateToSettings } = props;

    return (
        <>
            <Header />
            <SessionInfo
                currentSession={appState.currentSession}
                sessionsPerCycle={settings.sessionsPerCycle}
                completedSessions={appState.completedSessions}
            />
            <ModeIndicator mode={appState.mode} />
            <TimerDisplay
                timeRemaining={appState.timeRemaining}
                totalTime={appState.totalTime}
            />
            <Controls
                isRunning={appState.isRunning}
                startTimer={startTimer}
                stopTimer={stopTimer}
                resetTimer={resetTimer}
                navigateToSettings={navigateToSettings}
            />
            <StatsPanel
                completedToday={appState.completedToday}
                tasks={appState.tasks}
                totalFocusMinutes={appState.totalFocusMinutes}
                completedSessions={appState.completedSessions}
            />
        </>
    );
};

export default TimerPage;
