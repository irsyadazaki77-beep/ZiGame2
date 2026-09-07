import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Gamepad2, Trophy, Target, Award, User, Store, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGameContext } from '../../contexts/GameContext';
import { APP_VERSION } from '../../config/version';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Beranda', icon: Gamepad2 },
  { path: '/games', label: 'Eksplorasi', icon: Trophy },
  { path: '/challenges', label: 'Tantangan', icon: Target },
  { path: '/leaderboard', label: 'Peringkat', icon: Award },
  { path: '/shop', label: 'Toko', icon: Store },
  { path: '/profile', label: 'Profil', icon: User },
];

export interface DesktopSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ 
  collapsed = false, 
  onToggleCollapse 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useGameContext();

  return (
    <aside 
      className={`hidden md:flex flex-col h-screen fixed left-0 top-0 bg-[#090b10]/95 backdrop-blur-xl border-r border-white/[0.06] z-50 transition-all duration-200 ease-in-out ${
        collapsed ? 'w-[72px]' : 'w-[208px]'
      }`}
      aria-label="Sidebar Navigasi"
    >
      <div className="p-3 flex flex-col h-full">
        {/* Logo & Collapse Toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} mb-6 px-1`}>
          <div 
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            title="ZiGame Home"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/25 ring-1 ring-white/10 shrink-0 group-hover:scale-105 transition-transform">
              <Gamepad2 className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="font-display font-black tracking-wider text-sm text-white leading-none">
                  ZIGAME
                </div>
                <span className="text-[8px] font-mono text-zinc-400 tracking-wider uppercase block mt-0.5">
                  ARCADE v2
                </span>
              </div>
            )}
          </div>

          {onToggleCollapse && !collapsed && (
            <button
              onClick={onToggleCollapse}
              className="w-6 h-6 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Kecilkan Sidebar ([)"
              aria-label="Kecilkan Sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <div className="space-y-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl text-xs font-semibold tracking-normal transition-all duration-150 cursor-pointer group relative ${
                  isActive 
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20' 
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}

                {/* Floating Tooltip in Collapsed Mode */}
                {collapsed && (
                  <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-[#181c2b] text-white text-xs rounded-lg shadow-xl border border-white/[0.08] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Expand Button for Collapsed Mode */}
        {onToggleCollapse && collapsed && (
          <div className="my-2 flex justify-center">
            <button
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Perluas Sidebar ([)"
              aria-label="Perluas Sidebar"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* User Level Card & Quick Access Footer */}
        <div className="mt-auto pt-3 space-y-2.5">
          {/* Level Progress Widget */}
          <div 
            onClick={() => navigate('/profile')}
            className={`bg-[#121622] hover:bg-[#161c2c] border border-white/[0.06] rounded-xl transition-colors cursor-pointer group ${
              collapsed ? 'p-2 flex flex-col items-center' : 'p-2.5'
            }`}
            title={`Level ${profile.level || 1} • ${profile.xp || 0} XP`}
          >
            {collapsed ? (
              <div className="text-center">
                <span className="text-[10px] font-mono font-bold text-indigo-400 block">
                  L{profile.level || 1}
                </span>
                <div className="w-8 h-1 bg-black/40 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${Math.min(100, (((profile.xp || 0) % 100) / 100) * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-zinc-300 group-hover:text-white">
                    LVL {profile.level || 1}
                  </span>
                  <span className="text-[9px] font-mono text-indigo-400 font-semibold">
                    {profile.xp || 0} XP
                  </span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (((profile.xp || 0) % 100) / 100) * 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Version & Security Tag */}
          {!collapsed ? (
            <div className="flex items-center justify-between px-1 text-[9px] font-mono text-zinc-400">
              <span className="flex items-center gap-1">
                <Shield size={10} className="text-emerald-500 shrink-0" />
                Anti-Cheat
              </span>
              <span>v{APP_VERSION}</span>
            </div>
          ) : (
            <div className="flex justify-center text-zinc-400" title={`Anti-Cheat v2 • v${APP_VERSION}`}>
              <Shield size={12} className="text-emerald-500" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
