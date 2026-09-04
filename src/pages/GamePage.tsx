import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameStats, PlayerProfile, DailyMission } from '../types';

import { GAME_LAYOUTS, DEFAULT_GAME_LAYOUT } from '../config/gameLayouts';
import { GAME_REGISTRY } from '../config/gameRegistry';
import { audio } from '../utils/audio';

import { GamePageHeader } from '../components/gamepage/GamePageHeader';
import { GamePageRightSidebar } from '../components/gamepage/GamePageRightSidebar';
import { BossModeSpreadsheet } from '../components/gamepage/BossModeSpreadsheet';
import { MobileTouchControls } from '../components/gamepage/MobileTouchControls';
import { GamePageMobileNav } from '../components/gamepage/GamePageMobileNav';
import { GameErrorBoundary } from '../components/gameplay/GameErrorBoundary';
import { GameTutorialModal } from '../components/gamepage/GameTutorialModal';
import { GameNavigationDrawer } from '../components/gamepage/GameNavigationDrawer';
import { RefreshCw, Sparkles, Trophy, HelpCircle, Navigation, X } from "lucide-react";

interface GamePageProps {
  games: GameStats[];
  profile: PlayerProfile;
  dailyMissions: DailyMission[];
  onScoreUpdate: (gameId: string, score: number) => void;
  onGameOver: (gameId: string, score: number) => void;
}

export type GameControlType = 'directional' | 'directional-action' | 'tap' | 'action' | 'keyboard' | 'none';

