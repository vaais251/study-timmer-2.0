
import React, { useState, useEffect, useMemo } from 'react';
import { PomodoroHistory, Task } from '../types';
import * as dbService from '../services/dbService';
import Panel from './common/Panel';
import Spinner from './common/Spinner';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';


const TEN_THOUSAND_HOURS_IN_MINUTES = 10000 * 60;

const formatTimeForMastery = (minutes: number): string => {
    const totalMinutesRounded = Math.round(minutes);

    if (totalMinutesRounded < 1) {
        if (minutes > 0) return "<1m";
        return "0m";
    }

    const hours = Math.floor(totalMinutesRounded / 60);
    const remainingMinutes = totalMinutesRounded % 60;

    if (hours > 0 && remainingMinutes > 0) {
        return `${hours}h ${remainingMinutes}m`;
    }
    if (hours > 0) {
        return `${hours}h`;
    }
    return `${remainingMinutes}m`;
};

const FormattedTimeDisplay: React.FC<{ minutes: number; baseClass: string; unitClass: string }> = ({ minutes, baseClass, unitClass }) => {
    const timeString = formatTimeForMastery(minutes);
    
    if (timeString === "<1m" || timeString === "0m") {
        return <span className={baseClass}>{timeString}</span>;
    }

    const parts = timeString.split(' ');

    return (
        <span className={baseClass}>
            {parts.map((part, index) => {
                const value = part.slice(0, -1);
                const unit = part.slice(-1);
                return (
                    <React.Fragment key={index}>
                        {index > 0 && ' '}
                        {value}<span className={unitClass}>{unit}</span>
                    </React.Fragment>
                );
            })}
        </span>
    );
};


const FocusBreakdownChart: React.FC<{ data: { name: string; minutes: number }[], dateRange: {start: string, end: string} }> = ({ data, dateRange }) => {
    const totalMinutes = useMemo(() => data.reduce((sum, item) => sum + item.minutes, 0), [data]);
    const isAllTime = !dateRange.start || !dateRange.end;
    const titleText = isAllTime ? "All Time" : "In Range";

    return (
        <div className="p-4 text-white" style={{ fontFamily: `'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif` }}>
            <h3 className="text-lg font-semibold text-white text-center mb-4">Focus Breakdown for Selected Categories</h3>
            <div className="mb-8 text-left">
                <FormattedTimeDisplay minutes={totalMinutes} baseClass="text-6xl font-bold" unitClass="text-5xl font-medium align-baseline" />
            </div>
            <p className="text-sm text-white/70 -mt-6 mb-6 ml-1">{titleText} total for selected</p>
            
            <div className="flex gap-4">
                {data.map((item) => (
                    <div key={item.name} className="flex-1 bg-black/30 p-4 rounded-xl shadow-lg text-center flex flex-col justify-center items-center min-h-[100px]">
                        <div className="text-lg font-bold text-white/90 mb-2">{item.name}</div>
                        <FormattedTimeDisplay minutes={item.minutes} baseClass="text-4xl text-cyan-300 font-semibold" unitClass="text-3xl font-medium" />
                    </div>
                ))}
            </div>
        </div>
    );
};

const COLORS = ["#22d3ee", "#a78bfa"]; // cyan, purple

