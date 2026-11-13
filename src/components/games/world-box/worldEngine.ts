// ============================================================================
// WORLDBOX 2.0 — PURE TYPESCRIPT SIMULATION ENGINE (ZERO REACT IMPORTS)
// ============================================================================

import {
  BIOME_INDEX_LIST,
  DIVINE_ERA_CHALLENGES,
  FIXED_TICK_SECONDS,
  GRID_H,
  GRID_W,
  KINGDOM_NAMES,
  MAX_PARTICLES,
  PEACE_REASONS,
  RACE_CONFIG,
  RESOURCE_INDEX_LIST,
  SAVE_STORAGE_KEY,
  SPATIAL_CELL_SIZE,
  UNIT_NAMES,
  WAR_REASONS
} from './constants';
import { FixedParticlePool, SpatialHashGrid, swapAndPop } from './spatialGrid';
import {
  BiomeType,
  Building,
  ChronicleEvent,
  CivilizedRace,
  DeceasedUnitRecord,
  DiplomacyRelation,
  EngineCallbacks,
  HudSnapshot,
  InspectedUnitStatus,
  Kingdom,
  RaceType,
  ResourceType,
  SimSpeed,
  ToolId,
  Unit,
  UnitTrait,
  WorldLaws,
  WorldState,
  WorldTemplate
} from './types';
import { isLandBiome, isWaterBiome, populateProceduralTerrain } from './worldGen';