const GAME_CONTROLS_MAP: Record<string, { keys: string[]; mouse?: string; tips: string; controlType: GameControlType }> = {
  snake: { keys: ['⬆️', '⬇️', '⬅️', '➡️'], tips: 'Kendalikan ular siber di arena grid siber. Kumpulkan siber-kapsul neon tanpa menabrak ekor Anda sendiri atau batas grid luar.', controlType: 'directional' },
  brick: { keys: ['⬅️', '➡️'], mouse: 'Gerakan Mouse', tips: 'Pantulkan bola plasma untuk menghancurkan barisan balok pertahanan grid siber.', controlType: 'directional' },
  flappy: { keys: ['SPASI'], mouse: 'Klik Kiri', tips: 'Jaga ketinggian sayap piksel agar tidak menabrak tiang-tiang gerbang neon.', controlType: 'action' },
  space: { keys: ['⬅️', '➡️', 'SPASI'], tips: 'Hancurkan gelombang armada alien penyerang luar angkasa sebelum menabrak baris bawah!', controlType: 'directional-action' },
  memory: { keys: [], mouse: 'Klik Kotak Grid', tips: 'Ingat pola kotak-kotak biru yang menyala, lalu klik ulang sesuai urutan yang tepat.', controlType: 'tap' },
  runner: { keys: ['SPASI'], mouse: 'Klik Kiri', tips: 'Lompati rintangan laser siber berkecepatan tinggi demi bertahan sedalam mungkin.', controlType: 'action' },
  pong: { keys: ['⬆️', '⬇️'], mouse: 'Gerakkan Mouse', tips: 'Pantulkan bola neon melewati pertahanan musuh AI berkecepatan dinamis.', controlType: 'directional' },
  stacker: { keys: ['SPASI'], mouse: 'Klik Layar', tips: 'Tumpuk lapisan balok siber tepat di atas balok sebelumnya untuk menyusun menara neon!', controlType: 'action' },
  racer: { keys: ['⬅️', '➡️'], tips: 'Hindari rintangan mobil siber lain di lintasan Synthwave Miami retro.', controlType: 'directional' },
  lockbreaker: { keys: [], mouse: 'Klik Kiri saat Pas', tips: 'Tekan tombol kunci tepat saat jarum pemutar berada di zona target hijau neon!', controlType: 'tap' },
  sinerider: { keys: ['⬆️', '⬇️'], tips: 'Sesuaikan frekuensi gelombang sinus agar cocok dengan target rintangan garis siber.', controlType: 'directional' },
  cosmicdodge: { keys: ['⬆️', '⬇️', '⬅️', '➡️'], mouse: 'Klik/Sentuh Layar', tips: 'Hindari meteor dan rintangan asteroid kosmis yang bertebaran di luar angkasa.', controlType: 'directional' },
  lasergrid: { keys: ['⬆️', '⬇️', '⬅️', '➡️'], tips: 'Pindahkan detektor siber untuk menghindari tembakan laser merah yang menyilang.', controlType: 'directional' },
  simon: { keys: [], mouse: 'Klik Tombol Warna', tips: 'Ulangi urutan melodi warna audio siber yang menyala sesuai contoh aslinya.', controlType: 'tap' },
  plinko: { keys: [], mouse: 'Klik Jalur Atas', tips: 'Jatuhkan bola koin ke dalam paku siber Plinko untuk mendarat di keranjang skor tinggi!', controlType: 'tap' },
  asteroid: { keys: ['⬅️', '➡️', '⬆️', 'SPASI'], tips: 'Hancurkan meteor batu raksasa sebelum menabrak tameng kapal pelindung siber Anda.', controlType: 'directional-action' },
  slasher: { keys: [], mouse: 'Sapu / Klik Cepat', tips: 'Tebas buah-buah piksel neon yang melayang menggunakan pedang laser siber Anda!', controlType: 'tap' },
  clicker: { keys: [], mouse: 'Klik Cepat Core', tips: 'Klik quantum core di tengah layar secepat mungkin untuk mengumpulkan energi, dan beli upgrade peningkatan CPS otomatis.', controlType: 'tap' },
  blockmatch: { keys: [], mouse: 'Klik Kelompok Warna', tips: 'Ketuk kelompok balok berwarna sama yang saling terhubung (minimal 2 balok) untuk meledakkannya demi poin combo.', controlType: 'tap' },
  typer: { keys: ['A-Z Keyboard'], tips: 'Ketik kata-kata neon yang meluncur turun secepatnya sebelum mereka menembus barisan firewall pertahanan bawah!', controlType: 'keyboard' },
  maze: { keys: ['⬆️', '⬇️', '⬅️', '➡️'], tips: 'Arahkan node siber Anda melewati labirin berkelok menuju portal keluar ungu neon untuk lolos ke level selanjutnya.', controlType: 'directional' },
  matrixmemory: { keys: [], mouse: 'Klik Ulang Sel', tips: 'Hafalkan posisi kotak biru yang menyala sekejap, lalu klik kembali sel-sel tersebut secara presisi.', controlType: 'tap' },
  rhythm: { keys: ['D', 'F', 'J', 'K'], tips: 'Ketuk tombol D, F, J, K tepat saat lingkaran not musik siber sejajar dengan baris target bagian bawah.', controlType: 'keyboard' },
  puttgolf: { keys: [], mouse: 'Tarik & Lepas Bola (Slingshot)', tips: 'Tarik bola hijau neon untuk mengatur kekuatan dan sudut tembakan, lalu lepas untuk memasukkannya ke lubang hitam siber.', controlType: 'tap' },
  dinorun: { keys: ['SPASI', '⬇️'], tips: 'Melompati rintangan laser bawah dan merunduk di bawah rintangan drone terbang untuk bertahan hidup selama mungkin.', controlType: 'directional-action' },
  tetris: { keys: ['⬅️', '➡️', '⬆️', '⬇️'], tips: 'Susun balok neon yang jatuh untuk melengkapi baris horizontal penuh. Setiap baris lengkap akan hancur dan menambah skor.', controlType: 'directional' },
  archery: { keys: [], mouse: 'Goyang Arah / Klik Tembak', tips: 'Arahkan meriam laser siber di bawah, lalu klik layar untuk meluncurkan panah laser penghancur balon gelembung udara.', controlType: 'tap' },
  mines: { keys: [], mouse: 'Klik Kiri Buka / Klik Kanan Bendera', tips: 'Buka semua kotak yang aman. Gunakan angka untuk mengetahui jumlah ranjau di sekitarnya. Jangan sampai meledak!', controlType: 'tap' },
  "2048": { keys: ['⬆️', '⬇️', '⬅️', '➡️'], tips: 'Gabungkan balok angka yang sama untuk membentuk angka yang lebih besar hingga 2048.', controlType: 'directional' },
  whack: { keys: [], mouse: 'Klik Target', tips: 'Pukul drone secepat mungkin. Hindari bom dan incar drone emas untuk skor maksimal.', controlType: 'tap' },
  jumprope: { keys: ['SPASI'], mouse: 'Klik/Sentuh Layar', tips: 'Lompati tali laser siber dengan tepat waktu.', controlType: 'action' },
  neondrift: { keys: ['⬅️', '➡️'], mouse: 'Sentuh Kiri/Kanan Layar', tips: 'Hindari blok neon yang berjatuhan. Bertahan selama mungkin!', controlType: 'directional' }
};

