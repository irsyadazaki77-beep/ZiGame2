import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { GameStats, PlayerProfile, DailyMission } from '../types';

import { GAME_LAYOUTS, DEFAULT_GAME_LAYOUT } from '../config/gameLayouts';
import { GAME_REGISTRY } from '../config/gameRegistry';
import { competitiveService } from '../services/competitiveService';
import { friendChallengeService, FriendChallenge } from '../services/friendChallengeService';
import { economyService } from '../services/economyService';

import { useGameAudio } from '../hooks/useGameAudio';
import { useGameDisplayMode } from '../hooks/useGameDisplayMode';
import { useGameSession } from '../hooks/useGameSession';
import { useToast } from '../utils/ToastContext';
import { audio } from '../utils/audio';
import { screenShake } from '../utils/screenShake';
import { haptics } from '../utils/haptics';

import { GamePageHeader } from '../components/gamepage/GamePageHeader';
import { GamePageRightSidebar } from '../components/gamepage/GamePageRightSidebar';
import { BossModeSpreadsheet } from '../components/gamepage/BossModeSpreadsheet';
import { MobileTouchControls } from '../components/gamepage/MobileTouchControls';
import { UnifiedTutorialModal } from '../components/gamepage/UnifiedTutorialModal';
import { ShareResultModal } from '../components/gamepage/ShareResultModal';
import { GameNavigationDrawer } from '../components/gamepage/GameNavigationDrawer';
import { QuickArcadeSettings } from '../components/gamepage/QuickArcadeSettings';
import { GameHeroCanvas } from '../components/gamepage/GameHeroCanvas';
import { GameHUDBar } from '../components/gamepage/GameHUDBar';
import { GameNotFound } from '../components/gamepage/GameNotFound';
import { FriendChallengeBanner } from '../components/gamepage/FriendChallengeBanner';
import { CreateFriendChallengeModal } from '../components/gamepage/CreateFriendChallengeModal';
import { ChallengeReceivedModal } from '../components/gamepage/ChallengeReceivedModal';
import { ChallengeResultModal } from '../components/gamepage/ChallengeResultModal';
import { X } from 'lucide-react';

interface GamePageProps {
  games: GameStats[];
  profile: PlayerProfile;
  dailyMissions: DailyMission[];
  onScoreUpdate: (gameId: string, score: number) => void;
  onGameOver: (gameId: string, score: number, sessionId?: string, sessionDuration?: number) => void;
}

const BACKGROUND_AMBIENTS = [
  { id: 'indigo', name: 'Cosmic Indigo', class: 'from-indigo-950/40 via-zinc-950 to-zinc-950', color: '#6366f1' },
  { id: 'rose', name: 'Cyber Ruby', class: 'from-rose-950/40 via-zinc-950 to-zinc-950', color: '#f43f5e' },
  { id: 'emerald', name: 'Matrix Green', class: 'from-emerald-950/40 via-zinc-950 to-zinc-950', color: '#10b981' },
  { id: 'amber', name: 'Solar Gold', class: 'from-amber-950/30 via-zinc-950 to-zinc-950', color: '#f59e0b' },
  { id: 'cyan', name: 'Vapor Blue', class: 'from-cyan-950/40 via-zinc-950 to-zinc-950', color: '#06b6d4' },
];