interface SerializedWorldSave {
  version: number;
  year: number;
  month: number;
  biomesB64: string;
  resourcesB64: string;
  kingdoms: Kingdom[];
  buildings: Building[];
  units: Unit[];
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === 'function' ? btoa(binary) : binary;
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(b64) : b64;
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export class WorldBoxEngine {
  public readonly state: WorldState;
  public readonly spatialGrid: SpatialHashGrid<Unit>;
  public readonly particlePool: FixedParticlePool;
  public laws: WorldLaws;

  private readonly callbacks: EngineCallbacks;
  private readonly queryBuffer: Unit[] = [];
  private readonly secondaryBuffer: Unit[] = [];
  private accumulatorSeconds: number = 0;
  private isDestroyed: boolean = false;

  constructor(callbacks: EngineCallbacks = {}, gridW: number = GRID_W, gridH: number = GRID_H) {
    this.callbacks = callbacks;
    this.spatialGrid = new SpatialHashGrid<Unit>(gridW, gridH, SPATIAL_CELL_SIZE);
    this.particlePool = new FixedParticlePool(MAX_PARTICLES);
    this.laws = {
      diplomacyAndWars: true,
      naturalDisasters: false,
      hungerAndAging: true,
      showKingdomBorders: true
    };

    this.state = {
      gridW,
      gridH,
      biomes: new Array<BiomeType>(gridW * gridH).fill('deep_ocean'),
      resources: new Array<ResourceType>(gridW * gridH).fill('none'),
      territory: new Int16Array(gridW * gridH).fill(-1),
      terrainDirty: true,
      units: [],
      deceasedArchive: new Map<number, DeceasedUnitRecord>(),
      buildings: [],
      kingdoms: [],
      shockwaves: [],
      chronicles: [],
      nextEntityId: 1,
      tickCount: 0,
      year: 1,
      month: 1,
      windAngle: 0.4,
      peakPopulation: 0,
      totalWarsFought: 0,
      disastersTriggered: 0,
      miraclesCast: 0,
      completedEras: new Set<string>()
    };
  }

  public pushChronicle(text: string, category: ChronicleEvent['category'] = 'kingdom'): void {
    const s = this.state;
    const entry: ChronicleEvent = {
      id: s.nextEntityId++,
      year: s.year,
      month: s.month,
      text,
      category
    };
    s.chronicles.unshift(entry);
    if (s.chronicles.length > 35) {
      s.chronicles.pop();
    }
  }

  public generateWorld(template: WorldTemplate = 'archipelago', seed?: number): void {
    const s = this.state;
    s.territory.fill(-1);
    s.units.length = 0;
    s.deceasedArchive.clear();
    s.buildings.length = 0;
    s.kingdoms.length = 0;
    s.shockwaves.length = 0;
    s.chronicles.length = 0;
    this.particlePool.clear();
    this.spatialGrid.clear();

    s.tickCount = 0;
    s.year = 1;
    s.month = 1;
    s.totalWarsFought = 0;
    s.disastersTriggered = 0;
    s.miraclesCast = 0;
    s.completedEras.clear();
    s.terrainDirty = true;

    populateProceduralTerrain(s.gridW, s.gridH, template, s.biomes, s.resources, seed);

    // Seed starter pockets of the 4 fantasy races
    const starterRaces: CivilizedRace[] = ['human', 'elf', 'orc', 'dwarf'];
    for (let r = 0; r < starterRaces.length; r++) {
      const race = starterRaces[r];
      for (let attempt = 0; attempt < 90; attempt++) {
        const rx = 10 + Math.floor(Math.random() * (s.gridW - 20));
        const ry = 8 + Math.floor(Math.random() * (s.gridH - 16));
        const b = s.biomes[ry * s.gridW + rx];
        if (b === 'grass' || b === 'forest') {
          for (let i = 0; i < 4; i++) {
            const ox = Math.max(2, Math.min(s.gridW - 3, rx + Math.floor(Math.random() * 3) - 1));
            const oy = Math.max(2, Math.min(s.gridH - 3, ry + Math.floor(Math.random() * 3) - 1));
            this.spawnUnitAt(race, ox, oy);
          }
          break;
        }
      }
    }

    // Seed peaceful sheep
    for (let i = 0; i < 8; i++) {
      const rx = 8 + Math.floor(Math.random() * (s.gridW - 16));
      const ry = 8 + Math.floor(Math.random() * (s.gridH - 16));
      if (s.biomes[ry * s.gridW + rx] === 'grass') {
        this.spawnUnitAt('sheep', rx, ry);
      }
    }

    this.spatialGrid.rebuild(s.units);
    this.pushChronicle(
      `Tahun 1: Dunia baru (${template.toUpperCase()}) diciptakan. Empat bangsa kuno mulai menjelajah.`,
      'era'
    );
  }

  public spawnUnitAt(
    race: RaceType,
    tx: number,
    ty: number,
    customTraits?: UnitTrait[]
  ): Unit | null {
    const s = this.state;
    if (tx < 0 || tx >= s.gridW || ty < 0 || ty >= s.gridH) return null;
    const idx = ty * s.gridW + tx;
    const biome = s.biomes[idx];
    const cfg = RACE_CONFIG[race];

    if (!cfg.isFlying && (biome === 'deep_ocean' || biome === 'lava')) {
      return null;
    }

    const names = UNIT_NAMES[race];
    const name = `${names[Math.floor(Math.random() * names.length)]} ${(s.nextEntityId % 90) + 10}`;

    const traits: UnitTrait[] = customTraits ? [...customTraits] : [];
    if (Math.random() < 0.14 && !traits.includes('Strong')) traits.push('Strong');
    if (Math.random() < 0.12 && !traits.includes('Fast')) traits.push('Fast');
    if (Math.random() < 0.08 && !traits.includes('Wise')) traits.push('Wise');
    if ((race === 'dragon' || race === 'elf') && Math.random() < 0.25 && !traits.includes('Immortal')) {
      traits.push('Immortal');
    }

    const hpMult = traits.includes('Giant') ? 1.6 : traits.includes('Strong') ? 1.25 : 1;
    const maxHp = Math.round(cfg.hp * hpMult);

    let assignedKingdomId: number | null = null;
    if (cfg.isCivilized) {
      for (let i = 0; i < s.kingdoms.length; i++) {
        const k = s.kingdoms[i];
        if (k.race === race && Math.hypot(k.capitalX - tx, k.capitalY - ty) <= 20) {
          assignedKingdomId = k.id;
          break;
        }
      }
    }

    const unit: Unit = {
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
      animFrame: Math.floor(Math.random() * 100),
      lastAttackerId: null,
      lastAttackerName: null
    };

    s.units.push(unit);
    this.spatialGrid.insert(unit);
    if (s.units.length > s.peakPopulation) {
      s.peakPopulation = s.units.length;
    }
    return unit;
  }

  private recordUnitDeath(u: Unit, cause: string): void {
    const s = this.state;
    const record: DeceasedUnitRecord = {
      id: u.id,
      name: u.name,
      race: u.race,
      ageAtDeath: u.age,
      yearOfDeath: s.year,
      kills: u.kills,
      level: u.level,
      isKing: u.isKing,
      traits: [...u.traits],
      killerId: u.lastAttackerId,
      killerName: u.lastAttackerName,
      cause,
      lastX: u.x,
      lastY: u.y
    };
    s.deceasedArchive.set(u.id, record);
    if (s.deceasedArchive.size > 200) {
      const oldestKey = s.deceasedArchive.keys().next().value;
      if (oldestKey !== undefined) {
        s.deceasedArchive.delete(oldestKey);
      }
    }
    if (u.isKing) {
      const killerSuffix = u.lastAttackerName ? ` oleh ${u.lastAttackerName}` : ` (${cause})`;
      this.pushChronicle(
        `Tahun ${s.year}: Raja ${u.name} telah gugur pada usia ${u.age} tahun${killerSuffix}.`,
        'kingdom'
      );
    }
  }

  public applyToolAtTile(
    tool: ToolId,
    tx: number,
    ty: number,
    radius: number,
    isDragEvent: boolean,
    onSelectUnit?: (unitId: number | null) => void
  ): void {
    const s = this.state;
    if (tx < 0 || tx >= s.gridW || ty < 0 || ty >= s.gridH) return;

    // 1. Inspect Tool
    if (tool === 'tool_inspect') {
      if (isDragEvent) return;
      const candidates = this.spatialGrid.queryRadius(tx + 0.5, ty + 0.5, 4.0, this.queryBuffer);
      let closest: Unit | null = null;
      let minDist = 4.0;
      for (let i = 0; i < candidates.length; i++) {
        const u = candidates[i];
        const d = Math.hypot(u.x - (tx + 0.5), u.y - (ty + 0.5));
        if (d < minDist) {
          minDist = d;
          closest = u;
        }
      }
      onSelectUnit?.(closest ? closest.id : null);
      if (closest) this.callbacks.onSound?.('click');
      return;
    }

    // 2. Magnet Tool
    if (tool === 'tool_magnet') {
      const pulled = this.spatialGrid.queryRadius(
        tx + 0.5,
        ty + 0.5,
        radius * 2.5 + 3,
        this.queryBuffer
      );
      for (let i = 0; i < pulled.length; i++) {
        const u = pulled[i];
        u.x = Math.max(1, Math.min(s.gridW - 2, tx + 0.5 + (Math.random() - 0.5) * 1.5));
        u.y = Math.max(1, Math.min(s.gridH - 2, ty + 0.5 + (Math.random() - 0.5) * 1.5));
        u.vx = 0;
        u.vy = 0;
      }
      return;
    }

    // 3. Bless Tool
    if (tool === 'tool_bless') {
      const targets = this.spatialGrid.queryRadius(tx + 0.5, ty + 0.5, radius + 3, this.queryBuffer);
      let blessedCount = 0;
      for (let i = 0; i < targets.length; i++) {
        const u = targets[i];
        if (!u.traits.includes('Blessed')) u.traits.push('Blessed');
        if (!u.traits.includes('Immortal') && Math.random() < 0.35) u.traits.push('Immortal');
        u.maxHp = Math.round(u.maxHp * 1.25);
        u.hp = u.maxHp;
        u.attack = Math.round(u.attack * 1.2);
        blessedCount++;
      }
      for (let i = 0; i < 10; i++) {
        this.particlePool.spawn(
          tx + 0.5,
          ty + 0.5,
          (Math.random() - 0.5) * 0.35,
          (Math.random() - 0.5) * 0.35,
          '#fde047',
          2.5,
          24
        );
      }
      if (blessedCount > 0 && !isDragEvent) {
        s.miraclesCast++;
        this.callbacks.onScoreAdd?.(40 * blessedCount);
        this.callbacks.onSound?.('powerup');
        this.pushChronicle(
          `Tahun ${s.year}: Berkah Ilahi menyinari ${blessedCount} makhluk terpilih.`,
          'miracle'
        );
      }
      return;
    }

    // 4. Smite Tool
    if (tool === 'tool_smite') {
      let smited = 0;
      for (let i = s.units.length - 1; i >= 0; i--) {
        const u = s.units[i];
        if (Math.hypot(u.x - (tx + 0.5), u.y - (ty + 0.5)) <= radius + 1.8) {
          u.lastAttackerName = 'Murka Dewa';
          this.recordUnitDeath(u, 'Murka Dewa');
          swapAndPop(s.units, i);
          smited++;
        }
      }
      if (smited > 0) {
        this.spatialGrid.rebuild(s.units);
        this.callbacks.onSound?.('explosion');
        this.callbacks.onScoreAdd?.(15 * smited);
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
      s.terrainDirty = true;
      if (!isDragEvent) {
        this.callbacks.onScoreAdd?.(10);
        this.callbacks.onSound?.('click');
      }
      return;
    }

    // 6. Spawn Civilizations & Creatures
    if (tool.startsWith('spawn_')) {
      const race = tool.replace('spawn_', '') as RaceType;
      if (isDragEvent && (race === 'dragon' || race === 'ufo')) return;
      const spawned = this.spawnUnitAt(race, tx, ty);
      if (spawned) {
        this.callbacks.onScoreAdd?.(race === 'dragon' || race === 'ufo' ? 75 : 25);
        if (!isDragEvent) {
          this.callbacks.onSound?.('coin');
          if (race === 'dragon') {
            this.pushChronicle(
              `Tahun ${s.year}: Seekor Naga Api kuno (${spawned.name}) turun dari langit!`,
              'disaster'
            );
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
        this.callbacks.onScoreAdd?.(15);
        this.callbacks.onSound?.('click');
      }
      return;
    }

    if (tool === 'power_rain') {
      let terrainChanged = false;
      for (let dy = -radius * 2; dy <= radius * 2; dy++) {
        for (let dx = -radius * 2; dx <= radius * 2; dx++) {
          if (dx * dx + dy * dy <= radius * radius * 4) {
            const nx = tx + dx;
            const ny = ty + dy;
            if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
              const idx = ny * s.gridW + nx;
              if (s.resources[idx] === 'fire') s.resources[idx] = 'none';
              if (s.biomes[idx] === 'scorched') {
                s.biomes[idx] = 'grass';
                terrainChanged = true;
              } else if (s.biomes[idx] === 'lava') {
                s.biomes[idx] = 'mountain';
                terrainChanged = true;
              }
              if (s.biomes[idx] === 'grass' && Math.random() < 0.08) {
                s.resources[idx] = 'berry';
              }
            }
          }
        }
      }
      if (terrainChanged) s.terrainDirty = true;

      const healedUnits = this.spatialGrid.queryRadius(
        tx + 0.5,
        ty + 0.5,
        radius * 2 + 2,
        this.queryBuffer
      );
      for (let i = 0; i < healedUnits.length; i++) {
        const u = healedUnits[i];
        u.hp = Math.min(u.maxHp, u.hp + 45);
        const infIdx = u.traits.indexOf('Infected');
        if (infIdx !== -1) swapAndPop(u.traits, infIdx);
      }
      for (let i = 0; i < 12; i++) {
        this.particlePool.spawn(
          tx + (Math.random() - 0.5) * radius * 2,
          ty + (Math.random() - 0.5) * radius * 2,
          0,
          0.18,
          '#38bdf8',
          2,
          16
        );
      }
      if (!isDragEvent) {
        s.miraclesCast++;
        this.callbacks.onScoreAdd?.(35);
        this.callbacks.onSound?.('powerup');
      }
      return;
    }

    // 8. Disasters & Chain-Reaction Cataclysms
    if (
      isDragEvent &&
      (tool === 'disaster_nuke' ||
        tool === 'disaster_meteor' ||
        tool === 'disaster_earthquake' ||
        tool === 'disaster_tornado')
    ) {
      return;
    }

    if (tool === 'disaster_lightning') {
      s.disastersTriggered++;
      s.shockwaves.push({
        x: tx + 0.5,
        y: ty + 0.5,
        radius: 0.5,
        maxRadius: 6,
        color: '#fde047',
        alpha: 1
      });
      for (let i = 0; i < 18; i++) {
        this.particlePool.spawn(
          tx + 0.5,
          ty + 0.5,
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.7,
          i % 2 === 0 ? '#fde047' : '#ffffff',
          2.5,
          18
        );
      }
      const struck = this.spatialGrid.queryRadius(tx + 0.5, ty + 0.5, 4.5, this.queryBuffer);
      for (let i = 0; i < struck.length; i++) {
        const u = struck[i];
        u.hp -= 85;
        u.lastAttackerName = 'Petir Dewa';
        if (u.hp > 0 && Math.random() < 0.35 && !u.traits.includes('Immortal')) {
          u.traits.push('Immortal');
        }
      }
      const idx = ty * s.gridW + tx;
      if (isLandBiome(s.biomes[idx])) s.resources[idx] = 'fire';
      this.callbacks.onShake?.('subtle');
      this.callbacks.onSound?.('explosion');
      this.callbacks.onScoreAdd?.(30);
      return;
    }

    if (tool === 'disaster_tornado') {
      s.disastersTriggered++;
      const tornado = this.spawnUnitAt('tornado', tx, ty, ['Immortal', 'Fast']);
      if (tornado) {
        this.pushChronicle(
          `Tahun ${s.year}: Pusaran Tornado dahsyat terbentuk di koordinat (${tx}, ${ty})!`,
          'disaster'
        );
      }
      this.callbacks.onShake?.('subtle');
      this.callbacks.onSound?.('powerup');
      this.callbacks.onScoreAdd?.(55);
      return;
    }

    if (tool === 'disaster_earthquake') {
      s.disastersTriggered++;
      const angle = Math.random() * Math.PI * 2;
      const length = 14 + Math.floor(Math.random() * 10);
      for (let step = -length; step <= length; step++) {
        const jitter = (Math.random() - 0.5) * 2.2;
        const fx = Math.round(tx + Math.cos(angle) * step - Math.sin(angle) * jitter);
        const fy = Math.round(ty + Math.sin(angle) * step + Math.cos(angle) * jitter);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = fx + dx;
            const ny = fy + dy;
            if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
              const idx = ny * s.gridW + nx;
              if (dx === 0 && dy === 0) {
                s.biomes[idx] = Math.random() < 0.55 ? 'lava' : 'mountain';
                s.resources[idx] = 'none';
              } else if (isLandBiome(s.biomes[idx])) {
                s.biomes[idx] = 'mountain';
                if (Math.random() < 0.25) s.resources[idx] = 'stone';
              }
            }
          }
        }
      }
      // Remove buildings along the fault line
      for (let i = s.buildings.length - 1; i >= 0; i--) {
        const b = s.buildings[i];
        if (Math.hypot(b.x - tx, b.y - ty) <= length * 0.75) {
          swapAndPop(s.buildings, i);
        }
      }
      s.terrainDirty = true;
      s.shockwaves.push({
        x: tx + 0.5,
        y: ty + 0.5,
        radius: 1,
        maxRadius: 12,
        color: '#d97706',
        alpha: 1
      });
      this.callbacks.onShake?.('heavy');
      this.callbacks.onSound?.('explosion');
      this.callbacks.onScoreAdd?.(75);
      this.pushChronicle(
        `Tahun ${s.year}: Gempa Bumi tektonik membelah daratan di sekitar (${tx}, ${ty})!`,
        'disaster'
      );
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
      s.terrainDirty = true;

      const victims = this.spatialGrid.queryRadius(
        tx + 0.5,
        ty + 0.5,
        blastR + 1.8,
        this.queryBuffer
      );
      for (let i = 0; i < victims.length; i++) {
        const u = victims[i];
        u.hp -= isNuke ? 550 : 190;
        u.lastAttackerName = isNuke ? 'Bom Nuklir' : 'Meteorit';
      }

      for (let i = s.buildings.length - 1; i >= 0; i--) {
        const b = s.buildings[i];
        if (Math.hypot(b.x - tx, b.y - ty) <= blastR * 0.85) {
          swapAndPop(s.buildings, i);
        }
      }

      const particleBurst = isNuke ? 65 : 30;
      for (let i = 0; i < particleBurst; i++) {
        this.particlePool.spawn(
          tx + 0.5,
          ty + 0.5,
          (Math.random() - 0.5) * (isNuke ? 1.5 : 0.9),
          (Math.random() - 0.5) * (isNuke ? 1.5 : 0.9),
          i % 3 === 0 ? '#fde047' : i % 2 === 0 ? '#f97316' : '#ef4444',
          isNuke ? 3.5 : 2.5,
          isNuke ? 38 : 24
        );
      }

      this.callbacks.onShake?.(isNuke ? 'heavy' : 'medium');
      this.callbacks.onSound?.('explosion');
      this.callbacks.onScoreAdd?.(isNuke ? 120 : 60);
      this.pushChronicle(
        `Tahun ${s.year}: ${
          isNuke ? 'Ledakan Termonuklir Tsar Bomba' : 'Hantaman Meteorit Raksasa'
        } mengguncang koordinat (${tx}, ${ty})!`,
        'disaster'
      );
      return;
    }

    if (tool === 'disaster_plague') {
      s.disastersTriggered++;
      const targets = this.spatialGrid.queryRadius(tx + 0.5, ty + 0.5, radius + 4, this.queryBuffer);
      let infected = 0;
      for (let i = 0; i < targets.length; i++) {
        const u = targets[i];
        if (
          !u.traits.includes('Immortal') &&
          !u.traits.includes('Blessed') &&
          !u.traits.includes('Infected')
        ) {
          u.traits.push('Infected');
          infected++;
        }
      }
      for (let i = 0; i < 12; i++) {
        this.particlePool.spawn(
          tx + 0.5,
          ty + 0.5,
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4,
          '#a855f7',
          2.5,
          25
        );
      }
      if (!isDragEvent && infected > 0) {
        this.pushChronicle(
          `Tahun ${s.year}: Wabah Ungu mulai menjangkiti ${infected} penduduk!`,
          'disaster'
        );
        this.callbacks.onSound?.('hit');
      }
      return;
    }

    if (tool === 'disaster_ufo') {
      if (isDragEvent) return;
      s.disastersTriggered++;
      this.spawnUnitAt('ufo', tx, ty, ['Immortal', 'Fast']);
      this.pushChronicle(
        `Tahun ${s.year}: Objek Terbang Asing (UFO) terdeteksi di langit dunia!`,
        'disaster'
      );
      this.callbacks.onSound?.('powerup');
      this.callbacks.onScoreAdd?.(80);
    }
  }