const BACKGROUND_AMBIENTS = [
  { id: 'indigo', name: 'Cosmic Indigo', class: 'from-indigo-950/40 via-zinc-950 to-zinc-950', color: '#6366f1' },
  { id: 'rose', name: 'Cyber Ruby', class: 'from-rose-950/40 via-zinc-950 to-zinc-950', color: '#f43f5e' },
  { id: 'emerald', name: 'Matrix Green', class: 'from-emerald-950/40 via-zinc-950 to-zinc-950', color: '#10b981' },
  { id: 'amber', name: 'Solar Gold', class: 'from-amber-950/30 via-zinc-950 to-zinc-950', color: '#f59e0b' },
  { id: 'cyan', name: 'Vapor Blue', class: 'from-cyan-950/40 via-zinc-950 to-zinc-950', color: '#06b6d4' },
];

export default function GamePage({ games, profile, dailyMissions, onScoreUpdate, onGameOver }: GamePageProps) {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [isMuted, setIsMuted] = useState(() => audio.getMuteState());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Default: Sidebar is closed so game gets 80-90% viewport focus!
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'leaderboard' | 'quests'>('chat');
  const [isCrtFilter, setIsCrtFilter] = useState(false);
  const [bgAmbient, setBgAmbient] = useState(() => {
    const defaultColor = profile.colorTheme || '#6366f1';
    const match = BACKGROUND_AMBIENTS.find(b => b.color.toLowerCase() === defaultColor.toLowerCase());
    return match ? match.id : 'indigo';
  });

  const [isBgmOn, setIsBgmOn] = useState(true);
  const [isBossMode, setIsBossMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<'game' | 'community'>('game');

  // Onboarding tutorial state & inter-game drawer
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [recentlyPlayed, setRecentlyPlayed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('zigame_recently_played');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const activeGame = games.find((g) => g.id === gameId);
  const registryItem = gameId ? GAME_REGISTRY[gameId] : null;

  // Track recently played and check tutorial status on gameId change
  useEffect(() => {
    if (!gameId) return;

    setRecentlyPlayed((prev) => {
      const filtered = prev.filter((id) => id !== gameId);
      const updated = [gameId, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('zigame_recently_played', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      const isDisabled = localStorage.getItem(`tutorial_disabled_${gameId}`) === 'true';
      setIsTutorialOpen(!isDisabled);
    } catch {
      setIsTutorialOpen(true);
    }
  }, [gameId]);

  // Background audio sync
  useEffect(() => {
    if (isBgmOn && !isMuted && !isBossMode) {
      audio.startBgm();
    } else {
      audio.stopBgm();
    }
    return () => {
      audio.stopBgm();
    };
  }, [isBgmOn, isMuted, isBossMode]);

  // Keyboard shortcut listener ('B' for Boss Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'b' || e.key === 'B') {
        setIsBossMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleMute = useCallback(() => {
    const newMuteState = audio.toggleMute();
    setIsMuted(newMuteState);
  }, []);

  const handleRestart = useCallback(() => {
    audio.playCoin();
    setKey((prev) => prev + 1);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => {
        console.warn("Fullscreen request failed:", err);
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => {
        console.warn("Exit fullscreen failed:", err);
      });
    }
  }, []);

  if (!activeGame) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-6 select-none font-sans">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 text-2xl mb-4 animate-bounce">
          ⚠️
        </div>
        <h2 className="text-xl font-black font-display uppercase tracking-wider mb-2">PERMAINAN TIDAK DITEMUKAN</h2>
        <p className="text-sm text-zinc-400 font-mono mb-6 max-w-sm text-center">
          ID permainan "{gameId}" tidak terdaftar dalam registry Zigame.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 font-bold font-mono text-xs rounded-xl shadow-lg transition cursor-pointer"
        >
          KEMBALI KE LOBI UTAMA
        </button>
      </div>
    );
  }

  const currentAmbient = BACKGROUND_AMBIENTS.find(b => b.id === bgAmbient) || BACKGROUND_AMBIENTS[0];
  const controls = (gameId && GAME_CONTROLS_MAP[gameId]) || {
    keys: ['⬆️', '⬇️', '⬅️', '➡️', 'SPASI'],
    tips: 'Gunakan tombol arah panah dan spasi untuk mengontrol permainan.',
    controlType: 'directional-action' as GameControlType
  };

  const gameLayoutConfig = (gameId && GAME_LAYOUTS[gameId]) || DEFAULT_GAME_LAYOUT;
  const GameComponent = registryItem?.component || null;

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden flex flex-col bg-gradient-to-b ${currentAmbient.class} text-zinc-100 font-sans select-none`}
      id="arcade-gamepage-root"
    >
      {/* Boss Mode Overlay Screen */}
      {isBossMode && <BossModeSpreadsheet onExit={() => setIsBossMode(false)} />}

      {/* Tutorial Onboarding Modal */}
      {isTutorialOpen && (
        <GameTutorialModal
          game={activeGame}
          controls={controls}
          onClose={() => setIsTutorialOpen(false)}
          onStartGame={handleRestart}
        />
      )}

      {/* Simplified Header Navigation */}
      <GamePageHeader
        activeGame={activeGame}
        currentAmbient={currentAmbient}
        backgroundAmbients={BACKGROUND_AMBIENTS}
        bgAmbient={bgAmbient}
        setBgAmbient={setBgAmbient}
        isCrtFilter={isCrtFilter}
        setIsCrtFilter={setIsCrtFilter}
        onRestart={handleRestart}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isBgmOn={isBgmOn}
        setIsBgmOn={setIsBgmOn}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        onNavigateHome={() => navigate('/')}
        onOpenTutorial={() => setIsTutorialOpen(true)}
      />

      {/* Mobile Top Nav Tabs */}
      <GamePageMobileNav
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
      />

      {/* Main Single-Focus Hero Stage Layout */}
      <div className="flex-1 flex min-h-0 w-full overflow-hidden relative" id="gamepage-viewport-columns">
        {/* Center Stage: The Hero Game Viewport */}
        <div 
          className={`flex-1 flex flex-col h-full min-h-0 min-w-0 p-3 md:p-5 overflow-y-auto relative items-center justify-between ${
            mobileTab === 'game' ? 'flex' : 'hidden lg:flex'
          }`}
          id="center-game-viewport"
        >
          {/* CRT Screen Scanline Filter Layer */}
          {isCrtFilter && (
            <div className="absolute inset-0 bg-scanlines pointer-events-none z-30 opacity-20" />
          )}

          {/* Clean Focused Canvas Stage (occupies ~80% of width) */}
          <div className="flex-1 w-full max-w-5xl flex items-center justify-center relative min-h-0 py-2">
            <div 
              className="relative w-full h-full max-h-full flex items-center justify-center bg-zinc-950/95 border border-zinc-800 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden transition-all duration-300"
              style={{
                boxShadow: `0 0 30px ${currentAmbient.color}15, inset 0 0 15px rgba(0,0,0,0.9)`,
                aspectRatio: gameLayoutConfig.aspectRatio,
              }}
            >
              {GameComponent ? (
                <GameErrorBoundary gameTitle={activeGame.title} onReset={handleRestart}>
                  <Suspense
                    fallback={
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-zinc-950">
                        <RefreshCw size={28} className="animate-spin text-indigo-400 mb-3" />
                        <span className="font-display font-black text-xs uppercase tracking-widest text-zinc-300">
                          MEMUAT MODUL {activeGame.title.toUpperCase()}...
                        </span>
                      </div>
                    }
                  >
                    <GameComponent
                      key={key}
                      onGameOver={(score: number) => onGameOver(activeGame.id, score)}
                      onScoreUpdate={(score: number) => onScoreUpdate(activeGame.id, score)}
                      highScore={activeGame.highScore}
                    />
                  </Suspense>
                </GameErrorBoundary>
              ) : (
                <div className="text-center p-8">
                  <Sparkles size={32} className="text-amber-400 mx-auto mb-2 animate-spin" />
                  <h3 className="font-display font-black text-sm uppercase text-white">MODUL GAME SEDANG DIKEMBANGKAN</h3>
                </div>
              )}
            </div>
          </div>

          {/* Compact HUD Bar beneath Canvas */}
          <div className="w-full max-w-5xl mt-3 flex-none bg-zinc-950/80 border border-zinc-800/80 p-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 font-sans">
            {/* Left: Score & Controls Badges */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl font-mono text-xs font-bold">
                <Trophy size={14} />
                <span>Rekor: {activeGame.highScore.toLocaleString()} pts</span>
              </div>

              {controls.keys && controls.keys.length > 0 && (
                <div className="hidden sm:flex items-center gap-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold mr-1">Kontrol:</span>
                  {controls.keys.map((k, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[11px] font-mono font-bold text-zinc-300"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Quick Action Modals */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTutorialOpen(true)}
                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-indigo-400 hover:text-indigo-300 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <HelpCircle size={13} />
                <span>Cara Bermain</span>
              </button>

              <button
                onClick={() => setShowNavDrawer((prev) => !prev)}
                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono font-bold text-zinc-300 hover:text-white rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Navigation size={13} className="text-amber-400" />
                <span>{showNavDrawer ? 'Tutup Game Lain' : 'Jelajahi Game Lain'}</span>
              </button>
            </div>
          </div>

          {/* Inter-Game Navigation Drawer */}
          {showNavDrawer && (
            <div className="w-full max-w-5xl mt-3 flex-none animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl relative">
                <button
                  onClick={() => setShowNavDrawer(false)}
                  className="absolute top-3 right-3 text-zinc-500 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
                <GameNavigationDrawer
                  currentGame={activeGame}
                  allGames={games}
                  recentlyPlayedIds={recentlyPlayed}
                  onSelectGame={(id) => navigate(`/game/${id}`)}
                />
              </div>
            </div>
          )}

          {/* Virtual Touch Controller Deck for Mobile */}
          <MobileTouchControls visible={mobileTab === 'game'} controlType={controls.controlType} />
        </div>

        {/* Right Community & Leaderboard Sidebar (Drawer toggleable) */}
        {(isSidebarOpen || mobileTab === 'community') && (
          <GamePageRightSidebar
            activeGame={activeGame}
            profile={profile}
            dailyMissions={dailyMissions}
            currentAmbient={currentAmbient}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            mobileTab={mobileTab}
            isTheatreMode={false}
            isFullscreen={isFullscreen}
          />
        )}
      </div>
    </div>
  );
}
