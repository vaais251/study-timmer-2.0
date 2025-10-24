
import React from 'react';
import { Settings } from '../types';
import SettingsPanel from '../components/SettingsPanel';

interface SettingsPageProps {
    settings: Settings;
    onSave: (newSettings: Settings) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = (props) => {
    return (
        <SettingsPanel 
            settings={props.settings}
            onSave={props.onSave}
        />
    );
};

export default SettingsPage;