  /**
   * Advances simulation using a deterministic fixed-timestep accumulator.
   */
  public updateFrame(dtSeconds: number, speed: SimSpeed): void {
    if (this.isDestroyed || speed === 0) return;
    const clampedDt = Math.min(0.1, Math.max(0, dtSeconds));
    this.accumulatorSeconds += clampedDt * speed;

    let stepsExecuted = 0;
    const maxStepsPerFrame = 8;
    while (this.accumulatorSeconds >= FIXED_TICK_SECONDS && stepsExecuted < maxStepsPerFrame) {
      this.stepSimulationTick();
      this.accumulatorSeconds -= FIXED_TICK_SECONDS;
      stepsExecuted++;
    }
    if (stepsExecuted === maxStepsPerFrame) {
      this.accumulatorSeconds = 0;
    }
  }

  /**
   * Executes 1 authoritative simulation tick with O(N) SpatialHashGrid & Zero-GC Swap-and-Pop.
   */
  public stepSimulationTick(): void {
    const s = this.state;
    const laws = this.laws;
    s.tickCount++;

    // Rebuild Spatial Hash Grid in O(N) at start of tick
    this.spatialGrid.rebuild(s.units);

    // Calendar, Chain-Reaction Ecology & Diplomacy every 35 ticks
    if (s.tickCount % 35 === 0) {
      s.month++;
      s.windAngle = (s.windAngle + (Math.random() - 0.5) * 0.35) % (Math.PI * 2);
      if (s.month > 12) {
        s.month = 1;
        s.year++;
        const prosperityBonus = s.kingdoms.length * 15 + Math.min(80, s.units.length);
        this.callbacks.onScoreAdd?.(prosperityBonus);
      }

      this.stepChainReactionEcology();

      if (laws.naturalDisasters && Math.random() < 0.05) {
        const dx = 10 + Math.floor(Math.random() * (s.gridW - 20));
        const dy = 10 + Math.floor(Math.random() * (s.gridH - 20));
        this.applyToolAtTile('disaster_lightning', dx, dy, 2, false);
      }

      if (laws.diplomacyAndWars && s.kingdoms.length >= 2 && Math.random() < 0.16) {
        this.stepKingdomDiplomacy();
      }
    }

    // Track living members per Kingdom
    const kingdomMembers = new Map<number, Unit[]>();
    for (let i = 0; i < s.kingdoms.length; i++) {
      kingdomMembers.set(s.kingdoms[i].id, []);
    }

    // Iterate units backwards so swapAndPop on death never skips an element
    for (let i = s.units.length - 1; i >= 0; i--) {
      const u = s.units[i];
      u.animFrame++;
      if (u.actionCooldown > 0) u.actionCooldown--;

      // Aging & Hunger
      if (s.tickCount % 70 === 0 && (laws.hungerAndAging || u.race === 'tornado')) {
        u.age++;
        u.hunger = Math.max(0, u.hunger - 3);
        if (u.traits.includes('Infected')) {
          u.hp -= 9;
          u.lastAttackerName = 'Wabah Ungu';
        } else if (u.traits.includes('Blessed') && u.hp < u.maxHp) {
          u.hp = Math.min(u.maxHp, u.hp + 5);
        }
        if ((!u.traits.includes('Immortal') || u.race === 'tornado') && u.age > u.maxAge) {
          u.hp = 0;
          if (!u.lastAttackerName) u.lastAttackerName = 'Usia Tua';
        }
      }

      if (u.hp <= 0) {
        this.recordUnitDeath(u, u.lastAttackerName || 'Pertempuran');
        swapAndPop(s.units, i);
        continue;
      }

      // Apply knockback velocity (e.g. from Tornado throw)
      if (Math.abs(u.vx) > 0.005 || Math.abs(u.vy) > 0.005) {
        u.x = Math.max(1, Math.min(s.gridW - 2, u.x + u.vx));
        u.y = Math.max(1, Math.min(s.gridH - 2, u.y + u.vy));
        u.vx *= 0.82;
        u.vy *= 0.82;
      }

      const tx = Math.max(0, Math.min(s.gridW - 1, Math.floor(u.x)));
      const ty = Math.max(0, Math.min(s.gridH - 1, Math.floor(u.y)));
      const tileIdx = ty * s.gridW + tx;
      const currentBiome = s.biomes[tileIdx];
      const raceCfg = RACE_CONFIG[u.race];

      // Lava / Fire hazard for ground units
      if (!raceCfg.isFlying) {
        if (currentBiome === 'lava') {
          u.hp -= 16;
          u.lastAttackerName = 'Lava Vulkanik';
        } else if (s.resources[tileIdx] === 'fire') {
          u.hp -= 5;
          u.lastAttackerName = 'Kebakaran Hutan';
        }
        if (u.hp <= 0) {
          this.recordUnitDeath(u, u.lastAttackerName || 'Lava');
          swapAndPop(s.units, i);
          continue;
        }
      }

      // Tornado vortex physics via SpatialHashGrid
      if (u.race === 'tornado') {
        const pulled = this.spatialGrid.queryRadius(u.x, u.y, 7.5, this.queryBuffer);
        for (let pIdx = 0; pIdx < pulled.length; pIdx++) {
          const victim = pulled[pIdx];
          if (victim.id === u.id || victim.race === 'tornado') continue;
          const dx = u.x - victim.x;
          const dy = u.y - victim.y;
          const d = Math.max(0.2, Math.hypot(dx, dy));
          if (d < 1.8) {
            // Fling outward violently
            const flingAngle = Math.random() * Math.PI * 2;
            victim.vx = Math.cos(flingAngle) * 0.65;
            victim.vy = Math.sin(flingAngle) * 0.65;
            victim.hp -= 18;
            victim.lastAttackerId = u.id;
            victim.lastAttackerName = u.name;
          } else {
            // Swirl inward
            victim.x += (dx / d) * 0.14 - (dy / d) * 0.12;
            victim.y += (dy / d) * 0.14 + (dx / d) * 0.12;
          }
        }
        if (s.tickCount % 3 === 0) {
          this.particlePool.spawn(
            u.x + (Math.random() - 0.5) * 2,
            u.y + (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            '#cbd5e1',
            2,
            14
          );
        }
      }

      // Plague contagion via SpatialHashGrid O(1) neighborhood
      if (u.traits.includes('Infected') && Math.random() < 0.04) {
        const neighbors = this.spatialGrid.queryRadius(u.x, u.y, 2.4, this.queryBuffer);
        for (let nIdx = 0; nIdx < neighbors.length; nIdx++) {
          const other = neighbors[nIdx];
          if (
            other.id !== u.id &&
            !other.traits.includes('Infected') &&
            !other.traits.includes('Immortal') &&
            !other.traits.includes('Blessed')
          ) {
            other.traits.push('Infected');
          }
        }
      }

      // Civilized Unit Kingdom Founding, Resource Gathering & Building
      if (raceCfg.isCivilized) {
        this.stepCivilizedUnit(u, tx, ty, tileIdx, currentBiome, kingdomMembers);
      }

      // Combat & Movement via SpatialHashGrid O(1) neighborhood query
      if (u.race !== 'tornado') {
        this.stepUnitCombatAndMovement(u);
      } else {
        this.stepUnitWander(u, 20);
      }
    }

    // Update Kingdoms & elect new King if needed (using swapAndPop for fallen kingdoms)
    for (let i = s.kingdoms.length - 1; i >= 0; i--) {
      const k = s.kingdoms[i];
      const members = kingdomMembers.get(k.id) || [];
      k.population = members.length;
      if (k.population === 0) {
        for (let t = 0; t < s.territory.length; t++) {
          if (s.territory[t] === k.id) s.territory[t] = -1;
        }
        for (let bIdx = s.buildings.length - 1; bIdx >= 0; bIdx--) {
          if (s.buildings[bIdx].kingdomId === k.id) {
            swapAndPop(s.buildings, bIdx);
          }
        }
        this.pushChronicle(
          `Tahun ${s.year}: Kerajaan ${k.name} telah runtuh dan tinggal sejarah.`,
          'kingdom'
        );
        swapAndPop(s.kingdoms, i);
        continue;
      }

      let hasLivingKing = false;
      for (let m = 0; m < members.length; m++) {
        if (members[m].id === k.kingUnitId && members[m].hp > 0) {
          hasLivingKing = true;
          break;
        }
      }
      if (!hasLivingKing && members.length > 0) {
        const newKing = members[0];
        newKing.isKing = true;
        k.kingUnitId = newKing.id;
      }
    }

    // Update Fixed Particle Pool (zero allocations)
    this.particlePool.updateAll();

    // Update Shockwaves using swapAndPop
    for (let i = s.shockwaves.length - 1; i >= 0; i--) {
      const sw = s.shockwaves[i];
      sw.radius += 0.45;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius) {
        swapAndPop(s.shockwaves, i);
      }
    }

    // Evaluate Divine Era Challenges
    for (let i = 0; i < DIVINE_ERA_CHALLENGES.length; i++) {
      const challenge = DIVINE_ERA_CHALLENGES[i];
      if (!s.completedEras.has(challenge.id) && challenge.check(s)) {
        s.completedEras.add(challenge.id);
        this.callbacks.onScoreAdd?.(challenge.rewardScore);
        this.callbacks.onSound?.('levelup');
        this.pushChronicle(
          `Tahun ${s.year}: TANTANGAN TERCAPAI — ${challenge.title} (+${challenge.rewardScore} Divine Score)!`,
          'era'
        );
      }
    }
  }

