
import React, { useMemo } from 'react';
import { AppState, Settings, Task, DbDailyLog, PomodoroHistory } from '../types';
import Header from '../components/Header';
import SessionInfo from '../components/SessionInfo';
import TimerDisplay from '../components/TimerDisplay';
import Controls from '../components/Controls';
import StatsPanel from '../components/StatsPanel';
import AmbientSounds from '../components/AmbientSounds';
import CategoryFocusChart from '../components/CategoryFocusChart';
import CategoryFocusPieChart from '../components/CategoryFocusPieChart';
import { TargetIcon } from '../components/common/Icons';

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

const formatMinutes = (minutes: number): string => {
    const totalMinutes = Math.ceil(minutes);
    if (totalMinutes < 1) return '0m';
    const hours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;
    if (hours > 0 && remainingMins > 0) {
        return `${hours}h ${remainingMins}m`;
    }
    if (hours > 0) {
        return `${hours}h`;
    }
    return `${remainingMins}m`;
};

const CurrentTaskDisplay: React.FC<{ task?: Task }> = ({ task }) => {
    return (
        <div className="text-center h-12 flex items-center justify-center px-2">
            {task ? (
                <div className="bg-black/20 text-white/90 px-4 py-2 rounded-full shadow-inner inline-flex items-center gap-3">
                    <TargetIcon />
                    <span className="italic">{task.text}</span>
                </div>
            ) : (
                <div className="bg-black/20 text-white/60 px-4 py-2 rounded-full shadow-inner italic">
                   No task for today. Add one in the Plan tab!
                </div>
            )}
        </div>
    );
};

const TimerPage: React.FC<TimerPageProps> = (props) => {
    const { appState, settings, tasksToday, completedToday, dailyLog, startTimer, stopTimer, resetTimer, navigateToSettings, currentTask, todaysHistory, historicalLogs } = props;
    
    const allTodaysTasks = useMemo(() => [...tasksToday, ...completedToday], [tasksToday, completedToday]);

    const focusTimeRemainingMinutes = useMemo(() => {
        return tasksToday.reduce((total, task) => {
            const remainingPoms = task.total_poms - task.completed_poms;
            if (remainingPoms <= 0) return total;

            const focusDuration = task.custom_focus_duration || settings.focusDuration;
            return total + (remainingPoms * focusDuration);
        }, 0);
    }, [tasksToday, settings.focusDuration]);

    return (
        <>
            <Header />
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 mb-6 border border-white/20">
                <SessionInfo
                    completedTasksToday={completedToday.length}
                    totalTasksToday={tasksToday.length + completedToday.length}
                    remainingTasksToday={tasksToday.length}
                    focusLeft={formatMinutes(focusTimeRemainingMinutes)}
                />
                <Controls
                    isRunning={appState.isRunning}
                    startTimer={startTimer}
                    stopTimer={stopTimer}
                    resetTimer={resetTimer}
                />
                <CurrentTaskDisplay task={currentTask} />
            </div>
            
            <TimerDisplay
                timeRemaining={appState.timeRemaining}
                totalTime={appState.sessionTotalTime}
                isRunning={appState.isRunning}
                mode={appState.mode}
            />
            
            {/* Show full controls only when timer is running, otherwise they are in the panel above */}
             {appState.isRunning && (
                <div className="flex justify-center gap-4 sm:gap-6 mb-6">
                    {/* Placeholder for potential future controls specific to running state */}
                </div>
             )}

            <AmbientSounds />
            <StatsPanel
                completedToday={completedToday}
                tasksToday={tasksToday}
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
