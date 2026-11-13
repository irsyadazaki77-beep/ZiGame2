import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameOverlay } from '../gameplay/GameOverlay';
import { audio } from '../../utils/audio';
import { screenShake } from '../../utils/screenShake';
import {
  Globe,
  Users,
  Trees,
  Flame,
  Eye,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Award,
  Crown,
  Swords,
  Shield,
  Zap,
  Sparkles,
  ScrollText,
  ZoomIn,
  ZoomOut,
  Compass,
  MapPin
} from 'lucide-react';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type BiomeType =
  | 'deep_ocean'
  | 'shallow_water'
  | 'sand'
  | 'grass'
  | 'forest'
  | 'swamp'
  | 'mountain'
  | 'lava'
  | 'scorched';

type ResourceType = 'none' | 'tree' | 'berry' | 'stone' | 'gold' | 'fire';

type RaceType = 'human' | 'elf' | 'orc' | 'dwarf' | 'dragon' | 'sheep' | 'wolf' | 'ufo';

type UnitTrait =
  | 'Immortal'
  | 'Blessed'
  | 'Giant'
  | 'Strong'
  | 'Fast'
  | 'Wise'
  | 'Pyromaniac'
  | 'Infected'
  | 'Veteran'
  | 'Kingslayer';

type ToolCategory = 'terrain' | 'civilization' | 'nature' | 'disasters' | 'inspector';

type ToolId =
  // Terrain
  | 'biome_deep_ocean'
  | 'biome_shallow_water'
  | 'biome_sand'
  | 'biome_grass'
  | 'biome_forest'
  | 'biome_swamp'
  | 'biome_mountain'
  | 'biome_lava'
  // Civilizations & Creatures
  | 'spawn_human'
  | 'spawn_elf'
  | 'spawn_orc'
  | 'spawn_dwarf'
  | 'spawn_dragon'
  | 'spawn_sheep'
  | 'spawn_wolf'
  // Nature & Resources
  | 'res_tree'
  | 'res_stone'
  | 'res_gold'
  | 'power_rain'
  // Disasters
  | 'disaster_lightning'
  | 'disaster_meteor'
  | 'disaster_nuke'
  | 'disaster_plague'
  | 'disaster_ufo'
  // Inspector & Divine Powers
  | 'tool_inspect'
  | 'tool_bless'
  | 'tool_magnet'
  | 'tool_smite';

type WorldTemplate = 'archipelago' | 'pangaea' | 'volcanic';

interface BuildingEntity {
  id: number;
  x: number;
  y: number;
  kingdomId: number;
  race: 'human' | 'elf' | 'orc' | 'dwarf';
  type: 'hall' | 'house' | 'tower' | 'mine';
  hp: number;
  maxHp: number;
}

interface KingdomEntity {
  id: number;
  name: string;
  race: 'human' | 'elf' | 'orc' | 'dwarf';
  color: string;
  borderColor: string;
  capitalX: number;
  capitalY: number;
  wood: number;
  stone: number;
  gold: number;
  food: number;
  population: number;
  kingUnitId: number | null;
  enemies: Set<number>;
  foundedYear: number;
}

interface UnitEntity {
  id: number;
  name: string;
  race: RaceType;
  kingdomId: number | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number | null;
  targetY: number | null;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  age: number;
  maxAge: number;
  kills: number;
  level: number;
  hunger: number;
  isKing: boolean;
  isSoldier: boolean;
  traits: UnitTrait[];
  actionCooldown: number;
  animFrame: number;
}

interface ParticleFX {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface ShockwaveFX {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

interface ChronicleEvent {
  id: number;
  year: number;
  month: number;
  text: string;
  category: 'kingdom' | 'war' | 'disaster' | 'era' | 'miracle';
}

interface DivineEraChallenge {
  id: string;
  eraNumber: number;
  title: string;
  description: string;
  rewardScore: number;
  completed: boolean;
  check: (state: SimulationState) => boolean;
}

interface WorldLaws {
  diplomacyAndWars: boolean;
  naturalDisasters: boolean;
  hungerAndAging: boolean;
  showKingdomBorders: boolean;
}

interface SimulationState {
  gridW: number;
  gridH: number;
  biomes: BiomeType[];
  resources: ResourceType[];
  territory: Int16Array; // kingdomId per tile (-1 for unclaimed)
  units: UnitEntity[];
  buildings: BuildingEntity[];
  kingdoms: KingdomEntity[];
  particles: ParticleFX[];
  shockwaves: ShockwaveFX[];
  chronicles: ChronicleEvent[];
  nextEntityId: number;
  tickCount: number;
  year: number;
  month: number;
  peakPopulation: number;
  totalWarsFought: number;
  disastersTriggered: number;
  miraclesCast: number;
  completedEras: Set<string>;
}

const GRID_W = 108;
const GRID_H = 66;
const TILE_SIZE = 8; // Logical pixel size per tile

const BIOME_COLORS: Record<BiomeType, [string, string]> = {
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

const RACE_CONFIG: Record<
  RaceType,
  {
    label: string;
    hp: number;
    attack: number;
    speed: number;
    maxAge: number;
    primaryColor: string;
    secondaryColor: string;
    isCivilized: boolean;
  }
> = {
  human: {
    label: 'Manusia',
    hp: 100,
    attack: 12,
    speed: 0.085,
    maxAge: 75,
    primaryColor: '#3b82f6',
    secondaryColor: '#fde047',
    isCivilized: true
  },
  elf: {
    label: 'Elf Hutan',
    hp: 90,
    attack: 14,
    speed: 0.11,
    maxAge: 180,
    primaryColor: '#10b981',
    secondaryColor: '#a7f3d0',
    isCivilized: true
  },
  orc: {
    label: 'Orc Perang',
    hp: 145,
    attack: 20,
    speed: 0.09,
    maxAge: 60,
    primaryColor: '#ef4444',
    secondaryColor: '#fca5a5',
    isCivilized: true
  },
  dwarf: {
    label: 'Kurcaci Gunung',
    hp: 135,
    attack: 16,
    speed: 0.075,
    maxAge: 130,
    primaryColor: '#f59e0b',
    secondaryColor: '#fde68a',
    isCivilized: true
  },
  dragon: {
    label: 'Naga Api',
    hp: 750,
    attack: 55,
    speed: 0.125,
    maxAge: 500,
    primaryColor: '#dc2626',
    secondaryColor: '#fb923c',
    isCivilized: false
  },
  sheep: {
    label: 'Domba Padang',
    hp: 35,
    attack: 2,
    speed: 0.06,
    maxAge: 30,
    primaryColor: '#f8fafc',
    secondaryColor: '#cbd5e1',
    isCivilized: false
  },
  wolf: {
    label: 'Serigala Liar',
    hp: 65,
    attack: 14,
    speed: 0.11,
    maxAge: 40,
    primaryColor: '#64748b',
    secondaryColor: '#94a3b8',
    isCivilized: false
  },
  ufo: {
    label: 'UFO Invader',
    hp: 500,
    attack: 45,
    speed: 0.14,
    maxAge: 999,
    primaryColor: '#06b6d4',
    secondaryColor: '#67e8f9',
    isCivilized: false
  }
};

const KINGDOM_NAMES: Record<'human' | 'elf' | 'orc' | 'dwarf', string[]> = {
  human: ['Valoria', 'Aethelgard', 'Stormwatch', 'Solaria', 'Pendragon', 'Oakhaven'],
  elf: ['Eldoria', 'Sylvanor', 'Lothloria', 'Starwood', 'Elenna', 'Silverleaf'],
  orc: ['Krag-Mor', 'Bloodfang', 'Grimskull', 'Gorgoroth', 'Ironjaw', 'Ashmaw'],
  dwarf: ['Khazad-Dun', 'Ironforge', 'Deephelm', 'Mithrilhall', 'Stonebreaker', 'Goldpeak']
};

const UNIT_NAMES: Record<RaceType, string[]> = {
  human: ['Arthur', 'Alden', 'Elena', 'Garrick', 'Rowan', 'Cedric', 'Lyra', 'Viktor'],
  elf: ['Legolas', 'Aelrindel', 'Sylphie', 'Thranduil', 'Elowen', 'Caelum', 'Faelar'],
  orc: ['Grom', 'Thrall', 'Durotan', 'Garrosh', 'Morgul', 'Uruk', 'Zugor'],
  dwarf: ['Gimli', 'Thorin', 'Balin', 'Dwalin', 'Bardin', 'Durin', 'Thrain'],
  dragon: ['Ignis', 'Balerion', 'Smaug', 'Pyrax', 'Vermithrax'],
  sheep: ['Shaun', 'Woolly', 'Cloud', 'Cotton'],
  wolf: ['Fenrir', 'Ghost', 'Fang', 'Shadow'],
  ufo: ['Zeta-9', 'Orion-X', 'Probe-77']
};

const DIVINE_ERA_CHALLENGES: DivineEraChallenge[] = [
  {
    id: 'era_1_genesis',
    eraNumber: 1,
    title: 'Era I: Genesis Kehidupan',
    description: 'Ciptakan dunia yang subur dengan minimal 20 populasi makhluk hidup.',
    rewardScore: 1500,
    completed: false,
    check: (s) => s.units.length >= 20
  },
  {
    id: 'era_2_kingdoms',
    eraNumber: 2,
    title: 'Era II: Kebangkitan Kerajaan',
    description: 'Saksikan berdirinya minimal 2 Kerajaan berbeda dengan minimal 6 bangunan.',
    rewardScore: 3000,
    completed: false,
    check: (s) => s.kingdoms.length >= 2 && s.buildings.length >= 6
  },
  {
    id: 'era_3_empires',
    eraNumber: 3,
    title: 'Era III: Hegemoni Empat Bangsa',
    description: 'Capai 45 populasi aktif dan minimal 3 Kerajaan makmur atau peristiwa perang.',
    rewardScore: 4500,
    completed: false,
    check: (s) => s.units.length >= 45 && (s.kingdoms.length >= 3 || s.totalWarsFought >= 1)
  },
  {
    id: 'era_4_cataclysm',
    eraNumber: 4,
    title: 'Era IV: Ujian Bencana & Mukjizat',
    description: 'Gunakan minimal 3 Kekuatan Dewa/Bencana dan pertahankan populasi di atas 35.',
    rewardScore: 6000,
    completed: false,
    check: (s) => s.disastersTriggered + s.miraclesCast >= 3 && s.units.length >= 35
  },
  {
    id: 'era_5_pantheon',
    eraNumber: 5,
    title: 'Era V: Pantheon Abadi',
    description: 'Capai Tahun 40 dengan populasi >= 60 dan minimal 1 makhluk ber-trait Immortal.',
    rewardScore: 10000,
    completed: false,
    check: (s) =>
      s.year >= 40 &&
      s.units.length >= 60 &&
      s.units.some((u) => u.traits.includes('Immortal'))
  }
];

interface ToolItemConfig {
  id: ToolId;
  category: ToolCategory;
  label: string;
  shortDesc: string;
  accent: string;
}

const TOOL_CATALOG: ToolItemConfig[] = [
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
  { id: 'disaster_plague', category: 'disasters', label: 'Wabah Ungu', shortDesc: 'Sebarkan spora infeksi menular', accent: '#a855f7' },
  { id: 'disaster_ufo', category: 'disasters', label: 'Invasi UFO', shortDesc: 'Panggil piring terbang penembak laser', accent: '#06b6d4' },

  // Inspector & Divine
  { id: 'tool_inspect', category: 'inspector', label: 'Inspeksi Unit', shortDesc: 'Klik makhluk untuk melihat statistik & trait', accent: '#38bdf8' },
  { id: 'tool_bless', category: 'inspector', label: 'Berkah Ilahi', shortDesc: 'Berikan trait Blessed, Giant & pulihkan HP', accent: '#facc15' },
  { id: 'tool_magnet', category: 'inspector', label: 'Magnet Dewa', shortDesc: 'Tarik & pindahkan makhluk di sekitar kursor', accent: '#ec4899' },
  { id: 'tool_smite', category: 'inspector', label: 'Murka Dewa', shortDesc: 'Eliminasi unit target secara instan', accent: '#f43f5e' }
];

// ============================================================================
// PROCEDURAL NOISE & WORLD GENERATION HELPERS
// ============================================================================

function pseudoNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, scale: number, seed: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;

  const v00 = pseudoNoise(x0, y0, seed);
  const v10 = pseudoNoise(x0 + 1, y0, seed);
  const v01 = pseudoNoise(x0, y0 + 1, seed);
  const v11 = pseudoNoise(x0 + 1, y0 + 1, seed);

  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);

