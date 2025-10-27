



import React, { useMemo } from 'react';
import { AppState, Settings, Task, DbDailyLog, Mode, PomodoroHistory } from '../types';
import Header from '../components/Header';
import SessionInfo from '../components/SessionInfo';
import ModeIndicator from '../components/ModeIndicator';
import TimerDisplay from '../components/TimerDisplay';
import Controls from '../components/Controls';
import StatsPanel from '../components/StatsPanel';
import AmbientSounds from '../components/AmbientSounds';
import CategoryFocusChart from '../components/CategoryFocusChart';
import CategoryFocusPieChart from '../components/CategoryFocusPieChart';

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
    currentTask?: Task;
    todaysHistory: PomodoroHistory[];
    historicalLogs: DbDailyLog[];
}

const CurrentTaskDisplay: React.FC<{ task?: Task }> = ({ task }) => {
    return (
        <div className="text-center mb-4 h-12 flex items-center justify-center px-2">
            <div className="bg-black/20 text-white/90 px-4 py-2 rounded-lg truncate max-w-full shadow-inner">
                {task ? (
                    <>
                        <span className="font-semibold mr-2 opacity-80">🎯</span>
                        <span className="italic">{task.text}</span>
                    </>
                ) : (
                    <span className="text-white/60 italic">No task for today. Add one in the Plan tab!</span>
                )}
            </div>
        </div>
    );
};

const TimerPage: React.FC<TimerPageProps> = (props) => {
    const { appState, settings, tasksToday, completedToday, dailyLog, startTimer, stopTimer, resetTimer, navigateToSettings, currentTask, todaysHistory, historicalLogs } = props;
    
    const allTodaysTasks = useMemo(() => [...tasksToday, ...completedToday], [tasksToday, completedToday]);

    return (
        <>
            <Header />
            <SessionInfo
                completedTasksToday={completedToday.length}
                totalTasksToday={tasksToday.length + completedToday.length}
                remainingTasksToday={tasksToday.length}
            />
            <ModeIndicator mode={appState.mode} />
            <CurrentTaskDisplay task={currentTask} />
            <TimerDisplay
                timeRemaining={appState.timeRemaining}
                totalTime={appState.sessionTotalTime}
                isRunning={appState.isRunning}
                mode={appState.mode}
            />
            <Controls
                isRunning={appState.isRunning}
                startTimer={startTimer}
                stopTimer={stopTimer}
                resetTimer={resetTimer}
                navigateToSettings={navigateToSettings}
            />
            <AmbientSounds />
            <StatsPanel
                completedToday={completedToday}
                tasksToday={tasksToday}
                totalFocusMinutes={dailyLog.total_focus_minutes}
                historicalLogs={historicalLogs}
            />
            <CategoryFocusChart
                tasks={allTodaysTasks}
                todaysHistory={todaysHistory}
                totalFocusMinutes={dailyLog.total_focus_minutes}
            />
            <CategoryFocusPieChart
                tasks={allTodaysTasks}
                todaysHistory={todaysHistory}
            />
        </>
    );
};

export default TimerPage;