  private stepChainReactionEcology(): void {
    const s = this.state;
    const windDx = Math.round(Math.cos(s.windAngle));
    const windDy = Math.round(Math.sin(s.windAngle));
    let terrainChanged = false;

    // Sample tiles for fire spread, lava cooling, and forest regrowth
    for (let sample = 0; sample < 65; sample++) {
      const rx = Math.floor(Math.random() * s.gridW);
      const ry = Math.floor(Math.random() * s.gridH);
      const idx = ry * s.gridW + rx;
      const biome = s.biomes[idx];
      const res = s.resources[idx];

      if (res === 'fire') {
        // Check if adjacent to water -> extinguish immediately
        let nearWater = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = rx + dx;
            const ny = ry + dy;
            if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
              if (isWaterBiome(s.biomes[ny * s.gridW + nx])) {
                nearWater = true;
              }
            }
          }
        }
        if (nearWater) {
          s.resources[idx] = 'none';
          continue;
        }

        // Spread fire along wind direction to adjacent forest/grass
        const spreadX = rx + (Math.random() < 0.65 ? windDx : Math.floor(Math.random() * 3) - 1);
        const spreadY = ry + (Math.random() < 0.65 ? windDy : Math.floor(Math.random() * 3) - 1);
        if (spreadX >= 0 && spreadX < s.gridW && spreadY >= 0 && spreadY < s.gridH) {
          const sIdx = spreadY * s.gridW + spreadX;
          const targetBiome = s.biomes[sIdx];
          if (
            (targetBiome === 'forest' || targetBiome === 'grass' || s.resources[sIdx] === 'tree') &&
            s.resources[sIdx] !== 'fire' &&
            Math.random() < 0.48
          ) {
            s.resources[sIdx] = 'fire';
          }
        }

