// ============================================================================
// WORLDBOX 2.0 — STRICT DOMAIN TYPES & INTERFACES
// ============================================================================

export type BiomeType =
  | 'deep_ocean'
  | 'shallow_water'
  | 'sand'
  | 'grass'
  | 'forest'
  | 'swamp'
  | 'mountain'
  | 'lava'
  | 'scorched';

export type ResourceType = 'none' | 'tree' | 'berry' | 'stone' | 'gold' | 'fire';

export type CivilizedRace = 'human' | 'elf' | 'orc' | 'dwarf';

export type RaceType =
  | CivilizedRace
  | 'dragon'
  | 'sheep'
  | 'wolf'
  | 'ufo'
  | 'tornado';

export type UnitTrait =
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

export type ToolCategory =
  | 'terrain'
  | 'civilization'
  | 'nature'
  | 'disasters'
  | 'inspector';

export type ToolId =
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
  | 'disaster_tornado'
  | 'disaster_earthquake'
  | 'disaster_ufo'
  // Inspector & Divine Powers
  | 'tool_inspect'
  | 'tool_bless'
  | 'tool_magnet'
  | 'tool_smite';

export type WorldTemplate = 'archipelago' | 'pangaea' | 'volcanic';

export type SimSpeed = 0 | 1 | 2 | 5;

export type DiplomacyRelation = 'war' | 'peace' | 'alliance';

export interface GodPower {
  id: ToolId;
  category: ToolCategory;
  label: string;
  shortDesc: string;
  accent: string;
}

export interface Building {
  id: number;
  x: number;
  y: number;
  kingdomId: number;
  race: CivilizedRace;
  type: 'hall' | 'house' | 'tower' | 'mine';
  hp: number;
  maxHp: number;
}

export interface Kingdom {
  id: number;
  name: string;
  race: CivilizedRace;
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
  relations: Record<number, DiplomacyRelation>;
  foundedYear: number;
}

export interface Unit {
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
  lastAttackerId: number | null;
  lastAttackerName: string | null;
}

export interface DeceasedUnitRecord {
  id: number;
  name: string;
  race: RaceType;
  ageAtDeath: number;
  yearOfDeath: number;
  kills: number;
  level: number;
  isKing: boolean;
  traits: UnitTrait[];
  killerId: number | null;
  killerName: string | null;
  cause: string;
  lastX: number;
  lastY: number;
}

export type InspectedUnitStatus =
  | { status: 'alive'; unit: Unit }
  | { status: 'deceased'; record: DeceasedUnitRecord }
  | null;

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface ShockwaveFX {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

export interface ChronicleEvent {
  id: number;
  year: number;
  month: number;
  text: string;
  category: 'kingdom' | 'war' | 'disaster' | 'era' | 'miracle';
}

export interface WorldLaws {
  diplomacyAndWars: boolean;
  naturalDisasters: boolean;
  hungerAndAging: boolean;
  showKingdomBorders: boolean;
}

export interface CameraState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface DivineEraChallenge {
  id: string;
  eraNumber: number;
  title: string;
  description: string;
  rewardScore: number;
  check: (state: WorldState) => boolean;
}

export interface WorldState {
  gridW: number;
  gridH: number;
  biomes: BiomeType[];
  resources: ResourceType[];
  territory: Int16Array;
  terrainDirty: boolean;
  units: Unit[];
  deceasedArchive: Map<number, DeceasedUnitRecord>;
  buildings: Building[];
  kingdoms: Kingdom[];
  shockwaves: ShockwaveFX[];
  chronicles: ChronicleEvent[];
  nextEntityId: number;
  tickCount: number;
  year: number;
  month: number;
  windAngle: number;
  peakPopulation: number;
  totalWarsFought: number;
  disastersTriggered: number;
  miraclesCast: number;
  completedEras: Set<string>;
}

export interface HudSnapshot {
  year: number;
  month: number;
  population: number;
  kingdomCount: number;
  buildingCount: number;
  warsCount: number;
  completedEraCount: number;
  activeEraTitle: string;
  activeEraDesc: string;
  activeEraReward: number;
  chronicles: ChronicleEvent[];
  kingdoms: Kingdom[];
  inspected: InspectedUnitStatus;
}

export interface EngineCallbacks {
  onScoreAdd?: (points: number) => void;
  onSound?: (type: 'click' | 'coin' | 'powerup' | 'explosion' | 'hit' | 'levelup') => void;
  onShake?: (intensity: 'subtle' | 'medium' | 'heavy') => void;
}
