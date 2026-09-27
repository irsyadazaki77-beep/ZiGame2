import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Gamepad2, Trophy, Target, Award, User } from 'lucide-react';

export interface MobileNavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { path: '/', label: 'Beranda', icon: Gamepad2 },
  { path: '/games', label: 'Game', icon: Trophy },
  { path: '/challenges', label: 'Misi', icon: Target },
  { path: '/leaderboard', label: 'Peringkat', icon: Award },
  { path: '/profile', label: 'Profil', icon: User },
];

export const MobileNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav 
      aria-label="Navigasi Bawah Mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(3.75rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-surface-base/90 backdrop-blur-md border-t border-border-subtle z-50 px-2 flex items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.03)]"
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="relative flex flex-col items-center justify-center flex-1 h-full py-1 cursor-pointer min-w-0 select-none active:scale-95 transition-all"
            aria-label={item.label}
          >
            <div className={`relative flex flex-col items-center justify-center px-2 py-1 rounded-xl transition-all duration-150 ${
              isActive ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-text-muted hover:text-text-primary'
            }`}>
              <Icon className={`w-4 h-4 transition-colors duration-150 shrink-0 ${
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-text-muted'
              }`} />
              <span className={`text-[10px] font-medium tracking-tight mt-0.5 transition-colors duration-150 truncate max-w-full leading-none ${
                isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-text-muted'
              }`}>
                {item.label}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
};