const DailyFocusTrendChart: React.FC<{
    selectedCategories: [string | null, string | null];
    history: PomodoroHistory[];
    tasks: Task[];
    dateRange: { start: string, end: string };
    movingAveragePeriod: number;
    onPeriodChange: (period: number) => void;
}> = ({ selectedCategories, history, tasks, dateRange, movingAveragePeriod, onPeriodChange }) => {

    const [visibility, setVisibility] = useState<{ [key: string]: boolean }>({});

    const { dailyData, categoryNames, categoryDisplayNames } = useMemo(() => {
        const [cat1, cat2] = selectedCategories;
        const categoryNames = [cat1, cat2].filter((c): c is string => c !== null);
        const categoryDisplayNames = categoryNames.map(name => name.charAt(0).toUpperCase() + name.slice(1));
        
        if (categoryNames.length === 0 || history.length === 0) return { dailyData: [], categoryNames: [], categoryDisplayNames: [] };
        
        const isAllTime = !dateRange.start || !dateRange.end;
        let startDate: Date;
        let endDate = new Date(); // Today
        
        if (isAllTime) {
            if (history.length === 0) return { dailyData: [], categoryNames: [], categoryDisplayNames: [] };
            const earliestTimestamp = Math.min(...history.map(h => new Date(h.ended_at).getTime()));
            startDate = new Date(earliestTimestamp);
            startDate.setHours(0,0,0,0);
        } else {
            startDate = new Date(dateRange.start + 'T00:00:00');
            endDate = new Date(dateRange.end + 'T00:00:00');
        }

        const taskMap = new Map<string, string[]>();
        tasks.forEach(task => {
            if (task.id && task.tags?.length > 0) {
                taskMap.set(task.id, task.tags.map(t => t.toLowerCase()));
            }
        });

        const dataByDate = new Map<string, any>();
        const loopDate = new Date(startDate);
        while(loopDate <= endDate) {
            const dateStr = loopDate.toISOString().split('T')[0];
            const initialData: any = { 
                date: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            };
            categoryNames.forEach(name => { initialData[name] = 0; });
            dataByDate.set(dateStr, initialData);
            loopDate.setDate(loopDate.getDate() + 1);
        }
        
        history.forEach(h => {
            const historyDate = new Date(h.ended_at).toISOString().split('T')[0];
            if (dataByDate.has(historyDate) && h.task_id) {
                const dayData = dataByDate.get(historyDate);
                const taskTags = taskMap.get(h.task_id);
                if (dayData && taskTags) {
                    categoryNames.forEach(catName => {
                        if (taskTags.includes(catName)) {
                            dayData[catName] += Number(h.duration_minutes) || 0;
                        }
                    });
                }
            }
        });

        const sortedDates = Array.from(dataByDate.keys()).sort();

        // Calculate moving average
        for (let i = 0; i < sortedDates.length; i++) {
            const currentDateStr = sortedDates[i];
            const currentDayData = dataByDate.get(currentDateStr);
            if (!currentDayData) continue;
            
            const windowStartDateIndex = Math.max(0, i - (movingAveragePeriod - 1));
            
            categoryNames.forEach(catName => {
                let sum = 0;
                let count = 0;
                for (let j = windowStartDateIndex; j <= i; j++) {
                    const dateStr = sortedDates[j];
                    const dayData = dataByDate.get(dateStr);
                    if (dayData) {
                        sum += dayData[catName] || 0;
                        count++;
                    }
                }
                const avg = count > 0 ? sum / count : 0;
                currentDayData[`${catName}_avg`] = avg;
            });
        }

        const finalData = Array.from(dataByDate.values()).map(day => {
            categoryNames.forEach(name => {
                day[name] = Math.round(day[name]);
                if (day[`${name}_avg`]) {
                    day[`${name}_avg`] = Math.round(day[`${name}_avg`]);
                }
            });
            return day;
        });

        return { dailyData: finalData, categoryNames, categoryDisplayNames };

    }, [selectedCategories, history, tasks, dateRange, movingAveragePeriod]);

    useEffect(() => {
        const [cat1, cat2] = selectedCategories;
        const newVisibility: { [key: string]: boolean } = {};
        if (cat1) {
            newVisibility[cat1] = true;
            newVisibility[`${cat1}_avg`] = false;
        }
        if (cat2) {
            newVisibility[cat2] = true;
            newVisibility[`${cat2}_avg`] = false;
        }
        setVisibility(newVisibility);
    }, [selectedCategories]);

    const handleLegendClick = (payload: any) => {
        const { dataKey } = payload;
        setVisibility(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
    };

    const totalMinutes = dailyData.reduce((total, day) => {
        let dayTotal = 0;
        categoryNames.forEach(cat => {
            if (cat && visibility[cat]) {
                dayTotal += (day[cat] || 0);
            }
        });
        return total + dayTotal;
    }, 0);

    const title = categoryDisplayNames.length > 0 ? categoryDisplayNames.join(' vs ') : 'Daily Focus Trend';

    return (
        <div className="mt-6 bg-black/20 p-4 rounded-lg">
             <div className="flex flex-col sm:flex-row justify-between items-center mb-1">
                <h3 className="text-lg font-semibold text-white text-center mb-2 sm:mb-0">
                    Daily Focus Trend: <span className="text-cyan-300">{title}</span>
                </h3>
                <div className="flex items-center gap-2">
                    <label htmlFor="moving-avg-period" className="text-sm text-white/70">Moving Avg:</label>
                    <input
                        id="moving-avg-period"
                        type="number"
                        value={movingAveragePeriod}
                        onChange={e => onPeriodChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        min="1"
                        className="w-16 bg-slate-700/50 border border-slate-600 rounded-lg py-1 px-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                    <span className="text-sm text-white/70">days</span>
                </div>
            </div>

            {totalMinutes > 0 ? (
                <div className="h-64 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" tick={{ fontSize: 10 }} />
                            <YAxis stroke="rgba(255,255,255,0.7)" unit="m" allowDecimals={false} />
                            <Tooltip
                                cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                                contentStyle={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem' }}
                                itemStyle={{ color: 'white' }}
                                labelStyle={{ color: 'white', fontWeight: 'bold' }}
                                formatter={(value: number, name: string) => [`${value} min`, name]}
                            />
                            <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }}/>
                            {categoryNames.map((name, index) => (
                                <React.Fragment key={name}>
                                    <Line
                                        type="monotone"
                                        dataKey={name}
                                        name={name.charAt(0).toUpperCase() + name.slice(1)}
                                        stroke={COLORS[index % COLORS.length]}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 6 }}
                                        hide={!visibility[name]}
                                    />
                                    <Line 
                                        type="monotone"
                                        dataKey={`${name}_avg`}
                                        name={`${name.charAt(0).toUpperCase() + name.slice(1)} (Avg)`}
                                        stroke={COLORS[index % COLORS.length]}
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        dot={false}
                                        activeDot={false}
                                        hide={!visibility[`${name}_avg`]}
                                    />
                                </React.Fragment>
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-64 flex items-center justify-center text-white/60">
                    <p>No focus time recorded for the selected categories {!dateRange.start || !dateRange.end ? 'yet' : 'in this period'}.</p>
                </div>
            )}
        </div>
    );
};


const ExpertiseTracker: React.FC = () => {
    const [history, setHistory] = useState<PomodoroHistory[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeRange, setActiveRange] = useState<'week' | 'month' | 'all'>('all');
    const [chartActiveRange, setChartActiveRange] = useState<'week' | 'month' | 'all'>('week');
    
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [selectedCategories, setSelectedCategories] = useState<[string | null, string | null]>([null, null]);
    const [movingAveragePeriod, setMovingAveragePeriod] = useState(7);
    
    useEffect(() => {
        const today = new Date();
        const endDate = today.toISOString().split('T')[0];
        let startDate = '';

        if (activeRange === 'week') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(today.getDate() - 6);
            startDate = sevenDaysAgo.toISOString().split('T')[0];
            setDateRange({ start: startDate, end: endDate });
        } else if (activeRange === 'month') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 29);
            startDate = thirtyDaysAgo.toISOString().split('T')[0];
            setDateRange({ start: startDate, end: endDate });
        } else { // 'all'
            setDateRange({ start: '', end: '' });
        }
    }, [activeRange]);
    
    const chartDateRange = useMemo(() => {
        const today = new Date();
        const endDate = today.toISOString().split('T')[0];
        let startDate = '';

        if (chartActiveRange === 'week') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(today.getDate() - 6);
            startDate = sevenDaysAgo.toISOString().split('T')[0];
            return { start: startDate, end: endDate };
        } else if (chartActiveRange === 'month') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 29);
            startDate = thirtyDaysAgo.toISOString().split('T')[0];
            return { start: startDate, end: endDate };
        } else { // 'all'
            return { start: '', end: '' };
        }
    }, [chartActiveRange]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [fetchedHistory, fetchedTasks] = await Promise.all([
                    dbService.getAllPomodoroHistory(),
                    dbService.getAllTasksForStats()
                ]);
                setHistory(fetchedHistory);
                setTasks(fetchedTasks);
            } catch (err) {
                setError("Failed to load mastery data.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // This calculates all-time data. It is used to populate the category dropdowns
    // and to set the initial default categories to track.
    const allExpertiseData = useMemo(() => {
        const taskMap = new Map<string, string[]>();
        tasks.forEach(task => {
            if (task.id && task.tags?.length > 0) {
                taskMap.set(task.id, task.tags);
            }
        });

        const tagMinutesMap = new Map<string, number>();
        history.forEach(item => {
            if (item.task_id) {
                const tags = taskMap.get(item.task_id);
                if (tags) {
                    tags.forEach(tag => {
                        const normalizedTag = tag.trim().toLowerCase();
                        if (normalizedTag) {
                            const currentMinutes = tagMinutesMap.get(normalizedTag) || 0;
                            tagMinutesMap.set(normalizedTag, currentMinutes + (Number(item.duration_minutes) || 0));
                        }
                    });
                }
            }
        });

        return Array.from(tagMinutesMap.entries())
            .map(([name, totalMinutes]) => ({
                name: name,
                displayName: name.charAt(0).toUpperCase() + name.slice(1),
                totalMinutes,
                totalHours: totalMinutes / 60,
                progress: (totalMinutes / TEN_THOUSAND_HOURS_IN_MINUTES) * 100,
            }))
            .sort((a, b) => b.totalMinutes - a.totalMinutes);

    }, [history, tasks]);
    
    // This calculates expertise data based on the selected date range.
    // It drives the main progress bars and hour counts.
    const expertiseDataForDisplay = useMemo(() => {
        const historyToProcess = (!dateRange.start || !dateRange.end)
            ? history
            : history.filter(item => {
                const itemDate = new Date(item.ended_at).toISOString().split('T')[0];
                return itemDate >= dateRange.start && itemDate <= dateRange.end;
            });

        const taskMap = new Map<string, string[]>();
        tasks.forEach(task => {
            if (task.id && task.tags?.length > 0) {
                taskMap.set(task.id, task.tags);
            }
        });

        const tagMinutesMap = new Map<string, number>();
        historyToProcess.forEach(item => {
            if (item.task_id) {
                const tags = taskMap.get(item.task_id);
                if (tags) {
                    tags.forEach(tag => {
                        const normalizedTag = tag.trim().toLowerCase();
                        if (normalizedTag) {
                            const currentMinutes = tagMinutesMap.get(normalizedTag) || 0;
                            tagMinutesMap.set(normalizedTag, currentMinutes + (Number(item.duration_minutes) || 0));
                        }
                    });
                }
            }
        });

        // Use allExpertiseData as the source for all categories and all-time progress
        return allExpertiseData.map(allTimeCategoryData => {
            const minutesInRange = tagMinutesMap.get(allTimeCategoryData.name) || 0;
            return {
                name: allTimeCategoryData.name,
                displayName: allTimeCategoryData.displayName,
                progress: allTimeCategoryData.progress,
                allTimeMinutes: allTimeCategoryData.totalMinutes,
                minutesInRange: minutesInRange,
            };
        });
    }, [dateRange, history, tasks, allExpertiseData]);


    useEffect(() => {
        if (allExpertiseData.length > 0 && selectedCategories[0] === null) {
            const topCategory1 = allExpertiseData[0]?.name || null;
            const topCategory2 = allExpertiseData[1]?.name || null;
            setSelectedCategories([topCategory1, topCategory2]);
        }
    }, [allExpertiseData, selectedCategories]);

    const handleCategoryChange = (index: 0 | 1, newCategory: string) => {
        setSelectedCategories(prev => {
            const newSelection: [string | null, string | null] = [prev[0], prev[1]];
            const otherIndex = index === 0 ? 1 : 0;

            if (newCategory === newSelection[otherIndex]) {
                newSelection[otherIndex] = newSelection[index];
            }
            newSelection[index] = newCategory;
            return newSelection;
        });
    };

    const rangeBreakdownData = useMemo(() => {
        if (!selectedCategories[0] && !selectedCategories[1]) {
            return [];
        }

        return selectedCategories
            .filter((cat): cat is string => cat !== null)
            .map(catName => {
                const categoryData = expertiseDataForDisplay.find(c => c.name === catName);
                return {
                     name: categoryData?.displayName || 'Unknown',
                     minutes: categoryData?.minutesInRange || 0
                }
            })
            .sort((a,b) => b.minutes - a.minutes);
    }, [expertiseDataForDisplay, selectedCategories]);

    const renderCategoryTracker = (categoryName: string | null, index: 0 | 1) => {
        const data = expertiseDataForDisplay.find(item => item.name === categoryName);
        
        const renderPlaceholder = () => (
             <div className="bg-black/20 p-4 rounded-lg">
                 <select
                    value={categoryName || ''}
                    onChange={(e) => handleCategoryChange(index, e.target.value)}
                    className="w-full mb-3 bg-white/20 border border-white/30 rounded-lg p-2 text-white font-bold focus:outline-none focus:bg-white/30 focus:border-white/50"
                >
                    <option value="" disabled className="bg-gray-800">-- Select Category --</option>
                    {allExpertiseData.map(opt => (
                        <option key={opt.name} value={opt.name} className="bg-gray-800">{opt.displayName}</option>
                    ))}
                </select>
                <div className="text-center text-white/60 min-h-[70px] flex items-center justify-center">
                     <p>Select a category to track.</p>
                </div>
            </div>
        );

        if (!data) {
            return renderPlaceholder();
        }

        const isRangeActive = dateRange.start && dateRange.end;

        return (
            <div className="bg-black/20 p-4 rounded-lg">
                <select
                    value={categoryName || ''}
                    onChange={(e) => handleCategoryChange(index, e.target.value)}
                    className="w-full mb-3 bg-white/20 border border-white/30 rounded-lg p-2 text-white font-bold focus:outline-none focus:bg-white/30 focus:border-white/50"
                >
                    {allExpertiseData.map(opt => (
                        <option key={opt.name} value={opt.name} className="bg-gray-800">{opt.displayName}</option>
                    ))}
                </select>
                <div className="min-h-[70px]">
                    <div className="flex justify-between items-baseline mb-1 text-sm">
                        <span className="font-bold text-white">{data.displayName}</span>
                        <span className="text-white/80">
                            {formatTimeForMastery(data.allTimeMinutes)} / 10,000h
                        </span>
                    </div>
                    <div className="w-full bg-black/30 rounded-full h-4 shadow-inner">
                        <div
                            className="bg-gradient-to-r from-cyan-400 to-blue-500 h-4 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, data.progress)}%` }}
                        ></div>
                    </div>
                     <div className="flex justify-between items-center text-xs text-white/60 mt-1">
                        <span>{data.progress.toFixed(4)}% complete</span>
                        { isRangeActive && data.minutesInRange > 0 &&
                            <span className="font-semibold text-green-400">
                                +{formatTimeForMastery(data.minutesInRange)} in range
                            </span>
                        }
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (isLoading) return <Spinner />;
        if (error) return <p className="text-center text-red-400">{error}</p>;
        if (allExpertiseData.length === 0) {
            return <p className="text-center text-white/60 py-4">No focus time logged for tagged tasks yet. Add tags to your tasks and complete some focus sessions!</p>;
        }
        
        const totalRangeMinutes = rangeBreakdownData.reduce((sum, item) => sum + item.minutes, 0);

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    {renderCategoryTracker(selectedCategories[0], 0)}
                    {allExpertiseData.length > 1 && renderCategoryTracker(selectedCategories[1], 1)}
                </div>

                <div className="mt-6 bg-black/20 rounded-lg">
                    {totalRangeMinutes > 0 ? (
                        <FocusBreakdownChart data={rangeBreakdownData} dateRange={dateRange} />
                    ) : (
                        <div className="p-4 text-white/70 text-center h-48 flex items-center justify-center">
                            <p>No focus time logged for these categories {activeRange === 'all' ? 'at all' : 'in this date range'}.</p>
                        </div>
                    )}
                </div>
                
                 <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 mt-6 border border-slate-700/80">
                    <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full max-w-sm mx-auto">
                        {(['week', 'month', 'all'] as const).map(range => (
                            <button 
                                key={range}
                                onClick={() => setChartActiveRange(range)} 
                                className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${chartActiveRange === range ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                            >
                                {range === 'week' ? 'Last 7 Days' : range === 'month' ? 'Last 30 Days' : 'All Time'}
                            </button>
                        ))}
                    </div>
                    <DailyFocusTrendChart 
                        selectedCategories={selectedCategories}
                        history={history}
                        tasks={tasks}
                        dateRange={chartDateRange}
                        movingAveragePeriod={movingAveragePeriod}
                        onPeriodChange={setMovingAveragePeriod}
                    />
                </div>
            </div>
        );
    };

    return (
        <Panel title="🎓 Mastery Tracker">
             <div className="mb-4">
                <p className="text-white/80 text-center text-sm mb-4">Track your focus time for each category on your journey to 10,000 hours of mastery.</p>
                <div className="flex justify-center gap-2 mb-4 bg-black/20 p-1 rounded-full max-w-sm mx-auto">
                    {(['week', 'month', 'all'] as const).map(range => (
                        <button 
                            key={range}
                            onClick={() => setActiveRange(range)} 
                            className={`flex-1 p-2 text-sm rounded-full font-bold transition-colors ${activeRange === range ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'}`}
                        >
                            {range === 'week' ? 'Last 7 Days' : range === 'month' ? 'Last 30 Days' : 'All Time'}
                        </button>
                    ))}
                </div>
            </div>
            {renderContent()}
        </Panel>
    );
};

export default ExpertiseTracker;