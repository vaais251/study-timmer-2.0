
import React from 'react';
import { AppState } from '../types';
import HistoryPanel from '../components/HistoryPanel';

interface StatsPageProps {
    appState: AppState;
    historyRange: { start: string; end: string };
    setHistoryRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
}

const StatsPage: React.FC<StatsPageProps> = (props) => {
    return (
        <HistoryPanel
            appState={props.appState}
            historyRange={props.historyRange}
            setHistoryRange={props.setHistoryRange}
        />
    );
};

export default StatsPage;
