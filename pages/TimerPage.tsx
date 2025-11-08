

import React, { useMemo } from 'react';
import { AppState, Settings, Task, DbDailyLog, PomodoroHistory } from '../types';
import SessionInfo from '../components/SessionInfo';
import TimerDisplay from '../components/TimerDisplay';
import Controls from '../components/Controls';
import AmbientSounds from '../components/AmbientSounds';
import TodayLog from '../components/TodayLog';
import FocusQueue from '../components/FocusQueue';
import StatsPanel from '../components/StatsPanel';
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
    isStopwatchMode: boolean;
    completeStopwatchTask: () => void;
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

const TimerPage: React.FC<TimerPageProps> = (props) => {
    const { appState, settings, tasksToday, completedToday, dailyLog, startTimer, stopTimer, resetTimer, navigateToSettings, currentTask, todaysHistory, historicalLogs, isStopwatchMode, completeStopwatchTask } = props;
    
    const allTodaysTasks = useMemo(() => [...tasksToday, ...completedToday], [tasksToday, completedToday]);
    const nextTasks = useMemo(() => tasksToday.slice(1), [tasksToday]);

    const focusTimeRemainingMinutes = useMemo(() => {
        return tasksToday.reduce((total, task) => {
            if (task.total_poms < 0) return total;
            const remainingPoms = task.total_poms - task.completed_poms;
            if (remainingPoms <= 0) return total;
            const focusDuration = task.custom_focus_duration || settings.focusDuration;
            return total + (remainingPoms * focusDuration);
        }, 0);
    }, [tasksToday, settings.focusDuration]);

    const isFocus = appState.mode === 'focus';
    
    const stopwatchBaseTime = useMemo(() => {
        if (isStopwatchMode && currentTask && appState.mode === 'focus') {
            return todaysHistory
                .filter(h => h.task_id === currentTask.id)
                .reduce((total, h) => total + (Number(h.duration_minutes) || 0), 0) * 60;
        }
        return 0;
    }, [isStopwatchMode, currentTask, appState.mode, todaysHistory]);

    const displayTime = isStopwatchMode ? stopwatchBaseTime + appState.timeRemaining : appState.timeRemaining;

    const noTaskMessage = useMemo(() => {
        if (completedToday.length > 0 && tasksToday.length === 0) {
            return "All tasks for today are complete! 🎉";
        }
        if (tasksToday.length === 0) {
            return "Add a task in the 'Plan' tab to begin.";
        }
        return "No task selected"; // Fallback
    }, [tasksToday.length, completedToday.length]);
    
    return (
        <div className="flex flex-col gap-6">
            <SessionInfo
                completedTasksToday={completedToday.length}
                totalTasksToday={tasksToday.length + completedToday.length}
                remainingTasksToday={tasksToday.length}
                focusLeft={formatMinutes(focusTimeRemainingMinutes)}
            />
            
            {/* Main Timer Block */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-slate-700/80 animate-slideUp">
                <div className="text-center pb-4 mb-4 border-b border-slate-700/80">
                    <h3 className="text-sm font-semibold uppercase text-teal-400 tracking-wider mb-2">
                        Focusing On
                    </h3>
                    {currentTask ? (
                        <p className="font-semibold text-xl text-slate-100 truncate max-w-full" title={currentTask.text}>
                            {currentTask.text}
                        </p>
                    ) : (
                        <p className="text-slate-400 italic">{noTaskMessage}</p>
                    )}
                </div>

                <TimerDisplay
                    timeRemaining={displayTime}
                    totalTime={appState.sessionTotalTime}
                    isRunning={appState.isRunning}
                    mode={appState.mode}
                    isStopwatchMode={isStopwatchMode}
                    timeForProgress={appState.timeRemaining}
                />

                <Controls
                    isRunning={appState.isRunning}
                    startTimer={startTimer}
                    stopTimer={stopTimer}
                    resetTimer={resetTimer}
                    timeRemaining={appState.timeRemaining}
                    sessionTotalTime={appState.sessionTotalTime}
                    mode={appState.mode}
                />
                {isStopwatchMode && currentTask && (
                    <div className="text-center -mt-4 pb-2">
                        <button
                            onClick={completeStopwatchTask}
                            className="bg-green-600/80 hover:bg-green-500/80 backdrop-blur-sm border border-green-400/60 text-white font-semibold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-500/50"
                            aria-label="Save progress and complete task"
                        >
                            Save & Complete Task
                        </button>
                    </div>
                )}
            </div>

            {/* Widgets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slideUp" style={{animationDelay: '100ms'}}>
                <FocusQueue nextTasks={nextTasks} />
                <TodayLog todaysHistory={todaysHistory} tasks={allTodaysTasks} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slideUp" style={{animationDelay: '200ms'}}>
                <StatsPanel
                    completedToday={completedToday}
                    tasksToday={tasksToday}
                    historicalLogs={historicalLogs}
                    todaysHistory={todaysHistory}
                    dailyLog={dailyLog}
                />
                <CategoryFocusPieChart
                    tasks={allTodaysTasks}
                    todaysHistory={todaysHistory}
                />
            </div>
            
            {/* Ambient Sounds */}
            <div className="animate-slideUp" style={{animationDelay: '300ms'}}>
                <AmbientSounds />
            </div>
        </div>
    );
};

export default TimerPage;