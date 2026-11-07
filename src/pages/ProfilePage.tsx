import React, { useState, useEffect, useMemo } from 'react';
import { PlayerProfile, GameStats, Achievement, RecentlyPlayedEntry, FriendProfile, ActivityFeedItem, SocialPrivacySettings, GameMastery } from '../types';
import { audio } from '../utils/audio';
import { authService } from '../services/authService';
import { socialService } from '../services/socialService';
import { useAuth } from '../contexts/AuthContext';
import { useGameContext } from '../contexts/GameContext';
import { useToast } from '../utils/ToastContext';

import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileOverview } from '../components/profile/ProfileOverview';
import { ProfileMastery } from '../components/profile/ProfileMastery';
import { ProfileAchievements } from '../components/profile/ProfileAchievements';
import { ProfileFriends } from '../components/profile/ProfileFriends';
import { ProfileSettings } from '../components/profile/ProfileSettings';
import { ProfileAuth } from '../components/profile/ProfileAuth';

interface ProfilePageProps {
  profile: PlayerProfile;
  games: GameStats[];
  achievements: Achievement[];
  recentlyPlayed: RecentlyPlayedEntry[];
  masteries: Record<string, GameMastery>;
  totalPlays: number;
  onUpdateProfile: (newProfile: PlayerProfile) => void;
  onResetStats: () => void;
  onLogout?: () => void;
  onLoginSuccess?: (
    profile: PlayerProfile,
    games: GameStats[],
    achievements: Achievement[],
    recentlyPlayed: RecentlyPlayedEntry[]
  ) => void;
  onClearRecentlyPlayed: () => void;
  onSelectGame: (id: string) => void;
}

