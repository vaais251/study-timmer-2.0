import React, { useState, useMemo, useRef, useEffect } from 'react';
import Panel from './common/Panel';
import { DbDailyLog, Task, Project, Target, Settings, PomodoroHistory } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { getTodayDateString } from '../utils/date';
import AIInsightModal from './common/AIInsightModal';
import { SparklesIcon } from './common/Icons';

interface HistoryPanelProps {
    logs: DbDailyLog[];
    tasks: Task[];
    allTasks: Task[];
    projects: Project[];
    allProjects: Project[];
    targets: Target[];
    allTargets: Target[];
    historyRange: { start: string; end: string };
    setHistoryRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
    settings: Settings | null;
    pomodoroHistory: PomodoroHistory[];
    consistencyLogs: DbDailyLog[];
    timelinePomodoroHistory: PomodoroHistory[];
    consistencyPomodoroHistory: PomodoroHistory[];
}

const formatMinutesToHours = (minutes: number) => {
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}m`;
};

const StatItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div className="text-center">
        <div className="text-sm text-white/80 mb-1">{label}</div>
        <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
);

const StatCard: React.FC<{title: string, children: React.ReactNode}> = ({ title, children }) => (
    <div className="bg-white/5 p-4 rounded-xl h-full flex flex-col justify-center">
        <h3 className="font-bold text-center mb-3 text-white/70 uppercase tracking-wider text-sm">{title}</h3>
        {children}
    </div>
);


interface DayDetailTooltipProps {
    date: string;
    allTasks: Task[];
    pomodoroHistory: PomodoroHistory[];
    logs: DbDailyLog[];
    position: { top: number; left: number };
    onClose: () => void;
}

const DayDetailTooltip: React.FC<DayDetailTooltipProps> = ({ date, allTasks, pomodoroHistory, logs, position, onClose }) => {
    const tooltipRef = useRef<HTMLDivElement>(null);

    const details = useMemo(() => {
        const tasksForDay = allTasks.filter(t => t.due_date === date);
        const completedTasksCount = tasksForDay.filter(t => t.completed_at).length;
        const totalTasks = tasksForDay.length;
        
        const log = logs.find(l => l.date === date);
        const completionPercentage = log ? log.completed_sessions : (totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0);

        const focusMinutes = pomodoroHistory
            .filter(h => h.ended_at.startsWith(date))
            .reduce((sum, h) => sum + (Number(h.duration_minutes) || 0), 0);
        
        return {
            tasksForDay,
            completedTasksCount,
            totalTasks,
            completionPercentage,
            focusMinutes
        };
    }, [date, allTasks, pomodoroHistory, logs]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const style: React.CSSProperties = {
        position: 'absolute',
        top: `${position.top - 10}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%) translateY(-100%)',
        zIndex: 50
    };

    return (
        <div ref={tooltipRef} style={style} className="w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-4 animate-scaleIn text-sm">
            <button onClick={onClose} className="absolute top-2 right-2 text-slate-400 hover:text-white text-xl">&times;</button>
            <h4 className="font-bold text-white mb-2">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
            <div className="space-y-1 text-white/80">
                <p><strong>Task Completion:</strong> <span className="font-semibold text-white">{details.completionPercentage}%</span> ({details.completedTasksCount}/{details.totalTasks})</p>
                <p><strong>Focus Time:</strong> <span className="font-semibold text-white">{details.focusMinutes} min</span></p>
                {details.tasksForDay.length > 0 && (
                    <div>
                        <h5 className="font-semibold mt-2 text-white">Tasks:</h5>
                        <ul className="list-disc list-inside max-h-24 overflow-y-auto text-xs space-y-1 pl-1">
                            {details.tasksForDay.map(task => (
                                <li key={task.id} className={`${task.completed_at ? 'text-green-400' : 'text-amber-400'} truncate`}>
                                    {task.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                 {details.tasksForDay.length === 0 && (
                     <p className="text-xs text-white/60 mt-2">No tasks were due on this day.</p>
                 )}
            </div>
        </div>
    );
};


// --- New Component: Consistency Tracker ---
const ConsistencyTracker = ({ logs, allTasks, pomodoroHistory }: { logs: DbDailyLog[], allTasks: Task[], pomodoroHistory: PomodoroHistory[] }) => {
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleDayClick = (day: { date: string }, event: React.MouseEvent) => {
        event.stopPropagation();
        if (selectedDay === day.date) {
            setSelectedDay(null);
            return;
        }
        setSelectedDay(day.date);
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();

        if (containerRect) {
            setTooltipPosition({
                top: rect.top - containerRect.top,
                left: rect.left - containerRect.left + rect.width / 2,
            });
        }
    };
    
    const { weeks, monthLabels } = useMemo(() => {
        const activityMap: Map<string, number> = new Map(logs.map(log => [log.date, log.completed_sessions]));
        const today = new Date();
        const daysToShow = 180; // Approx 6 months
        const days = Array.from({ length: daysToShow }, (_, i) => {
            const date = new Date();
            date.setDate(today.getDate() - (daysToShow - 1 - i));
            return date;
        });

        const firstDayOfWeek = days[0].getDay(); // 0=Sun, 1=Mon, ...

        const allCells = [
            ...Array(firstDayOfWeek).fill(null),
            ...days.map(date => {
                const dateString = getTodayDateString(date);
                const percentage = activityMap.get(dateString) || 0;

                let colorClass = 'bg-gray-800'; // Corresponds to GitHub's no-contribution color
                if (percentage > 0 && percentage < 25) colorClass = 'bg-emerald-900';
                if (percentage >= 25 && percentage < 50) colorClass = 'bg-emerald-700';
                if (percentage >= 50 && percentage < 75) colorClass = 'bg-emerald-500';
                if (percentage >= 75) colorClass = 'bg-emerald-300';

                return {
                    date: dateString,
                    colorClass,
                    percentage,
                    month: date.getMonth(),
                };
            })
        ];

        const weeks = [];
        for (let i = 0; i < allCells.length; i += 7) {
            weeks.push(allCells.slice(i, i + 7));
        }

        const monthLabels: { name: string; startColumn: number }[] = [];
        let lastMonth = -1;
        weeks.forEach((week, colIndex) => {
            const firstDayOfNewMonthInWeek = week.find(day => day && day.month !== lastMonth);
            if (firstDayOfNewMonthInWeek) {
                lastMonth = firstDayOfNewMonthInWeek.month;
                if (colIndex > 0 || monthLabels.length === 0) {
                     monthLabels.push({
                        name: new Date(today.getFullYear(), lastMonth).toLocaleString('default', { month: 'short' }),
                        startColumn: colIndex,
                    });
                }
            }
        });

        return { weeks, monthLabels };
    }, [logs]);

    return (
        <div ref={containerRef} className="relative bg-black/20 p-4 rounded-lg overflow-x-auto">
            <div className="inline-block">
                <div className="flex" style={{ paddingLeft: '2.5rem', paddingBottom: '0.5rem' }}>
                    {monthLabels.map((month, index) => {
                        const nextMonth = monthLabels[index + 1];
                        const colSpan = nextMonth ? nextMonth.startColumn - month.startColumn : weeks.length - month.startColumn;
                        // Cell width (w-3) is 12px, gap is 4px. Total per column = 16px.
                        return (
                            <div key={month.name} className="text-xs text-white/50" style={{ minWidth: `${colSpan * 16}px` }}>
                                {month.name}
                            </div>
                        );
                    })}
                </div>
                <div className="flex gap-3">
                    <div className="grid grid-rows-7 text-xs text-white/50 w-8 shrink-0 text-right pr-2">
                        <span></span>
                        <span className="self-center">Mon</span>
                        <span></span>
                        <span className="self-center">Wed</span>
                        <span></span>
                        <span className="self-center">Fri</span>
                        <span></span>
                    </div>
                    
                    <div className="flex gap-1">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="grid grid-rows-7 gap-1">
                                {week.map((day, dayIndex) => (
                                    day 
                                    ? <div 
                                        key={day.date} 
                                        className={`w-3 h-3 rounded-sm ${day.colorClass} cursor-pointer transition-transform hover:scale-125 hover:ring-2 hover:ring-white/80`} 
                                        title={`${day.percentage}% tasks completed on ${day.date}`}
                                        onClick={(e) => handleDayClick(day, e)}
                                      />
                                    : <div key={`ph-${weekIndex}-${dayIndex}`} className="w-3 h-3" />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end items-center mt-4 text-xs text-white/60 gap-2 pr-4">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-gray-800"></div>
                <div className="w-3 h-3 rounded-sm bg-emerald-900"></div>
                <div className="w-3 h-3 rounded-sm bg-emerald-700"></div>
                <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                <div className="w-3 h-3 rounded-sm bg-emerald-300"></div>
                <span>More</span>
            </div>
             {selectedDay && tooltipPosition && (
                <DayDetailTooltip
                    date={selectedDay}
                    allTasks={allTasks}
                    pomodoroHistory={pomodoroHistory}
                    logs={logs}
                    position={tooltipPosition}
                    onClose={() => setSelectedDay(null)}
                />
            )}
        </div>
    );
};

interface CategoryTimelineChartProps {
    tasks: Task[];
    history: PomodoroHistory[];
    historyRange: { start: string; end: string };
    openInsightModal: (chartTitle: string, chartData: any, chartElement: React.ReactNode) => void;
}

const CategoryTimelineChart = React.memo(({ tasks, history, historyRange, openInsightModal }: CategoryTimelineChartProps) => {
    const [view, setView] = useState<'month' | 'week' | 'custom'>('week');
    const [visibleTags, setVisibleTags] = useState<string[]>([]);

    const chartData = useMemo(() => {
        let startDate: Date;
        let endDate: Date;

        const todayForComparison = new Date();
        todayForComparison.setHours(0, 0, 0, 0);

        if (view === 'custom') {
            startDate = new Date(historyRange.start + 'T00:00:00');
            endDate = new Date(historyRange.end + 'T00:00:00');
            
            // If the selected end date is today or later, cap it at yesterday.
            if (endDate >= todayForComparison) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                endDate = yesterday;
            }
            
            // If capping the end date made the start date later than the end date, adjust start date.
            if (startDate > endDate) {
                startDate = new Date(endDate);
            }

        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            endDate = yesterday; // end date is now yesterday
            
            startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - (view === 'month' ? 29 : 6));
        }
        
        const startDateString = getTodayDateString(startDate);
        const endDateString = getTodayDateString(endDate);

        const filteredHistory = history.filter(h => {
            const hDate = h.ended_at.split('T')[0];
            return hDate >= startDateString && hDate <= endDateString;
        });

        const taskMap = new Map<string, Task>();
        tasks.forEach(task => taskMap.set(task.id, task));

        const dataByDate = new Map<string, { date: string, [key: string]: number | string }>();
        const allTags = new Set<string>();

        // Initialize date map for all days in the range
        const loopDate = new Date(startDate);
        const finalEndDate = new Date(endDate);
        finalEndDate.setHours(23, 59, 59, 999); // Ensure end date is included
        while (loopDate <= finalEndDate) {
            const dateStr = getTodayDateString(loopDate);
            dataByDate.set(dateStr, { date: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
            loopDate.setDate(loopDate.getDate() + 1);
        }

        filteredHistory.forEach(h => {
            const task = h.task_id ? taskMap.get(h.task_id) : null;
            if (task && task.tags && task.tags.length > 0) {
                const dateStr = h.ended_at.split('T')[0];
                const dayData = dataByDate.get(dateStr);
                if (dayData) {
                    task.tags.forEach(tag => {
                        const normalizedTag = tag.trim().toLowerCase();
                        if (normalizedTag) {
                            allTags.add(normalizedTag);
                            dayData[normalizedTag] = (dayData[normalizedTag] || 0) as number + (Number(h.duration_minutes) || 0);
                        }
                    });
                }
            }
        });
        
        const sortedTags = Array.from(allTags).sort();
        const finalData = Array.from(dataByDate.values());

        // Ensure all tags are present in all date objects for recharts
        finalData.forEach(dayData => {
            sortedTags.forEach(tag => {
                if (!dayData[tag]) {
                    dayData[tag] = 0;
                }
            });
        });

        return { data: finalData, tags: sortedTags };

    }, [view, tasks, history, historyRange]);
    
    useEffect(() => {
        setVisibleTags(chartData.tags);
    }, [chartData.tags]);

    const handleLegendClick = (o: any) => {
        const { dataKey } = o;
        if (chartData.tags.includes(dataKey)) {
            setVisibleTags(prev => 
                prev.includes(dataKey) 
                    ? prev.filter(t => t !== dataKey) 
                    : [...prev, dataKey]
            );
        }
    };

    const COLORS = ['#F59E0B', '#10B981', '#38BDF8', '#EC4899', '#84CC16', '#F43F5E', '#6366F1'];

    const chartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData.data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                <YAxis stroke="rgba(255,255,255,0.7)" unit="m" />
                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} labelStyle={{ color: 'white', fontWeight: 'bold' }} />
                <Legend wrapperStyle={{fontSize: "12px", cursor: 'pointer'}} onClick={handleLegendClick}/>
                {chartData.tags.map((tag, index) => (
                    <Line 
                        key={tag} 
                        type="monotone" 
                        dataKey={tag} 
                        name={tag.charAt(0).toUpperCase() + tag.slice(1)}
                        stroke={COLORS[index % COLORS.length]} 
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 6 }}
                        hide={!visibleTags.includes(tag)}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
    
    return (
        <div className="">
            <div className="flex justify-center items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-white text-center">Category Focus Over Time</h3>
                <button
                    onClick={() => openInsightModal('Category Focus Over Time', chartData.data, <div className="h-96">{chartElement}</div>)}
                    className="p-1 text-purple-400 hover:text-purple-300 transition"
                    title="Get AI Insights for this chart"
                >
                    <SparklesIcon />
                </button>
            </div>
             <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full max-w-md mx-auto">
                <button 
                    onClick={() => setView('week')} 
                    className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${view === 'week' ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                >
                    This Week
                </button>
                 <button 
                    onClick={() => setView('month')} 
                    className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${view === 'month' ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                >
                    This Month
                </button>
                 <button 
                    onClick={() => setView('custom')} 
                    className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${view === 'custom' ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                >
                    Align to Range
                </button>
            </div>
            {chartData.data.length > 0 && chartData.tags.length > 0 ? (
                 <div className="h-96 mt-4">
                    {chartElement}
                </div>
            ) : (
                <div className="h-64 flex items-center justify-center text-white/60 bg-black/10 rounded-lg">
                    <p>No tagged focus sessions found for this period.</p>
                </div>
            )}
        </div>
    );
});


const HistoryPanel: React.FC<HistoryPanelProps> = ({ logs, tasks, allTasks, projects, allProjects, targets, allTargets, historyRange, setHistoryRange, settings, pomodoroHistory, consistencyLogs, timelinePomodoroHistory, consistencyPomodoroHistory }) => {
    const [selectedDay, setSelectedDay] = useState<string>(getTodayDateString());
    const [detailViewType, setDetailViewType] = useState<'day' | 'week' | 'month' | 'all'>('day');
    
    const [visibleLines, setVisibleLines] = useState({
        completedTasks: true,
        incompleteTasks: false,
        totalTasks: false,
    });
    
    const [visiblePriorities, setVisiblePriorities] = useState({
        P1: true,
        P2: true,
        P3: true,
        P4: true,
    });
    
    const [visibleCompletionRates, setVisibleCompletionRates] = useState({
        P1: true,
        P2: true,
        P3: true,
        P4: true,
    });

    const [visiblePrioritiesForDistribution, setVisiblePrioritiesForDistribution] = useState({
        P1: true,
        P2: true,
        P3: true,
        P4: true,
    });
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
    const categoryFilterRef = useRef<HTMLDivElement>(null);

    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        chartTitle: string;
        chartData: any;
        chartElement: React.ReactNode;
    } | null>(null);

    const openInsightModal = (chartTitle: string, chartData: any, chartElement: React.ReactNode) => {
        setModalState({ isOpen: true, chartTitle, chartData, chartElement });
    };

    const closeInsightModal = () => {
        setModalState(null);
    };


    const handleLegendClick = (o: any) => {
        const { dataKey } = o;
        if (Object.keys(visibleLines).includes(dataKey)) {
            setVisibleLines(prev => ({ ...prev, [dataKey as keyof typeof prev]: !prev[dataKey as keyof typeof prev] }));
        }
    };
    
    const handlePriorityLegendClick = (o: any) => {
        const { dataKey } = o;
        if (dataKey in visiblePriorities) {
            setVisiblePriorities(prev => ({ ...prev, [dataKey as keyof typeof prev]: !prev[dataKey as keyof typeof prev] }));
        }
    };
    
    const handleCompletionRateLegendClick = (o: any) => {
        const { dataKey } = o;
        if (dataKey in visibleCompletionRates) {
            setVisibleCompletionRates(prev => ({ ...prev, [dataKey as keyof typeof prev]: !prev[dataKey as keyof typeof prev] }));
        }
    };

    const handlePriorityDistributionLegendClick = (o: any) => {
        const { dataKey } = o;
        if (dataKey in visiblePrioritiesForDistribution) {
            setVisiblePrioritiesForDistribution(prev => ({ ...prev, [dataKey as keyof typeof prev]: !prev[dataKey as keyof typeof prev] }));
        }
    };

    const handleCategorySelection = (categoryName: string) => {
        setSelectedCategories(prev =>
            prev.includes(categoryName)
                ? prev.filter(c => c !== categoryName)
                : [...prev, categoryName]
        );
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (categoryFilterRef.current && !categoryFilterRef.current.contains(event.target as Node)) {
                setIsCategoryFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [categoryFilterRef]);


    const handleSetRange = (days: number) => {
        const today = getTodayDateString();
        const ago = new Date();
        ago.setDate(ago.getDate() - (days - 1));
        const startDate = getTodayDateString(ago);
        setHistoryRange({ start: startDate, end: today });
    };
    
    const aggregatedData = useMemo(() => {
        if (!logs || !tasks || !projects || !targets || !allTasks || !allProjects || !allTargets) {
            return {
                totalFocus: 0, completedCount: 0, totalTasks: 0, 
                pomsDone: 0, pomsEst: 0, projectsCompleted: 0, targetsCompleted: 0,
                totalProjectsInRange: 0, totalTargetsInRange: 0,
                lineChartData: [], 
                taskBreakdownData: [{ name: 'Completed', value: 0 }, { name: 'Pending', value: 0 }],
                projectBreakdownData: [{ name: 'Completed', value: 0 }, { name: 'Pending', value: 0 }],
                tagAnalysisData: [],
                focusLineChartData: [],
                dailyTaskVolumeChartData: [],
                averageDailyFocus: 0
            };
        }

        // Authoritative calculation for focus time, using pomodoro_history as the source of truth.
        const totalFocus = pomodoroHistory.reduce((acc, entry) => acc + (Number(entry.duration_minutes) || 0), 0);
        const completedCount = tasks.filter(t => t.completed_at !== null).length;
        const totalTasks = tasks.length;
        const pomsDone = tasks.reduce((acc, t) => acc + t.completed_poms, 0);
        const pomsEst = tasks.reduce((acc, t) => acc + t.total_poms, 0);
        const projectsCompleted = projects.length;
        const targetsCompleted = targets.length;
        
        const { start, end } = historyRange;
        
        const startDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T00:00:00');
        const timeDiff = endDate.getTime() - startDate.getTime();
        const dayDiff = timeDiff >= 0 ? Math.round(timeDiff / (1000 * 3600 * 24)) + 1 : 1;
        const averageDailyFocus = dayDiff > 0 ? Math.round(totalFocus / dayDiff) : 0;
        
        // --- Corrected Totals Logic ---
        // A project is relevant if its lifespan (creation to completion) intersects with the date range,
        // or if its deadline falls within the range. This gives us the denominator for projects.
        const relevantProjects = allProjects.filter(p => {
            const createdAtDate = p.created_at.split('T')[0];
            const completedAtDate = p.completed_at ? p.completed_at.split('T')[0] : null;

            // Project's lifespan intersects with the range [start, end]
            const startsBeforeOrDuringRange = createdAtDate <= end;
            const endsDuringOrAfterRange = !completedAtDate || completedAtDate >= start;
            const hasLifespanOverlap = startsBeforeOrDuringRange && endsDuringOrAfterRange;

            // Also include if deadline is in range, as it's a key event.
            const deadlineInRange = p.deadline && p.deadline >= start && p.deadline <= end;

            return hasLifespanOverlap || deadlineInRange;
        });
        const totalProjectsInRange = relevantProjects.length;

        // A target is relevant if its lifespan (creation to completion/present) intersects with the date range,
        // or if its deadline falls within the range.
        const relevantTargets = allTargets.filter(t => {
            const createdAtDate = t.created_at.split('T')[0];
            const completedAtDate = t.completed_at ? t.completed_at.split('T')[0] : null;

            // Target's lifespan intersects with the range [start, end]
            const startsBeforeOrDuringRange = createdAtDate <= end;
            const endsDuringOrAfterRange = !completedAtDate || completedAtDate >= start;
            const hasLifespanOverlap = startsBeforeOrDuringRange && endsDuringOrAfterRange;

            // Also include if deadline is in range, as it's a key event.
            const deadlineInRange = t.deadline >= start && t.deadline <= end;

            return hasLifespanOverlap || deadlineInRange;
        });
        const totalTargetsInRange = relevantTargets.length;

        const lineChartDataPoints = new Map<string, { total: number, completed: number }>();
        if (historyRange.start && historyRange.end) {
            let currentDate = new Date(historyRange.start + 'T00:00:00');
            let endDateForChart = new Date(historyRange.end + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (endDateForChart >= today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                endDateForChart = yesterday;
            }
            while(currentDate <= endDateForChart) {
                const dateString = getTodayDateString(currentDate);
                lineChartDataPoints.set(dateString, { total: 0, completed: 0 });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        tasks.forEach(task => {
            if (lineChartDataPoints.has(task.due_date)) {
                const dayData = lineChartDataPoints.get(task.due_date)!;
                dayData.total++;
                if (task.completed_at) {
                    dayData.completed++;
                }
            }
        });

        const lineChartData = Array.from(lineChartDataPoints.entries()).map(([dateString, data]) => ({
            date: new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            completion: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
        }));
        
        const focusMinutesPerDay = new Map<string, number>();
        if (historyRange.start && historyRange.end) {
            let currentDate = new Date(historyRange.start + 'T00:00:00');
            let endDateForChart = new Date(historyRange.end + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (endDateForChart >= today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                endDateForChart = yesterday;
            }
            while(currentDate <= endDateForChart) {
                const dateString = getTodayDateString(currentDate);
                focusMinutesPerDay.set(dateString, 0);
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        pomodoroHistory.forEach(entry => {
            const dateString = entry.ended_at.split('T')[0];
            if (focusMinutesPerDay.has(dateString)) {
                const currentMinutes = focusMinutesPerDay.get(dateString)!;
                focusMinutesPerDay.set(dateString, currentMinutes + (Number(entry.duration_minutes) || 0));
            }
        });

        const focusLineChartData = Array.from(focusMinutesPerDay.entries()).map(([dateString, minutes]) => ({
            date: new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            focusMinutes: minutes,
        }));

        const dailyTaskStats = new Map<string, { total: number, completed: number }>();
        if (historyRange.start && historyRange.end) {
            let currentDate = new Date(historyRange.start + 'T00:00:00');
            let endDateForChart = new Date(historyRange.end + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (endDateForChart >= today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                endDateForChart = yesterday;
            }
            while(currentDate <= endDateForChart) {
                const dateString = getTodayDateString(currentDate);
                dailyTaskStats.set(dateString, { total: 0, completed: 0 });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        tasks.forEach(task => {
            if (dailyTaskStats.has(task.due_date)) {
                const dayStat = dailyTaskStats.get(task.due_date)!;
                dayStat.total++;
                if (task.completed_at) {
                    dayStat.completed++;
                }
            }
        });

        const dailyTaskVolumeChartData = Array.from(dailyTaskStats.entries()).map(([dateString, stats]) => ({
            date: new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            completedTasks: stats.completed,
            incompleteTasks: stats.total - stats.completed,
            totalTasks: stats.total,
        }));

        const totalCompletedTasks = allTasks.filter(t => t.completed_at).length;
        const totalPendingTasks = allTasks.length - totalCompletedTasks;
        const taskBreakdownData = [
            { name: 'Completed', value: totalCompletedTasks },
            { name: 'Pending', value: totalPendingTasks },
        ];

        const totalCompletedProjects = allProjects.filter(p => p.status === 'completed').length;
        const totalActiveProjects = allProjects.filter(p => p.status === 'active').length;
        const totalDueProjects = allProjects.filter(p => p.status === 'due').length;
        const projectBreakdownData = [
            { name: 'Completed', value: totalCompletedProjects },
            { name: 'Active', value: totalActiveProjects },
            { name: 'Due', value: totalDueProjects },
        ].filter(d => d.value > 0);
        
        const tagAnalysisData = (() => {
            // Authoritative calculation using pomodoro_history as the source of truth for time spent.
            // This ensures consistency with the Mastery Tracker.
            const taskMap = new Map<string, string[]>();
            allTasks.forEach(task => {
                if (task.id && task.tags?.length > 0) {
                    taskMap.set(task.id, task.tags);
                }
            });

            const tagFocusTimes = new Map<string, number>();

            pomodoroHistory.forEach(item => {
                if (item.task_id) {
                    const tags = taskMap.get(item.task_id);
                    if (tags) {
                        tags.forEach(tag => {
                            const normalizedTag = tag.trim().toLowerCase();
                            if (normalizedTag) {
                                const currentTotal = tagFocusTimes.get(normalizedTag) || 0;
                                tagFocusTimes.set(normalizedTag, currentTotal + (Number(item.duration_minutes) || 0));
                            }
                        });
                    }
                }
            });

            return Array.from(tagFocusTimes.entries())
                .map(([name, minutes]) => ({
                    name: name.charAt(0).toUpperCase() + name.slice(1),
                    minutes,
                }))
                .sort((a, b) => b.minutes - a.minutes);
        })();


        return {
            totalFocus, completedCount, totalTasks, pomsDone, pomsEst, projectsCompleted, targetsCompleted,
            totalProjectsInRange, totalTargetsInRange,
            lineChartData, taskBreakdownData, projectBreakdownData, tagAnalysisData, focusLineChartData, dailyTaskVolumeChartData,
            averageDailyFocus
        };
    }, [logs, tasks, allTasks, projects, allProjects, targets, allTargets, historyRange, settings, pomodoroHistory]);
    
    const categoryPriorityDistributionData = useMemo(() => {
        const categoryMap = new Map<string, { name: string, P1: number, P2: number, P3: number, P4: number }>();

        tasks.forEach(task => {
            const priority = task.priority ?? 3; // Default to P3
            const priorityKey = `P${priority}` as 'P1' | 'P2' | 'P3' | 'P4';

            if (task.tags && task.tags.length > 0) {
                task.tags.forEach(tag => {
                    const normalizedTag = tag.trim().toLowerCase();
                    if (normalizedTag) {
                        const displayName = normalizedTag.charAt(0).toUpperCase() + normalizedTag.slice(1);
                        if (!categoryMap.has(normalizedTag)) {
                            categoryMap.set(normalizedTag, { name: displayName, P1: 0, P2: 0, P3: 0, P4: 0 });
                        }
                        const categoryData = categoryMap.get(normalizedTag)!;
                        if (categoryData.hasOwnProperty(priorityKey)) {
                            categoryData[priorityKey]++;
                        }
                    }
                });
            }
        });

        return Array.from(categoryMap.values()).sort((a, b) => {
            const totalA = a.P1 + a.P2 + a.P3 + a.P4;
            const totalB = b.P1 + b.P2 + b.P3 + b.P4;
            return totalB - totalA;
        });
    }, [tasks]);

    useEffect(() => {
        const topFour = categoryPriorityDistributionData.slice(0, 4).map(d => d.name);
        setSelectedCategories(topFour);
    }, [categoryPriorityDistributionData]);

    const filteredCategoryPriorityData = useMemo(() => {
        return categoryPriorityDistributionData.filter(d => selectedCategories.includes(d.name));
    }, [categoryPriorityDistributionData, selectedCategories]);


    const detailedViewData = useMemo(() => {
        const today = getTodayDateString();
        let startDate = '';
        let endDate = '';
        let title = '';
    
        switch (detailViewType) {
            case 'day':
                if (!selectedDay) return null;
                startDate = selectedDay;
                endDate = selectedDay;
                title = new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                break;
            case 'week': {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 6);
                startDate = getTodayDateString(weekAgo);
                endDate = today;
                title = `Last 7 Days (${startDate} to ${endDate})`;
                break;
            }
            case 'month': {
                const monthAgo = new Date();
                monthAgo.setDate(monthAgo.getDate() - 29);
                startDate = getTodayDateString(monthAgo);
                endDate = today;
                title = `Last 30 Days (${startDate} to ${endDate})`;
                break;
            }
            case 'all': {
                startDate = historyRange.start;
                endDate = historyRange.end;
                title = `Selected Range (${startDate} to ${endDate})`;
                break;
            }
            default:
                return null;
        }
        
        if (!startDate || !endDate) return null;

        const tasksInRange = tasks.filter(t => t.due_date >= startDate && t.due_date <= endDate);
        const pomodoroHistoryInRange = pomodoroHistory.filter(p => {
            const pDate = p.ended_at.split('T')[0];
            return pDate >= startDate && pDate <= endDate;
        });

        const completedTasksCount = tasksInRange.filter(t => t.completed_at).length;
        const totalTasksCount = tasksInRange.length;
        const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
        const totalFocusMinutes = pomodoroHistoryInRange.reduce((sum, record) => sum + (Number(record.duration_minutes) || 0), 0);
        
        return {
            title,
            startDate,
            endDate,
            tasks: tasksInRange,
            completedTasksCount,
            totalTasksCount,
            completionPercentage,
            totalFocusMinutes,
        };
    }, [detailViewType, selectedDay, tasks, pomodoroHistory, historyRange]);
    
    const priorityFocusData = useMemo(() => {
        const taskMap = new Map<string, Task>();
        allTasks.forEach(task => taskMap.set(task.id, task));

        const dataByDate = new Map<string, { date: string, P1: number, P2: number, P3: number, P4: number }>();

        if (historyRange.start && historyRange.end) {
            let currentDate = new Date(historyRange.start + 'T00:00:00');
            let endDate = new Date(historyRange.end + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (endDate >= today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                endDate = yesterday;
            }
            while(currentDate <= endDate) {
                const dateString = getTodayDateString(currentDate);
                dataByDate.set(dateString, {
                    date: new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    P1: 0,
                    P2: 0,
                    P3: 0,
                    P4: 0,
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        pomodoroHistory.forEach(h => {
            const dateStr = h.ended_at.split('T')[0];
            const dayData = dataByDate.get(dateStr);
            if (dayData) {
                const task = h.task_id ? taskMap.get(h.task_id) : null;
                const duration = Number(h.duration_minutes) || 0;
                
                const priority = task?.priority ?? 3;
                const priorityKey = `P${priority}` as 'P1' | 'P2' | 'P3' | 'P4';
                if (dayData.hasOwnProperty(priorityKey)) {
                    dayData[priorityKey] += duration;
                }
            }
        });

        return Array.from(dataByDate.values());

    }, [allTasks, pomodoroHistory, historyRange]);
    
    const taskCompletionByPriorityData = useMemo(() => {
        const dataByDate = new Map<string, {
            date: string;
            P1_total: number; P1_completed: number;
            P2_total: number; P2_completed: number;
            P3_total: number; P3_completed: number;
            P4_total: number; P4_completed: number;
        }>();
    
        if (historyRange.start && historyRange.end) {
            let currentDate = new Date(historyRange.start + 'T00:00:00');
            let endDate = new Date(historyRange.end + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (endDate >= today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                endDate = yesterday;
            }
            while(currentDate <= endDate) {
                const dateString = getTodayDateString(currentDate);
                dataByDate.set(dateString, {
                    date: new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    P1_total: 0, P1_completed: 0,
                    P2_total: 0, P2_completed: 0,
                    P3_total: 0, P3_completed: 0,
                    P4_total: 0, P4_completed: 0,
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
    
        tasks.forEach(task => {
            const dateStr = task.due_date;
            const dayData = dataByDate.get(dateStr);
            if (dayData) {
                const priority = task.priority ?? 3;
                const isCompleted = !!task.completed_at;
    
                if (priority === 1) {
                    dayData.P1_total++;
                    if (isCompleted) dayData.P1_completed++;
                } else if (priority === 2) {
                    dayData.P2_total++;
                    if (isCompleted) dayData.P2_completed++;
                } else if (priority === 3) {
                    dayData.P3_total++;
                    if (isCompleted) dayData.P3_completed++;
                } else if (priority === 4) {
                    dayData.P4_total++;
                    if (isCompleted) dayData.P4_completed++;
                }
            }
        });
    
        return Array.from(dataByDate.values()).map(dayData => ({
            date: dayData.date,
            P1: dayData.P1_total > 0 ? (dayData.P1_completed / dayData.P1_total) * 100 : 0,
            P2: dayData.P2_total > 0 ? (dayData.P2_completed / dayData.P2_total) * 100 : 0,
            P3: dayData.P3_total > 0 ? (dayData.P3_completed / dayData.P3_total) * 100 : 0,
            P4: dayData.P4_total > 0 ? (dayData.P4_completed / dayData.P4_total) * 100 : 0,
        }));
    }, [tasks, historyRange]);

    const COLORS_TASKS = ['#34D399', '#F87171'];
    const COLORS_PROJECTS = ['#34D399', '#60A5FA', '#F87171']; // Completed, Active, Due
    const COLORS_PIE = ['#F59E0B', '#10B981', '#84CC16', '#EC4899', '#38BDF8', '#F43F5E', '#6366F1'];


    const pieChartData = useMemo(() => 
        aggregatedData.tagAnalysisData.map(item => ({ name: item.name, value: item.minutes })),
        [aggregatedData.tagAnalysisData]
    );

    const totalFocusMinutesInRange = useMemo(() => 
        pieChartData.reduce((sum, item) => sum + item.value, 0),
        [pieChartData]
    );

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        if (percent * 100 < 5) return null;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-sm font-bold">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    // Chart Element Definitions for Modal Reuse
    const consistencyTrackerElement = <ConsistencyTracker logs={consistencyLogs} allTasks={allTasks} pomodoroHistory={consistencyPomodoroHistory} />;

    const dailyFocusChartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={aggregatedData.focusLineChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                <YAxis stroke="rgba(255,255,255,0.7)" unit="m" />
                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} labelStyle={{ color: 'white', fontWeight: 'bold' }} />
                <Legend wrapperStyle={{fontSize: "12px"}}/>
                <Line type="monotone" dataKey="focusMinutes" name="Focus Minutes" stroke="#34D399" activeDot={{ r: 8 }} />
            </LineChart>
        </ResponsiveContainer>
    );

    const priorityFocusChartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priorityFocusData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                <YAxis stroke="rgba(255,255,255,0.7)" unit="m" />
                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} labelStyle={{ color: 'white', fontWeight: 'bold' }} />
                <Legend wrapperStyle={{fontSize: "12px", cursor: 'pointer'}} onClick={handlePriorityLegendClick} />
                <Line type="monotone" dataKey="P1" name="P1 (Highest)" stroke="#F87171" activeDot={{ r: 8 }} hide={!visiblePriorities.P1} />
                <Line type="monotone" dataKey="P2" name="P2 (High)" stroke="#F59E0B" activeDot={{ r: 8 }} hide={!visiblePriorities.P2} />
                <Line type="monotone" dataKey="P3" name="P3 (Medium)" stroke="#38BDF8" activeDot={{ r: 8 }} hide={!visiblePriorities.P3} />
                <Line type="monotone" dataKey="P4" name="P4 (Low)" stroke="#64748B" activeDot={{ r: 8 }} hide={!visiblePriorities.P4} />
            </LineChart>
        </ResponsiveContainer>
    );

    const completionRateChartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={taskCompletionByPriorityData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                <YAxis stroke="rgba(255,255,255,0.7)" unit="%" domain={[0, 100]} />
                <Tooltip
                    contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                    itemStyle={{ color: 'white' }}
                    labelStyle={{ color: 'white', fontWeight: 'bold' }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Completion']}
                />
                <Legend wrapperStyle={{fontSize: "12px", cursor: 'pointer'}} onClick={handleCompletionRateLegendClick} />
                <Line type="monotone" dataKey="P1" name="P1 (Highest)" stroke="#F87171" activeDot={{ r: 8 }} hide={!visibleCompletionRates.P1} />
                <Line type="monotone" dataKey="P2" name="P2 (High)" stroke="#F59E0B" activeDot={{ r: 8 }} hide={!visibleCompletionRates.P2} />
                <Line type="monotone" dataKey="P3" name="P3 (Medium)" stroke="#38BDF8" activeDot={{ r: 8 }} hide={!visibleCompletionRates.P3} />
                <Line type="monotone" dataKey="P4" name="P4 (Low)" stroke="#64748B" activeDot={{ r: 8 }} hide={!visibleCompletionRates.P4} />
            </LineChart>
        </ResponsiveContainer>
    );
    
    const taskVolumeChartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={aggregatedData.dailyTaskVolumeChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                <YAxis stroke="rgba(255,255,255,0.7)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} labelStyle={{ color: 'white', fontWeight: 'bold' }} />
                <Legend wrapperStyle={{fontSize: "12px", cursor: 'pointer'}} onClick={handleLegendClick} />
                <Line type="monotone" dataKey="completedTasks" name="Completed" stroke="#34D399" activeDot={{ r: 8 }} hide={!visibleLines.completedTasks} />
                <Line type="monotone" dataKey="incompleteTasks" name="Incomplete" stroke="#F87171" activeDot={{ r: 8 }} hide={!visibleLines.incompleteTasks} />
                <Line type="monotone" dataKey="totalTasks" name="Total" stroke="#F59E0B" activeDot={{ r: 8 }} hide={!visibleLines.totalTasks} />
            </LineChart>
        </ResponsiveContainer>
    );

    const dailyCompletionChartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={aggregatedData.lineChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                <YAxis stroke="rgba(255,255,255,0.7)" unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} labelStyle={{ color: 'white', fontWeight: 'bold' }} />
                <Legend wrapperStyle={{fontSize: "12px"}}/>
                <Line type="monotone" dataKey="completion" name="Task Completion %" stroke="#f59e0b" activeDot={{ r: 8 }} />
            </LineChart>
        </ResponsiveContainer>
    );

    const categoryPriorityChartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={filteredCategoryPriorityData}
                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} interval={0} />
                <YAxis stroke="rgba(255,255,255,0.7)" allowDecimals={false} />
                <Tooltip
                    contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                    itemStyle={{ color: 'white' }}
                    labelStyle={{ color: 'white', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{fontSize: "12px", cursor: 'pointer'}} onClick={handlePriorityDistributionLegendClick}/>
                <Bar dataKey="P1" stackId="a" fill="#F87171" name="P1 (Highest)" hide={!visiblePrioritiesForDistribution.P1} />
                <Bar dataKey="P2" stackId="a" fill="#F59E0B" name="P2 (High)" hide={!visiblePrioritiesForDistribution.P2} />
                <Bar dataKey="P3" stackId="a" fill="#38BDF8" name="P3 (Medium)" hide={!visiblePrioritiesForDistribution.P3} />
                <Bar dataKey="P4" stackId="a" fill="#64748B" name="P4 (Low)" hide={!visiblePrioritiesForDistribution.P4} />
            </BarChart>
        </ResponsiveContainer>
    );

    const focusByCategoryBarChartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                layout="vertical"
                data={aggregatedData.tagAnalysisData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" />
                <XAxis type="number" stroke="rgba(255,255,255,0.7)" unit="m" />
                <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.7)" width={80} tick={{ fontSize: 12 }} />
                <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                    contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                    itemStyle={{ color: 'white' }} 
                    labelStyle={{ color: 'white', fontWeight: 'bold' }}
                    formatter={(value: number) => [`${value} minutes`, 'Focus Time']}
                />
                <Legend wrapperStyle={{fontSize: "12px"}}/>
                <Bar dataKey="minutes" name="Focus Minutes" fill="#f59e0b" />
            </BarChart>
        </ResponsiveContainer>
    );

    const focusDistributionPieChartElement = (
        <div className="w-full h-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={110}
                        innerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                        paddingAngle={2}
                    >
                        {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} stroke="none" />
                        ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                        itemStyle={{ color: 'white' }}
                        formatter={(value: number) => [`${value} minutes`, 'Focus Time']}
                    />
                    <Legend wrapperStyle={{ bottom: 0 }} />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                <span className="text-4xl font-bold text-white">{totalFocusMinutesInRange}</span>
                <span className="block text-sm text-white/70">Total Mins</span>
            </div>
        </div>
    );

    const taskBreakdownPieChartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie data={aggregatedData.taskBreakdownData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                    {aggregatedData.taskBreakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_TASKS[index % COLORS_TASKS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} />
                <Legend wrapperStyle={{fontSize: "12px"}}/>
            </PieChart>
        </ResponsiveContainer>
    );

    const projectBreakdownPieChartElement = (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie data={aggregatedData.projectBreakdownData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                    {aggregatedData.projectBreakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_PROJECTS[index % COLORS_PROJECTS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }} itemStyle={{ color: 'white' }} />
                <Legend wrapperStyle={{fontSize: "12px"}}/>
            </PieChart>
        </ResponsiveContainer>
    );


    return (
        <Panel title="📜 History & Progress">
            {/* --- Section 1: Controls --- */}
            <div className="mb-6 space-y-2">
                <h3 className="text-lg font-semibold text-white text-center">Select Date Range</h3>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <input type="date" value={historyRange.start} onChange={e => setHistoryRange(p => ({...p, start: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                    <span className="text-white">to</span>
                    <input type="date" value={historyRange.end} onChange={e => setHistoryRange(p => ({...p, end: e.target.value}))} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}/>
                </div>
                <div className="flex justify-center gap-2">
                    <button onClick={() => handleSetRange(7)} className="p-2 px-3 rounded-lg font-semibold text-white transition bg-white/10 hover:bg-white/20 text-xs sm:text-sm">Last 7 Days</button>
                    <button onClick={() => handleSetRange(30)} className="p-2 px-3 rounded-lg font-semibold text-white transition bg-white/10 hover:bg-white/20 text-xs sm:text-sm">Last 30 Days</button>
                </div>
            </div>

            {/* --- Section 2: KPIs --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
                <StatCard title="Time & Tasks">
                    <div className="flex justify-around items-center h-full">
                        <StatItem label="Total Focus" value={formatMinutesToHours(aggregatedData.totalFocus)} />
                        <StatItem label="Avg Daily Focus" value={formatMinutesToHours(aggregatedData.averageDailyFocus)} />
                        <StatItem label="Tasks Done" value={`${aggregatedData.completedCount} / ${aggregatedData.totalTasks}`} />
                    </div>
                </StatCard>
                <StatCard title="Task Progress">
                    <div className="grid grid-cols-2 gap-y-2">
                        <StatItem label="Tasks Done" value={aggregatedData.completedCount} />
                        <StatItem label="Tasks in Range" value={aggregatedData.totalTasks} />
                        <StatItem label="Poms Done" value={aggregatedData.pomsDone} />
                        <StatItem label="Poms Est" value={aggregatedData.pomsEst} />
                    </div>
                </StatCard>
                 <StatCard title="Achievements">
                     <div className="flex justify-around items-center h-full">
                        <StatItem label="Projects Done" value={`${aggregatedData.projectsCompleted} / ${aggregatedData.totalProjectsInRange}`} />
                        <StatItem label="Targets Met" value={`${aggregatedData.targetsCompleted} / ${aggregatedData.totalTargetsInRange}`} />
                    </div>
                </StatCard>
            </div>

            {/* --- Section 3: Consistency Tracker --- */}
            <div className="mt-8">
                <div className="flex justify-center items-center gap-2 mb-4">
                    <h3 className="text-lg font-semibold text-white text-center">Daily Consistency Tracker</h3>
                    <button
                        onClick={() => openInsightModal('Daily Consistency Tracker', consistencyLogs, consistencyTrackerElement)}
                        className="p-1 text-purple-400 hover:text-purple-300 transition"
                        title="Get AI Insights for this chart"
                    >
                        <SparklesIcon />
                    </button>
                </div>
                {consistencyTrackerElement}
            </div>

            {/* --- Section 4: Time-based Trends --- */}
            <div className="mt-8 space-y-6">
                <div>
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white text-center">Daily Focus Minutes</h3>
                        <button onClick={() => openInsightModal('Daily Focus Minutes', aggregatedData.focusLineChartData, <div className="h-72">{dailyFocusChartElement}</div>)} className="p-1 text-purple-400 hover:text-purple-300 transition" title="Get AI Insights"><SparklesIcon /></button>
                    </div>
                    <div className="h-72">{dailyFocusChartElement}</div>
                </div>
                 <div>
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white text-center">Priority Focus Distribution</h3>
                        <button onClick={() => openInsightModal('Priority Focus Distribution', priorityFocusData, <div className="h-72">{priorityFocusChartElement}</div>)} className="p-1 text-purple-400 hover:text-purple-300 transition" title="Get AI Insights"><SparklesIcon /></button>
                    </div>
                    <div className="h-72">{priorityFocusChartElement}</div>
                </div>
                 <div>
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white text-center">Task Completion Rate by Priority</h3>
                        <button onClick={() => openInsightModal('Task Completion Rate by Priority', taskCompletionByPriorityData, <div className="h-72">{completionRateChartElement}</div>)} className="p-1 text-purple-400 hover:text-purple-300 transition" title="Get AI Insights"><SparklesIcon /></button>
                    </div>
                    <div className="h-72">{completionRateChartElement}</div>
                </div>
                <div>
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white text-center">Daily Task Volume</h3>
                        <button onClick={() => openInsightModal('Daily Task Volume', aggregatedData.dailyTaskVolumeChartData, <div className="h-72">{taskVolumeChartElement}</div>)} className="p-1 text-purple-400 hover:text-purple-300 transition" title="Get AI Insights"><SparklesIcon /></button>
                    </div>
                    <div className="h-72">{taskVolumeChartElement}</div>
                </div>
                <div>
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white text-center">Daily Task Completion %</h3>
                        <button onClick={() => openInsightModal('Daily Task Completion %', aggregatedData.lineChartData, <div className="h-72">{dailyCompletionChartElement}</div>)} className="p-1 text-purple-400 hover:text-purple-300 transition" title="Get AI Insights"><SparklesIcon /></button>
                    </div>
                    <div className="h-72">{dailyCompletionChartElement}</div>
                </div>
                <div className="mt-8">
                    <CategoryTimelineChart tasks={allTasks} history={timelinePomodoroHistory} historyRange={historyRange} openInsightModal={openInsightModal} />
                </div>
                
                <div className="mt-8">
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white text-center">Category Priority Distribution</h3>
                        <button onClick={() => openInsightModal('Category Priority Distribution', filteredCategoryPriorityData, <div className="h-96">{categoryPriorityChartElement}</div>)} className="p-1 text-purple-400 hover:text-purple-300 transition" title="Get AI Insights"><SparklesIcon /></button>
                    </div>
                    <div className="flex justify-center mb-4">
                        <div className="relative" ref={categoryFilterRef}>
                            <button onClick={() => setIsCategoryFilterOpen(o => !o)} className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg inline-flex items-center">
                                <span>Filter Categories ({selectedCategories.length}/{categoryPriorityDistributionData.length})</span>
                                <svg className="fill-current h-4 w-4 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </button>
                            {isCategoryFilterOpen && (
                                <div className="absolute z-10 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl right-0">
                                    <ul className="max-h-60 overflow-y-auto p-2">
                                        {categoryPriorityDistributionData.map(cat => (
                                            <li key={cat.name}>
                                                <label className="inline-flex items-center w-full p-2 rounded-md hover:bg-slate-700/50 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded bg-slate-600 border-slate-500 text-teal-400 focus:ring-teal-400/50"
                                                        checked={selectedCategories.includes(cat.name)}
                                                        onChange={() => handleCategorySelection(cat.name)}
                                                    />
                                                    <span className="ml-3 text-sm text-white">{cat.name}</span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
    
                    {filteredCategoryPriorityData.length > 0 ? (
                        <div className="h-96">{categoryPriorityChartElement}</div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-white/60 bg-black/10 rounded-lg">
                            <p>No categories selected or no data for this period.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- Section 5: Focus Breakdown --- */}
            <div className="mt-8 space-y-6">
                <div>
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white text-center">Focus Time by Category</h3>
                        <button onClick={() => openInsightModal('Focus Time by Category', aggregatedData.tagAnalysisData, <div className="h-96">{focusByCategoryBarChartElement}</div>)} className="p-1 text-purple-400 hover:text-purple-300 transition" title="Get AI Insights"><SparklesIcon /></button>
                    </div>
                    <div className="h-96">
                        {aggregatedData.tagAnalysisData.length > 0 ? (
                            focusByCategoryBarChartElement
                        ) : (
                            <div className="flex items-center justify-center h-full text-white/60 bg-black/10 rounded-lg">
                                No tagged tasks with completed sessions in this date range.
                            </div>
                        )}
                    </div>
                </div>
                <div>
                     <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white text-center">Focus Distribution (%)</h3>
                        <button onClick={() => openInsightModal('Focus Distribution (%)', pieChartData, <div className="h-96">{focusDistributionPieChartElement}</div>)} className="p-1 text-purple-400 hover:text-purple-300 transition" title="Get AI Insights"><SparklesIcon /></button>
                    </div>
                    <div className="h-96">
                         {pieChartData.length > 0 ? (
                            focusDistributionPieChartElement
                        ) : (
                            <div className="flex items-center justify-center h-full text-white/60 bg-black/10 rounded-lg">
                                No data to display.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- Section 7: Overall Stats --- */}
            <div className="mt-8 space-y-6">
                 <div>
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white text-center">Overall Task Breakdown</h3>
                        <button onClick={() => openInsightModal('Overall Task Breakdown', aggregatedData.taskBreakdownData, <div className="h-64">{taskBreakdownPieChartElement}</div>)} className="p-1 text-purple-400 hover:text-purple-300 transition" title="Get AI Insights"><SparklesIcon /></button>
                    </div>
                    <div className="h-64">{taskBreakdownPieChartElement}</div>
                </div>
                 <div>
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white text-center">Overall Project Breakdown</h3>
                        <button onClick={() => openInsightModal('Overall Project Breakdown', aggregatedData.projectBreakdownData, <div className="h-64">{projectBreakdownPieChartElement}</div>)} className="p-1 text-purple-400 hover:text-purple-300 transition" title="Get AI Insights"><SparklesIcon /></button>
                    </div>
                    <div className="h-64">{projectBreakdownPieChartElement}</div>
                </div>
            </div>

            {/* --- Section 8: Detailed Drill-down --- */}
            <div className="mt-8">
                <h3 className="text-lg font-semibold text-white text-center mb-2">Detailed Breakdown</h3>
                <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full max-w-lg mx-auto">
                    {(['day', 'week', 'month', 'all'] as const).map(type => (
                        <button 
                            key={type} 
                            onClick={() => setDetailViewType(type)} 
                            className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${detailViewType === type ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                        >
                            {type === 'day' ? 'Day' : type === 'week' ? 'Last 7 Days' : type === 'month' ? 'Last 30 Days' : 'Date Range'}
                        </button>
                    ))}
                </div>
                {detailViewType === 'day' && (
                  <div className="flex gap-2 max-w-sm mx-auto">
                      <input type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}} />
                  </div>
                )}
                {detailedViewData ? (
                    <div className="bg-black/20 p-3 mt-3 rounded-lg text-white text-sm space-y-1 max-w-lg mx-auto">
                        <p><strong>{detailedViewData.startDate === detailedViewData.endDate ? 'Date' : 'Period'}:</strong> {detailedViewData.title}</p>
                        <p><strong>Completed Tasks:</strong> {detailedViewData.completedTasksCount} / {detailedViewData.totalTasksCount}</p>
                        <p><strong>Task Completion:</strong> {detailedViewData.completionPercentage}%</p>
                        <p><strong>Total Focus Minutes:</strong> {detailedViewData.totalFocusMinutes}</p>
                        <h4 className="font-bold pt-2">Tasks ({detailedViewData.tasks.length}):</h4>
                         {detailedViewData.tasks.length > 0 ? (
                            <ul className='list-disc list-inside max-h-48 overflow-y-auto pr-2 space-y-1'>
                                {detailedViewData.tasks.sort((a,b) => a.due_date.localeCompare(b.due_date)).map(t => (
                                    <li key={t.id} className={t.completed_at ? 'text-green-400' : 'text-amber-400'}>
                                        <span className="font-mono text-xs">{t.due_date}:</span> {t.text} - {t.completed_at ? 'Completed' : 'Incomplete'}
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-white/60">No tasks were due in this period.</p>}
                    </div>
                ) : (
                    <div className="bg-black/20 p-3 mt-3 rounded-lg text-white/70 text-sm text-center max-w-lg mx-auto">
                         {detailViewType === 'day' ? 'Select a day to see details.' : 'Loading data...'}
                    </div>
                )}
            </div>
            
            {modalState && (
                <AIInsightModal
                    isOpen={modalState.isOpen}
                    onClose={closeInsightModal}
                    chartTitle={modalState.chartTitle}
                    chartData={modalState.chartData}
                    chartElement={modalState.chartElement}
                />
            )}
        </Panel>
    );
};

export default React.memo(HistoryPanel);