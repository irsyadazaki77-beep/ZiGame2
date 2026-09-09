import { lazy, type ComponentType } from 'react';
import { GameComponentProps, TouchControlsType, InputSource } from '../types';
import { CanonicalGameId, GAME_ID_ALIAS_MAP, toCanonicalGameId } from './canonicalGames';

export type GameLayoutType = 'square' | 'portrait' | 'landscape';
export type GameControlType = TouchControlsType;

export interface GameRegistryItem {
  id: CanonicalGameId;
  title: string;
  description: string;
  genre: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  thumbnail: string;
  layout: GameLayoutType;
  component: React.LazyExoticComponent<ComponentType<GameComponentProps>>;
  themeColor: string;
  accentShadow: string;
  icon: string;
  controls: string;
  controlType?: GameControlType;
  supportedInputs?: InputSource[];
  avgDuration: string;
}

export const CANONICAL_GAME_REGISTRY: Record<CanonicalGameId, GameRegistryItem> = {
  'snake': {
    id: 'snake',
    title: 'Pixel Snake',
    description: 'Game ular klasik yang dirombak dengan power-up kecepatan turbo dan neon apple yang bersinar.',
    genre: 'Classic',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/SnakeGame')),
    themeColor: '#22c55e',
    accentShadow: 'shadow-[0_0_15px_rgba(34,197,94,0.15)]',
    icon: '🐍',
    controls: 'Arrows / WASD',
    controlType: 'dpad',
    supportedInputs: ['keyboard', 'touch', 'gamepad'],
    avgDuration: '2-5 mins'
  },
  'brick-breaker': {
    id: 'brick-breaker',
    title: 'Brick Neon',
    description: 'Hancurkan formasi balok neon dengan pantulan bola berkecepatan tinggi dan kumpulan power-up spektakuler.',
    genre: 'Arcade',
    difficulty: 'Easy',
    thumbnail: 'https://images.unsplash.com/photo-1595829830861-b54fc126b8b6?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/BrickBreakerGame')),
    themeColor: '#ec4899',
    accentShadow: 'shadow-[0_0_15px_rgba(236,72,153,0.15)]',
    icon: '🧱',
    controls: 'Mouse / Touch',
    controlType: 'leftright',
    supportedInputs: ['keyboard', 'touch', 'mouse'],
    avgDuration: '3-10 mins'
  },
  'flappy-pixel': {
    id: 'flappy-pixel',
    title: 'Flappy Pixel',
    description: 'Kepakkan sayap melewati rintangan pipa bercahaya dan kumpulkan koin emas misterius di kota neon.',
    genre: 'Endless',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?auto=format&fit=crop&w=600&q=80',
    layout: 'portrait',
    component: lazy(() => import('../components/games/FlappyPixelGame')),
    themeColor: '#eab308',
    accentShadow: 'shadow-[0_0_15px_rgba(234,179,8,0.15)]',
    icon: '🐦',
    controls: 'Space / Tap',
    controlType: 'actiononly',
    supportedInputs: ['keyboard', 'touch', 'mouse', 'gamepad'],
    avgDuration: '1-2 mins'
  },
  'space-defender': {
    id: 'space-defender',
    title: 'Space Defender',
    description: 'Pertahankan galaksi dengan menembak jatuh gelombang kapal penyerang alien menggunakan meriam laser plasma.',
    genre: 'Shooter',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/SpaceDefenderGame')),
    themeColor: '#6366f1',
    accentShadow: 'shadow-[0_0_15px_rgba(99,102,241,0.15)]',
    icon: '🚀',
    controls: 'Arrows + Space',
    controlType: 'dpad',
    supportedInputs: ['keyboard', 'touch', 'gamepad'],
    avgDuration: '2-5 mins'
  },
  'memory-grid': {
    id: 'memory-grid',
    title: 'Memory Grid',
    description: 'Uji daya ingat Anda untuk mencocokkan pasangan kartu retro sebelum sisa waktu Anda habis.',
    genre: 'Puzzle',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/MemoryGridGame')),
    themeColor: '#a855f7',
    accentShadow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
    icon: '🧠',
    controls: 'Mouse / Touch',
    avgDuration: '2-5 mins'
  },
  'cyber-runner': {
    id: 'cyber-runner',
    title: 'Cyber Runner',
    description: 'Berlari tanpa henti melompati duri laser dan menunduk menghindari drone patroli kota cyberpunk.',
    genre: 'Action',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/CyberRunnerGame')),
    themeColor: '#f97316',
    accentShadow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]',
    icon: '🏃‍♂️',
    controls: 'Arrows / Swipe',
    avgDuration: '2-4 mins'
  },
  'neon-pong': {
    id: 'neon-pong',
    title: 'Neon Pong',
    description: 'Uji refleks kilat Anda dalam permainan pingpong arcade klasik melawan kecerdasan bot AI yang taktis.',
    genre: 'Arcade',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1611996575749-79a3a250f948?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/NeonPongGame')),
    themeColor: '#3b82f6',
    accentShadow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]',
    icon: '🏓',
    controls: 'Arrows / WASD',
    avgDuration: '2-5 mins'
  },
  'neon-stacker': {
    id: 'neon-stacker',
    title: 'Neon Stacker',
    description: 'Tumpuk balok bergerak tepat di atas satu sama lain setinggi mungkin tanpa menjatuhkan bagian tepi.',
    genre: 'Arcade',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
    layout: 'portrait',
    component: lazy(() => import('../components/games/NeonStackerGame')),
    themeColor: '#f43f5e',
    accentShadow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]',
    icon: '🧱',
    controls: 'Arrows / WASD',
    avgDuration: '2-5 mins'
  },
  'vaporwave-racer': {
    id: 'vaporwave-racer',
    title: 'Vaporwave Racer',
    description: 'Nyetir mobil neon sport menghindari tabrakan lalu lintas di jalan raya cyber bertema vaporwave outrun.',
    genre: 'Action',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1515248137880-45e105b710e0?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/VaporwaveRacerGame')),
    themeColor: '#d946ef',
    accentShadow: 'shadow-[0_0_15px_rgba(217,70,239,0.15)]',
    icon: '🏎️',
    controls: 'Arrows / Swipe',
    avgDuration: '2-4 mins'
  },
  'lock-breaker': {
    id: 'lock-breaker',
    title: 'Neon Lock Breaker',
    description: 'Ketuk tepat waktu saat indikator berputar tumpang tindih dengan bulatan gembok untuk memecahkan sandi.',
    genre: 'Arcade',
    difficulty: 'Easy',
    thumbnail: 'https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/LockBreakerGame')),
    themeColor: '#f59e0b',
    accentShadow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    icon: '🔐',
    controls: 'Mouse / Touch',
    avgDuration: '3-10 mins'
  },
  'sine-rider': {
    id: 'sine-rider',
    title: 'Sine Rider',
    description: 'Mengapung mengendalikan gelombang sinus melewati celah laser berbahaya dengan fisika halus.',
    genre: 'Arcade',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/SineRiderGame')),
    themeColor: '#06b6d4',
    accentShadow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    icon: '🏄‍♂️',
    controls: 'Arrows / WASD',
    avgDuration: '2-5 mins'
  },
  'cosmic-dodge': {
    id: 'cosmic-dodge',
    title: 'Cosmic Dodge',
    description: 'Geser kapal luar angkasa Anda untuk mengumpulkan bintang jatuh sambil menghindari badai asteroid merah.',
    genre: 'Action',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/CosmicDodgeGame')),
    themeColor: '#10b981',
    accentShadow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    icon: '✨',
    controls: 'Arrows / Swipe',
    avgDuration: '2-4 mins'
  },
  'laser-grid': {
    id: 'laser-grid',
    title: 'Laser Grid Survival',
    description: 'Melompat antar petak grid 3x3 untuk menghindari barisan laser merah mematikan yang menyala bergantian.',
    genre: 'Arcade',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/LaserGridGame')),
    themeColor: '#ef4444',
    accentShadow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
    icon: '⚡',
    controls: 'Arrows / WASD',
    avgDuration: '2-5 mins'
  },
  'cyber-simon': {
    id: 'cyber-simon',
    title: 'Cyber Simon Says',
    description: 'Hafalkan dan ulangi urutan kedipan lampu neon dengan ketepatan memori kognitif Anda.',
    genre: 'Puzzle',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/CyberSimonGame')),
    themeColor: '#a855f7',
    accentShadow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
    icon: '🧠',
    controls: 'Mouse / Touch',
    avgDuration: '2-5 mins'
  },
  'plinko-neo': {
    id: 'plinko-neo',
    title: 'Plinko Neo Arcade',
    description: 'Jatuhkan bola neon melompati ratusan pasak untuk memantul ke saku pengali skor tertinggi.',
    genre: 'Arcade',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1606167668584-78701c57f13d?auto=format&fit=crop&w=600&q=80',
    layout: 'portrait',
    component: lazy(() => import('../components/games/PlinkoNeoGame')),
    themeColor: '#f59e0b',
    accentShadow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    icon: '🎰',
    controls: 'Mouse / Touch',
    avgDuration: '1-3 mins'
  },
  'cosmic-asteroid': {
    id: 'cosmic-asteroid',
    title: 'Cosmic Asteroid Smasher',
    description: 'Kemudikan pesawat jelajah ruang angkasa dan hancurkan batuan asteroid raksasa yang melayang di gravitasi nol.',
    genre: 'Shooter',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/CosmicAsteroidGame')),
    themeColor: '#06b6d4',
    accentShadow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    icon: '☄️',
    controls: 'WASD + Space',
    avgDuration: '2-5 mins'
  },
  'cyber-slasher': {
    id: 'cyber-slasher',
    title: 'Cyber Slasher Ninja',
    description: 'Tebas data orb yang melayang di udara dengan pedang plasma presisi tinggi sebelum jatuh ke jurang siber.',
    genre: 'Action',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/CyberSlasherGame')),
    themeColor: '#10b981',
    accentShadow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    icon: '⚔️',
    controls: 'Mouse Drag / Swipe',
    avgDuration: '2-4 mins'
  },
  'cyber-clicker': {
    id: 'cyber-clicker',
    title: 'Cyber Core Clicker',
    description: 'Kumpulkan sumber daya energi nukleus siber dan beli bot penambang otomatis untuk membangun imperium masa depan.',
    genre: 'Idle / Clicker',
    difficulty: 'Easy',
    thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
    layout: 'portrait',
    component: lazy(() => import('../components/games/CyberClickerGame')),
    themeColor: '#6366f1',
    accentShadow: 'shadow-[0_0_15px_rgba(99,102,241,0.15)]',
    icon: '⚡',
    controls: 'Mouse Click / Tap',
    avgDuration: '5-20 mins'
  },
  'block-match': {
    id: 'block-match',
    title: 'Neon Block Match-3',
    description: 'Tukar dan cocokkan 3 atau lebih permata kristal neon untuk memicu reaksi berantai ledakan kombo spektakuler.',
    genre: 'Puzzle',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/BlockMatchGame')),
    themeColor: '#ec4899',
    accentShadow: 'shadow-[0_0_15px_rgba(236,72,153,0.15)]',
    icon: '💎',
    controls: 'Mouse Click / Touch',
    avgDuration: '3-8 mins'
  },
  'cyber-typer': {
    id: 'cyber-typer',
    title: 'Cyber Typer Speedster',
    description: 'Ketik kata-kata kode sandi peretas sebelum kata tersebut menghujani batas sistem dan menembus firewall Anda.',
    genre: 'Educational',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/CyberTyperGame')),
    themeColor: '#22c55e',
    accentShadow: 'shadow-[0_0_15px_rgba(34,197,94,0.15)]',
    icon: '⌨️',
    controls: 'Keyboard Only',
    avgDuration: '2-5 mins'
  },
  'maze-runner': {
    id: 'maze-runner',
    title: 'Neon Maze Explorer',
    description: 'Temukan jalan keluar tercepat dari labirin siber bercahaya dalam batas waktu yang sangat terbatas.',
    genre: 'Puzzle',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/MazeRunnerGame')),
    themeColor: '#f97316',
    accentShadow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]',
    icon: '🧭',
    controls: 'Arrows / WASD',
    avgDuration: '2-5 mins'
  },
  'memory-path': {
    id: 'memory-path',
    title: 'Matrix Memory Path',
    description: 'Ingat jalur petak neon tersembunyi yang aman dan langkah mundur jejak Anda tanpa memicu jebakan lantai.',
    genre: 'Puzzle',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/MemoryPathGame')),
    themeColor: '#3b82f6',
    accentShadow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]',
    icon: '👣',
    controls: 'Mouse / Touch',
    avgDuration: '2-5 mins'
  },
  'rhythm-tap': {
    id: 'rhythm-tap',
    title: 'Cyber Rhythm Beats',
    description: 'Tekan tombol nada tepat saat not musik neon meluncur mencapai garis ritme synthwave.',
    genre: 'Music / Rhythm',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    layout: 'portrait',
    component: lazy(() => import('../components/games/RhythmTapGame')),
    themeColor: '#a855f7',
    accentShadow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
    icon: '🎵',
    controls: 'D, F, J, K / Touch',
    avgDuration: '2-4 mins'
  },
  'pixel-golf': {
    id: 'pixel-golf',
    title: 'Retro Putt Golf',
    description: 'Atur sudut bidikan dan daya pukulan untuk memasukkan bola golf ke lubang melewati berbagai rintangan geometris.',
    genre: 'Sports',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=600&q=80',
    layout: 'portrait',
    component: lazy(() => import('../components/games/PixelGolfGame')),
    themeColor: '#10b981',
    accentShadow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    icon: '⛳',
    controls: 'Drag & Release',
    avgDuration: '2-5 mins'
  },
  'pixel-dino': {
    id: 'pixel-dino',
    title: 'Pixel Dino Runner',
    description: 'Bantu dinosaurus pixel imut melompati kaktus dan menghindari pterodactyl di gurun tandus tak berujung.',
    genre: 'Classic',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/PixelDinoGame')),
    themeColor: '#eab308',
    accentShadow: 'shadow-[0_0_15px_rgba(234,179,8,0.15)]',
    icon: '🦖',
    controls: 'Space / Tap',
    avgDuration: '2-5 mins'
  },
  'cyber-tetris': {
    id: 'cyber-tetris',
    title: 'Cyber Tetris Pulse',
    description: 'Putar dan susun balok tetrimino neon untuk menghapus baris demi baris sebelum tumpukan menyentuh langit.',
    genre: 'Classic',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1585620385456-4759f9b5c7d9?auto=format&fit=crop&w=600&q=80',
    layout: 'portrait',
    component: lazy(() => import('../components/games/CyberTetrisGame')),
    themeColor: '#06b6d4',
    accentShadow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    icon: '🧱',
    controls: 'Arrows / Touch',
    avgDuration: '3-10 mins'
  },
  'archery-neo': {
    id: 'archery-neo',
    title: 'Archery Master Neo',
    description: 'Bidik busur plasma Anda ke sasaran tembak yang bergerak dengan memperhitungkan hembusan angin digital.',
    genre: 'Sports',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/ArcheryNeoGame')),
    themeColor: '#ef4444',
    accentShadow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
    icon: '🏹',
    controls: 'Drag & Release',
    avgDuration: '2-5 mins'
  },
  'cyber-mines': {
    id: 'cyber-mines',
    title: 'Cyber Minesweeper',
    description: 'Buka petak grid secara logis tanpa menginjak ranjau pulsa EMP yang tersembunyi.',
    genre: 'Puzzle',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/CyberMinesGame')),
    themeColor: '#f59e0b',
    accentShadow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    icon: '💣',
    controls: 'Left Click (Open) / Right Click (Flag)',
    avgDuration: '3-10 mins'
  },
  'neon-2048': {
    id: 'neon-2048',
    title: 'Neon 2048 Fusion',
    description: 'Gabungkan angka-angka bernilai sama dengan menggeser grid untuk mencapai kubus legendaris 2048.',
    genre: 'Puzzle',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/Neon2048Game')),
    themeColor: '#f43f5e',
    accentShadow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]',
    icon: '🔢',
    controls: 'Arrows / Swipe',
    avgDuration: '5-15 mins'
  },
  'whack-a-drone': {
    id: 'whack-a-drone',
    title: 'Whack-a-Drone',
    description: 'Pukul drone hacker yang muncul secara mendadak dari lubang server sebelum mereka mencuri paket data.',
    genre: 'Arcade',
    difficulty: 'Easy',
    thumbnail: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=600&q=80',
    layout: 'square',
    component: lazy(() => import('../components/games/WhackADroneGame')),
    themeColor: '#d946ef',
    accentShadow: 'shadow-[0_0_15px_rgba(217,70,239,0.15)]',
    icon: '🔨',
    controls: 'Mouse Click / Tap',
    avgDuration: '2-4 mins'
  },
  'jump-rope': {
    id: 'jump-rope',
    title: 'Neon Jump Rope',
    description: 'Lompat di atas kabel laser berputar dengan ketepatan waktu yang sempurna.',
    genre: 'Arcade',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/JumpRopeGame')),
    themeColor: '#22c55e',
    accentShadow: 'shadow-[0_0_15px_rgba(34,197,94,0.15)]',
    icon: '🪢',
    controls: 'Space / Tap',
    avgDuration: '1-3 mins'
  },
  'neon-drift': {
    id: 'neon-drift',
    title: 'Neon Drift',
    description: 'Bermanuver menghindari rintangan neon yang berjatuhan dari atas secepat kilat!',
    genre: 'Action',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/NeonDriftGame')),
    themeColor: '#22d3ee',
    accentShadow: 'shadow-[0_0_15px_rgba(34,211,238,0.15)]',
    icon: '🏎️',
    controls: 'Left / Right',
    avgDuration: '2-5 mins'
  },
  'neon-heist': {
    id: 'neon-heist',
    title: 'Neon Heist',
    description: 'Infiltrasi fasilitas berkeamanan tinggi, retas terminal data, hindari patroli penjaga dan laser!',
    genre: 'Stealth / Strategy',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/NeonHeistGame')),
    themeColor: '#06b6d4',
    accentShadow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    icon: '🥷',
    controls: 'WASD / Mouse',
    avgDuration: '2-5 mins'
  },
  'void-survivor': {
    id: 'void-survivor',
    title: 'Void Survivor',
    description: 'Bertahan hidup melawan gelombang gerombolan makhluk void dengan senjata otomatis dan upgrade acak.',
    genre: 'Roguelite / Survival',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/VoidSurvivorGame')),
    themeColor: '#a855f7',
    accentShadow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]',
    icon: '⚔️',
    controls: 'WASD / Arrows',
    avgDuration: '5-15 mins'
  },
  'orbital-defense': {
    id: 'orbital-defense',
    title: 'Orbital Defense',
    description: 'Bangun dan upgrade menara pertahanan taktis di orbit luar angkasa untuk membendung invasi drone.',
    genre: 'Tower Defense',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/OrbitalDefenseGame')),
    themeColor: '#38bdf8',
    accentShadow: 'shadow-[0_0_15px_rgba(56,189,248,0.15)]',
    icon: '🛰️',
    controls: 'Mouse / Click',
    avgDuration: '5-10 mins'
  },
  'gravity-shift': {
    id: 'gravity-shift',
    title: 'Gravity Shift',
    description: 'Balikkan gravitasi atas-bawah dalam labirin rintangan presisi berkecepatan tinggi.',
    genre: 'Platformer / Precision',
    difficulty: 'Hard',
    thumbnail: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/GravityShiftGame')),
    themeColor: '#06b6d4',
    accentShadow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    icon: '🌌',
    controls: 'A/D + Space',
    avgDuration: '2-6 mins'
  },
  'hex-dominion': {
    id: 'hex-dominion',
    title: 'Hex Dominion',
    description: 'Kuasai peta grid heksagonal strategis melawan AI komandan taktis dengan pasukan siber.',
    genre: 'Strategy / Turn-Based',
    difficulty: 'Medium',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
    layout: 'landscape',
    component: lazy(() => import('../components/games/HexDominionGame')),
    themeColor: '#6366f1',
    accentShadow: 'shadow-[0_0_15px_rgba(99,102,241,0.15)]',
    icon: '🔷',
    controls: 'Mouse / Click',
    avgDuration: '5-12 mins'
  }
};

/**
 * Universal Game Registry with full alias and canonical ID mapping.
 */
export const GAME_REGISTRY: Record<string, GameRegistryItem> = {
  ...CANONICAL_GAME_REGISTRY
};

// Map all known legacy aliases into GAME_REGISTRY for seamless backward compatibility
Object.entries(GAME_ID_ALIAS_MAP).forEach(([alias, canonical]) => {
  if (CANONICAL_GAME_REGISTRY[canonical]) {
    GAME_REGISTRY[alias] = CANONICAL_GAME_REGISTRY[canonical];
  }
});

/**
 * Resolves a game registry item by canonical ID or legacy alias.
 */
export function getGameRegistryItem(rawId: string): GameRegistryItem | undefined {
  if (!rawId) return undefined;
  if (GAME_REGISTRY[rawId]) return GAME_REGISTRY[rawId];
  const canonical = toCanonicalGameId(rawId);
  return CANONICAL_GAME_REGISTRY[canonical] || GAME_REGISTRY[canonical];
}
