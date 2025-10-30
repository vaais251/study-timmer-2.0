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
    isStopwatchMode: boolean;
    onSaveStopwatchTask: () => void;
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
        <div className="text-center min-h-[3rem] flex items-center justify-center px-2 pt-4 mt-4 border-t border-slate-700">
            {task ? (
                <div className="bg-black/20 text-slate-300 px-4 py-2 rounded-lg shadow-inner inline-flex items-center gap-3 max-w-full">
                    <TargetIcon />
                    <span className="italic break-words">{task.text}</span>
                </div>
            ) : (
                <div className="bg-black/20 text-slate-400 px-4 py-2 rounded-lg shadow-inner italic">
                   No task for today. Add one in the Plan tab!
                </div>
            )}
        </div>
    );
};

const TimerPage: React.FC<TimerPageProps> = (props) => {
    const { appState, settings, tasksToday, completedToday, dailyLog, startTimer, stopTimer, resetTimer, navigateToSettings, currentTask, todaysHistory, historicalLogs, isStopwatchMode, onSaveStopwatchTask } = props;
    
    const allTodaysTasks = useMemo(() => [...tasksToday, ...completedToday], [tasksToday, completedToday]);

    const focusTimeRemainingMinutes = useMemo(() => {
        return tasksToday.reduce((total, task) => {
            // Ignore stopwatch tasks for remaining time calculation
            if (task.total_poms < 0) return total;

            const remainingPoms = task.total_poms - task.completed_poms;
            if (remainingPoms <= 0) return total;

            const focusDuration = task.custom_focus_duration || settings.focusDuration;
            return total + (remainingPoms * focusDuration);
        }, 0);
    }, [tasksToday, settings.focusDuration]);

    const isFocus = appState.mode === 'focus';

    return (
        <div className="space-y-6">
            <Header />
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-slate-700/80">
                <SessionInfo
                    completedTasksToday={completedToday.length}
                    totalTasksToday={tasksToday.length + completedToday.length}
                    remainingTasksToday={tasksToday.length}
                    focusLeft={formatMinutes(focusTimeRemainingMinutes)}
                />
                <CurrentTaskDisplay task={currentTask} />
            </div>
            
            <div className="bg-slate-800/60 rounded-xl p-4 sm:p-6 border border-slate-700/80">
                <div className="text-center mb-4">
                    <h2 className={`text-lg font-semibold uppercase tracking-wider ${isFocus ? 'text-teal-400' : 'text-purple-400'}`}>
                        {isStopwatchMode ? 'Stopwatch' : isFocus ? 'Focus Session' : 'Break Time'}
                    </h2>
                </div>
                
                <TimerDisplay
                    timeRemaining={appState.timeRemaining}
                    totalTime={appState.sessionTotalTime}
                    isRunning={appState.isRunning}
                    mode={appState.mode}
                    isStopwatchMode={isStopwatchMode}
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
                {isStopwatchMode && appState.isRunning && (
                    <div className="text-center -mt-2 mb-4">
                        <button
                            onClick={onSaveStopwatchTask}
                            className="text-white font-semibold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-400 bg-green-500 hover:bg-green-600"
                            aria-label="Save stopwatch session and complete task"
                        >
                            Save &amp; Complete Session
                        </button>
                    </div>
                )}
            </div>
            
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
        </div>
    );
};

export default TimerPage;