export default function GamePage({ games, profile, dailyMissions, onScoreUpdate, onGameOver }: GamePageProps) {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const activeGame = games.find((g) => g.id === gameId);
  const registryItem = gameId ? GAME_REGISTRY[gameId] : null;

  // Domain Hooks
  const {
    isFullscreen,
    isFocusMode,
    setIsFocusMode,
    isBossMode,
    setIsBossMode,
    isCrtFilter,
    setIsCrtFilter,
    containerRef,
    toggleFullscreen
  } = useGameDisplayMode();

  const {
    isMuted,
    isBgmOn,
    setIsBgmOn,
    handleToggleMute
  } = useGameAudio(isBossMode);

  // Challenge System States
  const [incomingChallenge, setIncomingChallenge] = useState<FriendChallenge | null>(() => {
    return friendChallengeService.parseChallengeFromUrl(searchParams);
  });
  const [activeChallenge, setActiveChallenge] = useState<FriendChallenge | null>(null);
  const [isCreateChallengeOpen, setIsCreateChallengeOpen] = useState(false);
  const [challengeResultData, setChallengeResultData] = useState<{ challenge: FriendChallenge; finalScore: number } | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const targetBeatenRef = useRef(false);

  // Wrapped Score Update with Challenge milestone detector
  const handleScoreUpdateProxy = useCallback((gid: string, score: number) => {
    setSessionScore(score);
    onScoreUpdate(gid, score);

    if (activeChallenge && score >= activeChallenge.targetScore && !targetBeatenRef.current) {
      targetBeatenRef.current = true;
      audio.playPowerup();
      screenShake.trigger('subtle');
      haptics.trigger('success');
      showToast('🎯 Target Terlewati!', `Kamu berhasil mengalahkan target skor ${activeChallenge.targetScore.toLocaleString()}!`, 'success', '🏆');
    }
  }, [activeChallenge, onScoreUpdate, showToast]);

  // Wrapped Game Over with Challenge result check
  const handleGameOverProxy = useCallback((gid: string, score: number, sessionId?: string, sessionDuration?: number) => {
    onGameOver(gid, score, sessionId, sessionDuration);

    if (activeChallenge) {
      friendChallengeService.recordChallengeAttempt(activeChallenge.id, score);
      setChallengeResultData({
        challenge: activeChallenge,
        finalScore: score
      });
    }
  }, [activeChallenge, onGameOver]);

  const {
    key,
    isRankedMode,
    setIsRankedMode,
    isStartingSession,
    sessionError,
    shareResultData,
    setShareResultData,
    hasExistingSave,
    setHasExistingSave,
    isTutorialOpen,
    setIsTutorialOpen,
    recentlyPlayed,
    handleRestart: baseRestart,
    handleScoreUpdate,
    handleWrappedGameOver
  } = useGameSession(activeGame, profile, handleScoreUpdateProxy, handleGameOverProxy);

  const handleRestart = useCallback(() => {
    targetBeatenRef.current = false;
    setSessionScore(0);
    setChallengeResultData(null);
    baseRestart();
  }, [baseRestart]);

  // Handle incoming challenge accept
  const handleAcceptChallenge = () => {
    if (!incomingChallenge) return;
    friendChallengeService.saveIncomingChallenge(incomingChallenge);
    setActiveChallenge(incomingChallenge);
    setIncomingChallenge(null);
    targetBeatenRef.current = false;
    setSessionScore(0);
    handleRestart();
    showToast('Tantangan Diterima!', `Kalahkan skor ${incomingChallenge.targetScore.toLocaleString()} dari ${incomingChallenge.challengerName}`, 'info', '⚔️');
  };

  // Handle claim bounty
  const handleClaimChallengeBounty = async () => {
    if (!challengeResultData) return;
    const { challenge } = challengeResultData;
    await economyService.claimReward(challenge.id, 'challenge');
    showToast('Bounty Diklaim!', `+${challenge.bountyCoins} Koin & +${challenge.bountyXp} XP berhasil ditambahkan!`, 'success', '💰');
  };

  // Page State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'leaderboard' | 'quests'>('chat');
  const [mobileTab, setMobileTab] = useState<'game' | 'community'>('game');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showNavDrawer, setShowNavDrawer] = useState(false);

  const [bgAmbient, setBgAmbient] = useState(() => {
    const defaultColor = profile.colorTheme || '#6366f1';
    const match = BACKGROUND_AMBIENTS.find(b => b.color.toLowerCase() === defaultColor.toLowerCase());
    return match ? match.id : 'indigo';
  });

  if (!activeGame) {
    return <GameNotFound gameId={gameId} onNavigateHome={() => navigate('/')} />;
  }

  const currentAmbient = BACKGROUND_AMBIENTS.find(b => b.id === bgAmbient) || BACKGROUND_AMBIENTS[0];
  const controls = {
    keys: registryItem?.controls.split(' ') || ['⬆️', '⬇️', '⬅️', '➡️', 'SPASI'],
    tips: registryItem?.description || 'Gunakan tombol kontrol virtual atau keyboard untuk mengontrol permainan.',
    controlType: registryItem?.controlType || 'actiononly'
  };

  const gameLayoutConfig = (gameId && GAME_LAYOUTS[gameId]) || DEFAULT_GAME_LAYOUT;
  const GameComponent = registryItem?.component || null;
  const competitiveInfo = competitiveService.getRating(activeGame.id);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden flex flex-col bg-gradient-to-b ${currentAmbient.class} text-zinc-100 font-sans select-none`}
      id="arcade-gamepage-root"
    >
      {/* Boss Mode Overlay Screen */}
      {isBossMode && <BossModeSpreadsheet onExit={() => setIsBossMode(false)} />}

      {/* Unified Tutorial Modal */}
      {isTutorialOpen && (
        <UnifiedTutorialModal
          game={activeGame}
          onClose={() => setIsTutorialOpen(false)}
          onStartGame={() => setIsTutorialOpen(false)}
        />
      )}

      {/* Shareable Result Card Modal (when not in challenge mode) */}
      {shareResultData && !challengeResultData && (
        <ShareResultModal
          data={shareResultData}
          onClose={() => setShareResultData(null)}
        />
      )}

      {/* Friend Challenge Modals */}
      {incomingChallenge && (
        <ChallengeReceivedModal
          challenge={incomingChallenge}
          onAccept={handleAcceptChallenge}
          onDecline={() => setIncomingChallenge(null)}
        />
      )}

      {isCreateChallengeOpen && (
        <CreateFriendChallengeModal
          isOpen={isCreateChallengeOpen}
          onClose={() => setIsCreateChallengeOpen(false)}
          activeGame={activeGame}
          profile={profile}
          lastScore={sessionScore}
        />
      )}

      {challengeResultData && (
        <ChallengeResultModal
          challenge={challengeResultData.challenge}
          finalScore={challengeResultData.finalScore}
          onRetry={handleRestart}
          onCounterChallenge={() => {
            setChallengeResultData(null);
            setIsCreateChallengeOpen(true);
          }}
          onClaimBounty={handleClaimChallengeBounty}
          onClose={() => setChallengeResultData(null)}
        />
      )}

      {/* Simplified Header Navigation (Hidden in Focus Mode) */}
      {!isFocusMode && (
        <GamePageHeader
          activeGame={activeGame}
          onRestart={handleRestart}
          onNavigateHome={() => navigate('/')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />
      )}

      {/* Arcade Cabinet adjustments */}
      <QuickArcadeSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeGame={activeGame}
        games={games}
        recentlyPlayedIds={recentlyPlayed}
        onSelectGame={(id) => navigate(`/game/${id}`)}
        onOpenTutorial={() => setIsTutorialOpen(true)}
        onOpenChallengeModal={() => setIsCreateChallengeOpen(true)}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isBgmOn={isBgmOn}
        setIsBgmOn={setIsBgmOn}
        isCrtFilter={isCrtFilter}
        setIsCrtFilter={setIsCrtFilter}
        bgAmbient={bgAmbient}
        setBgAmbient={setBgAmbient}
        backgroundAmbients={BACKGROUND_AMBIENTS}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        isFocusMode={isFocusMode}
        setIsFocusMode={setIsFocusMode}
      />

      {/* Main Single-Focus Hero Stage Layout */}
      <div className="flex-1 flex min-h-0 w-full overflow-hidden relative" id="gamepage-viewport-columns">
        {/* Center Stage: The Hero Game Viewport */}
        <div 
          className={`flex-1 flex flex-col h-full min-h-0 min-w-0 p-0 sm:p-3 md:p-5 overflow-hidden sm:overflow-y-auto relative items-center justify-between ${
            mobileTab === 'game' ? 'flex' : 'hidden lg:flex'
          }`}
          id="center-game-viewport"
        >
          {/* Active Friend Challenge HUD Banner */}
          {activeChallenge && (
            <FriendChallengeBanner
              challenge={activeChallenge}
              currentScore={sessionScore}
            />
          )}

          {/* Main Game Stage & Overlays */}
          <GameHeroCanvas
            activeGame={activeGame}
            GameComponent={GameComponent}
            gameKey={key}
            aspectRatio={gameLayoutConfig.aspectRatio}
            isStartingSession={isStartingSession}
            sessionError={sessionError}
            isRankedMode={isRankedMode}
            isCrtFilter={isCrtFilter}
            isFocusMode={isFocusMode}
            setIsFocusMode={setIsFocusMode}
            hasExistingSave={hasExistingSave}
            setHasExistingSave={setHasExistingSave}
            onRestart={handleRestart}
            onGameOver={handleWrappedGameOver}
            onScoreUpdate={handleScoreUpdate}
          />

          {/* Virtual Touch Controller Deck for Mobile */}
          <MobileTouchControls visible={mobileTab === 'game'} controlType={controls.controlType} />

          {/* Simplified Arcade-Grade HUD Bar */}
          <GameHUDBar
            activeGame={activeGame}
            isRankedMode={isRankedMode}
            setIsRankedMode={setIsRankedMode}
            competitiveInfo={competitiveInfo}
            onRestart={handleRestart}
            onOpenChallengeModal={() => setIsCreateChallengeOpen(true)}
          />

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
        </div>

        {/* Right Community & Leaderboard Sidebar (Drawer toggleable) */}
        {!isFocusMode && (isSidebarOpen || mobileTab === 'community') && (
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
