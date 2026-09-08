import { Achievement } from '../types';

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  // --- Beginner Achievements (Easy, General) ---
  {
    id: 'first_blood',
    title: 'AWAL PERJALANAN',
    description: 'Mainkan permainan pertamamu di ZiGame.',
    gameId: 'all',
    unlocked: false,
    icon: '🎮',
    rewardCoins: 50,
    target: 1,
    tier: 'Beginner'
  },
  {
    id: 'first_high_score',
    title: 'PEMANASAN MESIN',
    description: 'Cetak Personal Best (PB) pertamamu di game apapun.',
    gameId: 'all',
    unlocked: false,
    icon: '🔥',
    rewardCoins: 50,
    target: 1,
    tier: 'Beginner'
  },
  {
    id: 'genre_explorer',
    title: 'PENJELAJAH GENRE',
    description: 'Mainkan 3 genre berbeda di katalog game.',
    gameId: 'all',
    unlocked: false,
    icon: '🧭',
    rewardCoins: 100,
    target: 3,
    tier: 'Beginner'
  },
  
  // --- Skill / Mastery (Specific Games) ---
  // Neon Heist (Action/Stealth)
  {
    id: 'heist_ghost',
    title: 'HANTU DIGITAL',
    description: 'Selesaikan 3 stage berturut-turut tanpa memicu alarm di Neon Heist.',
    gameId: 'neon-heist',
    unlocked: false,
    icon: '👻',
    rewardCoins: 150,
    target: 3,
    tier: 'Skill'
  },
  {
    id: 'heist_master',
    title: 'PENCURI ULUNG',
    description: 'Raih skor 30,000 dengan bonus All-Intel di Neon Heist.',
    gameId: 'neon-heist',
    unlocked: false,
    icon: '💎',
    rewardCoins: 250,
    target: 30000,
    tier: 'Mastery'
  },

  // Void Survivor (Survival)
  {
    id: 'void_survivor_5m',
    title: 'TAHAN BANTING',
    description: 'Bertahan selama 5 menit penuh di Void Survivor.',
    gameId: 'void-survivor',
    unlocked: false,
    icon: '⏱️',
    rewardCoins: 100,
    target: 300, // seconds
    tier: 'Skill'
  },
  {
    id: 'void_boss_killer',
    title: 'PEMBUNUH RAKSASA',
    description: 'Kalahkan boss pertama di Void Survivor.',
    gameId: 'void-survivor',
    unlocked: false,
    icon: '⚔️',
    rewardCoins: 200,
    target: 1,
    tier: 'Mastery'
  },

  // Gravity Shift (Platformer/Puzzle)
  {
    id: 'gravity_flawless',
    title: 'BEBAS GRAVITASI',
    description: 'Selesaikan 5 stage di Gravity Shift tanpa mati sekalipun.',
    gameId: 'gravity-shift',
    unlocked: false,
    icon: '🌌',
    rewardCoins: 150,
    target: 5,
    tier: 'Skill'
  },
  
  // Orbital Defense (Tower Defense)
  {
    id: 'orbital_perfect',
    title: 'PERTAHANAN MUTLAK',
    description: 'Selesaikan Wave 10 tanpa Core terkena damage sama sekali di Orbital Defense.',
    gameId: 'orbital-defense',
    unlocked: false,
    icon: '🛡️',
    rewardCoins: 250,
    target: 10,
    tier: 'Mastery'
  },
  
  // Cyber Tetris (Puzzle)
  {
    id: 'tetris_first',
    title: 'BARIS KEJAYAAN',
    description: 'Cetak "Tetris" (4 baris sekaligus) pertamamu.',
    gameId: 'cyber-tetris',
    unlocked: false,
    icon: '🧱',
    rewardCoins: 100,
    target: 1,
    tier: 'Skill'
  },
  {
    id: 'tetris_combo',
    title: 'AHLI RANTAI',
    description: 'Cetak 5-Combo beruntun di Cyber Tetris.',
    gameId: 'cyber-tetris',
    unlocked: false,
    icon: '🔗',
    rewardCoins: 200,
    target: 5,
    tier: 'Mastery'
  },
  
  // --- Secret Achievements ---
  {
    id: 'secret_pacifist',
    title: 'PACIFIST',
    description: 'Bertahan 2 menit di Space Defender tanpa menembak sekalipun.',
    gameId: 'space-defender',
    unlocked: false,
    icon: '🕊️',
    rewardCoins: 500,
    target: 120, // seconds
    tier: 'Secret',
    secret: true
  },
  {
    id: 'secret_overkill',
    title: 'OVERKILL',
    description: 'Beri lebih dari 10,000 damage ke satu musuh kecil.',
    gameId: 'all',
    unlocked: false,
    icon: '💥',
    rewardCoins: 300,
    target: 10000,
    tier: 'Secret',
    secret: true
  }
];
