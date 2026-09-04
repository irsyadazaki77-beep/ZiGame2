import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerProfile, GameStats, Achievement, RecentlyPlayedEntry, FriendProfile, ActivityFeedItem, SocialPrivacySettings, GameMastery } from '../types';
import { audio } from '../utils/audio';
import { authService } from '../services/authService';
import { socialService } from '../services/socialService';
import { formatNumber } from "../utils/format";
import { 
  User, UserPlus, LogIn, Sparkles, Lock, RefreshCw, Globe, AlertCircle, CheckCircle2, 
  Settings as SettingsIcon, Volume2, Monitor, Cpu, ShieldCheck, ShieldAlert, Smile, Save, Code2,
  Trophy, Calendar, CheckCircle, ChevronLeft, ChevronRight, Users, Trash2, Ban, Check, Search, 
  Gamepad2, Flame, Award, Target, Zap, Clock, ArrowUpRight, LogOut, Activity, X 
} from 'lucide-react';

interface ProfilePageProps {
  profile: PlayerProfile;
  games: GameStats[];
  achievements: Achievement[];
  recentlyPlayed: RecentlyPlayedEntry[];
  masteries: Record<string, GameMastery>;
  totalPlays: number;
  onUpdateProfile: (newProfile: PlayerProfile) => void;
  onResetStats: () => void;
  onLogout: () => void;
  onLoginSuccess: (
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
  // Navigation Tabs within Profile
  const [activeTab, setActiveTab] = useState<'overview' | 'mastery' | 'achievements' | 'friends' | 'settings' | 'auth'>('overview');
  
  // Auth Form States (used in 'auth' tab or when logged out)
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
  const [friendsTab, setFriendsTab] = useState<'list' | 'requests' | 'activity' | 'privacy'>('list');
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [privacy, setPrivacy] = useState<SocialPrivacySettings>({ allowFriendRequests: 'everyone', showActivityFeed: 'public' });
  const [friendSearchName, setFriendSearchName] = useState('');
  const [friendStatusMsg, setFriendStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Settings States
  const [defaultScreenSize, setDefaultScreenSize] = useState<'standard' | 'wide' | 'theater'>(() => {
    return (localStorage.getItem('zigame-screensize') as any) || 'wide';
  });
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high'>(() => {
    return (localStorage.getItem('zigame-graphics') as any) || 'high';
  });
  const [fpsLimit, setFpsLimit] = useState<'30' | '60' | '120' | 'auto'>(() => {
    return (localStorage.getItem('zigame-fps') as any) || 'auto';
  });
  const [isMuted, setIsMuted] = useState(() => audio.getMuteState());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [autolockVal, setAutolockVal] = useState(() => localStorage.getItem('zigame_session_autolock') || 'off');
  const [showImportArea, setShowImportArea] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportedJson, setExportedJson] = useState('');
  const [backupError, setBackupError] = useState('');

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

  // Sync initial logged in user state
  useEffect(() => {
    const active = localStorage.getItem('zigame_active_user');
    if (active) {
      setLoggedInUser(active);
    }
  }, []);

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
        onLoginSuccess(
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
        onLoginSuccess(
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
        onLoginSuccess(
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
    await authService.logout();
    setLoggedInUser(null);
    setUsername('');
    setPassword('');
    onLogout();
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

  const handleBlockUser = (uid: string) => {
    audio.playHit();
    socialService.blockUser(uid);
    setFriends(socialService.getFriends());
  };

  const handleUnblockUser = (uid: string) => {
    audio.playCoin();
    socialService.unblockUser(uid);
    setFriends(socialService.getFriends());
  };

  // Settings Handlers
  const handleGraphicsChange = (quality: 'low' | 'medium' | 'high') => {
    audio.playCoin();
    setGraphicsQuality(quality);
    localStorage.setItem('zigame-graphics', quality);
  };

  const handleFpsChange = (limit: '30' | '60' | '120' | 'auto') => {
    audio.playCoin();
    setFpsLimit(limit);
    localStorage.setItem('zigame-fps', limit);
  };

  const handleScreenSize = (size: 'standard' | 'wide' | 'theater') => {
    audio.playCoin();
    setDefaultScreenSize(size);
    localStorage.setItem('zigame-screensize', size);
  };

  const handleSaveProfile = (dName: string, av: string, theme: string) => {
    if (!dName.trim()) return;
    audio.playLevelUp();
    const updated = {
      ...profile,
      name: dName.trim().toUpperCase(),
      avatar: av,
      colorTheme: theme
    };
    onUpdateProfile(updated);

    if (loggedInUser) {
      try {
        const accs = localStorage.getItem('zigame_accounts');
        if (accs) {
          const accounts = JSON.parse(accs);
          const updatedAccs = accounts.map((acc: any) => {
            if (acc.username.toLowerCase() === loggedInUser.toLowerCase()) {
              return { ...acc, profile: updated };
            }
            return acc;
          });
          localStorage.setItem('zigame_accounts', JSON.stringify(updatedAccs));
        }
      } catch (e) {}
    }
    setSuccessMsg('Profil berhasil disimpan!');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleToggleMute = () => {
    const nextMute = audio.toggleMute();
    setIsMuted(nextMute);
    if (!nextMute) audio.playCoin();
  };

  const triggerResetStats = () => {
    audio.playGameOver();
    onResetStats();
    setShowResetConfirm(false);
    setSuccessMsg('Semua statistik & highscore berhasil direset!');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const triggerDeleteAccount = () => {
    if (!loggedInUser) return;
    audio.playGameOver();
    try {
      const accs = localStorage.getItem('zigame_accounts');
      if (accs) {
        const accounts = JSON.parse(accs);
        const filtered = accounts.filter((acc: any) => acc.username.toLowerCase() !== loggedInUser.toLowerCase());
        localStorage.setItem('zigame_accounts', JSON.stringify(filtered));
      }
    } catch (e) {}
    localStorage.removeItem('zigame_active_user');
    onLogout();
    setShowDeleteConfirm(false);
    setSuccessMsg('Akun berhasil dihapus. Beralih ke Tamu...');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  // Local state copy for settings editor
  const [editorName, setEditorName] = useState(profile.name);
  const [editorAvatar, setEditorAvatar] = useState(profile.avatar);
  const [editorColor, setEditorColor] = useState(profile.colorTheme);

  // Sync editor if prop profile updates
  useEffect(() => {
    setEditorName(profile.name);
    setEditorAvatar(profile.avatar);
    setEditorColor(profile.colorTheme);
  }, [profile]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6"
    >
      {/* Player Identity Header Card */}
      <div className="bg-[#0f131c] border border-white/[0.06] rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden">
        {/* Avatar & Identitas */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left z-10 w-full md:w-auto">
          <div 
            className="w-16 h-16 rounded-2xl bg-zinc-900 border-2 flex items-center justify-center text-3xl shadow-inner shrink-0"
            style={{ borderColor: profile.colorTheme || '#6366f1' }}
          >
            {profile.avatar}
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider font-display truncate">
                {profile.name}
              </h1>
              <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full ${playerRank.color} ${playerRank.bg}`}>
                LVL {profile.level || 1}
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest truncate">
              {loggedInUser ? `@${loggedInUser}` : 'AKUN TAMU'} • {playerRank.title}
            </p>
            {/* Level Progress bar */}
            <div className="w-full sm:w-64 pt-0.5">
              <div className="flex justify-between text-[10px] font-mono text-zinc-400 pb-1">
                <span>{profile.xp || 0} Total XP</span>
                <span>{profile.xp % 100} / 100 XP ke Level {(profile.level || 1) + 1}</span>
              </div>
              <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (profile.xp % 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Action Buttons & Currency Header */}
        <div className="flex items-center gap-3 z-10 shrink-0 w-full sm:w-auto justify-center sm:justify-end flex-wrap">
          <div className="px-4 py-2.5 bg-[#151a26] border border-white/[0.06] rounded-2xl font-mono text-center">
            <span className="block text-[10px] text-zinc-400 uppercase font-bold">Saldo Koin</span>
            <span className="text-sm font-bold text-amber-400">🪙 {formatNumber(profile.coins)}</span>
          </div>

          {loggedInUser ? (
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-1.5 font-mono text-xs text-zinc-300 hover:text-red-400 border border-white/[0.06] hover:border-red-500/30 px-4 py-2.5 bg-[#151a26] hover:bg-red-500/10 transition-colors rounded-2xl cursor-pointer"
            >
              <LogOut size={13} /> Keluar
            </button>
          ) : (
            activeTab !== 'auth' && (
              <button
                onClick={() => { audio.playCoin(); setActiveTab('auth'); }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 font-mono text-xs font-bold tracking-wide rounded-2xl cursor-pointer transition-colors shadow-sm shadow-indigo-600/20"
              >
                Hubungkan Akun
              </button>
            )
          )}
        </div>
      </div>

      {/* Progressive Tab Navigation row */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-white/[0.04] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <button
          onClick={() => { audio.playHit(); setActiveTab('overview'); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition duration-200 shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'overview' ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          <Zap size={13} /> Ikhtisar
        </button>
        <button
          onClick={() => { audio.playHit(); setActiveTab('mastery'); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition duration-200 shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'mastery' ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          <Gamepad2 size={13} /> Kemampuan
        </button>
        <button
          onClick={() => { audio.playHit(); setActiveTab('achievements'); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition duration-200 shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'achievements' ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          <Trophy size={13} /> Pencapaian
        </button>
        <button
          onClick={() => { audio.playHit(); setActiveTab('friends'); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition duration-200 shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'friends' ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          <Users size={13} /> Teman
        </button>
        <button
          onClick={() => { audio.playHit(); setActiveTab('settings'); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition duration-200 shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'settings' ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
          }`}
        >
          <SettingsIcon size={13} /> Pengaturan
        </button>
        {!loggedInUser && (
          <button
            onClick={() => { audio.playHit(); setActiveTab('auth'); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition duration-200 shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'auth' ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            <LogIn size={13} /> Masuk / Daftar
          </button>
        )}
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase"
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {/* Progressive Disclosure Content Container */}
      <div className="pt-2">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Bento Grid Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#0f1322] border border-white/[0.04] p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Pangkat</span>
                <h4 className={`text-sm sm:text-base font-black tracking-wider uppercase font-display mt-2 ${playerRank.color}`}>
                  {playerRank.title}
                </h4>
                <p className="text-[10px] text-zinc-400 mt-1 leading-normal line-clamp-1">{playerRank.desc}</p>
              </div>

              <div className="bg-[#0f1322] border border-white/[0.04] p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Bermain</span>
                <h4 className="text-base sm:text-lg font-black tracking-tight text-white font-mono mt-2">
                  {formatNumber(totalPlays)} <span className="text-[9px] text-zinc-500 font-sans font-normal uppercase">KALI</span>
                </h4>
                <p className="text-[10px] text-zinc-400 mt-1 leading-normal">Total permainan selesai.</p>
              </div>

              <div className="bg-[#0f1322] border border-white/[0.04] p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Koin Prestasi</span>
                <h4 className="text-base sm:text-lg font-black tracking-tight text-white font-mono mt-2 truncate">
                  🪙 {formatNumber(totalCoinsEarned)}
                </h4>
                <p className="text-[10px] text-zinc-400 mt-1 leading-normal">Koin bonus prestasi.</p>
              </div>

              <div className="bg-[#0f1322] border border-white/[0.04] p-4 rounded-2xl flex flex-col justify-between shadow-sm">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Prestasi Terbuka</span>
                <h4 className="text-base sm:text-lg font-black tracking-tight text-white font-mono mt-2">
                  {achievementUnlocks.percent}%
                </h4>
                <p className="text-[10px] text-zinc-400 mt-1 leading-normal">{achievementUnlocks.unlocked} dari {achievementUnlocks.total} prestasi.</p>
              </div>
            </div>

            {/* Favorites Chart & Highscore Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Play Counts Chart */}
              <div className="lg:col-span-3 bg-[#0f1322] border border-white/[0.04] p-5 sm:p-6 rounded-2xl space-y-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-display font-black text-sm text-zinc-200 tracking-wide uppercase">Daftar Permainan Teraktif</h3>
                    <p className="text-[10px] text-zinc-500 font-mono">5 GAME DENGAN PLAY COUNT TERTINGGI</p>
                  </div>
                  <Flame className="text-orange-500 w-4 h-4" />
                </div>

                {barChartData.sorted.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 text-xs font-mono border border-dashed border-white/5 rounded-xl bg-[#080b12]">
                    Belum ada data bermain! Mainkan game beberapa kali untuk merekam analitik.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {barChartData.sorted.map((game, idx) => {
                      const percentage = (game.plays / barChartData.maxPlays) * 100;
                      return (
                        <div key={game.id} className="space-y-1 font-mono">
                          <div className="flex justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-zinc-500 bg-white/[0.02] px-1.5 py-0.5 rounded border border-white/[0.05] font-black">0{idx + 1}</span>
                              <span className="text-zinc-300 font-bold">{game.icon} {game.title}</span>
                            </div>
                            <span className="text-zinc-400 font-bold text-[11px]">{game.plays} kali</span>
                          </div>
                          <div className="h-3.5 w-full bg-white/[0.02] rounded-full overflow-hidden border border-white/[0.05] p-[2px] relative">
                            <div 
                              className="h-full rounded-full bg-indigo-600 transition-all duration-800"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recently Played */}
              <div className="lg:col-span-2 bg-[#0f1322] border border-white/[0.04] p-5 sm:p-6 rounded-2xl space-y-4 shadow-sm flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-cyan-500" />
                    <h3 className="font-display font-black text-sm text-zinc-200 tracking-wide uppercase">Terakhir Dimainkan</h3>
                  </div>
                  {recentlyPlayed.length > 0 && (
                    <button 
                      onClick={() => {
                        if(window.confirm('Yakin ingin menghapus riwayat permainan?')) {
                          onClearRecentlyPlayed();
                        }
                      }}
                      className="text-[10px] font-mono text-zinc-500 hover:text-red-400 uppercase tracking-widest transition-colors"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                {recentlyPlayed.length > 0 ? (
                  <div className="space-y-2.5 overflow-y-auto max-h-[250px] flex-1 pr-1 custom-scrollbar">
                    {recentlyPlayed.map(entry => {
                      const game = games.find(g => g.id === entry.gameId);
                      if (!game) return null;
                      return (
                        <div 
                          key={entry.gameId}
                          onClick={() => onSelectGame(game.id)}
                          className="flex items-center gap-3 bg-white/[0.02] hover:bg-white/[0.04] p-2.5 rounded-xl border border-white/[0.04] hover:border-indigo-500/20 cursor-pointer transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lg shrink-0">
                            {game.icon}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <h5 className="text-xs font-black text-white uppercase truncate group-hover:text-indigo-400 transition-colors">{game.title}</h5>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[9px] font-mono text-zinc-500">SKOR: <span className="text-white font-bold">{entry.lastScore !== undefined ? entry.lastScore : '-'}</span></span>
                              <span className="text-[9px] font-mono text-zinc-500">{new Date(entry.lastPlayedAt).toLocaleDateString('id-ID')}</span>
                            </div>
                          </div>
                          <ArrowUpRight size={14} className="text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-zinc-500 text-xs font-mono border border-dashed border-white/5 rounded-xl bg-[#080b12] flex-1 flex items-center justify-center">
                    Belum ada riwayat game.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: MASTERY (GAME HIGH SCORES) */}
        {activeTab === 'mastery' && (
          <div className="bg-[#0f1322] border border-white/[0.04] p-5 sm:p-6 rounded-3xl space-y-4 shadow-sm">
            <div>
              <h3 className="font-display font-black text-sm text-zinc-200 tracking-wide uppercase">Rekor Terbaik Setiap Game</h3>
              <p className="text-[10px] text-zinc-500 font-mono">DENGAN PLAY COUNTS DAN SKOR TERTINGGI</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {games.map((g) => (
                <div 
                  key={g.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] hover:border-white/10 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl p-1.5 bg-white/[0.02] border border-white/[0.05] rounded-xl shrink-0">{g.icon}</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-white truncate uppercase tracking-wide font-sans">{g.title}</h4>
                      <p className="text-[10px] text-zinc-500 font-mono">{g.plays} kali dimainkan</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-black font-mono text-amber-400">
                      {g.highScore.toLocaleString()}
                    </span>
                    <p className="text-[9px] font-mono text-zinc-500 uppercase font-black">REKOR</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: ACHIEVEMENTS */}
        {activeTab === 'achievements' && (
          <div className="bg-[#0f1322] border border-white/[0.04] p-5 sm:p-6 rounded-3xl space-y-4 shadow-sm">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="font-display font-black text-sm text-zinc-200 tracking-wide uppercase">Koleksi Pencapaian Prestasi</h3>
                <p className="text-[10px] text-zinc-500 font-mono">KLAIM BONUS KOIN DENGAN MENYELESAIKAN MISI BERIKUT</p>
              </div>
              <span className="font-mono text-[10px] text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 font-black">
                {achievementUnlocks.unlocked} / {achievementUnlocks.total} TERBUKA ({achievementUnlocks.percent}%)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {achievements.map((achievement) => (
                <div 
                  key={achievement.id}
                  className={`p-3.5 rounded-2xl border flex items-center gap-3.5 transition-all duration-200 ${
                    achievement.unlocked
                      ? 'bg-white/[0.02] border-indigo-500/20'
                      : 'bg-zinc-950/40 border-white/[0.04] opacity-50'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl border shrink-0 ${
                    achievement.unlocked
                      ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                      : 'bg-zinc-900 border-white/5 text-zinc-600'
                  }`}>
                    {achievement.unlocked ? achievement.icon : '🔒'}
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className={`text-xs font-black truncate uppercase tracking-wider ${achievement.unlocked ? 'text-white' : 'text-zinc-500'}`}>
                        {achievement.title}
                      </h4>
                      {achievement.unlocked && (
                        <span className="text-emerald-400 shrink-0">
                          <Check size={12} className="stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed font-sans">
                      {achievement.description}
                    </p>
                    <span className="text-[10px] font-mono text-amber-500 block">Reward: 🪙 {achievement.rewardCoins}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: FRIENDS */}
        {activeTab === 'friends' && (
          <div className="bg-[#0f1322] border border-white/[0.04] rounded-3xl overflow-hidden shadow-sm flex flex-col lg:flex-row">
            {/* Side options */}
            <div className="border-b lg:border-b-0 lg:border-r border-white/[0.04] p-4 lg:w-48 bg-[#0b0d16] flex lg:flex-col gap-1 overflow-x-auto shrink-0">
              <button
                onClick={() => { audio.playHit(); setFriendsTab('list'); }}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  friendsTab === 'list' ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Users size={13} /> Teman ({friends.filter(f => f.status === 'FRIENDS').length})
              </button>
              <button
                onClick={() => { audio.playHit(); setFriendsTab('requests'); }}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer shrink-0 relative ${
                  friendsTab === 'requests' ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <UserPlus size={13} /> Permintaan
                {friends.filter(f => f.status === 'PENDING_RECEIVED').length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse absolute right-2"></span>
                )}
              </button>
              <button
                onClick={() => { audio.playHit(); setFriendsTab('activity'); }}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  friendsTab === 'activity' ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Activity size={13} /> Feed Aktivitas
              </button>
              <button
                onClick={() => { audio.playHit(); setFriendsTab('privacy'); }}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  friendsTab === 'privacy' ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Lock size={13} /> Privasi
              </button>
            </div>

            {/* Friend Content Panel */}
            <div className="p-5 flex-1 space-y-4">
              {friendsTab === 'list' && (
                <div className="space-y-4">
                  {/* Add Friend Row */}
                  <form onSubmit={handleSendFriendRequest} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        value={friendSearchName}
                        onChange={(e) => setFriendSearchName(e.target.value)}
                        placeholder="Masukkan username teman (contoh: RETRO_DEV)..."
                        className="w-full pl-9 pr-3 py-2 bg-[#151a2a] border border-white/[0.05] rounded-xl text-xs text-white uppercase font-mono placeholder:normal-case placeholder:text-zinc-600 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <UserPlus size={14} /> Tambah
                    </button>
                  </form>

                  {friendStatusMsg && (
                    <div className={`p-3 rounded-xl text-xs font-mono ${friendStatusMsg.isError ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {friendStatusMsg.text}
                    </div>
                  )}

                  {/* Real Friends grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {friends.filter(f => f.status === 'FRIENDS').length > 0 ? (
                      friends.filter(f => f.status === 'FRIENDS').map((friend) => (
                        <div
                          key={friend.uid}
                          className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.04] hover:border-zinc-700 transition flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <span className="text-2xl p-1.5 bg-zinc-900 border border-zinc-800 rounded-xl block">
                                {friend.avatar}
                              </span>
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${
                                friend.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
                              }`} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-white uppercase truncate">{friend.name}</span>
                                {friend.masteryTitle && (
                                  <span className="text-[8px] font-mono px-1 py-0.2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
                                    {friend.masteryTitle}
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] font-mono text-zinc-500 mt-0.5 truncate">
                                {friend.isOnline ? <span className="text-emerald-400 font-bold">Online</span> : <span>Offline</span>}
                                {friend.highestScoreGame && ` • Best: ${friend.highestScoreGame.score}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleRemoveFriend(friend.uid)}
                              title="Hapus Teman"
                              className="p-1.5 rounded bg-white/[0.02] hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              onClick={() => handleBlockUser(friend.uid)}
                              title="Blokir User"
                              className="p-1.5 rounded bg-white/[0.02] hover:bg-amber-500/10 text-zinc-500 hover:text-amber-400 transition cursor-pointer"
                            >
                              <Ban size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-8 text-zinc-500 text-xs italic bg-white/[0.01] rounded-2xl border border-white/[0.04] p-4">
                        Daftar teman kosong. Cari teman siber dengan memasukkan username mereka di atas!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {friendsTab === 'requests' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase mb-2">Permintaan Masuk ({friends.filter(f => f.status === 'PENDING_RECEIVED').length})</h4>
                    {friends.filter(f => f.status === 'PENDING_RECEIVED').length > 0 ? (
                      <div className="space-y-2">
                        {friends.filter(f => f.status === 'PENDING_RECEIVED').map((req) => (
                          <div key={req.uid} className="p-3 rounded-2xl bg-zinc-950 border border-white/[0.04] flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl">{req.avatar}</span>
                              <div>
                                <div className="text-xs font-bold text-white uppercase">{req.name}</div>
                                <div className="text-[10px] text-zinc-500 font-mono">Mengajak berteman</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleAcceptFriend(req.uid)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                              >
                                <Check size={12} /> Terima
                              </button>
                              <button
                                onClick={() => handleRejectFriend(req.uid)}
                                className="px-2.5 py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-400 text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                              >
                                <X size={12} /> Tolak
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 italic font-mono">Tidak ada permintaan masuk.</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/[0.04]">
                    <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase mb-2">Permintaan Terkirim ({friends.filter(f => f.status === 'PENDING_SENT').length})</h4>
                    {friends.filter(f => f.status === 'PENDING_SENT').length > 0 ? (
                      <div className="space-y-2">
                        {friends.filter(f => f.status === 'PENDING_SENT').map((req) => (
                          <div key={req.uid} className="p-2.5 rounded-xl bg-white/[0.01] border border-white/[0.04] flex items-center justify-between text-xs">
                            <span className="text-zinc-300 font-bold uppercase">{req.name}</span>
                            <span className="text-[10px] font-mono text-amber-500">Menunggu verifikasi...</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 italic font-mono">Tidak ada permintaan dikirim.</p>
                    )}
                  </div>
                </div>
              )}

              {friendsTab === 'activity' && (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div key={act.id} className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.04] flex items-start gap-3">
                      <span className="text-2xl p-1 bg-zinc-900 rounded-lg">{act.userAvatar}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white uppercase">{act.userName}</span>
                          <span className="text-[10px] font-mono text-zinc-500">Baru saja</span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">{act.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {friendsTab === 'privacy' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold text-zinc-400 uppercase block">Siapa yang dapat mengirim permintaan teman?</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          audio.playCoin();
                          const updated = { ...privacy, allowFriendRequests: 'everyone' as any };
                          setPrivacy(updated);
                          socialService.savePrivacySettings(updated);
                        }}
                        className={`p-3 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          privacy.allowFriendRequests === 'everyone' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-zinc-800 text-zinc-400'
                        }`}
                      >
                        Semua Pemain
                      </button>
                      <button
                        onClick={() => {
                          audio.playCoin();
                          const updated = { ...privacy, allowFriendRequests: 'none' as any };
                          setPrivacy(updated);
                          socialService.savePrivacySettings(updated);
                        }}
                        className={`p-3 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          privacy.allowFriendRequests === 'none' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-zinc-800 text-zinc-400'
                        }`}
                      >
                        Tutup (Tidak Ada)
                      </button>
                    </div>
                  </div>

                  {friends.filter(f => f.status === 'BLOCKED').length > 0 && (
                    <div className="pt-4 border-t border-white/[0.04]">
                      <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase mb-2">Daftar Blokir ({friends.filter(f => f.status === 'BLOCKED').length})</h4>
                      <div className="space-y-2">
                        {friends.filter(f => f.status === 'BLOCKED').map(b => (
                          <div key={b.uid} className="p-2.5 rounded-xl bg-zinc-950 border border-white/[0.04] flex items-center justify-between text-xs">
                            <span className="text-zinc-400 uppercase font-bold">{b.name}</span>
                            <button
                              onClick={() => handleUnblockUser(b.uid)}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-mono font-bold cursor-pointer"
                            >
                              Batal Blokir
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: SETTINGS (AUDIO, CANVASES, GRAPHICS, AUTO-LOCK, SECURITY) */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Col - Configs */}
            <div className="lg:col-span-7 space-y-6">
              {/* Audio panel */}
              <div className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-indigo-400" /> Sintesis Audio
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-zinc-200 uppercase tracking-wide block">Bungkam Semua Suara</span>
                      <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">Matikan audio synthesizer Web Audio API.</span>
                    </div>
                    <button
                      onClick={handleToggleMute}
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 cursor-pointer focus:outline-none ${
                        isMuted ? 'bg-zinc-800' : 'bg-indigo-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
                        isMuted ? 'translate-x-0' : 'translate-x-5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Video canvases panel */}
              <div className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-indigo-400" /> Ukuran Layar Canvas Game
                </h3>
                
                <div className="grid grid-cols-3 gap-2 bg-white/[0.01] border border-white/[0.04] rounded-xl p-1">
                  {(['standard', 'wide', 'theater'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => handleScreenSize(size)}
                      className={`py-2 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-1 cursor-pointer transition select-none ${
                        defaultScreenSize === size ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span>{size === 'standard' ? '📱' : size === 'wide' ? '💻' : '📺'}</span>
                      <span className="text-[10px] uppercase font-black">{size}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Graphics and performance */}
              <div className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" /> Grafis & FPS
                </h3>

                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] font-mono text-zinc-400 uppercase block mb-1.5">Kualitas Efek (Fidelity)</span>
                    <div className="grid grid-cols-3 gap-2 bg-white/[0.01] border border-white/[0.04] rounded-xl p-1">
                      {(['low', 'medium', 'high'] as const).map((q) => (
                        <button
                          key={q}
                          onClick={() => handleGraphicsChange(q)}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer transition select-none ${
                            graphicsQuality === q ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          <span className="text-[10px] uppercase font-black">{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-mono text-zinc-400 uppercase block mb-1.5">Batas Frame Rate (FPS)</span>
                    <div className="grid grid-cols-4 gap-1.5 bg-white/[0.01] border border-white/[0.04] rounded-xl p-1">
                      {(['30', '60', '120', 'auto'] as const).map((limit) => (
                        <button
                          key={limit}
                          onClick={() => handleFpsChange(limit)}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center cursor-pointer transition select-none ${
                            fpsLimit === limit ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          <span className="text-[10px] uppercase font-black">{limit}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto lock and back ups */}
              <div className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Integritas Sesi & Backup
                </h3>

                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] font-mono text-zinc-400 uppercase block mb-1.5">Sesi Kunci Otomatis (Auto-Lock)</span>
                    <div className="grid grid-cols-4 gap-1.5 bg-white/[0.01] border border-white/[0.04] rounded-xl p-1">
                      {([
                        { value: 'off', label: 'OFF' },
                        { value: '1', label: '1M' },
                        { value: '5', label: '5M' },
                        { value: '15', label: '15M' }
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            audio.playCoin();
                            setAutolockVal(opt.value);
                            localStorage.setItem('zigame_session_autolock', opt.value);
                            setSuccessMsg(`Auto-Lock disetel ke: ${opt.label}`);
                            setTimeout(() => setSuccessMsg(''), 2000);
                          }}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center cursor-pointer transition select-none ${
                            autolockVal === opt.value ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          <span className="text-[10px] font-black">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reset stats zone */}
              <div className="bg-[#0f1322] border border-rose-500/10 rounded-2xl p-5 space-y-3 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-rose-400 tracking-wider uppercase flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" /> Zona Berbahaya
                </h3>
                <div className="p-3 bg-rose-500/[0.02] border border-rose-500/10 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-xs font-bold text-rose-300 uppercase tracking-wide block">Reset Rekor & Skor</span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block font-normal">Kembalikan plays, koin, dan highscore Anda ke 0.</span>
                  </div>
                  {!showResetConfirm ? (
                    <button
                      onClick={() => { audio.playCoin(); setShowResetConfirm(true); }}
                      className="px-3.5 py-1.5 bg-white/[0.02] border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-mono font-bold tracking-wider cursor-pointer transition"
                    >
                      RESET DATA
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={triggerResetStats}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold cursor-pointer uppercase"
                      >
                        YA, RESET
                      </button>
                      <button
                        onClick={() => { audio.playCoin(); setShowResetConfirm(false); }}
                        className="px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-mono font-bold cursor-pointer uppercase"
                      >
                        BATAL
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Col - Customizer */}
            <div className="lg:col-span-5 space-y-6">
              {/* Profile Editor */}
              <div className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2">
                  <Smile className="w-4 h-4 text-indigo-400" /> Edit Profil Karakter
                </h3>

                <div className="space-y-4">
                  {/* Edit Display Name */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-black tracking-wider text-zinc-500 uppercase">Nama Karakter</label>
                    <input
                      type="text"
                      maxLength={14}
                      value={editorName}
                      onChange={(e) => setEditorName(e.target.value.toUpperCase())}
                      className="w-full bg-[#151a2a] border border-white/[0.05] focus:border-indigo-500 rounded-xl py-2 px-3 text-xs font-mono text-white outline-none transition uppercase"
                    />
                  </div>

                  {/* Edit Avatar Grid */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-black tracking-wider text-zinc-500 uppercase">Pilih Avatar</label>
                    <div className="flex flex-wrap gap-1.5 p-2 bg-[#151a2a] rounded-xl border border-white/[0.04]">
                      {avatars.map((av) => (
                        <button
                          key={av}
                          type="button"
                          onClick={() => { audio.playCoin(); setEditorAvatar(av); }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-base cursor-pointer transition select-none ${
                            editorAvatar === av ? 'bg-indigo-600 text-white' : 'bg-zinc-900 hover:bg-zinc-800'
                          }`}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Themes row */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono font-black tracking-wider text-zinc-500 uppercase">Warna Glow Tema</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {colors.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => { audio.playCoin(); setEditorColor(c.value); }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer border select-none transition ${
                            editorColor === c.value ? 'bg-white/[0.04] border-white/20 text-white' : 'bg-white/[0.01] border-transparent text-zinc-500'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.value }}></span>
                          <span className="truncate text-[9px] uppercase">{c.label.split(' ')[1]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSaveProfile(editorName, editorAvatar, editorColor)}
                    disabled={!editorName.trim()}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Save size={13} /> SIMPAN PROFIL
                  </button>
                </div>
              </div>

              {/* Info app card */}
              <div className="bg-[#0f1322] border border-white/[0.04] rounded-2xl p-5 space-y-3 shadow-sm font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                <h4 className="text-xs font-bold text-white mb-2 tracking-widest flex items-center gap-1.5"><Code2 size={13} className="text-indigo-400" /> Informasi Lobi</h4>
                <div className="flex justify-between border-b border-white/[0.03] pb-1.5">
                  <span>SISTEM ARKADE</span>
                  <span className="text-white font-black">ZIGAME V3.0-PRO</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.03] pb-1.5">
                  <span>SOUNDSYNTH ENGINE</span>
                  <span className="text-white font-black">WEB AUDIO API OSC</span>
                </div>
                <div className="flex justify-between">
                  <span>ARKADE STUDIO</span>
                  <span className="text-white font-black">BANDUNG RETROLAB</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: AUTHENTICATION (LOGIN / REGISTER FORM) */}
        {activeTab === 'auth' && !loggedInUser && (
          <div className="w-full max-w-lg mx-auto p-1.5">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0f1322] border border-white/[0.04] rounded-3xl p-6 sm:p-8 shadow-lg relative overflow-hidden"
            >
              {/* Glowing effects */}
              <div className="absolute -top-16 -left-16 w-32 h-32 rounded-full filter blur-[50px] opacity-10" style={{ backgroundColor: profile.colorTheme }}></div>
              <div className="absolute -bottom-16 -right-16 w-32 h-32 rounded-full filter blur-[50px] opacity-10" style={{ backgroundColor: profile.colorTheme }}></div>

              <div className="text-center mb-6 relative z-10">
                <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-[#080b12] border border-white/[0.04] mb-3 text-indigo-400 shadow-md">
                  {isRegistering ? <UserPlus size={24} /> : <LogIn size={24} />}
                </div>
                <h2 className="text-lg sm:text-xl font-display font-black tracking-wider text-white uppercase">
                  {isRegistering ? 'DAFTAR RETRO PEMAIN' : 'MASUK KE SYSTEM'}
                </h2>
                <p className="text-[10px] font-mono text-zinc-400 mt-1 uppercase tracking-widest">
                  Simpan rekor skor & saldo koin Anda di server lokal cloud
                </p>
              </div>

              {/* Status notifications inside Auth card */}
              {authError && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[11px] font-mono flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 text-rose-500" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] font-mono flex items-start gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {cooldownRemaining > 0 ? (
                <div className="p-6 text-center space-y-3 bg-rose-500/[0.02] border border-rose-500/20 rounded-2xl">
                  <span className="text-2xl block">🛡️</span>
                  <h3 className="text-xs font-mono font-black text-rose-400 uppercase tracking-widest">SISTEM DIKUNCI (ANTI BRUTE-FORCE)</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Formulir dikunci demi keamanan data Anda. Sisa waktu:</p>
                  <div className="text-3xl font-mono font-black text-rose-500">00:{cooldownRemaining.toString().padStart(2, '0')}</div>
                </div>
              ) : (
                <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4 relative z-10">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-black tracking-wider text-zinc-500 uppercase">Username (Huruf kecil & Angka)</label>
                    <div className="relative">
                      <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="contoh: zaki_neo"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className="w-full bg-[#151a2a] border border-white/[0.05] focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-3 text-xs font-mono text-white outline-none"
                      />
                    </div>
                  </div>

                  {isRegistering && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono font-black tracking-wider text-zinc-500 uppercase">Nama Karakter (Kapital)</label>
                      <div className="relative">
                        <Sparkles size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          maxLength={14}
                          placeholder="contoh: GALAXY KING"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value.toUpperCase())}
                          className="w-full bg-[#151a2a] border border-white/[0.05] focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-3 text-xs font-mono text-white outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-black tracking-wider text-zinc-500 uppercase">Password</label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#151a2a] border border-white/[0.05] focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-3 text-xs font-mono text-white outline-none"
                      />
                    </div>
                  </div>

                  {isRegistering && (
                    <div className="space-y-3 pt-1 border-t border-white/[0.03]">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono font-black text-zinc-500 uppercase">Pilih Avatar Karakter</label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-[#151a2a] rounded-xl border border-white/[0.05]">
                          {avatars.map((av) => (
                            <button
                              key={av}
                              type="button"
                              onClick={() => { audio.playCoin(); setSelectedAvatar(av); }}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-base cursor-pointer transition select-none ${
                                selectedAvatar === av ? 'bg-[#080b12] border border-indigo-500 text-indigo-400 scale-105 shadow-sm' : 'bg-zinc-900'
                              }`}
                            >
                              {av}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono font-black text-zinc-500 uppercase">Warna Glow Tema</label>
                        <div className="grid grid-cols-6 gap-1.5">
                          {colors.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => { audio.playCoin(); setSelectedColor(c.value); }}
                              className={`py-1.5 rounded-lg text-xs font-mono font-bold flex flex-col items-center gap-1 cursor-pointer border select-none transition ${
                                selectedColor === c.value ? 'bg-[#151a2a] border-white/20' : 'bg-[#151a2a]/30 border-transparent'
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: c.value }}></span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-mono font-bold uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-900/10"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : isRegistering ? (
                      <>
                        <UserPlus size={14} />
                        <span>Daftar Karakter</span>
                      </>
                    ) : (
                      <>
                        <LogIn size={14} />
                        <span>Masuk Sistem</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-[1px] bg-white/[0.04]"></div>
                    <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Atau</span>
                    <div className="flex-1 h-[1px] bg-white/[0.04]"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full py-2.5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.05] text-zinc-300 font-mono font-bold text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Globe size={13} className="text-cyan-400" />
                    <span>Google Login (Firebase)</span>
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => { audio.playCoin(); setIsRegistering(!isRegistering); setAuthError(''); setAuthSuccess(''); }}
                      className="text-[10px] font-mono text-zinc-500 hover:text-indigo-400 transition cursor-pointer uppercase tracking-widest"
                    >
                      {isRegistering ? 'Sudah punya akun? Masuk lobi' : 'Belum punya akun? Daftar gratis'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
