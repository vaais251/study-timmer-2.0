

import React from 'react';
import { Settings } from '../types';
import SettingsPanel from '../components/SettingsPanel';
import Panel from '../components/common/Panel';

interface SettingsPageProps {
    settings: Settings;
    onSave: (newSettings: Settings) => void;
    canInstall: boolean;
    onInstall: () => void;
    isStandalone: boolean;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSave, canInstall, onInstall, isStandalone }) => {
    return (
        <div className="space-y-6">
            <SettingsPanel 
                settings={settings}
                onSave={onSave}
            />
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
                    <p className="text-white/60 text-center text-sm">
                        This app is installable! Check for an "Install" button in your browser's address bar or settings menu (usually a ⋮ icon) to add it to your desktop.
                    </p>
                )}
            </Panel>
        </div>
    );
};

export default SettingsPage;