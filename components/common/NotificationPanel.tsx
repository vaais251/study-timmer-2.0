import React from 'react';
import { AppNotification } from '../../types';
import { BellIcon, CheckIcon, TrashIcon, FilledStarIcon, ExclamationTriangleIcon } from './Icons';

// FIX: Define `minutes`, `hours`, and `days` before they are used to calculate relative time.
const timeAgo = (isoString: string): string => {
    if (!isoString) {
        return 'just now';
    }
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
        console.warn('Invalid date string passed to timeAgo:', isoString);
        return 'a while ago';
    }
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 0) {
        return 'in the future';
    }
    
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
};

interface NotificationPanelProps {
    notifications: AppNotification[];
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onClearAll: () => void;
    onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ notifications, onMarkRead, onMarkAllRead, onClearAll, onClose }) => {
    const unreadCount = notifications.filter(n => !n.read).length;

    const typeStyles: { [key in AppNotification['type']]: { icon: React.ReactNode; iconClass: string; borderClass: string } } = {
        milestone: {
            icon: <FilledStarIcon className="w-6 h-6" />,
            iconClass: 'text-green-400',
            borderClass: 'border-l-green-400',
        },
        deadline: {
            icon: <BellIcon />,
            iconClass: 'text-amber-400',
            borderClass: 'border-l-amber-400',
        },
        alert: {
            icon: <ExclamationTriangleIcon />,
            iconClass: 'text-red-500',
            borderClass: 'border-l-red-500',
        },
    };

    return (
        <div 
            className="fixed inset-0 bg-transparent z-40"
            onClick={onClose}
        >
            <div 
                className="fixed top-4 right-4 sm:top-16 sm:right-8 w-80 max-w-[90vw] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 animate-scaleIn flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-3 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
                    <h3 className="font-bold text-white">Notifications</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="overflow-y-auto flex-grow">
                    {notifications.length > 0 ? (
                        <ul>
                            {notifications.map(n => {
                                const styles = typeStyles[n.type] || typeStyles.deadline;
                                return (
                                    <li key={n.id} className={`p-3 border-b border-slate-700/50 border-l-4 ${!n.read ? 'bg-slate-700/30' : ''} ${styles.borderClass}`}>
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 flex-shrink-0 ${styles.iconClass}`}>
                                                {styles.icon}
                                            </div>
                                            <div className="flex-grow">
                                                <p className="text-sm text-white/90">{n.message}</p>
                                                <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                                            </div>
                                            {!n.read && (
                                                <button onClick={() => onMarkRead(n.id)} className="p-1 text-slate-400 hover:text-white" title="Mark as read">
                                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="p-6 text-center text-slate-400">No notifications yet.</p>
                    )}
                </div>

                {notifications.length > 0 && (
                    <div className="p-2 bg-slate-900/50 flex justify-between text-xs font-semibold flex-shrink-0">
                        <button onClick={onMarkAllRead} disabled={unreadCount === 0} className="text-cyan-300 hover:text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                            <CheckIcon /> Mark all as read
                        </button>
                        <button onClick={onClearAll} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                            <TrashIcon /> Clear all
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationPanel;