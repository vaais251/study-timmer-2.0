import React from 'react';
import { Page } from '../../types';
import { TimerIcon, PlanIcon, StatsIcon, AIIcon, SettingsIcon, LogoutIcon, TargetIcon } from '../common/Icons';

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
            className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-300 ${
                isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'
            }`}
            aria-label={label}
        >
            {icon}
            <span className="text-xs capitalize mt-1 hidden sm:inline">{label}</span>
        </button>
    );
};

interface NavbarProps {
    currentPage: Page;
    setPage: (page: Page) => void;
    onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentPage, setPage, onLogout }) => {
    return (
        <nav className="flex justify-around items-center bg-black/20 rounded-full p-1.5 gap-1">
            <NavItem label="timer" icon={<TimerIcon />} isActive={currentPage === 'timer'} onClick={() => setPage('timer')} />
            <NavItem label="plan" icon={<PlanIcon />} isActive={currentPage === 'plan'} onClick={() => setPage('plan')} />
            <NavItem label="goals" icon={<TargetIcon />} isActive={currentPage === 'goals'} onClick={() => setPage('goals')} />
            <NavItem label="stats" icon={<StatsIcon />} isActive={currentPage === 'stats'} onClick={() => setPage('stats')} />
            <NavItem label="ai" icon={<AIIcon />} isActive={currentPage === 'ai'} onClick={() => setPage('ai')} />
            <NavItem label="settings" icon={<SettingsIcon />} isActive={currentPage === 'settings'} onClick={() => setPage('settings')} />
            <NavItem label="logout" icon={<LogoutIcon />} isActive={false} onClick={onLogout} />
        </nav>
    );
};

export default Navbar;