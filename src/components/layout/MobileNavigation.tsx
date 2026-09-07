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
      className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-[#090b10]/95 backdrop-blur-xl border-t border-white/[0.06] z-50 px-1 flex items-center justify-around safe-landscape-inset"
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="relative flex flex-col items-center justify-center flex-1 h-full py-1 cursor-pointer min-w-0 select-none active:scale-95 transition-transform"
            aria-label={item.label}
          >
            <div className={`relative flex items-center justify-center transition-all duration-150 ${isActive ? '-translate-y-0.5' : ''}`}>
              <Icon className={`w-4 h-4 transition-colors duration-150 shrink-0 ${
                isActive ? 'text-indigo-400' : 'text-zinc-400'
              }`} />
            </div>
            <span className={`text-[10px] font-medium tracking-tight mt-0.5 transition-colors duration-150 truncate max-w-full px-0.5 leading-none ${
              isActive ? 'text-indigo-300 font-bold' : 'text-zinc-400'
            }`}>
              {item.label}
            </span>
            {isActive && (
              <motion.div 
                layoutId="mobile-nav-indicator"
                className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-400" 
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};