  const nx0 = v00 * (1 - u) + v10 * u;
  const nx1 = v01 * (1 - u) + v11 * u;
  return nx0 * (1 - v) + nx1 * v;
}

function fbmNoise(x: number, y: number, seed: number): number {
  let value = 0;
  value += 0.55 * smoothNoise(x, y, 18, seed);
  value += 0.3 * smoothNoise(x, y, 9, seed + 17);
  value += 0.15 * smoothNoise(x, y, 4, seed + 31);
  return value;
}

function isLandBiome(b: BiomeType): boolean {
  return b !== 'deep_ocean' && b !== 'shallow_water' && b !== 'lava';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WorldBoxGame({ onGameOver, onScoreUpdate, highScore }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    gameState,
    score,
    setScore,
    addScore,
    startWithCountdown,
    countdown,
    triggerGameOver,
    startLoop,
    stopLoop,
    scoreRef
  } = useGameEngine({
    gameId: 'world-box',
    onGameOver,
    onScoreUpdate
  });

  // UI Control States
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('civilization');
  const [selectedTool, setSelectedTool] = useState<ToolId>('spawn_human');
  const [brushRadius, setBrushRadius] = useState<number>(2);
  const [simSpeed, setSimSpeed] = useState<0 | 1 | 3 | 5>(1);
  const [worldTemplate, setWorldTemplate] = useState<WorldTemplate>('archipelago');
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [cameraZoom, setCameraZoom] = useState<number>(1);
  const [cameraPan, setCameraPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [worldLaws, setWorldLaws] = useState<WorldLaws>({
    diplomacyAndWars: true,
    naturalDisasters: false,
    hungerAndAging: true,
    showKingdomBorders: true
  });

  // HUD Snapshot State (updated periodically so React UI stays fast & responsive)
  const [hudStats, setHudStats] = useState({
    year: 1,
    month: 1,
    population: 0,
    kingdomCount: 0,
    buildingCount: 0,
    warsCount: 0,
    completedEraCount: 0
  });
  const [chroniclesUI, setChroniclesUI] = useState<ChronicleEvent[]>([]);
  const [kingdomsUI, setKingdomsUI] = useState<KingdomEntity[]>([]);
  const [inspectedUnitUI, setInspectedUnitUI] = useState<UnitEntity | null>(null);

  // Refs for simulation loop access
  const simSpeedRef = useRef<0 | 1 | 3 | 5>(1);
  const worldLawsRef = useRef<WorldLaws>(worldLaws);
  const selectedToolRef = useRef<ToolId>(selectedTool);
  const brushRadiusRef = useRef<number>(brushRadius);
  const selectedUnitIdRef = useRef<number | null>(selectedUnitId);
  const cameraRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const isPointerDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  useEffect(() => {
    worldLawsRef.current = worldLaws;
  }, [worldLaws]);

  useEffect(() => {
    selectedToolRef.current = selectedTool;
  }, [selectedTool]);

  useEffect(() => {
    brushRadiusRef.current = brushRadius;
  }, [brushRadius]);

  useEffect(() => {
    selectedUnitIdRef.current = selectedUnitId;
  }, [selectedUnitId]);

  useEffect(() => {
    cameraRef.current = { zoom: cameraZoom, panX: cameraPan.x, panY: cameraPan.y };
  }, [cameraZoom, cameraPan]);

  // Mutable authoritative simulation state
  const simRef = useRef<SimulationState>({
    gridW: GRID_W,
    gridH: GRID_H,
    biomes: new Array<BiomeType>(GRID_W * GRID_H).fill('deep_ocean'),
    resources: new Array<ResourceType>(GRID_W * GRID_H).fill('none'),
    territory: new Int16Array(GRID_W * GRID_H).fill(-1),
    units: [],
    buildings: [],
    kingdoms: [],
    particles: [],
    shockwaves: [],
    chronicles: [],
    nextEntityId: 1,
    tickCount: 0,
    year: 1,
    month: 1,
    peakPopulation: 0,
    totalWarsFought: 0,
    disastersTriggered: 0,
    miraclesCast: 0,
    completedEras: new Set<string>()
  });

  // Add Chronicle entry helper
  const pushChronicle = useCallback(
    (text: string, category: ChronicleEvent['category'] = 'kingdom') => {
      const s = simRef.current;
      const entry: ChronicleEvent = {
        id: s.nextEntityId++,
        year: s.year,
        month: s.month,
        text,
        category
      };
      s.chronicles = [entry, ...s.chronicles.slice(0, 29)];
    },
    []
  );

  // Spawn unit helper
  const spawnUnitAt = useCallback(
    (race: RaceType, tx: number, ty: number, customTraits?: UnitTrait[]): UnitEntity | null => {
      const s = simRef.current;
      if (tx < 0 || tx >= s.gridW || ty < 0 || ty >= s.gridH) return null;
      const idx = ty * s.gridW + tx;
      const biome = s.biomes[idx];

      // Civilized land units cannot spawn in deep water/lava unless flying
      if (
        race !== 'dragon' &&
        race !== 'ufo' &&
        (biome === 'deep_ocean' || biome === 'lava')
      ) {
        return null;
      }

      const cfg = RACE_CONFIG[race];
      const names = UNIT_NAMES[race];
      const name = names[Math.floor(Math.random() * names.length)] + ' ' + ((s.nextEntityId % 90) + 10);

      const traits: UnitTrait[] = customTraits ? [...customTraits] : [];
      if (Math.random() < 0.14) traits.push('Strong');
      if (Math.random() < 0.12) traits.push('Fast');
      if (Math.random() < 0.08) traits.push('Wise');
      if (race === 'dragon' || race === 'elf') {
        if (Math.random() < 0.25 && !traits.includes('Immortal')) traits.push('Immortal');
      }

      const hpBonus = traits.includes('Giant') ? 1.6 : traits.includes('Strong') ? 1.25 : 1;
      const maxHp = Math.round(cfg.hp * hpBonus);

      // Find nearest kingdom of same race within 18 tiles
      let assignedKingdomId: number | null = null;
      if (cfg.isCivilized) {
        for (const k of s.kingdoms) {
          if (k.race === race) {
            const dist = Math.hypot(k.capitalX - tx, k.capitalY - ty);
            if (dist <= 20) {
              assignedKingdomId = k.id;
              break;
            }
          }
        }
      }

      const unit: UnitEntity = {
        id: s.nextEntityId++,
        name,
        race,
        kingdomId: assignedKingdomId,
        x: tx + 0.5,
        y: ty + 0.5,
        vx: 0,
        vy: 0,
        targetX: null,
        targetY: null,
        hp: maxHp,
        maxHp,
        attack: Math.round(cfg.attack * (traits.includes('Strong') ? 1.3 : 1)),
        speed: cfg.speed * (traits.includes('Fast') ? 1.35 : 1),
        age: 1,
        maxAge: cfg.maxAge,
        kills: 0,
        level: 1,
        hunger: 100,
        isKing: false,
        isSoldier: Math.random() < 0.35,
        traits,
        actionCooldown: 0,
        animFrame: Math.floor(Math.random() * 100)
      };

      s.units.push(unit);
      if (s.units.length > s.peakPopulation) {
        s.peakPopulation = s.units.length;
      }
      return unit;
    },
    []
  );

  // Generate Procedural World
  const generateWorld = useCallback(
    (template: WorldTemplate = worldTemplate) => {
      const s = simRef.current;
      const seed = Math.random() * 1000;
      s.biomes = new Array<BiomeType>(s.gridW * s.gridH);
      s.resources = new Array<ResourceType>(s.gridW * s.gridH).fill('none');
      s.territory = new Int16Array(s.gridW * s.gridH).fill(-1);
      s.units = [];
      s.buildings = [];
      s.kingdoms = [];
      s.particles = [];
      s.shockwaves = [];
      s.chronicles = [];
      s.tickCount = 0;
      s.year = 1;
      s.month = 1;
      s.totalWarsFought = 0;
      s.disastersTriggered = 0;
      s.miraclesCast = 0;
      s.completedEras.clear();
      setSelectedUnitId(null);
      setInspectedUnitUI(null);

      const cx = s.gridW / 2;
      const cy = s.gridH / 2;

      for (let y = 0; y < s.gridH; y++) {
        for (let x = 0; x < s.gridW; x++) {
          const idx = y * s.gridW + x;
          const nx = (x - cx) / (s.gridW * 0.5);
          const ny = (y - cy) / (s.gridH * 0.5);
          const distFromCenter = Math.hypot(nx, ny);
          let n = fbmNoise(x, y, seed);

          if (template === 'archipelago') {
            n = n - distFromCenter * 0.38;
          } else if (template === 'pangaea') {
            n = n + 0.14 - Math.pow(distFromCenter, 1.8) * 0.55;
          } else if (template === 'volcanic') {
            // Ring island with central volcano
            if (distFromCenter < 0.22) {
              s.biomes[idx] = distFromCenter < 0.11 ? 'lava' : 'mountain';
              if (s.biomes[idx] === 'mountain' && Math.random() < 0.2) {
                s.resources[idx] = 'gold';
              }
              continue;
            }
            n = n + 0.1 - distFromCenter * 0.42;
          }

          let biome: BiomeType = 'deep_ocean';
          if (n < 0.32) {
            biome = 'deep_ocean';
          } else if (n < 0.41) {
            biome = 'shallow_water';
          } else if (n < 0.46) {
            biome = 'sand';
          } else if (n < 0.62) {
            biome = 'grass';
          } else if (n < 0.75) {
            biome = 'forest';
          } else if (n < 0.86) {
            biome = 'mountain';
          } else {
            biome = template === 'volcanic' ? 'lava' : 'mountain';
          }

          s.biomes[idx] = biome;

          // Populate natural resources
          if (biome === 'forest' && Math.random() < 0.42) {
            s.resources[idx] = Math.random() < 0.8 ? 'tree' : 'berry';
          } else if (biome === 'grass' && Math.random() < 0.08) {
            s.resources[idx] = Math.random() < 0.6 ? 'berry' : 'tree';
          } else if (biome === 'mountain' && Math.random() < 0.22) {
            s.resources[idx] = Math.random() < 0.72 ? 'stone' : 'gold';
          }
        }
      }

      // Seed starter pockets of the 4 fantasy races on suitable islands
      const starterRaces: Array<'human' | 'elf' | 'orc' | 'dwarf'> = ['human', 'elf', 'orc', 'dwarf'];
      starterRaces.forEach((race) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const rx = 10 + Math.floor(Math.random() * (s.gridW - 20));
          const ry = 8 + Math.floor(Math.random() * (s.gridH - 16));
          const b = s.biomes[ry * s.gridW + rx];
          if (b === 'grass' || b === 'forest') {
            for (let i = 0; i < 4; i++) {
              const ox = Math.max(2, Math.min(s.gridW - 3, rx + Math.floor(Math.random() * 3) - 1));
              const oy = Math.max(2, Math.min(s.gridH - 3, ry + Math.floor(Math.random() * 3) - 1));
              spawnUnitAt(race, ox, oy);
            }
            break;
          }
        }
      });

      // Spawn a few sheep in plains
      for (let i = 0; i < 8; i++) {
        const rx = 8 + Math.floor(Math.random() * (s.gridW - 16));
        const ry = 8 + Math.floor(Math.random() * (s.gridH - 16));
        if (s.biomes[ry * s.gridW + rx] === 'grass') {
          spawnUnitAt('sheep', rx, ry);
        }
      }

      pushChronicle(
        `Tahun 1: Dunia baru (${template.toUpperCase()}) diciptakan oleh Sang Dewa. Empat bangsa kuno mulai menjelajah.`,
        'era'
      );
    },
    [worldTemplate, spawnUnitAt, pushChronicle]
  );

