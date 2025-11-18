import React, { useState } from 'react';
import { Settings } from '../types';
import SettingsPanel from '../components/SettingsPanel';
import Panel from '../components/common/Panel';
import ExplanationTooltip from '../components/common/ExplanationTooltip';


interface SettingsPageProps {
    settings: Settings;
    onSave: (newSettings: Settings) => void;
    canInstall: boolean;
    onInstall: () => void;
    isStandalone: boolean;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSave, canInstall, onInstall, isStandalone }) => {
    const [localDailyTarget, setLocalDailyTarget] = useState(settings.dailyFocusTarget);
    const [localDayTargets, setLocalDayTargets] = useState(settings.dailyFocusTargetsByDay || {});

    const handleSaveDailyLimits = () => {
        onSave({
            ...settings,
            dailyFocusTarget: localDailyTarget,
            dailyFocusTargetsByDay: localDayTargets,
        });
    };
    
    const handleDayTargetChange = (dayIndex: number, value: string) => {
        const newDayTargets = { ...localDayTargets };
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue > 0) {
            newDayTargets[dayIndex] = numValue;
        } else {
            delete newDayTargets[dayIndex];
        }
        setLocalDayTargets(newDayTargets);
    };

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
        <div className="space-y-6">
            <SettingsPanel 
                settings={settings}
                onSave={onSave}
            />
            
            <Panel title="🎯 Daily Focus Limits">
                <div className="mb-4">
                    <label className="block text-white text-sm mb-2 flex items-center gap-1.5">
                        Default Daily Focus Limit (minutes)
                        <ExplanationTooltip title="Daily Focus Limit" content="Set a target for your total focus time per day. If you try to add a task that exceeds this limit for today or tomorrow, you'll get a warning. Set to 0 or leave empty for no limit." />
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={localDailyTarget || ''}
                        onChange={(e) => setLocalDailyTarget(e.target.value ? parseInt(e.target.value, 10) : null)}
                        placeholder="e.g., 240 for 4 hours"
                        className="w-full text-center bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
                    />
                </div>

                <div className="pt-4 border-t border-white/20">
                    <h4 className="text-md font-semibold text-white mb-3 text-center">Day-Specific Limits (Overrides Default)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {daysOfWeek.map((day, index) => (
                            <div key={index}>
                                <label className="block text-white/80 text-xs mb-1 text-center">{day}</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={localDayTargets?.[index] || ''}
                                    onChange={(e) => handleDayTargetChange(index, e.target.value)}
                                    placeholder="None"
                                    className="w-full text-center bg-white/10 border border-white/20 rounded-lg p-2 text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 focus:border-white/40"
                                />
                            </div>
                        ))}
                    </div>
                </div>
                 <button
                    onClick={handleSaveDailyLimits}
                    className="w-full mt-6 p-3 bg-gradient-to-br from-cyan-400 to-blue-600 text-white font-bold rounded-lg transition hover:scale-105"
                >
                    💾 Save Daily Limits
                </button>
                 <details className="mt-6 bg-black/20 p-3 rounded-lg text-xs">
                    <summary className="cursor-pointer font-semibold text-slate-400">Database Schema (for developers)</summary>
                    <div className="mt-2 p-3 bg-slate-900 rounded-md">
                        <p className="text-slate-300 mb-2">The following SQL commands for PostgreSQL are needed to enable this feature. Supabase uses PostgreSQL, not MySQL.</p>
                        <pre className="text-cyan-300 whitespace-pre-wrap text-[11px] leading-relaxed"><code>
                            {`-- Add columns to settings table for daily focus limits
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS daily_focus_target INTEGER,
ADD COLUMN IF NOT EXISTS daily_focus_targets_by_day JSONB;

-- Example of what the JSONB could look like for a user:
-- {"0": 240, "1": 180, "6": 120}
-- (Sunday: 240 mins, Monday: 180 mins, Saturday: 120 mins)
`}
                        </code></pre>
                    </div>
                </details>
            </Panel>

            <Panel title="📲 App Installation">
                {isStandalone ? (
                     <p className="text-green-400 text-center text-sm font-semibold">
                        ✅ This app is already installed and running in standalone mode.
                    </p>
                ) : canInstall ? (
                    <>
                        <p className="text-white/80 text-center text-sm mb-4">
                            Install FocusFlow as a desktop app for a more integrated experience, just like you can with YouTube.
                        </p>
                        <button
                            onClick={onInstall}
                            className="w-full mt-2 p-3 bg-gradient-to-br from-teal-500 to-cyan-600 text-white font-bold rounded-lg transition hover:scale-105"
                        >
                            Install App
                        </button>
                    </>
                ) : (
                    <div className="text-white/80 text-sm space-y-4 text-left">
                        <p className="text-center font-semibold text-white">This app is installable on your browser!</p>
                        <p className="text-center text-white/70">
                            Since the address bar icon isn't showing, please follow these steps to install manually:
                        </p>
                        <ol className="list-decimal list-inside bg-black/20 p-4 rounded-lg space-y-2">
                            <li>Click the <span className="font-bold text-white">"More" icon (⋮)</span> in the top-right corner of Chrome.</li>
                            <li>In the menu that appears, look for an option that says <span className="font-bold text-white">'Install FocusFlow...'</span>.</li>
                            <li>Click it and follow the on-screen instructions to finish installation.</li>
                        </ol>
                        <p className="text-xs text-white/60 text-center pt-2">
                            If you can't find the install option, it might mean the app is already installed or there's an issue with your browser settings.
                        </p>
                    </div>
                )}
            </Panel>
        </div>
    );
};

export default SettingsPage;