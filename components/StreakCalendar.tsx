import React, { useMemo, useState } from 'react';
import { DbDailyLog } from '../types';
import { getTodayDateString } from '../utils/date';

interface StreakCalendarProps {
    historicalLogs: DbDailyLog[];
}

const StreakCalendar: React.FC<StreakCalendarProps> = ({ historicalLogs }) => {
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);

    // Create a map of date -> focus minutes for quick lookup
    const logMap = useMemo(() => {
        const map = new Map<string, number>();
        historicalLogs.forEach(log => {
            map.set(log.date, log.total_focus_minutes);
        });
        console.log('StreakCalendar - Total logs received:', historicalLogs.length);
        console.log('StreakCalendar - Date range:',
            historicalLogs.length > 0 ?
                `${historicalLogs[0]?.date} to ${historicalLogs[historicalLogs.length - 1]?.date}` :
                'No data'
        );
        console.log('StreakCalendar - Sample data:', historicalLogs.slice(0, 5));
        return map;
    }, [historicalLogs]);

    // Calculate current streak
    const currentStreak = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let streak = 0;
        let checkDate = new Date(today);

        for (let i = 0; i < 365; i++) {
            const dateString = getTodayDateString(checkDate);
            const focusMinutes = logMap.get(dateString) || 0;

            if (focusMinutes > 1) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                if (i === 0 && focusMinutes <= 1) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                break;
            }
        }
        return streak;
    }, [logMap]);

    // Calculate longest streak
    const longestStreak = useMemo(() => {
        let maxStreak = 0;
        let currentStreak = 0;
        const sortedDates = Array.from(logMap.keys()).sort();

        for (let i = 0; i < sortedDates.length; i++) {
            const focusMinutes: number = logMap.get(sortedDates[i]) || 0;
            if (focusMinutes > 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }
        return maxStreak;
    }, [logMap]);

    // Calculate total focus days
    const totalFocusDays = useMemo(() => {
        return Array.from(logMap.values()).filter((mins: number) => mins > 1).length;
    }, [logMap]);

    // Generate 6 months of calendar data
    const calendarData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const startDate = new Date(currentYear, currentMonth - 5, 1);
        const months = [];

        for (let i = 0; i < 6; i++) {
            const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const year = monthDate.getFullYear();
            const month = monthDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startDayOfWeek = firstDay.getDay();
            const days = [];
            const totalDays = lastDay.getDate();

            for (let j = 0; j < startDayOfWeek; j++) {
                days.push(null);
            }

            for (let day = 1; day <= totalDays; day++) {
                const date = new Date(year, month, day);
                date.setHours(0, 0, 0, 0);
                const dateString = getTodayDateString(date);
                const focusMinutes = logMap.get(dateString) || 0;
                const isFuture = date > today;
                const isToday = dateString === getTodayDateString(today);

                days.push({
                    date: dateString,
                    day,
                    focusMinutes,
                    isStreak: focusMinutes > 1,
                    isFuture,
                    isToday
                });
            }

            months.push({
                year,
                month,
                monthName: firstDay.toLocaleDateString('en-US', { month: 'short' }),
                days
            });
        }
        return months;
    }, [logMap]);

    const getDayStyle = (day: any) => {
        if (!day) return 'invisible';

        let baseClass = 'group relative w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-md sm:rounded-lg flex items-center justify-center text-[8px] sm:text-[9px] md:text-[10px] font-bold transition-all duration-300 cursor-pointer';

        if (day.isFuture) {
            return baseClass + ' bg-white/5 border border-white/10 text-slate-700';
        }

        if (day.isStreak) {
            const intensity = Math.min(day.focusMinutes / 90, 1);

            if (intensity > 0.66) {
                return baseClass + ' bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60 hover:scale-110 ' + (day.isToday ? 'ring-1 sm:ring-2 ring-white ring-offset-1 sm:ring-offset-2 ring-offset-slate-900' : '');
            } else if (intensity > 0.33) {
                return baseClass + ' bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-600/30 hover:shadow-cyan-600/50 hover:scale-110 ' + (day.isToday ? 'ring-1 sm:ring-2 ring-white ring-offset-1 sm:ring-offset-2 ring-offset-slate-900' : '');
            } else {
                return baseClass + ' bg-gradient-to-br from-cyan-600 to-blue-700 text-white/90 shadow-sm hover:shadow-md hover:scale-110 ' + (day.isToday ? 'ring-1 sm:ring-2 ring-white ring-offset-1 sm:ring-offset-2 ring-offset-slate-900' : '');
            }
        }

        return baseClass + ' bg-white/5 text-slate-600 hover:bg-white/10 ' + (day.isToday ? 'ring-1 sm:ring-2 ring-cyan-400 ring-offset-1 sm:ring-offset-2 ring-offset-slate-900' : '');
    };

    return (
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 p-3 sm:p-4 md:p-6 shadow-2xl">
            {/* Ambient Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none"></div>

            {/* Header Section */}
            <div className="relative mb-4 sm:mb-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                            <span className="text-xl sm:text-2xl">🔥</span>
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">Focus Streak</h3>
                            <p className="text-[10px] sm:text-xs text-slate-400 font-medium">Your consistency journey</p>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    {/* Current Streak */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl sm:rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <div className="relative bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-xl border border-orange-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-orange-500/40 transition-all">
                            <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-400 leading-none mb-1">
                                {currentStreak}
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Current Streak</div>
                        </div>
                    </div>

                    {/* Longest Streak */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl sm:rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <div className="relative bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl border border-purple-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-purple-500/40 transition-all">
                            <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-400 leading-none mb-1">
                                {longestStreak}
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Best Streak</div>
                        </div>
                    </div>

                    {/* Total Days */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl sm:rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <div className="relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl border border-cyan-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-cyan-500/40 transition-all">
                            <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-400 leading-none mb-1">
                                {totalFocusDays}
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Days</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
                {calendarData.map((monthData, idx) => (
                    <div
                        key={`${monthData.year}-${monthData.month}`}
                        className="bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-white/10 hover:border-white/20 transition-all animate-fadeIn"
                        style={{ animationDelay: `${idx * 50}ms` }}
                    >
                        {/* Month Header */}
                        <div className="mb-1.5 sm:mb-2 text-center">
                            <h4 className="text-[10px] sm:text-xs font-black text-white/90 uppercase tracking-wide">
                                {monthData.monthName} <span className="text-white/50">'{String(monthData.year).slice(-2)}</span>
                            </h4>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-1.5">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                <div key={i} className="text-center text-[8px] sm:text-[9px] font-black text-slate-500 w-5 h-4 sm:w-6 sm:h-5 md:w-7 flex items-center justify-center">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                            {monthData.days.map((day, i) => (
                                <div
                                    key={i}
                                    className={getDayStyle(day)}
                                    onMouseEnter={() => day && setHoveredDay(day.date)}
                                    onMouseLeave={() => setHoveredDay(null)}
                                >
                                    {day && (
                                        <>
                                            <span className="relative z-10">{day.day}</span>

                                            {/* Premium Tooltip */}
                                            {hoveredDay === day.date && (
                                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 pointer-events-none z-50 animate-scaleIn">
                                                    <div className="bg-slate-900 border border-cyan-500/30 rounded-xl px-3 py-2 shadow-2xl shadow-cyan-500/20 backdrop-blur-xl">
                                                        <div className="text-xs font-bold text-white mb-1 whitespace-nowrap">
                                                            {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-sm font-black text-cyan-400">
                                                                {day.focusMinutes}
                                                            </div>
                                                            <div className="text-xs text-slate-400">minutes</div>
                                                        </div>
                                                        {day.isStreak && (
                                                            <div className="mt-1 text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                                                <span>✓</span>
                                                                <span>Streak Day</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Tooltip Arrow */}
                                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                                                        <div className="w-2 h-2 bg-slate-900 border-r border-b border-cyan-500/30 rotate-45"></div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Elegant Legend */}
            <div className="relative flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-3 sm:pt-4 border-t border-white/10">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                        <div className="w-3 h-3 rounded bg-gradient-to-br from-cyan-400 to-blue-500 shadow-sm"></div>
                        <div className="w-3 h-3 rounded bg-gradient-to-br from-cyan-500 to-blue-600 shadow-sm"></div>
                        <div className="w-3 h-3 rounded bg-gradient-to-br from-cyan-600 to-blue-700 shadow-sm"></div>
                    </div>
                    <span className="text-[10px] sm:text-xs text-slate-400 font-medium">More activity</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-white/5"></div>
                    <span className="text-[10px] sm:text-xs text-slate-400 font-medium">Less</span>
                </div>
            </div>
        </div>
    );
};

export default StreakCalendar;