  // Paint or apply active tool at tile coordinate (tx, ty)
  const applyToolAtTile = useCallback(
    (tx: number, ty: number, isDragEvent: boolean) => {
      const s = simRef.current;
      const tool = selectedToolRef.current;
      const radius = brushRadiusRef.current;

      if (tx < 0 || tx >= s.gridW || ty < 0 || ty >= s.gridH) return;

      // 1. Inspector Tool
      if (tool === 'tool_inspect') {
        if (isDragEvent) return;
        let closest: UnitEntity | null = null;
        let minDist = 3.2;
        for (const u of s.units) {
          const d = Math.hypot(u.x - (tx + 0.5), u.y - (ty + 0.5));
          if (d < minDist) {
            minDist = d;
            closest = u;
          }
        }
        if (closest) {
          setSelectedUnitId(closest.id);
          setInspectedUnitUI({ ...closest });
          audio.playClick();
        } else {
          setSelectedUnitId(null);
          setInspectedUnitUI(null);
        }
        return;
      }

      // 2. Magnet Tool
      if (tool === 'tool_magnet') {
        for (const u of s.units) {
          const d = Math.hypot(u.x - (tx + 0.5), u.y - (ty + 0.5));
          if (d <= radius * 2.5 + 2) {
            u.x = tx + 0.5 + (Math.random() - 0.5) * 1.4;
            u.y = ty + 0.5 + (Math.random() - 0.5) * 1.4;
          }
        }
        return;
      }

      // 3. Bless Tool
      if (tool === 'tool_bless') {
        let blessedCount = 0;
        for (const u of s.units) {
          const d = Math.hypot(u.x - (tx + 0.5), u.y - (ty + 0.5));
          if (d <= radius + 2.5) {
            if (!u.traits.includes('Blessed')) u.traits.push('Blessed');
            if (!u.traits.includes('Immortal') && Math.random() < 0.35) u.traits.push('Immortal');
            u.maxHp = Math.round(u.maxHp * 1.25);
            u.hp = u.maxHp;
            u.attack = Math.round(u.attack * 1.2);
            blessedCount++;
          }
        }
        for (let i = 0; i < 8; i++) {
          s.particles.push({
            x: tx + 0.5,
            y: ty + 0.5,
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            color: '#fde047',
            size: 2.5,
            life: 24,
            maxLife: 24
          });
        }
        if (blessedCount > 0 && !isDragEvent) {
          s.miraclesCast++;
          addScore(40 * blessedCount);
          audio.playPowerup();
          pushChronicle(`Tahun ${s.year}: Berkah Ilahi menyinari ${blessedCount} makhluk terpilih.`, 'miracle');
        }
        return;
      }

      // 4. Smite Tool
      if (tool === 'tool_smite') {
        const before = s.units.length;
        s.units = s.units.filter((u) => Math.hypot(u.x - (tx + 0.5), u.y - (ty + 0.5)) > radius + 1.5);
        const removed = before - s.units.length;
        if (removed > 0) {
          audio.playExplosion();
          addScore(15 * removed);
        }
        return;
      }

      // 5. Terrain Brushes
      if (tool.startsWith('biome_')) {
        const targetBiome = tool.replace('biome_', '') as BiomeType;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius + 0.5) {
              const nx = tx + dx;
              const ny = ty + dy;
              if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
                const idx = ny * s.gridW + nx;
                s.biomes[idx] = targetBiome;
                if (!isLandBiome(targetBiome)) {
                  s.resources[idx] = 'none';
                  s.territory[idx] = -1;
                } else if (targetBiome === 'forest' && Math.random() < 0.35) {
                  s.resources[idx] = 'tree';
                }
              }
            }
          }
        }
        if (!isDragEvent) {
          addScore(10);
          audio.playClick();
        }
        return;
      }

      // 6. Spawn Civilizations & Creatures
      if (tool.startsWith('spawn_')) {
        const race = tool.replace('spawn_', '') as RaceType;
        if (isDragEvent && (race === 'dragon' || race === 'ufo')) return; // Prevent accidental flood of dragons on drag
        const spawned = spawnUnitAt(race, tx, ty);
        if (spawned) {
          addScore(race === 'dragon' || race === 'ufo' ? 75 : 25);
          if (!isDragEvent) {
            audio.playEat();
            if (race === 'dragon') {
              pushChronicle(`Tahun ${s.year}: Seekor Naga Api kuno (${spawned.name}) turun dari langit!`, 'disaster');
            }
          }
        }
        return;
      }

      // 7. Nature & Resources
      if (tool === 'res_tree' || tool === 'res_stone' || tool === 'res_gold') {
        const resType = tool.replace('res_', '') as ResourceType;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius && Math.random() < 0.55) {
              const nx = tx + dx;
              const ny = ty + dy;
              if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
                const idx = ny * s.gridW + nx;
                if (isLandBiome(s.biomes[idx])) {
                  s.resources[idx] = resType;
                }
              }
            }
          }
        }
        if (!isDragEvent) {
          addScore(15);
          audio.playClick();
        }
        return;
      }

      if (tool === 'power_rain') {
        for (let dy = -radius * 2; dy <= radius * 2; dy++) {
          for (let dx = -radius * 2; dx <= radius * 2; dx++) {
            if (dx * dx + dy * dy <= radius * radius * 4) {
              const nx = tx + dx;
              const ny = ty + dy;
              if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
                const idx = ny * s.gridW + nx;
                if (s.resources[idx] === 'fire') s.resources[idx] = 'none';
                if (s.biomes[idx] === 'scorched') s.biomes[idx] = 'grass';
                if (s.biomes[idx] === 'lava') s.biomes[idx] = 'mountain';
                if (s.biomes[idx] === 'grass' && Math.random() < 0.08) s.resources[idx] = 'berry';
              }
            }
          }
        }
        for (const u of s.units) {
          if (Math.hypot(u.x - tx, u.y - ty) <= radius * 2 + 2) {
            u.hp = Math.min(u.maxHp, u.hp + 40);
            u.traits = u.traits.filter((t) => t !== 'Infected');
          }
        }
        if (!isDragEvent) {
          s.miraclesCast++;
          addScore(35);
          audio.playPowerup();
        }
        return;
      }

      // 8. Disasters & Wrath
      if (isDragEvent && (tool === 'disaster_nuke' || tool === 'disaster_meteor')) return;

      if (tool === 'disaster_lightning') {
        s.disastersTriggered++;
        s.shockwaves.push({ x: tx + 0.5, y: ty + 0.5, radius: 0.5, maxRadius: 6, color: '#fde047', alpha: 1 });
        for (let i = 0; i < 16; i++) {
          s.particles.push({
            x: tx + 0.5,
            y: ty + 0.5,
            vx: (Math.random() - 0.5) * 0.7,
            vy: (Math.random() - 0.5) * 0.7,
            color: i % 2 === 0 ? '#fde047' : '#ffffff',
            size: 2.5,
            life: 18,
            maxLife: 18
          });
        }
        for (const u of s.units) {
          const d = Math.hypot(u.x - tx, u.y - ty);
          if (d <= 4.5) {
            u.hp -= 85;
            if (u.hp > 0 && Math.random() < 0.35 && !u.traits.includes('Immortal')) {
              u.traits.push('Immortal');
            }
          }
        }
        const idx = ty * s.gridW + tx;
        if (isLandBiome(s.biomes[idx])) s.resources[idx] = 'fire';
        screenShake.trigger('subtle');
        audio.playExplosion();
        addScore(30);
        return;
      }

      if (tool === 'disaster_meteor' || tool === 'disaster_nuke') {
        const isNuke = tool === 'disaster_nuke';
        const blastR = isNuke ? 13 : 6;
        s.disastersTriggered++;
        s.shockwaves.push({
          x: tx + 0.5,
          y: ty + 0.5,
          radius: 1,
          maxRadius: blastR * 1.4,
          color: isNuke ? '#ef4444' : '#f97316',
          alpha: 1
        });

        for (let dy = -blastR; dy <= blastR; dy++) {
          for (let dx = -blastR; dx <= blastR; dx++) {
            const dist = Math.hypot(dx, dy);
            if (dist <= blastR) {
              const nx = tx + dx;
              const ny = ty + dy;
              if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
                const idx = ny * s.gridW + nx;
                if (dist <= blastR * 0.35) {
                  s.biomes[idx] = isNuke ? 'lava' : 'scorched';
                  s.resources[idx] = 'none';
                  s.territory[idx] = -1;
                } else if (dist <= blastR * 0.75) {
                  if (s.biomes[idx] !== 'deep_ocean') {
                    s.biomes[idx] = 'scorched';
                    s.resources[idx] = Math.random() < 0.45 ? 'fire' : 'none';
                  }
                } else if (isLandBiome(s.biomes[idx]) && Math.random() < 0.35) {
                  s.resources[idx] = 'fire';
                }
              }
            }
          }
        }

        // Damage units & buildings in blast radius
        for (const u of s.units) {
          const d = Math.hypot(u.x - tx, u.y - ty);
          if (d <= blastR + 1.5) {
            u.hp -= isNuke ? 500 : 180;
          }
        }
        s.buildings = s.buildings.filter((b) => Math.hypot(b.x - tx, b.y - ty) > blastR * 0.85);

        for (let i = 0; i < (isNuke ? 45 : 24); i++) {
          s.particles.push({
            x: tx + 0.5,
            y: ty + 0.5,
            vx: (Math.random() - 0.5) * (isNuke ? 1.4 : 0.9),
            vy: (Math.random() - 0.5) * (isNuke ? 1.4 : 0.9),
            color: i % 3 === 0 ? '#fde047' : i % 2 === 0 ? '#f97316' : '#ef4444',
            size: isNuke ? 3.5 : 2.5,
            life: isNuke ? 38 : 24,
            maxLife: isNuke ? 38 : 24
          });
        }

        screenShake.trigger(isNuke ? 'heavy' : 'medium');
        audio.playExplosion();
        addScore(isNuke ? 120 : 60);
        pushChronicle(
          `Tahun ${s.year}: ${isNuke ? 'Ledakan Termonuklir Tsar Bomba' : 'Hantaman Meteorit Raksasa'} mengguncang koordinat (${tx}, ${ty})!`,
          'disaster'
        );
        return;
      }

      if (tool === 'disaster_plague') {
        s.disastersTriggered++;
        let infected = 0;
        for (const u of s.units) {
          if (Math.hypot(u.x - tx, u.y - ty) <= radius + 4) {
            if (!u.traits.includes('Immortal') && !u.traits.includes('Blessed') && !u.traits.includes('Infected')) {
              u.traits.push('Infected');
              infected++;
            }
          }
        }
        for (let i = 0; i < 12; i++) {
          s.particles.push({
            x: tx + 0.5,
            y: ty + 0.5,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            color: '#a855f7',
            size: 2.5,
            life: 25,
            maxLife: 25
          });
        }
        if (!isDragEvent && infected > 0) {
          pushChronicle(`Tahun ${s.year}: Wabah Ungu mulai menjangkiti ${infected} penduduk!`, 'disaster');
          audio.playHit();
        }
        return;
      }

      if (tool === 'disaster_ufo') {
        if (isDragEvent) return;
        s.disastersTriggered++;
        spawnUnitAt('ufo', tx, ty, ['Immortal', 'Fast']);
        pushChronicle(`Tahun ${s.year}: Objek Terbang Asing (UFO) terdeteksi di langit dunia!`, 'disaster');
        audio.playPowerup();
        addScore(80);
      }
    },
    [addScore, pushChronicle, spawnUnitAt]
  );

  // Advance 1 Simulation Tick
  const stepSimulation = useCallback(() => {
    const s = simRef.current;
    const laws = worldLawsRef.current;
    s.tickCount++;

    // Advance calendar every 35 ticks
    if (s.tickCount % 35 === 0) {
      s.month++;
      if (s.month > 12) {
        s.month = 1;
        s.year++;
        // Passive Divine Score per surviving year + kingdom prosperity
        const prosperityBonus = s.kingdoms.length * 15 + Math.min(80, s.units.length);
        addScore(prosperityBonus);
      }

      // Natural ecosystem regrowth & fire decay
      for (let i = 0; i < 28; i++) {
        const rx = Math.floor(Math.random() * s.gridW);
        const ry = Math.floor(Math.random() * s.gridH);
        const idx = ry * s.gridW + rx;
        if (s.resources[idx] === 'fire') {
          // Fire spreads or burns out
          if (Math.random() < 0.55) {
            s.resources[idx] = 'none';
            if (s.biomes[idx] === 'forest') s.biomes[idx] = 'scorched';
          }
        } else if (s.biomes[idx] === 'forest' && s.resources[idx] === 'none' && Math.random() < 0.08) {
          s.resources[idx] = 'tree';
        } else if (s.biomes[idx] === 'grass' && s.resources[idx] === 'none' && Math.random() < 0.05) {
          s.resources[idx] = 'berry';
        }
      }

      // Random natural disaster if enabled
      if (laws.naturalDisasters && Math.random() < 0.05) {
        const dx = 10 + Math.floor(Math.random() * (s.gridW - 20));
        const dy = 10 + Math.floor(Math.random() * (s.gridH - 20));
        s.shockwaves.push({ x: dx, y: dy, radius: 1, maxRadius: 7, color: '#f97316', alpha: 1 });
        pushChronicle(`Tahun ${s.year}: Badai petir alami menyambar koordinat (${dx}, ${dy}).`, 'disaster');
      }

      // Diplomacy & Wars between Kingdoms
      if (laws.diplomacyAndWars && s.kingdoms.length >= 2 && Math.random() < 0.14) {
        const k1 = s.kingdoms[Math.floor(Math.random() * s.kingdoms.length)];
        const k2 = s.kingdoms[Math.floor(Math.random() * s.kingdoms.length)];
        if (k1.id !== k2.id) {
          if (!k1.enemies.has(k2.id)) {
            // Higher chance of war if Orcs or different races
            const warChance = k1.race === 'orc' || k2.race === 'orc' ? 0.65 : k1.race !== k2.race ? 0.4 : 0.2;
            if (Math.random() < warChance) {
              k1.enemies.add(k2.id);
              k2.enemies.add(k1.id);
              s.totalWarsFought++;
              pushChronicle(`Tahun ${s.year}: Kerajaan ${k1.name} mendeklarasikan PERANG terhadap ${k2.name}!`, 'war');
            }
          } else if (Math.random() < 0.3) {
            k1.enemies.delete(k2.id);
            k2.enemies.delete(k1.id);
            pushChronicle(`Tahun ${s.year}: Perjanjian damai ditandatangani antara ${k1.name} dan ${k2.name}.`, 'kingdom');
          }
        }
      }
    }

    // Update Kingdom Populations & Kings
    const kingdomPopMap = new Map<number, UnitEntity[]>();
    for (const k of s.kingdoms) {
      kingdomPopMap.set(k.id, []);
    }

    // Process Units
    const newUnits: UnitEntity[] = [];
    for (let i = 0; i < s.units.length; i++) {
      const u = s.units[i];
      u.animFrame++;
      if (u.actionCooldown > 0) u.actionCooldown--;

      // Aging & Hunger
      if (s.tickCount % 70 === 0 && laws.hungerAndAging) {
        u.age++;
        u.hunger = Math.max(0, u.hunger - 3);
        if (u.traits.includes('Infected')) {
          u.hp -= 8;
        } else if (u.traits.includes('Blessed') && u.hp < u.maxHp) {
          u.hp = Math.min(u.maxHp, u.hp + 5);
        }
        if (!u.traits.includes('Immortal') && u.age > u.maxAge) {
          u.hp = 0;
        }
      }

      if (u.hp <= 0) {
        if (u.isKing) {
          pushChronicle(`Tahun ${s.year}: Raja ${u.name} telah gugur pada usia ${u.age} tahun.`, 'kingdom');
        }
        continue;
      }

      const tx = Math.max(0, Math.min(s.gridW - 1, Math.floor(u.x)));
      const ty = Math.max(0, Math.min(s.gridH - 1, Math.floor(u.y)));
      const tileIdx = ty * s.gridW + tx;
      const currentBiome = s.biomes[tileIdx];

      // Lava damage for non-flying units
      if (currentBiome === 'lava' && u.race !== 'dragon' && u.race !== 'ufo') {
        u.hp -= 15;
      }

      // Plague contagion
      if (u.traits.includes('Infected') && Math.random() < 0.03) {
        for (const other of s.units) {
          if (
            other.id !== u.id &&
            !other.traits.includes('Infected') &&
            !other.traits.includes('Immortal') &&
            !other.traits.includes('Blessed') &&
            Math.hypot(other.x - u.x, other.y - u.y) < 2.2
          ) {
            other.traits.push('Infected');
          }
        }
      }

      // Civilized Unit Kingdom Founding & Resource Gathering
      const raceCfg = RACE_CONFIG[u.race];
      if (raceCfg.isCivilized) {
        // Check if kingdom still exists
        if (u.kingdomId !== null && !s.kingdoms.some((k) => k.id === u.kingdomId)) {
          u.kingdomId = null;
          u.isKing = false;
        }

        // Found a new Kingdom if unaligned on good land and enough unaligned neighbors
        if (
          u.kingdomId === null &&
          (currentBiome === 'grass' || currentBiome === 'forest' || currentBiome === 'mountain') &&
          s.territory[tileIdx] === -1 &&
          s.kingdoms.length < 10
        ) {
          const nearbySameRace = s.units.filter(
            (other) =>
              other.race === u.race &&
              other.kingdomId === null &&
              Math.hypot(other.x - u.x, other.y - u.y) <= 10
          );

          if (nearbySameRace.length >= 3) {
            const civRace = u.race as 'human' | 'elf' | 'orc' | 'dwarf';
            const namePool = KINGDOM_NAMES[civRace];
            const kName =
              namePool[s.kingdoms.length % namePool.length] +
              (s.kingdoms.length >= namePool.length ? ` II` : '');
            const kId = s.nextEntityId++;

            const newKingdom: KingdomEntity = {
              id: kId,
              name: kName,
              race: civRace,
              color: raceCfg.primaryColor,
              borderColor: raceCfg.secondaryColor,
              capitalX: tx,
              capitalY: ty,
              wood: 30,
              stone: 20,
              gold: 10,
              food: 40,
              population: nearbySameRace.length,
              kingUnitId: u.id,
              enemies: new Set<number>(),
              foundedYear: s.year
            };

            u.isKing = true;
            s.kingdoms.push(newKingdom);
            kingdomPopMap.set(kId, []);

            // Claim initial territory radius 6
            for (let dy = -6; dy <= 6; dy++) {
              for (let dx = -6; dx <= 6; dx++) {
                if (dx * dx + dy * dy <= 38) {
                  const nx = tx + dx;
                  const ny = ty + dy;
                  if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
                    const nIdx = ny * s.gridW + nx;
                    if (isLandBiome(s.biomes[nIdx]) && s.territory[nIdx] === -1) {
                      s.territory[nIdx] = kId;
                    }
                  }
                }
              }
            }

            // Build Town Hall
            s.buildings.push({
              id: s.nextEntityId++,
              x: tx,
              y: ty,
              kingdomId: kId,
              race: civRace,
              type: 'hall',
              hp: 300,
              maxHp: 300
            });

            nearbySameRace.forEach((member) => {
              member.kingdomId = kId;
            });

            addScore(250);
            pushChronicle(
              `Tahun ${s.year}: Kerajaan ${kName} (${raceCfg.label}) didirikan oleh Raja ${u.name}!`,
              'kingdom'
            );
          }
        }

        // Gather resources on current tile
        if (u.kingdomId !== null) {
          const k = s.kingdoms.find((kg) => kg.id === u.kingdomId);
          if (k) {
            kingdomPopMap.get(k.id)?.push(u);
            const res = s.resources[tileIdx];
            if (res === 'tree' && Math.random() < 0.08) {
              k.wood += 8;
              s.resources[tileIdx] = 'none';
            } else if (res === 'berry' && Math.random() < 0.1) {
              k.food += 10;
              u.hunger = Math.min(100, u.hunger + 35);
              u.hp = Math.min(u.maxHp, u.hp + 15);
              s.resources[tileIdx] = 'none';
            } else if (res === 'stone' && Math.random() < 0.06) {
              k.stone += 8;
              s.resources[tileIdx] = 'none';
            } else if (res === 'gold' && Math.random() < 0.05) {
              k.gold += 10;
              s.resources[tileIdx] = 'none';
            }

            // Construct new buildings if Kingdom has resources
            if (
              k.wood >= 16 &&
              s.buildings.length < 95 &&
              Math.random() < 0.025 &&
              (currentBiome === 'grass' || currentBiome === 'forest' || currentBiome === 'mountain')
            ) {
              const tooClose = s.buildings.some((b) => Math.hypot(b.x - tx, b.y - ty) < 3.2);
              if (!tooClose) {
                k.wood -= 16;
                const bType: BuildingEntity['type'] =
                  k.stone >= 15 && Math.random() < 0.3
                    ? 'tower'
                    : currentBiome === 'mountain'
                    ? 'mine'
                    : 'house';
                if (bType === 'tower') k.stone -= 12;

                s.buildings.push({
                  id: s.nextEntityId++,
                  x: tx,
                  y: ty,
                  kingdomId: k.id,
                  race: k.race,
                  type: bType,
                  hp: bType === 'tower' ? 220 : 140,
                  maxHp: bType === 'tower' ? 220 : 140
                });

                // Expand territory around new building
                for (let dy = -4; dy <= 4; dy++) {
                  for (let dx = -4; dx <= 4; dx++) {
                    if (dx * dx + dy * dy <= 16) {
                      const nx = tx + dx;
                      const ny = ty + dy;
                      if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
                        const nIdx = ny * s.gridW + nx;
                        if (isLandBiome(s.biomes[nIdx])) {
                          s.territory[nIdx] = k.id;
                        }
                      }
                    }
                  }
                }
                addScore(35);
              }
            }

            // Reproduction if Kingdom is prosperous and population < 140
            if (
              s.units.length + newUnits.length < 140 &&
              k.food >= 12 &&
              u.age >= 16 &&
              Math.random() < 0.008
            ) {
              k.food -= 8;
              const child = spawnUnitAt(u.race, tx, ty);
              if (child) {
                child.kingdomId = k.id;
              }
            }
          }
        }
      }

      // Combat & Enemy Detection
      let enemyTarget: UnitEntity | null = null;
      let minEnemyDist = u.race === 'dragon' || u.race === 'ufo' ? 18 : 9;

      for (const other of s.units) {
        if (other.id === u.id || other.hp <= 0) continue;
        let isHostile = false;

        if (u.race === 'dragon' || u.race === 'ufo') {
          isHostile = other.race !== u.race;
        } else if (u.race === 'wolf') {
          isHostile = other.race === 'sheep' || (other.race !== 'wolf' && Math.random() < 0.2);
        } else if (raceCfg.isCivilized) {
          if (other.race === 'dragon' || other.race === 'ufo' || other.race === 'wolf') {
            isHostile = true;
          } else if (
            laws.diplomacyAndWars &&
            u.kingdomId !== null &&
            other.kingdomId !== null &&
            u.kingdomId !== other.kingdomId
          ) {
            const myK = s.kingdoms.find((k) => k.id === u.kingdomId);
            if (myK?.enemies.has(other.kingdomId)) {
              isHostile = true;
            }
          }
        }

        if (isHostile) {
          const d = Math.hypot(other.x - u.x, other.y - u.y);
          if (d < minEnemyDist) {
            minEnemyDist = d;
            enemyTarget = other;
          }
        }
      }

      if (enemyTarget) {
        u.targetX = enemyTarget.x;
        u.targetY = enemyTarget.y;
        const attackRange = u.race === 'dragon' || u.race === 'ufo' || u.race === 'elf' ? 3.2 : 1.4;
        if (minEnemyDist <= attackRange && u.actionCooldown === 0) {
          enemyTarget.hp -= u.attack;
          u.actionCooldown = 18;

          // Particle hit effect
          s.particles.push({
            x: enemyTarget.x,
            y: enemyTarget.y,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25,
            color: u.race === 'dragon' ? '#f97316' : u.race === 'ufo' ? '#22d3ee' : '#ef4444',
            size: 2,
            life: 10,
            maxLife: 10
          });

          // Dragon fire breath on tile
          if (u.race === 'dragon' && Math.random() < 0.4) {
            const etx = Math.floor(enemyTarget.x);
            const ety = Math.floor(enemyTarget.y);
            if (etx >= 0 && etx < s.gridW && ety >= 0 && ety < s.gridH) {
              s.resources[ety * s.gridW + etx] = 'fire';
            }
          }

          if (enemyTarget.hp <= 0) {
            u.kills++;
            u.level = Math.min(10, 1 + Math.floor(u.kills / 2));
            u.maxHp += 10;
            u.hp = Math.min(u.maxHp, u.hp + 20);
            if (u.kills >= 3 && !u.traits.includes('Veteran')) u.traits.push('Veteran');
            if (enemyTarget.isKing && !u.traits.includes('Kingslayer')) {
              u.traits.push('Kingslayer');
              pushChronicle(`Tahun ${s.year}: ${u.name} menumbangkan Raja ${enemyTarget.name} di medan tempur!`, 'war');
            }
          }
        }
      } else if (u.targetX === null || u.targetY === null || Math.hypot(u.targetX - u.x, u.targetY - u.y) < 0.8) {
        // Choose a new wander / patrol target
        const wanderRadius = u.race === 'dragon' || u.race === 'ufo' ? 22 : 9;
        const candX = Math.max(1, Math.min(s.gridW - 2, Math.floor(u.x + (Math.random() - 0.5) * wanderRadius * 2)));
        const candY = Math.max(1, Math.min(s.gridH - 2, Math.floor(u.y + (Math.random() - 0.5) * wanderRadius * 2)));
        const candBiome = s.biomes[candY * s.gridW + candX];
        if (u.race === 'dragon' || u.race === 'ufo' || isLandBiome(candBiome)) {
          u.targetX = candX + 0.5;
          u.targetY = candY + 0.5;
        }
      }

      // Move toward target
      if (u.targetX !== null && u.targetY !== null) {
        const dx = u.targetX - u.x;
        const dy = u.targetY - u.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.15) {
          const step = Math.min(dist, u.speed);
          const nextX = u.x + (dx / dist) * step;
          const nextY = u.y + (dy / dist) * step;
          const ntx = Math.max(0, Math.min(s.gridW - 1, Math.floor(nextX)));
          const nty = Math.max(0, Math.min(s.gridH - 1, Math.floor(nextY)));
          const nextBiome = s.biomes[nty * s.gridW + ntx];

          if (u.race === 'dragon' || u.race === 'ufo' || isLandBiome(nextBiome) || nextBiome === 'shallow_water') {
            const waterSlowdown = nextBiome === 'shallow_water' && u.race !== 'dragon' && u.race !== 'ufo' ? 0.45 : 1;
            u.x += (dx / dist) * step * waterSlowdown;
            u.y += (dy / dist) * step * waterSlowdown;
          } else {
            u.targetX = null;
            u.targetY = null;
          }
        }
      }
    }

    // Filter dead units
    s.units = s.units.filter((u) => u.hp > 0);

    // Update Kingdoms & elect new King if needed
    s.kingdoms = s.kingdoms.filter((k) => {
      const members = kingdomPopMap.get(k.id) || [];
      k.population = members.length;
      if (k.population === 0) {
        // Clear territory of fallen kingdom
        for (let i = 0; i < s.territory.length; i++) {
          if (s.territory[i] === k.id) s.territory[i] = -1;
        }
        s.buildings = s.buildings.filter((b) => b.kingdomId !== k.id);
        pushChronicle(`Tahun ${s.year}: Kerajaan ${k.name} telah runtuh dan tinggal sejarah.`, 'kingdom');
        return false;
      }

      const hasLivingKing = members.some((m) => m.id === k.kingUnitId && m.hp > 0);
      if (!hasLivingKing && members.length > 0) {
        const newKing = members[0];
        newKing.isKing = true;
        k.kingUnitId = newKing.id;
      }
      return true;
    });

    // Update Particles & Shockwaves
    s.particles = s.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      return p.life > 0;
    });

    s.shockwaves = s.shockwaves.filter((sw) => {
      sw.radius += 0.45;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      return sw.radius < sw.maxRadius;
    });

    // Evaluate Divine Era Challenges
    for (const challenge of DIVINE_ERA_CHALLENGES) {
      if (!s.completedEras.has(challenge.id) && challenge.check(s)) {
        s.completedEras.add(challenge.id);
        addScore(challenge.rewardScore);
        audio.playLevelUp();
        pushChronicle(
          `Tahun ${s.year}: TANTANGAN TERCAPAI — ${challenge.title} (+${challenge.rewardScore} Divine Score)!`,
          'era'
        );
      }
    }

    // Sync React HUD periodically
    if (s.tickCount % 12 === 0) {
      setHudStats({
        year: s.year,
        month: s.month,
        population: s.units.length,
        kingdomCount: s.kingdoms.length,
        buildingCount: s.buildings.length,
        warsCount: s.totalWarsFought,
        completedEraCount: s.completedEras.size
      });
      setChroniclesUI([...s.chronicles.slice(0, 12)]);
      setKingdomsUI([...s.kingdoms]);

      if (selectedUnitIdRef.current !== null) {
        const found = s.units.find((u) => u.id === selectedUnitIdRef.current) || null;
        setInspectedUnitUI(found ? { ...found } : null);
      }
    }
  }, [addScore, pushChronicle, spawnUnitAt]);

  // Render World to 2D Canvas
  const renderWorld = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = simRef.current;
    const laws = worldLawsRef.current;
    const { zoom, panX, panY } = cameraRef.current;

    const fullW = s.gridW * TILE_SIZE;
    const fullH = s.gridH * TILE_SIZE;

    if (canvas.width !== fullW || canvas.height !== fullH) {
      canvas.width = fullW;
      canvas.height = fullH;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#071324';
    ctx.fillRect(0, 0, fullW, fullH);

    // Apply camera pan & zoom around center
    ctx.translate(fullW / 2 + panX, fullH / 2 + panY);
    ctx.scale(zoom, zoom);
    ctx.translate(-fullW / 2, -fullH / 2);

    const waterPhase = Math.floor(s.tickCount / 20) % 2;
    const kingdomColorLookup = new Map<number, string>();
    for (const k of s.kingdoms) {
      kingdomColorLookup.set(k.id, k.color);
    }

    // 1. Render Terrain Biomes & Resources
    for (let y = 0; y < s.gridH; y++) {
      for (let x = 0; x < s.gridW; x++) {
        const idx = y * s.gridW + x;
        const biome = s.biomes[idx];
        const colors = BIOME_COLORS[biome];
        const checker = (x + y + (biome === 'deep_ocean' || biome === 'shallow_water' ? waterPhase : 0)) % 2;
        ctx.fillStyle = colors[checker];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // Kingdom territory overlay
        if (laws.showKingdomBorders && s.territory[idx] !== -1) {
          const kColor = kingdomColorLookup.get(s.territory[idx]);
          if (kColor) {
            ctx.fillStyle = kColor + '28';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

            // Highlight border edge
            const rightDiff = x < s.gridW - 1 && s.territory[idx + 1] !== s.territory[idx];
            const bottomDiff = y < s.gridH - 1 && s.territory[idx + s.gridW] !== s.territory[idx];
            if (rightDiff || bottomDiff) {
              ctx.fillStyle = kColor + 'aa';
              if (rightDiff) ctx.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
              if (bottomDiff) ctx.fillRect(px, py + TILE_SIZE - 1, TILE_SIZE, 1);
            }
          }
        }

        // Resources
        const res = s.resources[idx];
        if (res === 'tree') {
          ctx.fillStyle = '#78350f';
          ctx.fillRect(px + 3, py + 5, 2, 3);
          ctx.fillStyle = '#15803d';
          ctx.fillRect(px + 1, py + 1, 6, 4);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(px + 2, py, 4, 2);
        } else if (res === 'berry') {
          ctx.fillStyle = '#166534';
          ctx.fillRect(px + 2, py + 2, 4, 4);
          ctx.fillStyle = '#f43f5e';
          ctx.fillRect(px + 2, py + 2, 2, 2);
          ctx.fillRect(px + 4, py + 4, 2, 2);
        } else if (res === 'stone') {
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(px + 1, py + 2, 5, 5);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(px + 2, py + 2, 3, 2);
        } else if (res === 'gold') {
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(px + 1, py + 2, 6, 5);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(px + 2, py + 3, 3, 2);
        } else if (res === 'fire') {
          ctx.fillStyle = s.tickCount % 4 < 2 ? '#f97316' : '#fde047';
          ctx.fillRect(px + 2, py + 1, 4, 6);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(px + 1, py + 4, 6, 3);
        }
      }
    }

    // 2. Render Buildings
    for (const b of s.buildings) {
      const bx = b.x * TILE_SIZE;
      const by = b.y * TILE_SIZE;
      const raceColor = RACE_CONFIG[b.race].primaryColor;

      if (b.type === 'hall') {
        // Grand Castle / Town Hall (12x12 pixel sprite)
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(bx - 2, by - 2, 12, 10);
        ctx.fillStyle = raceColor;
        ctx.fillRect(bx - 3, by - 5, 14, 4);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(bx + 2, by - 8, 4, 3);
      } else if (b.type === 'tower') {
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(bx + 1, by - 3, 6, 11);
        ctx.fillStyle = raceColor;
        ctx.fillRect(bx, by - 5, 8, 3);
      } else if (b.type === 'mine') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(bx, by + 1, 8, 7);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(bx + 2, by + 3, 4, 4);
      } else {
        // House
        ctx.fillStyle = '#d6d3d1';
        ctx.fillRect(bx + 1, by + 2, 6, 6);
        ctx.fillStyle = raceColor;
        ctx.fillRect(bx, by, 8, 3);
      }
    }

    // 3. Render Units (Pixel Art Sprites)
    for (const u of s.units) {
      const ux = Math.round(u.x * TILE_SIZE);
      const uy = Math.round(u.y * TILE_SIZE);
      const cfg = RACE_CONFIG[u.race];
      const bob = Math.floor(u.animFrame / 8) % 2;

      if (u.race === 'dragon') {
        // Large winged pixel dragon
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(ux - 8, uy - 4 + bob, 16, 8);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(ux - 4, uy - 7 + bob, 8, 12);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(ux - 2, uy - 6 + bob, 2, 2);
        ctx.fillRect(ux + 1, uy - 6 + bob, 2, 2);
      } else if (u.race === 'ufo') {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(ux - 6, uy - 2, 12, 4);
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(ux - 3, uy - 5, 6, 3);
      } else {
        const scale = u.traits.includes('Giant') ? 1.5 : 1;
        const w = Math.round(4 * scale);
        const h = Math.round(5 * scale);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(ux - w / 2, uy + h / 2, w, 2);

        // Body
        ctx.fillStyle = cfg.primaryColor;
        ctx.fillRect(ux - w / 2, uy - h / 2 - bob, w, h);

        // Head
        ctx.fillStyle = u.race === 'orc' ? '#4ade80' : '#fed7aa';
        ctx.fillRect(ux - w / 2, uy - h / 2 - 2 - bob, w, 2);

        // King Crown
        if (u.isKing) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(ux - 2, uy - h / 2 - 5 - bob, 5, 3);
        }

        // Blessed Halo
        if (u.traits.includes('Blessed')) {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1;
          ctx.strokeRect(ux - 4, uy - 6, 8, 10);
        }
      }

      // Highlight ring if selected in Inspector
      if (selectedUnitIdRef.current === u.id) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ux - 6, uy - 8, 12, 14);
      }
    }

    // 4. Render Kingdom Name Banners at Capitals
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    for (const k of s.kingdoms) {
      const kx = (k.capitalX + 0.5) * TILE_SIZE;
      const ky = k.capitalY * TILE_SIZE - 8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      const textW = ctx.measureText(k.name).width + 8;
      ctx.fillRect(kx - textW / 2, ky - 8, textW, 11);
      ctx.fillStyle = k.borderColor;
      ctx.fillText(k.name, kx, ky);
    }

    // 5. Render Particles & Shockwaves
    for (const p of s.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * TILE_SIZE, p.y * TILE_SIZE, p.size, p.size);
    }

    for (const sw of s.shockwaves) {
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sw.x * TILE_SIZE, sw.y * TILE_SIZE, sw.radius * TILE_SIZE, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, []);

  // Main Engine Lifecycle & Loop
  useEffect(() => {
    generateWorld('archipelago');
  }, [generateWorld]);

  useEffect(() => {
    if (gameState !== 'playing') {
      stopLoop();
      renderWorld();
      return;
    }

    startLoop(() => {
      const spd = simSpeedRef.current;
      for (let i = 0; i < spd; i++) {
        stepSimulation();
      }
      renderWorld();
    });

    return () => {
      stopLoop();
    };
  }, [gameState, startLoop, stopLoop, stepSimulation, renderWorld]);

  // Convert screen pointer event to tile coordinates (accounting for zoom & pan)
  const getTileCoordsFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const rawX = (clientX - rect.left) * scaleX;
    const rawY = (clientY - rect.top) * scaleY;

    const { zoom, panX, panY } = cameraRef.current;
    const fullW = canvas.width;
    const fullH = canvas.height;

    const worldPx = (rawX - fullW / 2 - panX) / zoom + fullW / 2;
    const worldPy = (rawY - fullH / 2 - panY) / zoom + fullH / 2;

    const tx = Math.floor(worldPx / TILE_SIZE);
    const ty = Math.floor(worldPy / TILE_SIZE);
    return { tx, ty };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      isPanningRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    isPointerDownRef.current = true;
    const coords = getTileCoordsFromPointer(e.clientX, e.clientY);
    if (coords) {
      applyToolAtTile(coords.tx, coords.ty, false);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanPointRef.current.x;
      const dy = e.clientY - lastPanPointRef.current.y;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      setCameraPan((prev) => ({
        x: Math.max(-300, Math.min(300, prev.x + dx)),
        y: Math.max(-200, Math.min(200, prev.y + dy))
      }));
      return;
    }
    if (!isPointerDownRef.current || gameState !== 'playing') return;
    const coords = getTileCoordsFromPointer(e.clientX, e.clientY);
    if (coords) {
      applyToolAtTile(coords.tx, coords.ty, true);
    }
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    isPanningRef.current = false;
  };

  // Direct actions inside the Unit Inspector Panel
  const handleBlessInspectedUnit = () => {
    if (!inspectedUnitUI) return;
    const s = simRef.current;
    const u = s.units.find((unit) => unit.id === inspectedUnitUI.id);
    if (!u) return;
    if (!u.traits.includes('Blessed')) u.traits.push('Blessed');
    if (!u.traits.includes('Immortal')) u.traits.push('Immortal');
    u.maxHp = Math.round(u.maxHp * 1.4);
    u.hp = u.maxHp;
    u.attack = Math.round(u.attack * 1.3);
    setInspectedUnitUI({ ...u });
    addScore(100);
    audio.playPowerup();
    pushChronicle(`Tahun ${s.year}: ${u.name} dianugerahi Keabadian (Immortal) oleh Sang Dewa!`, 'miracle');
  };

  const handleSmiteInspectedUnit = () => {
    if (!inspectedUnitUI) return;
    const s = simRef.current;
    const u = s.units.find((unit) => unit.id === inspectedUnitUI.id);
    if (!u) return;
    s.shockwaves.push({ x: u.x, y: u.y, radius: 0.5, maxRadius: 5, color: '#fde047', alpha: 1 });
    u.hp = 0;
    setSelectedUnitId(null);
    setInspectedUnitUI(null);
    audio.playExplosion();
    addScore(25);
  };

  const handleStartSandbox = () => {
    setScore(0);
    generateWorld(worldTemplate);
    startWithCountdown();
  };

  const handleClaimDivineScore = () => {
    const finalScore = Math.max(
      scoreRef.current,
      hudStats.population * 25 + hudStats.kingdomCount * 300 + hudStats.year * 20
    );
    setScore(finalScore);
    audio.playLevelUp();
    triggerGameOver(finalScore);
  };

  const activeTools = TOOL_CATALOG.filter((t) => t.category === activeCategory);
  const currentToolInfo = TOOL_CATALOG.find((t) => t.id === selectedTool) || TOOL_CATALOG[0];
  const nextEraChallenge =
    DIVINE_ERA_CHALLENGES.find((c) => !simRef.current.completedEras.has(c.id)) ||
    DIVINE_ERA_CHALLENGES[DIVINE_ERA_CHALLENGES.length - 1];

  return (
    <div className="relative w-full h-full min-h-[560px] bg-slate-950 text-slate-100 flex flex-col select-none overflow-hidden rounded-xl border border-slate-800">
      {/* =================================================================== */}
      {/* TOP CHRONICLE & SIMULATION HUD BAR                                  */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 z-20">
        {/* Left: World Stats */}
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <Compass className="w-4 h-4 shrink-0" />
            <span>
              Tahun {hudStats.year} · Bln {hudStats.month}
            </span>
          </div>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <div className="flex items-center gap-1.5 text-slate-200">
            <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Populasi: {hudStats.population}</span>
          </div>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
            ·
          </span>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-200">
            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Kerajaan: {hudStats.kingdomCount}</span>
          </div>
          <span className="text-slate-600 hidden md:inline" aria-hidden="true">
            ·
          </span>
          <div className="hidden md:flex items-center gap-1.5 text-slate-200">
            <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Era: {hudStats.completedEraCount}/{DIVINE_ERA_CHALLENGES.length}
            </span>
          </div>
        </div>

        {/* Center: Simulation Speed & World Generator */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setSimSpeed(0)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                simSpeed === 0
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Jeda Simulasi"
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
            {([1, 3, 5] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSimSpeed(spd)}
                className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  simSpeed === spd
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <select
            aria-label="Template Dunia"
            value={worldTemplate}
            onChange={(e) => {
              const tpl = e.target.value as WorldTemplate;
              setWorldTemplate(tpl);
              generateWorld(tpl);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
          >
            <option value="archipelago">Kepulauan</option>
            <option value="pangaea">Benua Pangaea</option>
            <option value="volcanic">Cincin Vulkanik</option>
          </select>

          <button
            type="button"
            onClick={() => generateWorld(worldTemplate)}
            className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            title="Buat Dunia Baru"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Peta Baru</span>
          </button>
        </div>

        {/* Right: Divine Score & Claim Leaderboard Button */}
        <div className="flex items-center gap-3">
          <div className="text-right font-mono tabular-nums">
            <span className="text-[11px] text-slate-400 block leading-none">DIVINE SCORE</span>
            <span className="text-sm font-bold text-amber-400">{score.toLocaleString()}</span>
          </div>
          {gameState === 'playing' && (
            <button
              type="button"
              onClick={handleClaimDivineScore}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Klaim Skor</span>
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* ACTIVE ERA OBJECTIVE STRIP                                          */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 text-xs z-10">
        <div className="flex items-center gap-2 text-slate-300 truncate">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-300 whitespace-nowrap">{nextEraChallenge.title}:</span>
          <span className="text-slate-300 truncate">{nextEraChallenge.description}</span>
          <span className="text-slate-500" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums text-emerald-400 whitespace-nowrap">
            +{nextEraChallenge.rewardScore.toLocaleString()} Poin
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Kuas: <strong className="text-slate-200">{currentToolInfo.label}</strong></span>
          <span aria-hidden="true">·</span>
          <div className="flex items-center gap-1">
            <span>Radius:</span>
            {[1, 2, 4, 7].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setBrushRadius(r)}
                className={`px-1.5 py-0.5 font-mono tabular-nums rounded text-[11px] transition-colors ${
                  brushRadius === r
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MAIN WORKSPACE: 2D PIXEL CANVAS + RIGHT CHRONICLE/INSPECTOR DRAWER  */}
      {/* =================================================================== */}
      <div className="relative flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Interactive 2D World Viewport */}
        <div className="relative flex-1 bg-[#071324] flex items-center justify-center overflow-hidden min-h-[320px]">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full object-contain cursor-crosshair touch-none"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Floating Camera Zoom & Overlay Controls */}
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 z-10">
            <button
              type="button"
              onClick={() => setCameraZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Perbesar Peta"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCameraZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Perkecil Peta"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraZoom(1);
                setCameraPan({ x: 0, y: 0 });
              }}
              className="px-2 py-1 text-[11px] font-mono tabular-nums text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Reset Kamera"
            >
              {Math.round(cameraZoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() =>
                setWorldLaws((prev) => ({ ...prev, showKingdomBorders: !prev.showKingdomBorders }))
              }
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                worldLaws.showKingdomBorders
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Tampilkan Batas Wilayah Kerajaan"
            >
               Wilayah
            </button>
          </div>
        </div>

        {/* Right Sidebar: Unit Inspector, Kingdoms & Live World Chronicle */}
        <aside className="w-full lg:w-72 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between p-3 gap-3 overflow-y-auto max-h-56 lg:max-h-none z-10">
          {/* Section 1: Unit Inspector or World Laws */}
          {inspectedUnitUI ? (
            <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    {inspectedUnitUI.isKing && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                    <span>{inspectedUnitUI.name}</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    {RACE_CONFIG[inspectedUnitUI.race].label} · Lv.{inspectedUnitUI.level} · Usia {inspectedUnitUI.age} thn
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUnitId(null);
                    setInspectedUnitUI(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white px-1.5 py-0.5"
                >
                  Tutup
                </button>
              </div>

              <div className="space-y-1 text-xs font-mono tabular-nums">
                <div className="flex justify-between text-slate-300">
                  <span>HP: {inspectedUnitUI.hp}/{inspectedUnitUI.maxHp}</span>
                  <span>ATK: {inspectedUnitUI.attack} · Kills: {inspectedUnitUI.kills}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, (inspectedUnitUI.hp / inspectedUnitUI.maxHp) * 100))}%`
                    }}
                  />
                </div>
              </div>

              <div className="text-xs text-slate-300">
                <span className="text-slate-400">Traits: </span>
                {inspectedUnitUI.traits.length > 0
                  ? inspectedUnitUI.traits.join(' · ')
                  : 'Normal'}
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleBlessInspectedUnit}
                  className="px-2.5 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-md transition-colors whitespace-nowrap"
                >
                  Berkahi & Abadi
                </button>
                <button
                  type="button"
                  onClick={handleSmiteInspectedUnit}
                  className="px-2.5 py-1.5 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-md transition-colors whitespace-nowrap"
                >
                  Sambar Petir
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  <span>Hukum Dunia & Kerajaan</span>
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {kingdomsUI.length} Dinasti
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setWorldLaws((w) => ({ ...w, diplomacyAndWars: !w.diplomacyAndWars }))
                  }
                  className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                    worldLaws.diplomacyAndWars
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Perang & Diplomasi: {worldLaws.diplomacyAndWars ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setWorldLaws((w) => ({ ...w, naturalDisasters: !w.naturalDisasters }))
                  }
                  className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                    worldLaws.naturalDisasters
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Bencana Alami: {worldLaws.naturalDisasters ? 'ON' : 'OFF'}
                </button>
              </div>

              {kingdomsUI.length > 0 ? (
                <div className="space-y-1 pt-1 max-h-24 overflow-y-auto">
                  {kingdomsUI.slice(0, 5).map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-300"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: k.color }}
                        />
                        <span className="truncate font-sans font-medium text-slate-200">{k.name}</span>
                      </div>
                      <span className="text-slate-400 shrink-0">
                        Pop {k.population} · Emas {k.gold}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Letakkan minimal 3 Manusia, Elf, Orc, atau Kurcaci di daratan untuk mendirikan Kerajaan baru.
                </p>
              )}
            </div>
          )}

          {/* Section 2: World History Chronicle Log */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <ScrollText className="w-3.5 h-3.5 text-amber-400" />
                <span>Kronik Sejarah Dunia</span>
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">LIVE</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {chroniclesUI.map((c) => (
                <div key={c.id} className="text-slate-300 leading-snug border-b border-slate-800/60 pb-1">
                  <span
                    className={
                      c.category === 'war'
                        ? 'text-rose-400 font-medium'
                        : c.category === 'era'
                        ? 'text-amber-300 font-semibold'
                        : c.category === 'disaster'
                        ? 'text-orange-400'
                        : c.category === 'miracle'
                        ? 'text-sky-300'
                        : 'text-emerald-300'
                    }
                  >
                    {c.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* =================================================================== */}
      {/* BOTTOM GOD POWERS TOOLBAR (5 CATEGORIES + TOOL BUTTONS)             */}
      {/* =================================================================== */}
      <div className="bg-slate-900 border-t border-slate-800 px-3 py-2 space-y-2 z-20">
        {/* Category Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {[
            { id: 'terrain' as const, label: 'Medan & Bioma', icon: Globe },
            { id: 'civilization' as const, label: 'Peradaban & Ras', icon: Users },
            { id: 'nature' as const, label: 'Alam & Sumber Daya', icon: Trees },
            { id: 'disasters' as const, label: 'Bencana & Murka', icon: Flame },
            { id: 'inspector' as const, label: 'Inspeksi & Berkah', icon: Eye }
          ].map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  const firstTool = TOOL_CATALOG.find((t) => t.category === cat.id);
                  if (firstTool) setSelectedTool(firstTool.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Category Tool Palette */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {activeTools.map((tool) => {
            const isSelected = selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => {
                  setSelectedTool(tool.id);
                  audio.playClick();
                }}
                className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap shrink-0 min-h-[42px] border ${
                  isSelected
                    ? 'bg-slate-800 text-white border-amber-400 shadow-sm'
                    : 'bg-slate-950/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
                title={tool.shortDesc}
              >
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: tool.accent }}
                />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* SHARED ZIGAME OVERLAY (START / COUNTDOWN / PAUSE / GAME OVER)       */}
      {/* =================================================================== */}
      <GameOverlay
        gameState={gameState}
        score={score}
        highScore={highScore}
        countdown={countdown}
        title="WorldBox: God Simulator"
        description="Bentuk benua 2D Pixel Art, turunkan 4 bangsa fantasi otonom (Manusia, Elf, Orc, Kurcaci) & Naga, saksikan kerajaan bangkit atau berperang, dan selesaikan Tantangan Era Ilahi!"
        icon="🌍"
        themeColor="#f59e0b"
        onStart={handleStartSandbox}
        onRestart={handleStartSandbox}
      />
    </div>
  );
}
