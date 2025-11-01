import React from 'react';
import { AppNotification } from '../../types';
import { BellIcon, CheckIcon, TrashIcon, FilledStarIcon } from './Icons';

const timeAgo = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
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

    const getIconForType = (type: AppNotification['type']) => {
        switch (type) {
            case 'deadline':
                return <BellIcon />;
            case 'milestone':
                return <FilledStarIcon className="w-6 h-6 text-yellow-400" />;
            default:
                return <BellIcon />;
        }
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
                            {notifications.map(n => (
                                <li key={n.id} className={`p-3 border-b border-slate-700/50 transition-colors ${!n.read ? 'bg-slate-700/30' : ''}`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 flex-shrink-0 ${n.type === 'deadline' ? 'text-amber-400' : 'text-teal-300'}`}>
                                            {getIconForType(n.type)}
                                        </div>
                                        <div className="flex-grow">
                                            <p className="text-sm text-white/90">{n.message}</p>
                                            <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                                        </div>
                                        {!n.read && (
                                            <button onClick={() => onMarkRead(n.id)} className="p-1 text-slate-400 hover:text-white" title="Mark as read">
                                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
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
