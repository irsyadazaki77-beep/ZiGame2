import {
  BiomeType,
  CivilizedRace,
  DivineEraChallenge,
  GodPower,
  RaceType,
  ResourceType
} from './types';

export const GRID_W = 108;
export const GRID_H = 66;
export const TILE_SIZE = 8;
export const SPATIAL_CELL_SIZE = 6;
export const MAX_PARTICLES = 1800;
export const FIXED_TICK_SECONDS = 1 / 30; // 30 deterministic simulation ticks per second at 1x
export const SAVE_STORAGE_KEY = 'zigame_worldbox_quicksave_v2';

export const BIOME_INDEX_LIST: BiomeType[] = [
  'deep_ocean',
  'shallow_water',
  'sand',
  'grass',
  'forest',
  'swamp',
  'mountain',
  'lava',
  'scorched'
];

export const RESOURCE_INDEX_LIST: ResourceType[] = [
  'none',
  'tree',
  'berry',
  'stone',
  'gold',
  'fire'
];

export const BIOME_COLORS: Record<BiomeType, [string, string]> = {
  deep_ocean: ['#0b2138', '#0e2946'],
  shallow_water: ['#1d4ed8', '#2563eb'],
  sand: ['#eab308', '#facc15'],
  grass: ['#16a34a', '#22c55e'],
  forest: ['#14532d', '#15803d'],
  swamp: ['#365314', '#3f6212'],
  mountain: ['#475569', '#64748b'],
  lava: ['#ea580c', '#f97316'],
  scorched: ['#27272a', '#3f3f46']
};

export interface RaceStatsConfig {
  label: string;
  hp: number;
  attack: number;
  speed: number;
  maxAge: number;
  primaryColor: string;
  secondaryColor: string;
  isCivilized: boolean;
  isFlying: boolean;
}

export const RACE_CONFIG: Record<RaceType, RaceStatsConfig> = {
  human: {
    label: 'Manusia',
    hp: 100,
    attack: 12,
    speed: 0.088,
    maxAge: 75,
    primaryColor: '#3b82f6',
    secondaryColor: '#fde047',
    isCivilized: true,
    isFlying: false
  },
  elf: {
    label: 'Elf Hutan',
    hp: 92,
    attack: 14,
    speed: 0.112,
    maxAge: 180,
    primaryColor: '#10b981',
    secondaryColor: '#a7f3d0',
    isCivilized: true,
    isFlying: false
  },
  orc: {
    label: 'Orc Perang',
    hp: 150,
    attack: 20,
    speed: 0.092,
    maxAge: 62,
    primaryColor: '#ef4444',
    secondaryColor: '#fca5a5',
    isCivilized: true,
    isFlying: false
  },
  dwarf: {
    label: 'Kurcaci Gunung',
    hp: 140,
    attack: 16,
    speed: 0.078,
    maxAge: 130,
    primaryColor: '#f59e0b',
    secondaryColor: '#fde68a',
    isCivilized: true,
    isFlying: false
  },
  dragon: {
    label: 'Naga Api',
    hp: 780,
    attack: 55,
    speed: 0.13,
    maxAge: 500,
    primaryColor: '#dc2626',
    secondaryColor: '#fb923c',
    isCivilized: false,
    isFlying: true
  },
  sheep: {
    label: 'Domba Padang',
    hp: 36,
    attack: 2,
    speed: 0.062,
    maxAge: 30,
    primaryColor: '#f8fafc',
    secondaryColor: '#cbd5e1',
    isCivilized: false,
    isFlying: false
  },
  wolf: {
    label: 'Serigala Liar',
    hp: 68,
    attack: 14,
    speed: 0.112,
    maxAge: 42,
    primaryColor: '#64748b',
    secondaryColor: '#94a3b8',
    isCivilized: false,
    isFlying: false
  },
  ufo: {
    label: 'UFO Invader',
    hp: 520,
    attack: 45,
    speed: 0.14,
    maxAge: 999,
    primaryColor: '#06b6d4',
    secondaryColor: '#67e8f9',
    isCivilized: false,
    isFlying: true
  },
  tornado: {
    label: 'Pusaran Tornado',
    hp: 999,
    attack: 25,
    speed: 0.15,
    maxAge: 12,
    primaryColor: '#94a3b8',
    secondaryColor: '#e2e8f0',
    isCivilized: false,
    isFlying: true
  }
};

export const KINGDOM_NAMES: Record<CivilizedRace, string[]> = {
  human: ['Valoria', 'Aethelgard', 'Stormwatch', 'Solaria', 'Pendragon', 'Oakhaven'],
  elf: ['Eldoria', 'Sylvanor', 'Lothloria', 'Starwood', 'Elenna', 'Silverleaf'],
  orc: ['Krag-Mor', 'Bloodfang', 'Grimskull', 'Gorgoroth', 'Ironjaw', 'Ashmaw'],
  dwarf: ['Khazad-Dun', 'Ironforge', 'Deephelm', 'Mithrilhall', 'Stonebreaker', 'Goldpeak']
};

