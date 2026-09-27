/**
 * Authoritative Mission & Challenge Generator & Definitions
 * ZiGame 2.0 Stabilization & Production Hardening
 * 
 * Strict single source of truth for:
 * - Daily Missions (target, type, gameId, rewardCoins, rewardXp, description)
 * - Daily Challenges (target, frequency, category, gameId, rewardCoins, rewardXp, description)
 * - Weekly Challenges (target, frequency, category, rewardCoins, rewardXp, description)
 * - Server UTC Date & Week Calculations
 */

import { DailyMission, Challenge, GameStats } from '../types';
import { CANONICAL_GAME_IDS, CanonicalGameId } from './canonicalGames';
import { CANONICAL_GAME_REGISTRY } from './gameRegistry';

// Calculate today's UTC Date string (YYYY-MM-DD)
export function getUtcTodayDateString(timestamp: number = Date.now()): string {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Calculate current UTC ISO Week string (YYYY-Www)
export function getUtcWeekString(timestamp: number = Date.now()): string {
  const date = new Date(timestamp);
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekFormatted = weekNo < 10 ? `0${weekNo}` : `${weekNo}`;
  return `${date.getUTCFullYear()}-W${weekFormatted}`;
}

// Small Fast PRNG (sfc32) for deterministic seeding
function sfc32(a: number, b: number, c: number, d: number) {
  return function() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
    let t = (a + b) | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

function createDateSeed(dateStr: string): () => number {
  let seedNum = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seedNum += dateStr.charCodeAt(i) * Math.pow(10, i % 3);
  }
  return sfc32(seedNum, seedNum * 2, seedNum * 3, 1);
}

function createWeekSeed(weekStr: string): () => number {
  let seedNum = 0;
  for (let i = 0; i < weekStr.length; i++) {
    seedNum += weekStr.charCodeAt(i) * Math.pow(10, i % 3);
  }
  return sfc32(seedNum * 3, seedNum * 5, seedNum * 7, 2);
}

export interface AuthoritativeDailyMissionDef extends DailyMission {
  rewardXp: number;
}

/**
 * Generates the authoritative 3 daily missions for a given UTC date string.
 */
export function getAuthoritativeDailyMissions(dateStr?: string, customGames?: GameStats[]): AuthoritativeDailyMissionDef[] {
  const date = dateStr || getUtcTodayDateString();
  const rand = createDateSeed(date);

  const availableGames: { id: CanonicalGameId; title: string; genre: string }[] = customGames && customGames.length > 0
    ? customGames.map(g => ({ id: g.id as CanonicalGameId, title: g.title, genre: g.genre || 'Arcade' }))
    : CANONICAL_GAME_IDS.map(id => ({
        id,
        title: CANONICAL_GAME_REGISTRY[id]?.title || id,
        genre: CANONICAL_GAME_REGISTRY[id]?.genre || 'Arcade'
      }));

  const missions: AuthoritativeDailyMissionDef[] = [];

  // Mission 1: Specific Game Score Target
  const gameIdx = Math.floor(rand() * availableGames.length);
  const selectedGame = availableGames[gameIdx];
  // Target score scaled reasonably per game
  const targetScore = selectedGame.id === 'snake' ? 30
    : selectedGame.id === 'flappy-pixel' ? 15
    : selectedGame.id === 'memory-grid' ? 80
    : selectedGame.id === 'cyber-mines' ? 60
    : 100;

  missions.push({
    id: `m_${date}_1`,
    type: 'score_target',
    target: targetScore,
    progress: 0,
    rewardCoins: 100,
    rewardXp: 150,
    completed: false,
    gameId: selectedGame.id,
    description: `Raih skor minimal ${targetScore} di game ${selectedGame.title}`,
    date
  });

  // Mission 2: Engagement (Beat PB, Total Score, or Multigenre)
  const mission2Types: Array<'beat_pb' | 'total_score' | 'play_genre_count'> = ['beat_pb', 'total_score', 'play_genre_count'];
  const m2Type = mission2Types[Math.floor(rand() * mission2Types.length)];

  if (m2Type === 'beat_pb') {
    missions.push({
      id: `m_${date}_2`,
      type: 'beat_pb',
      target: 1,
      progress: 0,
      rewardCoins: 120,
      rewardXp: 180,
      completed: false,
      description: 'Pecahkan Rekor (PB) di game mana saja hari ini',
      date
    });
  } else if (m2Type === 'total_score') {
    const totalScoreTarget = 300;
    missions.push({
      id: `m_${date}_2`,
      type: 'total_score',
      target: totalScoreTarget,
      progress: 0,
      rewardCoins: 120,
      rewardXp: 180,
      completed: false,
      description: `Kumpulkan total akumulasi skor ${totalScoreTarget} hari ini di semua game`,
      date
    });
  } else {
    missions.push({
      id: `m_${date}_2`,
      type: 'play_genre_count',
      target: 2,
      progress: 0,
      rewardCoins: 120,
      rewardXp: 180,
      completed: false,
      description: 'Mainkan 2 genre game yang berbeda hari ini',
      metadata: { genresPlayed: [] },
      date
    });
  }

  // Mission 3: Consistency & Plays
  missions.push({
    id: `m_${date}_3`,
    type: 'play_count',
    target: 3,
    progress: 0,
    rewardCoins: 80,
    rewardXp: 100,
    completed: false,
    description: 'Mainkan 3 sesi permainan game yang valid hari ini',
    date
  });

  return missions;
}

/**
 * Generates the authoritative 3 daily challenges for a given UTC date string.
 */
export function getAuthoritativeDailyChallenges(dateStr?: string, customGames?: GameStats[]): Challenge[] {
  const date = dateStr || getUtcTodayDateString();
  const rand = createDateSeed(`chal_${date}`);

  const availableGames = customGames && customGames.length > 0
    ? customGames
    : CANONICAL_GAME_IDS.map(id => ({
        id,
        title: CANONICAL_GAME_REGISTRY[id]?.title || id,
        genre: CANONICAL_GAME_REGISTRY[id]?.genre || 'Arcade'
      }));


  const game1 = availableGames[Math.floor(rand() * availableGames.length)];
  const game2 = availableGames[(Math.floor(rand() * availableGames.length) + 1) % availableGames.length];

  return [
    {
      id: `daily_${date}_1`,
      title: `Skor Target: ${game1.title}`,
      description: `Raih minimal 50 poin dalam satu sesi di ${game1.title}`,
      frequency: 'daily',
      category: 'score',
      target: 50,
      progress: 0,
      completed: false,
      claimed: false,
      rewardCoins: 80,
      rewardXp: 120,
      gameId: game1.id,
      expiryDate: date,
      icon: '🎯'
    },
    {
      id: `daily_${date}_2`,
      title: 'Eksplorasi Multigenre',
      description: 'Mainkan minimal 2 genre game yang berbeda hari ini',
      frequency: 'daily',
      category: 'genre',
      target: 2,
      progress: 0,
      completed: false,
      claimed: false,
      rewardCoins: 75,
      rewardXp: 100,
      expiryDate: date,
      icon: '🌐'
    },
    {
      id: `daily_${date}_3`,
      title: `Tantangan Refleks: ${game2.title}`,
      description: `Selesaikan sesi tanpa menyerah di ${game2.title}`,
      frequency: 'daily',
      category: 'featured',
      target: 1,
      progress: 0,
      completed: false,
      claimed: false,
      rewardCoins: 60,
      rewardXp: 90,
      gameId: game2.id,
      expiryDate: date,
      icon: '⚡'
    }
  ];
}

/**
 * Generates the authoritative 3 weekly challenges for a given UTC ISO week string.
 */
export function getAuthoritativeWeeklyChallenges(weekStr?: string): Challenge[] {
  const week = weekStr || getUtcWeekString();

  return [
    {
      id: `weekly_${week}_1`,
      title: 'Pemecah Rekor Mingguan',
      description: 'Pecahkan 2 rekor skor tertinggi (Personal Best) di game apa pun',
      frequency: 'weekly',
      category: 'personal_best',
      target: 2,
      progress: 0,
      completed: false,
      claimed: false,
      rewardCoins: 250,
      rewardXp: 400,
      expiryDate: week,
      icon: '🏆'
    },
    {
      id: `weekly_${week}_2`,
      title: 'Maraton Arcade',
      description: 'Mainkan total 5 sesi permainan game apa pun minggu ini',
      frequency: 'weekly',
      category: 'endurance',
      target: 5,
      progress: 0,
      completed: false,
      claimed: false,
      rewardCoins: 200,
      rewardXp: 350,
      expiryDate: week,
      icon: '🔥'
    },
    {
      id: `weekly_${week}_3`,
      title: 'Kolektor Skor Akbar',
      description: 'Kumpulkan akumulasi total 500 poin di berbagai game minggu ini',
      frequency: 'weekly',
      category: 'score',
      target: 500,
      progress: 0,
      completed: false,
      claimed: false,
      rewardCoins: 300,
      rewardXp: 500,
      expiryDate: week,
      icon: '💎'
    }
  ];
}