        // Burn out and scorch the tile
        if (Math.random() < 0.45) {
          s.resources[idx] = 'none';
          if (biome === 'forest' || biome === 'grass') {
            s.biomes[idx] = 'scorched';
            terrainChanged = true;
          }
        }
      } else if (biome === 'lava') {
        // Lava cools into mountain when touching water, or ignites adjacent forest
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = rx + dx;
            const ny = ry + dy;
            if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
              const nIdx = ny * s.gridW + nx;
              if (isWaterBiome(s.biomes[nIdx])) {
                s.biomes[idx] = 'mountain';
                terrainChanged = true;
              } else if (
                (s.biomes[nIdx] === 'forest' || s.resources[nIdx] === 'tree') &&
                Math.random() < 0.3
              ) {
                s.resources[nIdx] = 'fire';
              }
            }
          }
        }
      } else if (biome === 'scorched' && Math.random() < 0.04) {
        s.biomes[idx] = 'grass';
        terrainChanged = true;
      } else if (biome === 'forest' && res === 'none' && Math.random() < 0.09) {
        s.resources[idx] = 'tree';
      } else if (biome === 'grass' && res === 'none' && Math.random() < 0.05) {
        s.resources[idx] = 'berry';
      }
    }

    if (terrainChanged) {
      s.terrainDirty = true;
    }
  }

  private stepKingdomDiplomacy(): void {
    const s = this.state;
    if (s.kingdoms.length < 2) return;
    const k1 = s.kingdoms[Math.floor(Math.random() * s.kingdoms.length)];
    const k2 = s.kingdoms[Math.floor(Math.random() * s.kingdoms.length)];
    if (k1.id === k2.id) return;

    const currentRel: DiplomacyRelation = k1.relations[k2.id] || 'peace';

    if (currentRel === 'peace' || currentRel === 'alliance') {
      const warBias = k1.race === 'orc' || k2.race === 'orc' ? 0.55 : k1.race !== k2.race ? 0.32 : 0.15;
      if (Math.random() < warBias) {
        k1.relations[k2.id] = 'war';
        k2.relations[k1.id] = 'war';
        s.totalWarsFought++;
        const reason = WAR_REASONS[Math.floor(Math.random() * WAR_REASONS.length)];
        this.pushChronicle(
          `Tahun ${s.year}: Kerajaan ${k1.name} mendeklarasikan PERANG terhadap ${k2.name} karena ${reason}!`,
          'war'
        );
      } else if (currentRel === 'peace' && Math.random() < 0.25) {
        k1.relations[k2.id] = 'alliance';
        k2.relations[k1.id] = 'alliance';
        this.pushChronicle(
          `Tahun ${s.year}: Pakta ALIANSI dibentuk antara Kerajaan ${k1.name} dan ${k2.name}.`,
          'kingdom'
        );
      }
    } else if (currentRel === 'war' && Math.random() < 0.32) {
      k1.relations[k2.id] = 'peace';
      k2.relations[k1.id] = 'peace';
      const reason = PEACE_REASONS[Math.floor(Math.random() * PEACE_REASONS.length)];
      this.pushChronicle(
        `Tahun ${s.year}: Perjanjian DAMAI disepakati antara ${k1.name} dan ${k2.name} atas dasar ${reason}.`,
        'kingdom'
      );
    }
  }

  private stepCivilizedUnit(
    u: Unit,
    tx: number,
    ty: number,
    tileIdx: number,
    currentBiome: BiomeType,
    kingdomMembers: Map<number, Unit[]>
  ): void {
    const s = this.state;
    const raceCfg = RACE_CONFIG[u.race];

    if (u.kingdomId !== null && !kingdomMembers.has(u.kingdomId)) {
      u.kingdomId = null;
      u.isKing = false;
    }

    // Found a new Kingdom using SpatialHashGrid neighbor lookup
    if (
      u.kingdomId === null &&
      (currentBiome === 'grass' || currentBiome === 'forest' || currentBiome === 'mountain') &&
      s.territory[tileIdx] === -1 &&
      s.kingdoms.length < 10
    ) {
      const neighbors = this.spatialGrid.queryRadius(u.x, u.y, 10, this.secondaryBuffer);
      const sameRaceUnaligned: Unit[] = [];
      for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        if (n.race === u.race && n.kingdomId === null && n.hp > 0) {
          sameRaceUnaligned.push(n);
        }
      }

      if (sameRaceUnaligned.length >= 3) {
        const civRace = u.race as CivilizedRace;
        const namePool = KINGDOM_NAMES[civRace];
        const kName =
          namePool[s.kingdoms.length % namePool.length] +
          (s.kingdoms.length >= namePool.length ? ' II' : '');
        const kId = s.nextEntityId++;

        const newKingdom: Kingdom = {
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
          population: sameRaceUnaligned.length,
          kingUnitId: u.id,
          relations: {},
          foundedYear: s.year
        };

        u.isKing = true;
        s.kingdoms.push(newKingdom);
        kingdomMembers.set(kId, []);

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

        for (let i = 0; i < sameRaceUnaligned.length; i++) {
          sameRaceUnaligned[i].kingdomId = kId;
        }

        this.callbacks.onScoreAdd?.(250);
        this.pushChronicle(
          `Tahun ${s.year}: Kerajaan ${kName} (${raceCfg.label}) didirikan oleh Raja ${u.name}!`,
          'kingdom'
        );
      }
    }

    if (u.kingdomId !== null) {
      let k: Kingdom | undefined;
      for (let i = 0; i < s.kingdoms.length; i++) {
        if (s.kingdoms[i].id === u.kingdomId) {
          k = s.kingdoms[i];
          break;
        }
      }
      if (k) {
        kingdomMembers.get(k.id)?.push(u);
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

        // Construct new building
        if (
          k.wood >= 16 &&
          s.buildings.length < 95 &&
          Math.random() < 0.025 &&
          (currentBiome === 'grass' || currentBiome === 'forest' || currentBiome === 'mountain')
        ) {
          let tooClose = false;
          for (let bIdx = 0; bIdx < s.buildings.length; bIdx++) {
            const b = s.buildings[bIdx];
            if (Math.hypot(b.x - tx, b.y - ty) < 3.2) {
              tooClose = true;
              break;
            }
          }
          if (!tooClose) {
            k.wood -= 16;
            const bType: Building['type'] =
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
            this.callbacks.onScoreAdd?.(35);
          }
        }

        // Reproduction
        if (s.units.length < 150 && k.food >= 12 && u.age >= 16 && Math.random() < 0.008) {
          k.food -= 8;
          const child = this.spawnUnitAt(u.race, tx, ty);
          if (child) child.kingdomId = k.id;
        }
      }
    }
  }

  private stepUnitCombatAndMovement(u: Unit): void {
    const s = this.state;
    const laws = this.laws;
    const raceCfg = RACE_CONFIG[u.race];
    const searchRadius = u.race === 'dragon' || u.race === 'ufo' ? 14 : 9;

    // Query only the 3x3 spatial neighborhood / radius in O(1)
    const nearby = this.spatialGrid.queryRadius(u.x, u.y, searchRadius, this.queryBuffer);
    let enemyTarget: Unit | null = null;
    let minEnemyDist = searchRadius;

    let myKingdom: Kingdom | undefined;
    if (u.kingdomId !== null) {
      for (let kIdx = 0; kIdx < s.kingdoms.length; kIdx++) {
        if (s.kingdoms[kIdx].id === u.kingdomId) {
          myKingdom = s.kingdoms[kIdx];
          break;
        }
      }
    }

    for (let i = 0; i < nearby.length; i++) {
      const other = nearby[i];
      if (other.id === u.id || other.hp <= 0 || other.race === 'tornado') continue;

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
          myKingdom &&
          other.kingdomId !== null &&
          u.kingdomId !== other.kingdomId
        ) {
          isHostile = myKingdom.relations[other.kingdomId] === 'war';
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
        enemyTarget.lastAttackerId = u.id;
        enemyTarget.lastAttackerName = u.name;
        u.actionCooldown = 18;

        this.particlePool.spawn(
          enemyTarget.x,
          enemyTarget.y,
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.25,
          u.race === 'dragon' ? '#f97316' : u.race === 'ufo' ? '#22d3ee' : '#ef4444',
          2,
          10
        );

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
            this.pushChronicle(
              `Tahun ${s.year}: ${u.name} menumbangkan Raja ${enemyTarget.name} di medan tempur!`,
              'war'
            );
          }
        }
      }
    } else {
      this.stepUnitWander(u, raceCfg.isFlying ? 22 : 9);
    }

    this.moveUnitTowardTarget(u, raceCfg.isFlying);
  }

  private stepUnitWander(u: Unit, wanderRadius: number): void {
    const s = this.state;
    const isFlying = RACE_CONFIG[u.race].isFlying;
    if (
      u.targetX === null ||
      u.targetY === null ||
      Math.hypot(u.targetX - u.x, u.targetY - u.y) < 0.8
    ) {
      const candX = Math.max(
        1,
        Math.min(s.gridW - 2, Math.floor(u.x + (Math.random() - 0.5) * wanderRadius * 2))
      );
      const candY = Math.max(
        1,
        Math.min(s.gridH - 2, Math.floor(u.y + (Math.random() - 0.5) * wanderRadius * 2))
      );
      const candBiome = s.biomes[candY * s.gridW + candX];
      if (isFlying || isLandBiome(candBiome)) {
        u.targetX = candX + 0.5;
        u.targetY = candY + 0.5;
      }
    }
    if (u.race === 'tornado') {
      this.moveUnitTowardTarget(u, true);
    }
  }

  private moveUnitTowardTarget(u: Unit, isFlying: boolean): void {
    const s = this.state;
    if (u.targetX === null || u.targetY === null) return;
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

      if (isFlying || isLandBiome(nextBiome) || nextBiome === 'shallow_water') {
        const waterSlowdown = nextBiome === 'shallow_water' && !isFlying ? 0.45 : 1;
        u.x += (dx / dist) * step * waterSlowdown;
        u.y += (dy / dist) * step * waterSlowdown;
      } else {
        u.targetX = null;
        u.targetY = null;
      }
    }
  }

  /**
   * Safe Unit Inspector lookup that never returns stale references:
   * Returns `{ status: 'alive', unit }` if living, or `{ status: 'deceased', record }` if dead.
   */
  public getInspectedUnitStatus(unitId: number | null): InspectedUnitStatus {
    if (unitId === null) return null;
    const s = this.state;
    for (let i = 0; i < s.units.length; i++) {
      if (s.units[i].id === unitId && s.units[i].hp > 0) {
        return { status: 'alive', unit: { ...s.units[i], traits: [...s.units[i].traits] } };
      }
    }
    const deceased = s.deceasedArchive.get(unitId);
    if (deceased) {
      return { status: 'deceased', record: { ...deceased, traits: [...deceased.traits] } };
    }
    return null;
  }

  public blessUnitById(unitId: number): boolean {
    const s = this.state;
    for (let i = 0; i < s.units.length; i++) {
      const u = s.units[i];
      if (u.id === unitId && u.hp > 0) {
        if (!u.traits.includes('Blessed')) u.traits.push('Blessed');
        if (!u.traits.includes('Immortal')) u.traits.push('Immortal');
        u.maxHp = Math.round(u.maxHp * 1.4);
        u.hp = u.maxHp;
        u.attack = Math.round(u.attack * 1.3);
        this.callbacks.onScoreAdd?.(100);
        this.callbacks.onSound?.('powerup');
        this.pushChronicle(
          `Tahun ${s.year}: ${u.name} dianugerahi Keabadian (Immortal) oleh Sang Dewa!`,
          'miracle'
        );
        return true;
      }
    }
    return false;
  }

  public smiteUnitById(unitId: number): boolean {
    const s = this.state;
    for (let i = s.units.length - 1; i >= 0; i--) {
      const u = s.units[i];
      if (u.id === unitId) {
        s.shockwaves.push({
          x: u.x,
          y: u.y,
          radius: 0.5,
          maxRadius: 5,
          color: '#fde047',
          alpha: 1
        });
        u.lastAttackerName = 'Petir Dewa';
        this.recordUnitDeath(u, 'Petir Dewa');
        swapAndPop(s.units, i);
        this.spatialGrid.rebuild(s.units);
        this.callbacks.onSound?.('explosion');
        this.callbacks.onScoreAdd?.(25);
        return true;
      }
    }
    return false;
  }

  public getHudSnapshot(inspectedUnitId: number | null): HudSnapshot {
    const s = this.state;
    let nextChallenge = DIVINE_ERA_CHALLENGES[DIVINE_ERA_CHALLENGES.length - 1];
    for (let i = 0; i < DIVINE_ERA_CHALLENGES.length; i++) {
      if (!s.completedEras.has(DIVINE_ERA_CHALLENGES[i].id)) {
        nextChallenge = DIVINE_ERA_CHALLENGES[i];
        break;
      }
    }

    return {
      year: s.year,
      month: s.month,
      population: s.units.length,
      kingdomCount: s.kingdoms.length,
      buildingCount: s.buildings.length,
      warsCount: s.totalWarsFought,
      completedEraCount: s.completedEras.size,
      activeEraTitle: nextChallenge.title,
      activeEraDesc: nextChallenge.description,
      activeEraReward: nextChallenge.rewardScore,
      chronicles: s.chronicles.slice(0, 14),
      kingdoms: s.kingdoms.map((k) => ({ ...k, relations: { ...k.relations } })),
      inspected: this.getInspectedUnitStatus(inspectedUnitId)
    };
  }

  /**
   * Compresses world state (Base64 typed arrays + kingdoms/units) into a JSON snapshot string.
   */
  public serializeSnapshot(): string {
    const s = this.state;
    const biomeBytes = new Uint8Array(s.biomes.length);
    const resBytes = new Uint8Array(s.resources.length);
    for (let i = 0; i < s.biomes.length; i++) {
      biomeBytes[i] = Math.max(0, BIOME_INDEX_LIST.indexOf(s.biomes[i]));
      resBytes[i] = Math.max(0, RESOURCE_INDEX_LIST.indexOf(s.resources[i]));
    }

    const payload: SerializedWorldSave = {
      version: 2,
      year: s.year,
      month: s.month,
      biomesB64: uint8ToBase64(biomeBytes),
      resourcesB64: uint8ToBase64(resBytes),
      kingdoms: s.kingdoms,
      buildings: s.buildings,
      units: s.units.slice(0, 160)
    };
    return JSON.stringify(payload);
  }

  public loadSnapshot(rawJson: string): boolean {
    try {
      const data = JSON.parse(rawJson) as SerializedWorldSave;
      if (!data || data.version !== 2 || !data.biomesB64) return false;

      const s = this.state;
      const biomeBytes = base64ToUint8(data.biomesB64);
      const resBytes = base64ToUint8(data.resourcesB64);
      if (biomeBytes.length !== s.gridW * s.gridH) return false;

      for (let i = 0; i < biomeBytes.length; i++) {
        s.biomes[i] = BIOME_INDEX_LIST[biomeBytes[i]] || 'deep_ocean';
        s.resources[i] = RESOURCE_INDEX_LIST[resBytes[i]] || 'none';
      }

      s.year = data.year || 1;
      s.month = data.month || 1;
      s.kingdoms = Array.isArray(data.kingdoms) ? data.kingdoms : [];
      s.buildings = Array.isArray(data.buildings) ? data.buildings : [];
      s.units = Array.isArray(data.units) ? data.units : [];
      s.territory.fill(-1);

      for (let i = 0; i < s.buildings.length; i++) {
        const b = s.buildings[i];
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            if (dx * dx + dy * dy <= 16) {
              const nx = b.x + dx;
              const ny = b.y + dy;
              if (nx >= 0 && nx < s.gridW && ny >= 0 && ny < s.gridH) {
                const idx = ny * s.gridW + nx;
                if (isLandBiome(s.biomes[idx])) s.territory[idx] = b.kingdomId;
              }
            }
          }
        }
      }

      s.terrainDirty = true;
      this.spatialGrid.rebuild(s.units);
      this.pushChronicle(`Tahun ${s.year}: Snapshot dunia berhasil dimuat ulang.`, 'era');
      return true;
    } catch {
      return false;
    }
  }

  public saveToLocalStorage(): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, this.serializeSnapshot());
      this.pushChronicle(`Tahun ${this.state.year}: Dunia disimpan ke Quick Save lokal.`, 'miracle');
      return true;
    } catch {
      return false;
    }
  }

  public loadFromLocalStorage(): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return false;
      return this.loadSnapshot(raw);
    } catch {
      return false;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.particlePool.clear();
    this.spatialGrid.clear();
  }
}
