import React from 'react';
import { MessageSquare, Trophy, Target, Sparkles, Calendar, CheckCircle2 } from 'lucide-react';
import { GameStats, PlayerProfile, DailyMission } from '../../types';
import { BackgroundAmbient } from './GamePageHeader';
import Shoutbox from '../Shoutbox';
import GlobalLeaderboard from '../GlobalLeaderboard';
import { audio } from '../../utils/audio';

interface GamePageRightSidebarProps {
  activeGame: GameStats;
  profile: PlayerProfile;
  dailyMissions: DailyMission[];
  currentAmbient: BackgroundAmbient;
  activeTab: 'chat' | 'leaderboard' | 'quests';
  setActiveTab: (tab: 'chat' | 'leaderboard' | 'quests') => void;
  mobileTab: 'game' | 'controls' | 'community';
  isTheatreMode: boolean;
  isFullscreen: boolean;
}

export const GamePageRightSidebar: React.FC<GamePageRightSidebarProps> = ({
  activeGame,
  profile,
  dailyMissions,
  currentAmbient,
  activeTab,
  setActiveTab,
  mobileTab,
  isTheatreMode,
  isFullscreen,
}) => {
  if (isTheatreMode || (mobileTab !== 'community' && isFullscreen)) {
    return null;
  }

  const gameSpecificMissions = dailyMissions.filter(m => m.gameId === activeGame.id);

  return (
    <div 
      className={`w-[340px] xl:w-[370px] border-l border-zinc-900 bg-zinc-950/60 backdrop-blur-md flex-none flex flex-col h-full overflow-hidden transition-all duration-300 ${
        mobileTab === 'community' ? 'flex w-full' : 'hidden lg:flex'
      }`}
      id="right-column-social-dashboard"
    >
      <div className="flex flex-col h-full overflow-hidden" id="sidebar-panel-container">
        {/* Sidebar Nav Tabs */}
        <div className="flex-none flex border-b border-white/[0.06] bg-[#0d1017] p-1.5 gap-1 select-none">
          <button
            onClick={() => { audio.playCoin(); setActiveTab('chat'); }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white/[0.08] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <MessageSquare size={13} className={activeTab === 'chat' ? 'text-indigo-400' : 'text-zinc-500'} />
            Obrolan
          </button>

          <button
            onClick={() => { audio.playCoin(); setActiveTab('leaderboard'); }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'bg-white/[0.08] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <Trophy size={13} className={activeTab === 'leaderboard' ? 'text-amber-400' : 'text-zinc-500'} />
            Papan Skor
          </button>

          <button
            onClick={() => { audio.playCoin(); setActiveTab('quests'); }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'quests'
                ? 'bg-white/[0.08] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <Target size={13} className={activeTab === 'quests' ? 'text-emerald-400' : 'text-zinc-500'} />
            Misi
          </button>
        </div>

        {/* Tab Scroll Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col justify-between [&>div]:h-full animate-fade-in" id="shoutbox-chat-tab">
              <Shoutbox 
                playerName={profile.name} 
                playerAvatar={profile.avatar} 
                playerThemeColor={currentAmbient.color} 
              />
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="animate-fade-in space-y-3" id="leaderboard-tab">
              <div className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Peringkat Teratas Saat Ini</div>
              <GlobalLeaderboard game={activeGame} />
              
              <div className="bg-zinc-950/70 border border-zinc-800/80 p-3.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-lg border border-zinc-800">
                    {profile.avatar}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-300">Skor Anda</div>
                    <div className="text-[10px] text-zinc-500 font-mono">Batas personal terbaik</div>
                  </div>
                </div>
                <div className="font-mono text-sm font-black text-yellow-400">
                  {activeGame.highScore.toLocaleString()} pts
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quests' && (
            <div className="space-y-4 animate-fade-in font-sans pb-4" id="missions-tab">
              {gameSpecificMissions.length > 0 && (
                <div className="p-3 bg-zinc-950 border border-indigo-500/20 rounded-xl">
                  <div className="flex items-center gap-1.5 text-indigo-400 mb-1">
                    <Sparkles size={13} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Misi Utama Game Ini</span>
                  </div>
                  <div className="space-y-2.5 mt-2">
                    {gameSpecificMissions.map(m => {
                      const pct = Math.min(100, (m.progress / m.target) * 100);
                      return (
                        <div key={m.id} className="text-xs bg-black/40 border border-zinc-800 p-2.5 rounded-lg">
                          <div className="flex justify-between font-bold text-zinc-300 mb-1">
                            <span className={m.completed ? "line-through text-zinc-500" : ""}>{m.description}</span>
                            <span className="text-amber-400 font-mono">+{m.rewardCoins}🪙</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: m.completed ? '#10b981' : currentAmbient.color }} />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400">{m.progress}/{m.target}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Calendar size={13} className="text-zinc-500" />
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Daftar Misi Harian</h4>
              </div>

              <div className="space-y-2.5">
                {dailyMissions.map((m) => {
                  const pct = Math.min(100, (m.progress / m.target) * 100);
                  const isThisGame = m.gameId === activeGame.id;
                  return (
                    <div 
                      key={m.id} 
                      className={`p-3 rounded-xl border transition-all ${
                        m.completed 
                          ? 'bg-zinc-950/40 border-zinc-800 opacity-50' 
                          : isThisGame
                          ? 'bg-zinc-900 border-indigo-500/30'
                          : 'bg-zinc-950/80 border-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {m.completed ? (
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 shrink-0" />
                          )}
                          <span className={`text-xs font-bold ${m.completed ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
                            {m.description}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-500 font-mono shrink-0 bg-black/40 border border-zinc-800 px-1.5 py-0.5 rounded">
                          +{m.rewardCoins}🪙
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: m.completed ? '#10b981' : currentAmbient.color }} />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">{m.progress}/{m.target}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
