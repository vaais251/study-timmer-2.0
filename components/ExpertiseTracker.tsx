

import React, { useState, useEffect, useMemo } from 'react';
import { PomodoroHistory, Task } from '../types';
import * as dbService from '../services/dbService';
import Panel from './common/Panel';
import Spinner from './common/Spinner';

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


const ExpertiseTracker: React.FC = () => {
    const [history, setHistory] = useState<PomodoroHistory[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [selectedCategories, setSelectedCategories] = useState<[string | null, string | null]>([null, null]);

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
                // from allTimeCategoryData, for all-time progress bar
                name: allTimeCategoryData.name,
                displayName: allTimeCategoryData.displayName,
                progress: allTimeCategoryData.progress,
                
                // calculated for the selected date range, for text display
                totalMinutes: minutesInRange,
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
                     minutes: categoryData?.totalMinutes || 0
                }
            })
            .sort((a,b) => b.minutes - a.minutes);
    }, [expertiseDataForDisplay, selectedCategories]);

    const handleResetDates = () => {
        setDateRange({ start: '', end: '' });
    };

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
                    <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="font-bold text-white">{data.displayName}</span>
                        <span className="text-white/80">
                            {formatTimeForMastery(data.totalMinutes)} / 10,000 hrs
                        </span>
                    </div>
                    <div className="w-full bg-black/30 rounded-full h-4 shadow-inner">
                        <div
                            className="bg-gradient-to-r from-cyan-400 to-blue-500 h-4 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, data.progress)}%` }}
                        ></div>
                    </div>
                     <div className="text-right text-xs text-white/60 mt-1">
                        {data.progress.toFixed(4)}% complete
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderCategoryTracker(selectedCategories[0], 0)}
                    {allExpertiseData.length > 1 && renderCategoryTracker(selectedCategories[1], 1)}
                </div>

                <div className="mt-6 bg-black/20 rounded-lg">
                    {totalRangeMinutes > 0 ? (
                        <FocusBreakdownChart data={rangeBreakdownData} dateRange={dateRange} />
                    ) : (
                        <div className="p-4 text-white/70 text-center h-48 flex items-center justify-center">
                            <p>No focus time logged for these categories {!dateRange.start && !dateRange.end ? 'at all' : 'in this date range'}.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <Panel title="🎓 Mastery Tracker">
             <div className="mb-4">
                <p className="text-white/80 text-center text-sm mb-4">Track your focus time for each category on your journey to 10,000 hours of mastery.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <input 
                        type="date" 
                        value={dateRange.start}
                        onChange={e => setDateRange(p => ({...p, start: e.target.value}))} 
                        className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}
                    />
                    <span className="text-white">to</span>
                    <input 
                        type="date" 
                        value={dateRange.end}
                        onChange={e => setDateRange(p => ({...p, end: e.target.value}))} 
                        className="bg-white/20 border border-white/30 rounded-lg p-2 text-white/80 w-full text-center" style={{colorScheme: 'dark'}}
                    />
                    <button onClick={handleResetDates} className="p-2 w-full sm:w-auto px-4 rounded-lg font-bold text-white transition hover:scale-105 bg-gradient-to-br from-gray-500 to-gray-600">
                        All Time
                    </button>
                </div>
            </div>
            {renderContent()}
        </Panel>
    );
};

export default ExpertiseTracker;