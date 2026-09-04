import { Achievement } from '../types';

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'snake_glutton',
    title: 'ULAR RAKUS',
    description: 'Capai skor 20 atau lebih dalam permainan Pixel Snake.',
    gameId: 'snake',
    unlocked: false,
    icon: '🍏',
    rewardCoins: 50,
    target: 20
  },
  {
    id: 'snake_turbo',
    title: 'PENGENDARA BADAI',
    description: 'Capai skor 40 atau lebih dalam permainan Pixel Snake.',
    gameId: 'snake',
    unlocked: false,
    icon: '⚡',
    rewardCoins: 100,
    target: 40
  },
  {
    id: 'brick_demolisher',
    title: 'PENGHANCUR BALOK',
    description: 'Raih skor 150 atau lebih dalam permainan Brick Neon.',
    gameId: 'brick',
    unlocked: false,
    icon: '💥',
    rewardCoins: 80,
    target: 150
  },
  {
    id: 'flappy_pilot',
    title: 'PILOT PRO',
    description: 'Raih skor 10 atau lebih dalam permainan Flappy Pixel.',
    gameId: 'flappy',
    unlocked: false,
    icon: '✈️',
    rewardCoins: 60,
    target: 10
  },
  {
    id: 'flappy_god',
    title: 'PENDEKAR NEON',
    description: 'Raih skor 25 atau lebih dalam permainan Flappy Pixel.',
    gameId: 'flappy',
    unlocked: false,
    icon: '🏆',
    rewardCoins: 120,
    target: 25
  },
  {
    id: 'space_champion',
    title: 'DEFENDER GALAKSI',
    description: 'Raih skor 150 atau lebih dalam permainan Space Defender.',
    gameId: 'space',
    unlocked: false,
    icon: '🌌',
    rewardCoins: 80,
    target: 150
  },
  {
    id: 'space_god',
    title: 'DEWA ANGKASA',
    description: 'Bertahan dari serangan luar angkasa dengan skor ekstrem.',
    gameId: 'space',
    unlocked: false,
    icon: '🛸',
    rewardCoins: 200,
    target: 500,
    secret: true
  },
  {
    id: 'memory_master',
    title: 'INGATAN CYBER',
    description: 'Selesaikan Memory Grid dengan skor 100 atau lebih.',
    gameId: 'memory',
    unlocked: false,
    icon: '🌀',
    rewardCoins: 75,
    target: 100
  },
  {
    id: 'memory_god',
    title: 'KONEKSI NEURAL SEJATI',
    description: 'Selesaikan Memory Grid dengan ingatan absolut.',
    gameId: 'memory',
    unlocked: false,
    icon: '🧠',
    rewardCoins: 300,
    target: 300,
    secret: true
  }
];
