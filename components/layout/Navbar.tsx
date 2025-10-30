
import React from 'react';
import { Page } from '../../types';
import { TimerIcon, PlanIcon, StatsIcon, AIIcon, SettingsIcon, LogoutIcon, TargetIcon, CircleIcon, PlanIconFilled, StatsIconFilled, AIIconFilled } from '../common/Icons';

interface NavItemProps {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ label, icon, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`group relative flex items-center justify-center lg:justify-start gap-3 w-full px-4 py-3 rounded-lg transition-colors duration-200
                ${isActive
                    ? 'bg-slate-700/50 text-white shadow-inner'
                    : 'text-slate-400 hover:bg-slate-700/30 hover:text-white'
                }`}
            aria-label={label}
        >
            {icon}
            <span className="hidden lg:inline text-sm font-medium capitalize">{label}</span>
            {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-teal-400 rounded-r-full hidden md:block animate-slideInFromLeft"></div>}
            
            {/* Tooltip for md only */}
            <div className="absolute left-full ml-4 hidden md:group-hover:block lg:hidden bg-slate-800 text-white text-xs font-bold p-2 rounded-md shadow-lg z-20 whitespace-nowrap">
                {label.charAt(0).toUpperCase() + label.slice(1)}
            </div>
        </button>
    );
};

interface NavbarProps {
    currentPage: Page;
    setPage: (page: Page) => void;
    onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentPage, setPage, onLogout }) => {
    const navItems = [
        { page: 'timer' as Page, icon: <TimerIcon />, iconInactive: <CircleIcon />, label: 'Timer' },
        { page: 'plan' as Page, icon: <PlanIcon />, iconInactive: <PlanIconFilled />, label: 'Plan' },
        { page: 'goals' as Page, icon: <TargetIcon />, iconInactive: <CircleIcon />, label: 'Goals' },
        { page: 'stats' as Page, icon: <StatsIcon />, iconInactive: <StatsIconFilled />, label: 'Stats' },
        { page: 'ai' as Page, icon: <AIIcon />, iconInactive: <AIIconFilled />, label: 'AI Coach' },
    ];

    return (
        <>
            {/* Bottom Bar for Mobile */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur-lg border-t border-slate-700/80 flex justify-around items-center z-40">
                {navItems.map(item => {
                    const isActive = currentPage === item.page;
                    return (
                        <button
                            key={item.page}
                            onClick={() => setPage(item.page)}
                            className={`flex flex-col items-center justify-center transition-colors p-2 rounded-md ${isActive ? 'text-teal-400' : 'text-slate-400'}`}
                            aria-label={item.label}
                        >
                            {isActive ? item.icon : item.iconInactive}
                            <span className={`text-[10px] mt-0.5 ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Sidebar for Desktop */}
            <nav className="hidden md:flex flex-col justify-between fixed top-0 left-0 h-screen w-20 lg:w-56 bg-slate-900/80 backdrop-blur-lg border-r border-slate-700/80 p-4 z-40 transition-all duration-300">
                <div>
                    <div className="flex items-center gap-3 mb-8 justify-center lg:justify-start">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex-shrink-0"></div>
                        <h1 className="hidden lg:block text-xl font-bold text-white">FocusFlow</h1>
                    </div>
                    <div className="space-y-2">
                         {navItems.map(item => (
                            <NavItem key={item.page} label={item.label} icon={item.icon} isActive={currentPage === item.page} onClick={() => setPage(item.page)} />
                         ))}
                    </div>
                </div>
                 <div className="space-y-2">
                    <NavItem label="Settings" icon={<SettingsIcon />} isActive={currentPage === 'settings'} onClick={() => setPage('settings')} />
                    <NavItem label="Logout" icon={<LogoutIcon />} isActive={false} onClick={onLogout} />
                </div>
            </nav>
        </>
    );
};

export default Navbar;
