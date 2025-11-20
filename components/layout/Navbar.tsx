
import React from 'react';
import { Page } from '../../types';
import { TimerIcon, PlanIcon, StatsIcon, AIIcon, SettingsIcon, LogoutIcon, TargetIcon, CircleIcon, PlanIconFilled, StatsIconFilled, AIIconFilled, BellIcon } from '../common/Icons';

interface NavItemProps {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    notificationCount?: number;
}

const NavItem: React.FC<NavItemProps> = ({ label, icon, isActive, onClick, notificationCount = 0 }) => {
    return (
        <button
            onClick={onClick}
            className={`group relative flex items-center justify-center lg:justify-start gap-3 w-full px-3 py-3 rounded-2xl transition-all duration-300
                ${isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)] border border-cyan-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                }`}
            aria-label={label}
        >
            <div className="relative transition-transform duration-300 group-hover:scale-110">
                {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { 
                    className: `w-5 h-5 ${isActive ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' : 'fill-current'}` 
                })}
                {notificationCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-sm ring-2 ring-[#030712]">
                        {notificationCount}
                    </span>
                )}
            </div>
            <span className={`hidden lg:inline text-sm font-medium tracking-wide ${isActive ? 'text-cyan-100' : ''}`}>{label}</span>
        </button>
    );
};

interface NavbarProps {
    currentPage: Page;
    setPage: (page: Page) => void;
    onLogout: () => void;
    unreadNotificationCount: number;
    onToggleNotifications: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentPage, setPage, onLogout, unreadNotificationCount, onToggleNotifications }) => {
    const navItems = [
        { page: 'timer' as Page, icon: <TimerIcon />, label: 'Timer' },
        { page: 'plan' as Page, icon: <PlanIcon />, label: 'Plan' },
        { page: 'goals' as Page, icon: <TargetIcon />, label: 'Goals' },
        { page: 'stats' as Page, icon: <StatsIcon />, label: 'Stats' },
        { page: 'ai' as Page, icon: <AIIcon />, label: 'AI Coach' },
    ];

    return (
        <>
            {/* Mobile Floating Dock */}
            <nav className="md:hidden fixed bottom-6 left-4 right-4 h-16 glass-panel rounded-full flex justify-around items-center z-50 shadow-2xl shadow-black/50 px-2">
                {navItems.map(item => {
                    const isActive = currentPage === item.page;
                    return (
                        <button
                            key={item.page}
                            onClick={() => setPage(item.page)}
                            className={`relative p-3 rounded-full transition-all duration-300 flex items-center justify-center ${isActive ? '-translate-y-2' : ''}`}
                            aria-label={item.label}
                        >
                            <div className={`transition-all duration-300 ${isActive ? 'text-cyan-400 scale-125 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-slate-400'}`}>
                                {item.icon}
                            </div>
                            {isActive && (
                                <span className="absolute -bottom-3 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_5px_#22d3ee]"></span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Desktop Floating Pillar */}
            <nav className="hidden md:flex flex-col justify-between fixed top-4 bottom-4 left-4 w-20 lg:w-64 glass-panel rounded-3xl p-4 z-40 transition-all duration-300">
                <div>
                    <div className="flex items-center gap-3 mb-10 px-2 mt-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 shadow-lg flex items-center justify-center text-white font-bold text-xl">
                            F
                        </div>
                        <h1 className="hidden lg:block text-xl font-bold text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">FocusFlow</h1>
                    </div>
                    <div className="space-y-2">
                         {navItems.map(item => (
                            <NavItem key={item.page} label={item.label} icon={item.icon} isActive={currentPage === item.page} onClick={() => setPage(item.page)} />
                         ))}
                    </div>
                </div>
                 <div className="space-y-2 pt-4 border-t border-white/5">
                    <NavItem label="Updates" icon={<BellIcon />} isActive={false} onClick={onToggleNotifications} notificationCount={unreadNotificationCount} />
                    <NavItem label="Settings" icon={<SettingsIcon />} isActive={currentPage === 'settings'} onClick={() => setPage('settings')} />
                    <button 
                        onClick={onLogout}
                        className="group flex items-center justify-center lg:justify-start gap-3 w-full px-3 py-3 rounded-2xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 mt-2"
                    >
                         <div className="relative">
                            <LogoutIcon />
                        </div>
                        <span className="hidden lg:inline text-sm font-medium">Logout</span>
                    </button>
                </div>
            </nav>
        </>
    );
};

export default Navbar;