export const UNIT_NAMES: Record<RaceType, string[]> = {
  human: ['Arthur', 'Alden', 'Elena', 'Garrick', 'Rowan', 'Cedric', 'Lyra', 'Viktor'],
  elf: ['Legolas', 'Aelrindel', 'Sylphie', 'Thranduil', 'Elowen', 'Caelum', 'Faelar'],
  orc: ['Grom', 'Thrall', 'Durotan', 'Garrosh', 'Morgul', 'Uruk', 'Zugor'],
  dwarf: ['Gimli', 'Thorin', 'Balin', 'Dwalin', 'Bardin', 'Durin', 'Thrain'],
  dragon: ['Ignis', 'Balerion', 'Smaug', 'Pyrax', 'Vermithrax'],
  sheep: ['Shaun', 'Woolly', 'Cloud', 'Cotton'],
  wolf: ['Fenrir', 'Ghost', 'Fang', 'Shadow'],
  ufo: ['Zeta-9', 'Orion-X', 'Probe-77'],
  tornado: ['Vortex-Alpha', 'Zephyr-Rage', 'Tempest-IX']
};

export const WAR_REASONS: string[] = [
  'sengketa ekspansi perbatasan wilayah',
  'perebutan tambang emas dan sumber daya alam',
  'insiden diplomatik antar utusan kerajaan',
  'ambisi hegemoni takhta benua',
  'balas dendam atas konflik masa lalu'
];

export const PEACE_REASONS: string[] = [
  'kelelahan perang berkepanjangan',
  'pernikahan politik antar bangsawan',
  'kesepakatan dagang sumber daya emas',
  'ancaman bencana alam bersama'
];

export const DIVINE_ERA_CHALLENGES: DivineEraChallenge[] = [
  {
    id: 'era_1_genesis',
    eraNumber: 1,
    title: 'Era I: Genesis Kehidupan',
    description: 'Ciptakan dunia yang subur dengan minimal 20 populasi makhluk hidup.',
    rewardScore: 1500,
    check: (s) => s.units.length >= 20
  },
  {
    id: 'era_2_kingdoms',
    eraNumber: 2,
    title: 'Era II: Kebangkitan Kerajaan',
    description: 'Saksikan berdirinya minimal 2 Kerajaan berbeda dengan minimal 6 bangunan.',
    rewardScore: 3000,
    check: (s) => s.kingdoms.length >= 2 && s.buildings.length >= 6
  },
  {
    id: 'era_3_empires',
    eraNumber: 3,
    title: 'Era III: Hegemoni Empat Bangsa',
    description: 'Capai 45 populasi aktif dan minimal 3 Kerajaan makmur atau peristiwa perang.',
    rewardScore: 4500,
    check: (s) => s.units.length >= 45 && (s.kingdoms.length >= 3 || s.totalWarsFought >= 1)
  },
  {
    id: 'era_4_cataclysm',
    eraNumber: 4,
    title: 'Era IV: Ujian Bencana & Mukjizat',
    description: 'Gunakan minimal 3 Kekuatan Dewa/Bencana dan pertahankan populasi di atas 35.',
    rewardScore: 6000,
    check: (s) => s.disastersTriggered + s.miraclesCast >= 3 && s.units.length >= 35
  },
  {
    id: 'era_5_pantheon',
    eraNumber: 5,
    title: 'Era V: Pantheon Abadi',
    description: 'Capai Tahun 40 dengan populasi >= 60 dan minimal 1 makhluk ber-trait Immortal.',
    rewardScore: 10000,
    check: (s) =>
      s.year >= 40 &&
      s.units.length >= 60 &&
      s.units.some((u) => u.traits.includes('Immortal'))
  }
];

