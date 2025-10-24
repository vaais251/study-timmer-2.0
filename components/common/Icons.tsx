
import React from 'react';

const commonProps = {
    viewBox: "0 0 24 24",
    className: "w-6 h-6 fill-current"
};

const iconWithStrokeProps = {
    ...commonProps,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as "round",
    strokeLinejoin: "round" as "round",
};

export const PlayIcon: React.FC = () => <svg {...commonProps}><path d="M8 5v14l11-7z"/></svg>;
export const PauseIcon: React.FC = () => <svg {...commonProps}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
export const ResetIcon: React.FC = () => <svg {...commonProps}><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>;
export const SettingsIcon: React.FC = () => <svg {...iconWithStrokeProps}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
export const PostponeIcon: React.FC = () => <svg {...commonProps}><path d="M14 5l7 7-7 7V5zM3 5v14h2V5H3z"/></svg>;
export const DuplicateIcon: React.FC = () => <svg {...commonProps}><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>;

// Navbar Icons
export const TimerIcon: React.FC = () => <svg {...iconWithStrokeProps}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
export const PlanIcon: React.FC = () => <svg {...iconWithStrokeProps}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
export const StatsIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M18 20V10M12 20V4M6 20V14"/></svg>;
export const AIIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M12 8V4H8" /><rect x="4" y="12" width="8" height="8" rx="2" /><path d="M20 12h-4" /><path d="M16 6h4" /><path d="M12 12v-2" /><path d="m16 16-1.5-1.5" /><path d="m8 16 1.5-1.5" /></svg>;