export default function ProfilePage({
  profile,
  games,
  achievements,
  recentlyPlayed,
  totalPlays,
  onUpdateProfile,
  onResetStats,
  onLogout,
  onLoginSuccess,
  onClearRecentlyPlayed,
  masteries,
  onSelectGame
}: ProfilePageProps) {
  const { setProfile, setGames, setAchievements, setRecentlyPlayed } = useGameContext();
  const { showToast } = useToast();

  const applyLoginSuccess = (
    newProfile: PlayerProfile,
    newGames: GameStats[],
    newAchievements: Achievement[],
    newRecentlyPlayed: RecentlyPlayedEntry[]
  ) => {
    if (onLoginSuccess) {
      onLoginSuccess(newProfile, newGames, newAchievements, newRecentlyPlayed);
    } else {
      setProfile(newProfile);
      setGames(newGames);
      setAchievements(newAchievements);
      setRecentlyPlayed(newRecentlyPlayed);
      showToast('Login Berhasil', 'Data kamu sudah disinkronkan.', 'success', '👋');
    }
  };

  // Navigation Tabs within Profile
  const [activeTab, setActiveTab] = useState<'overview' | 'mastery' | 'achievements' | 'friends' | 'settings' | 'auth'>('overview');
  
  // Auth Form States
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Register Customization States
  const [selectedAvatar, setSelectedAvatar] = useState('👾');
  const [selectedColor, setSelectedColor] = useState('#ef4444');

  // Friends & Social States
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [privacy, setPrivacy] = useState<SocialPrivacySettings>({ allowFriendRequests: 'everyone', showActivityFeed: 'public' });
  const [friendSearchName, setFriendSearchName] = useState('');
  const [friendStatusMsg, setFriendStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Static constants
  const avatars = ['👾', '🚀', '🤖', '🛸', '🎮', '⚡', '👑', '🧙‍♂️', '🦊', '🐱'];
  const colors = [
    { value: '#ef4444', label: 'NEON MERAH' },
    { value: '#06b6d4', label: 'NEON SIAN' },
    { value: '#eab308', label: 'NEON KUNING' },
    { value: '#a855f7', label: 'NEON UNGU' },
    { value: '#ec4899', label: 'NEON MERAH MUDA' },
    { value: '#10b981', label: 'NEON HIJAU' }
  ];

  const { user, isFirebaseUser, logout: authLogout } = useAuth();

  // Sync initial logged in user state
  useEffect(() => {
    if (user) {
      setLoggedInUser(isFirebaseUser ? (user.displayName || user.email || user.uid) : (user.displayName || user.uid.replace('local_', '')));
    } else {
      setLoggedInUser(null);
    }
  }, [user, isFirebaseUser]);

  // Initialize friends & social metrics
  useEffect(() => {
    setFriends(socialService.getFriends());
    setActivities(socialService.getActivities());
    setPrivacy(socialService.getPrivacySettings());
  }, []);

  // Sync brute-force cooldown
  useEffect(() => {
    const checkCooldown = () => {
      const cooldownTime = localStorage.getItem('zigame_login_cooldown_until');
      if (cooldownTime) {
        const remaining = Math.ceil((parseInt(cooldownTime) - Date.now()) / 1000);
        if (remaining > 0) {
          setCooldownRemaining(remaining);
        } else {
          setCooldownRemaining(0);
          localStorage.removeItem('zigame_login_failures');
          localStorage.removeItem('zigame_login_cooldown_until');
        }
      }
    };
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Computed Statistics
  const totalCoinsEarned = useMemo(() => {
    return achievements
      .filter(a => a.unlocked)
      .reduce((sum, curr) => sum + curr.rewardCoins, 0);
  }, [achievements]);

  const achievementUnlocks = useMemo(() => {
    const unlocked = achievements.filter(a => a.unlocked).length;
    const total = achievements.length || 1;
    return {
      unlocked,
      total,
      percent: Math.round((unlocked / total) * 100)
    };
  }, [achievements]);

  const playerRank = useMemo(() => {
    if (totalPlays === 0) return { title: 'CADET TAMU', desc: 'Mulai mainkan game siber pertamamu!', color: 'text-zinc-500', bg: 'bg-zinc-500/10' };
    if (totalPlays < 5) return { title: 'RETRO REKREASI', desc: 'Baru memulai petualangan di dunia lobi.', color: 'text-cyan-400', bg: 'bg-cyan-500/10' };
    if (totalPlays < 15) return { title: 'BYTE HACKER', desc: 'Mulai menguasai refleks game arkade.', color: 'text-indigo-400', bg: 'bg-indigo-500/10' };
    if (totalPlays < 35) return { title: 'CORE RUNNER', desc: 'Pemain tangguh dengan ambisi tak terbatas.', color: 'text-purple-400', bg: 'bg-purple-500/10' };
    return { title: 'ARCADE LEGEND', desc: 'Sang legenda sejati pemuncak lobi siber!', color: 'text-pink-500', bg: 'bg-pink-500/10' };
  }, [totalPlays]);

  const barChartData = useMemo(() => {
    const sorted = [...games]
      .filter(g => g.plays > 0)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);
    const maxPlays = sorted.length > 0 ? Math.max(...sorted.map(s => s.plays)) : 10;
    return { sorted, maxPlays };
  }, [games]);

  // Auth Handlers
  const handleFailedAttempt = () => {
    const currentFailures = parseInt(localStorage.getItem('zigame_login_failures') || '0') + 1;
    localStorage.setItem('zigame_login_failures', currentFailures.toString());
    
    if (currentFailures >= 3) {
      const cooldownUntil = Date.now() + 30000;
      localStorage.setItem('zigame_login_cooldown_until', cooldownUntil.toString());
      setCooldownRemaining(30);
      setAuthError('Batas percobaan terlampaui! Sistem dikunci selama 30 detik.');
    } else {
      setAuthError(`Password salah! Sisa percobaan: ${3 - currentFailures}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const cooldownTime = localStorage.getItem('zigame_login_cooldown_until');
    if (cooldownTime && parseInt(cooldownTime) > Date.now()) {
      setAuthError('Sistem dikunci sementara!');
      audio.playGameOver();
      return;
    }

    if (!username.trim() || !password) {
      setAuthError('Isi username dan password.');
      audio.playGameOver();
      return;
    }

    setIsLoading(true);
    const guestData = { profile, games, achievements, recentlyPlayed };
    const res = await authService.loginLocal(username, password, guestData);
    setIsLoading(false);

    if (!res.success) {
      handleFailedAttempt();
      audio.playGameOver();
      return;
    }

    localStorage.removeItem('zigame_login_failures');
    localStorage.removeItem('zigame_login_cooldown_until');
    audio.playLevelUp();
    setAuthSuccess(res.message);
    setLoggedInUser(username.trim().toLowerCase());
    
    if (res.session) {
      setTimeout(() => {
        applyLoginSuccess(
          res.session!.profile,
          res.session!.games,
          res.session!.achievements,
          res.session!.recentlyPlayed
        );
        setActiveTab('overview');
      }, 1000);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!username.trim() || !displayName.trim() || !password) {
      setAuthError('Harap lengkapi semua bidang.');
      audio.playGameOver();
      return;
    }

    setIsLoading(true);
    const guestData = {
      profile: {
        ...profile,
        name: displayName.trim().toUpperCase(),
        avatar: selectedAvatar,
        colorTheme: selectedColor,
        coins: Math.max(profile.coins, 100)
      },
      games,
      achievements,
      recentlyPlayed
    };

    const res = await authService.registerLocal(username, displayName, password, guestData);
    setIsLoading(false);

    if (!res.success) {
      setAuthError(res.message);
      audio.playGameOver();
      return;
    }

    audio.playLevelUp();
    setAuthSuccess(res.message);
    setLoggedInUser(username.trim().toLowerCase());

    if (res.session) {
      setTimeout(() => {
        applyLoginSuccess(
          res.session!.profile,
          res.session!.games,
          res.session!.achievements,
          res.session!.recentlyPlayed
        );
        setActiveTab('overview');
      }, 1000);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthSuccess('');
    setIsLoading(true);

    const guestData = { profile, games, achievements, recentlyPlayed };
    const res = await authService.loginWithGoogle(guestData);
    setIsLoading(false);

    if (!res.success) {
      setAuthError(res.message);
      audio.playGameOver();
      return;
    }

    audio.playLevelUp();
    setAuthSuccess(res.message);
    if (res.session) {
      setLoggedInUser(res.session.username);
      setTimeout(() => {
        applyLoginSuccess(
          res.session!.profile,
          res.session!.games,
          res.session!.achievements,
          res.session!.recentlyPlayed
        );
        setActiveTab('overview');
      }, 1000);
    }
  };

  const handleLogoutClick = async () => {
    audio.playCoin();
    await authLogout();
    setLoggedInUser(null);
    setUsername('');
    setPassword('');
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
    setActiveTab('auth');
  };

  // Friends Handlers
  const handleSendFriendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendSearchName.trim()) return;
    const res = socialService.sendFriendRequest(friendSearchName, loggedInUser || 'Tamu');
    setFriendStatusMsg({ text: res.message, isError: !res.success });
    if (res.success) {
      audio.playCoin();
      setFriendSearchName('');
      setFriends(socialService.getFriends());
    } else {
      audio.playHit();
    }
  };

  const handleAcceptFriend = (uid: string) => {
    audio.playLevelUp();
    socialService.acceptFriendRequest(uid);
    setFriends(socialService.getFriends());
  };

  const handleRejectFriend = (uid: string) => {
    audio.playHit();
    socialService.rejectFriendRequest(uid);
    setFriends(socialService.getFriends());
  };

  const handleRemoveFriend = (uid: string) => {
    audio.playHit();
    socialService.removeFriend(uid);
    setFriends(socialService.getFriends());
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12 text-text-primary">
      {/* Profile Header & Navigation */}
      <ProfileHeader
        profile={profile}
        loggedInUser={loggedInUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        playerRank={playerRank}
      />

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <ProfileOverview
          profile={profile}
          games={games}
          totalPlays={totalPlays}
          totalCoinsEarned={totalCoinsEarned}
          achievementUnlocks={achievementUnlocks}
          playerRank={playerRank}
          barChartData={barChartData}
          recentlyPlayed={recentlyPlayed}
          onSelectGame={onSelectGame}
          onClearRecentlyPlayed={onClearRecentlyPlayed}
        />
      )}

      {activeTab === 'mastery' && (
        <ProfileMastery
          masteries={masteries}
          games={games}
          onSelectGame={onSelectGame}
        />
      )}

      {activeTab === 'achievements' && (
        <ProfileAchievements
          achievements={achievements}
        />
      )}

      {activeTab === 'friends' && (
        <ProfileFriends
          friends={friends}
          activities={activities}
          privacy={privacy}
          friendSearchName={friendSearchName}
          setFriendSearchName={setFriendSearchName}
          friendStatusMsg={friendStatusMsg}
          onSendFriendRequest={handleSendFriendRequest}
          onAcceptFriend={handleAcceptFriend}
          onRejectFriend={handleRejectFriend}
          onRemoveFriend={handleRemoveFriend}
        />
      )}

      {activeTab === 'settings' && (
        <ProfileSettings
          profile={profile}
          loggedInUser={loggedInUser}
          onUpdateProfile={onUpdateProfile}
          onResetStats={onResetStats}
          onLogout={handleLogoutClick}
        />
      )}

      {activeTab === 'auth' && (
        <ProfileAuth
          loggedInUser={loggedInUser}
          isRegistering={isRegistering}
          setIsRegistering={setIsRegistering}
          username={username}
          setUsername={setUsername}
          displayName={displayName}
          setDisplayName={setDisplayName}
          password={password}
          setPassword={setPassword}
          isLoading={isLoading}
          authError={authError}
          authSuccess={authSuccess}
          cooldownRemaining={cooldownRemaining}
          selectedAvatar={selectedAvatar}
          setSelectedAvatar={setSelectedAvatar}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          avatars={avatars}
          colors={colors}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onGoogleLogin={handleGoogleLogin}
          onLogout={handleLogoutClick}
        />
      )}
    </div>
  );
}
