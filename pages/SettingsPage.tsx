
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
