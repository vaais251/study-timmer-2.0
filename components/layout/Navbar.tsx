
import React from 'react';
import { Page } from '../../types';
import { TimerIcon, PlanIcon, StatsIcon, AIIcon, SettingsIcon } from '../common/Icons';

interface NavItemProps {
    label: Page;
    icon: React.ReactNode;
    currentPage: Page;
    setPage: (page: Page) => void;
}

const NavItem: React.FC<NavItemProps> = ({ label, icon, currentPage, setPage }) => {
    const isActive = currentPage === label;
    return (
        <button
            onClick={() => setPage(label)}
            className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-300 ${
                isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'
            }`}
            aria-label={`Navigate to ${label} page`}
        >
            {icon}
            <span className="text-xs capitalize mt-1">{label}</span>
        </button>
    );
};

interface NavbarProps {
    currentPage: Page;
    setPage: (page: Page) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentPage, setPage }) => {
    return (
        <nav className="flex justify-around items-center bg-black/20 rounded-full p-1.5 gap-1.5">
            <NavItem label="timer" icon={<TimerIcon />} currentPage={currentPage} setPage={setPage} />
            <NavItem label="plan" icon={<PlanIcon />} currentPage={currentPage} setPage={setPage} />
            <NavItem label="stats" icon={<StatsIcon />} currentPage={currentPage} setPage={setPage} />
            <NavItem label="ai" icon={<AIIcon />} currentPage={currentPage} setPage={setPage} />
            <NavItem label="settings" icon={<SettingsIcon />} currentPage={currentPage} setPage={setPage} />
        </nav>
    );
};

export default Navbar;
