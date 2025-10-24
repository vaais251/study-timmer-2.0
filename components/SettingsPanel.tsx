
import React, { useState } from 'react';
import Panel from './common/Panel';
import { Settings } from '../types';

interface SettingsPanelProps {
    settings: Settings;
    onSave: (newSettings: Settings) => void;
}

const SettingInput: React.FC<{ label: string; value: number; onChange: (val: number) => void; unit: string; }> = ({ label, value, onChange, unit }) => (
    <div className="mb-4">
        <label className="block text-white text-sm mb-2">{label}</label>
        <div className="flex items-center gap-4">
            <input
                type="number"
                min="1"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
                className="w-full text-center bg-white/20 border border-white/30 rounded-lg p-3 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/30 focus:border-white/50"
            />
            <span className="text-white/80">{unit}</span>
        </div>
    </div>
);

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSave }) => {
    const [localSettings, setLocalSettings] = useState(settings);

    const handleSave = () => {
        onSave(localSettings);
    };

    return (
        <Panel title="⚙️ Timer Settings">
            <SettingInput
                label="Focus Duration"
                value={localSettings.focusDuration}
                onChange={(val) => setLocalSettings(s => ({ ...s, focusDuration: val }))}
                unit="minutes"
            />
            <SettingInput
                label="Break Duration"
                value={localSettings.breakDuration}
                onChange={(val) => setLocalSettings(s => ({ ...s, breakDuration: val }))}
                unit="minutes"
            />
            <SettingInput
                label="Sessions per Cycle"
                value={localSettings.sessionsPerCycle}
                onChange={(val) => setLocalSettings(s => ({ ...s, sessionsPerCycle: val }))}
                unit="sessions"
            />
            <button
                onClick={handleSave}
                className="w-full mt-4 p-3 bg-gradient-to-br from-cyan-400 to-blue-600 text-white font-bold rounded-lg transition hover:scale-105"
            >
                💾 Save Settings
            </button>
        </Panel>
    );
};

export default SettingsPanel;
