import React from 'react';

const baseIconProps = {
    viewBox: "0 0 24 24",
    className: "w-6 h-6"
};

const commonProps = {
    ...baseIconProps,
    className: `${baseIconProps.className} fill-current`
};

const iconWithStrokeProps = {
    ...baseIconProps,
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
export const MoreVerticalIcon: React.FC = () => <svg {...iconWithStrokeProps}><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>;
export const TrashIcon: React.FC = () => <svg {...iconWithStrokeProps}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
export const UndoIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>;
export const EditIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
export const StarIcon: React.FC = () => <svg {...iconWithStrokeProps}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>;
export const FilledStarIcon: React.FC<{ className?: string }> = ({ className }) => <svg {...commonProps} className={className}><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>;
export const LockIcon: React.FC = () => <svg {...iconWithStrokeProps}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
export const CheckIcon: React.FC = () => <svg {...iconWithStrokeProps}><polyline points="20 6 9 17 4 12"></polyline></svg>;
export const BringForwardIcon: React.FC = () => <svg {...commonProps}><path d="M10 19l-7-7 7-7v14zM21 19V5h-2v14h2z"/></svg>;
export const CalendarIcon: React.FC = () => <svg {...iconWithStrokeProps}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
export const RescheduleIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>;
export const SearchIcon: React.FC = () => <svg {...iconWithStrokeProps}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
export const QuestionMarkCircleIcon: React.FC = () => <svg {...iconWithStrokeProps}><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>;
export const BellIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>;


// Navbar Icons
export const TimerIcon: React.FC = () => <svg {...iconWithStrokeProps}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
export const PlanIcon: React.FC = () => <svg {...iconWithStrokeProps}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
export const StatsIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M18 20V10M12 20V4M6 20V14"/></svg>;
export const AIIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M12 8V4H8" /><rect x="4" y="12" width="8" height="8" rx="2" /><path d="M20 12h-4" /><path d="M16 6h4" /><path d="M12 12v-2" /><path d="m16 16-1.5-1.5" /><path d="m8 16 1.5-1.5" /></svg>;
export const TargetIcon: React.FC = () => <svg {...iconWithStrokeProps}><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>;
export const LogoutIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>;

// New Filled Icons for Navbar
export const CircleIcon: React.FC = () => <svg {...commonProps}><circle cx="12" cy="12" r="10" /></svg>;
export const PlanIconFilled: React.FC = () => <svg {...commonProps}><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>;
export const StatsIconFilled: React.FC = () => <svg {...commonProps}><path d="M10 20h4V4h-4v16zm-6 0h4v-8H4v8zM16 9v11h4V9h-4z"/></svg>;
export const AIIconFilled: React.FC = () => <svg {...commonProps}><path d="M20,11.5C20,12.33 19.33,13 18.5,13H17.22C16.89,14.16 16.2,15.17 15.25,15.89L16.2,17.84L15.3,18.3L14.35,16.35C13.56,16.76 12.72,17 11.83,17H11.75C11.5,17 11.25,17 11,17C7.69,17 5,14.31 5,11V6C5,3.79 6.79,2 9,2H15C17.21,2 19,3.79 19,6V11.5H20M17,11.5V6C17,4.9 16.1,4 15,4H9C7.9,4 7,4.9 7,6V11C7,13.21 8.79,15 11,15C11.19,15 11.37,15 11.55,14.95L11,16.29L11.95,16.7L12.5,15.41C13.62,14.65 14.43,13.43 14.8,12H15.5C16.33,12 17,11.33 17,10.5V9.5H19V11.5Z" /></svg>;

// AI Coach Icons
export const BrainIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v0A2.5 2.5 0 0 1 9.5 7h-3A2.5 2.5 0 0 1 4 4.5v0A2.5 2.5 0 0 1 6.5 2m3 0V1"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v0A2.5 2.5 0 0 0 14.5 7h3A2.5 2.5 0 0 0 20 4.5v0A2.5 2.5 0 0 0 17.5 2m-3 0V1"/><path d="M6 10a2.5 2.5 0 0 1-2.5 2.5v0A2.5 2.5 0 0 1 6 15"/><path d="M18 10a2.5 2.5 0 0 0 2.5 2.5v0A2.5 2.5 0 0 0 18 15"/><path d="M9.5 8.5A2.5 2.5 0 0 1 12 11v0a2.5 2.5 0 0 1-2.5 2.5"/><path d="M14.5 8.5A2.5 2.5 0 0 0 12 11v0a2.5 2.5 0 0 0 2.5 2.5"/><path d="M12 15V9"/><path d="M6.5 17A2.5 2.5 0 0 1 9 19.5v0a2.5 2.5 0 0 1-2.5 2.5"/><path d="M17.5 17A2.5 2.5 0 0 0 15 19.5v0a2.5 2.5 0 0 0 2.5 2.5"/><path d="M12 22v-2.5"/></svg>;
export const UserIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
export const SparklesIcon: React.FC = () => <svg {...iconWithStrokeProps}><path d="M12 3L9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5z"/></svg>;
export const SendIcon: React.FC = () => <svg {...commonProps}><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>;