export const GOD_POWERS_CATALOG: GodPower[] = [
  // Terrain
  { id: 'biome_deep_ocean', category: 'terrain', label: 'Laut Dalam', shortDesc: 'Lukis perairan samudra dalam', accent: '#0e2946' },
  { id: 'biome_shallow_water', category: 'terrain', label: 'Air Dangkal', shortDesc: 'Lukis perairan pesisir dangkal', accent: '#2563eb' },
  { id: 'biome_sand', category: 'terrain', label: 'Pasir Pantai', shortDesc: 'Lukis pesisir pasir emas', accent: '#eab308' },
  { id: 'biome_grass', category: 'terrain', label: 'Tanah Subur', shortDesc: 'Lukis padang rumput dataran', accent: '#22c55e' },
  { id: 'biome_forest', category: 'terrain', label: 'Bioma Hutan', shortDesc: 'Lukis tanah hutan rimba lebat', accent: '#15803d' },
  { id: 'biome_swamp', category: 'terrain', label: 'Rawa Mistis', shortDesc: 'Lukis lahan basah berlumpur', accent: '#4d7c0f' },
  { id: 'biome_mountain', category: 'terrain', label: 'Pegunungan', shortDesc: 'Lukis bukit batu tinggi', accent: '#64748b' },
  { id: 'biome_lava', category: 'terrain', label: 'Lava Vulkanik', shortDesc: 'Lukis cairan magma pijar', accent: '#ea580c' },

  // Civilizations & Creatures
  { id: 'spawn_human', category: 'civilization', label: 'Manusia', shortDesc: 'Bangsa pembangun kerajaan seimbang', accent: '#3b82f6' },
  { id: 'spawn_elf', category: 'civilization', label: 'Elf Hutan', shortDesc: 'Bangsa pemanah abadi penjaga hutan', accent: '#10b981' },
  { id: 'spawn_orc', category: 'civilization', label: 'Orc Perang', shortDesc: 'Bangsa petarung kuat & agresif', accent: '#ef4444' },
  { id: 'spawn_dwarf', category: 'civilization', label: 'Kurcaci', shortDesc: 'Bangsa penambang batu & emas tangguh', accent: '#f59e0b' },
  { id: 'spawn_dragon', category: 'civilization', label: 'Naga Api', shortDesc: 'Makhluk mitologi penyembur api', accent: '#dc2626' },
  { id: 'spawn_sheep', category: 'civilization', label: 'Domba', shortDesc: 'Herbivora damai sumber pangan', accent: '#e2e8f0' },
  { id: 'spawn_wolf', category: 'civilization', label: 'Serigala', shortDesc: 'Predator liar pemburu kelompok', accent: '#94a3b8' },

  // Nature & Resources
  { id: 'res_tree', category: 'nature', label: 'Bibit Pohon', shortDesc: 'Tumbuhkan pepohonan kayu lebat', accent: '#16a34a' },
  { id: 'res_stone', category: 'nature', label: 'Deposit Batu', shortDesc: 'Tambahkan batuan mineral bangunan', accent: '#94a3b8' },
  { id: 'res_gold', category: 'nature', label: 'Bijih Emas', shortDesc: 'Tambahkan tambang emas kemakmuran', accent: '#facc15' },
  { id: 'power_rain', category: 'nature', label: 'Hujan Berkah', shortDesc: 'Padamkan api, suburkan tanah & sembuhkan unit', accent: '#38bdf8' },

  // Disasters
  { id: 'disaster_lightning', category: 'disasters', label: 'Petir Dewa', shortDesc: 'Sambar titik target dengan kilat', accent: '#fde047' },
  { id: 'disaster_meteor', category: 'disasters', label: 'Meteorit', shortDesc: 'Jatuhkan batu angkasa berdaya ledak tinggi', accent: '#f97316' },
  { id: 'disaster_nuke', category: 'disasters', label: 'Bom Nuklir', shortDesc: 'Ledakan termonuklir penghancur benua', accent: '#ef4444' },
  { id: 'disaster_tornado', category: 'disasters', label: 'Tornado', shortDesc: 'Pusaran angin yang menarik & melempar unit', accent: '#94a3b8' },
  { id: 'disaster_earthquake', category: 'disasters', label: 'Gempa Bumi', shortDesc: 'Retakkan patahan benua menjadi gunung & lava', accent: '#d97706' },
  { id: 'disaster_plague', category: 'disasters', label: 'Wabah Ungu', shortDesc: 'Sebarkan spora infeksi menular', accent: '#a855f7' },
  { id: 'disaster_ufo', category: 'disasters', label: 'Invasi UFO', shortDesc: 'Panggil piring terbang penembak laser', accent: '#06b6d4' },

  // Inspector & Divine
  { id: 'tool_inspect', category: 'inspector', label: 'Inspeksi Unit', shortDesc: 'Klik makhluk untuk melihat statistik & trait', accent: '#38bdf8' },
  { id: 'tool_bless', category: 'inspector', label: 'Berkah Ilahi', shortDesc: 'Berikan trait Blessed, Giant & pulihkan HP', accent: '#facc15' },
  { id: 'tool_magnet', category: 'inspector', label: 'Magnet Dewa', shortDesc: 'Tarik & pindahkan makhluk di sekitar kursor', accent: '#ec4899' },
  { id: 'tool_smite', category: 'inspector', label: 'Murka Dewa', shortDesc: 'Eliminasi unit target secara instan', accent: '#f43f5e' }
];
