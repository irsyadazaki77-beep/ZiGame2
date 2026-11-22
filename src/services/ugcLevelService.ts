export type UgcTileType = 0 | 1 | 2 | 3 | 4; // 0: Empty, 1: Wall, 2: Energy Orb, 3: Hazard, 4: Goal Portal

export interface UgcCustomLevel {
  id: string;
  title: string;
  author: string;
  gameId: string;
  gridSize: number;
  tiles: UgcTileType[];
  createdAt: number;
}

const STORAGE_KEY_LEVELS = 'zigame_ugc_custom_levels_v1';

const DEFAULT_COMMUNITY_LEVELS: UgcCustomLevel[] = [
  {
    id: 'lvl_cyber_labyrinth',
    title: 'Cyber Labyrinth Alpha',
    author: 'ZiArchitect',
    gameId: 'maze-runner',
    gridSize: 8,
    tiles: [
      0, 1, 0, 2, 0, 1, 0, 4,
      0, 1, 0, 1, 0, 1, 0, 1,
      0, 0, 2, 1, 0, 0, 2, 0,
      1, 1, 0, 1, 1, 1, 0, 0,
      0, 2, 0, 0, 3, 0, 0, 1,
      0, 1, 1, 0, 1, 1, 0, 0,
      0, 0, 2, 0, 0, 1, 2, 0,
      0, 1, 0, 0, 0, 0, 0, 0,
    ],
    createdAt: 1790000000000,
  },
  {
    id: 'lvl_neon_fortress',
    title: 'Neon Voxel Citadel',
    author: 'VoxelMaster',
    gameId: 'world-box',
    gridSize: 8,
    tiles: [
      1, 1, 0, 0, 0, 0, 1, 1,
      1, 2, 0, 1, 1, 0, 2, 1,
      0, 0, 0, 2, 2, 0, 0, 0,
      0, 1, 2, 4, 4, 2, 1, 0,
      0, 1, 2, 4, 4, 2, 1, 0,
      0, 0, 0, 2, 2, 0, 0, 0,
      1, 3, 0, 1, 1, 0, 3, 1,
      1, 1, 0, 0, 0, 0, 1, 1,
    ],
    createdAt: 1790000500000,
  },
];

export class UgcLevelService {
  public encodeLevelCode(level: Pick<UgcCustomLevel, 'title' | 'author' | 'gameId' | 'gridSize' | 'tiles'>): string {
    const payload = {
      t: (level.title || 'Custom Arena').slice(0, 32),
      a: (level.author || 'Player').slice(0, 20),
      g: (level.gameId || 'maze-runner').slice(0, 32),
      s: level.gridSize || 8,
      d: level.tiles.join(''),
    };
    const json = JSON.stringify(payload);
    const b64 =
      typeof btoa === 'function'
        ? btoa(encodeURIComponent(json))
        : Buffer.from(encodeURIComponent(json), 'utf8').toString('base64');
    return `ZGLVL-${b64}`;
  }

  public decodeLevelCode(code: string): UgcCustomLevel | null {
    const clean = (code || '').trim();
    if (!clean.startsWith('ZGLVL-')) return null;
    try {
      const b64 = clean.slice(6);
      const decodedUri =
        typeof atob === 'function'
          ? atob(b64)
          : Buffer.from(b64, 'base64').toString('utf8');
      const parsed = JSON.parse(decodeURIComponent(decodedUri));
      const gridSize = Number(parsed.s) || 8;
      if (gridSize < 4 || gridSize > 16 || typeof parsed.d !== 'string') return null;

      const tiles: UgcTileType[] = parsed.d
        .slice(0, gridSize * gridSize)
        .split('')
        .map((c: string) => {
          const n = Number(c);
          return (n >= 0 && n <= 4 ? n : 0) as UgcTileType;
        });

      while (tiles.length < gridSize * gridSize) {
        tiles.push(0);
      }

      return {
        id: `ugc_${Date.now()}`,
        title: String(parsed.t || 'Imported Arena').slice(0, 32),
        author: String(parsed.a || 'Community').slice(0, 20),
        gameId: String(parsed.g || 'maze-runner').slice(0, 32),
        gridSize,
        tiles,
        createdAt: Date.now(),
      };
    } catch {
      return null;
    }
  }

  public getSavedLevels(): UgcCustomLevel[] {
    if (typeof localStorage === 'undefined') return DEFAULT_COMMUNITY_LEVELS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LEVELS);
      if (!raw) return DEFAULT_COMMUNITY_LEVELS;
      const saved = JSON.parse(raw) as UgcCustomLevel[];
      return Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_COMMUNITY_LEVELS;
    } catch {
      return DEFAULT_COMMUNITY_LEVELS;
    }
  }

  public saveLevel(level: UgcCustomLevel): UgcCustomLevel[] {
    const existing = this.getSavedLevels().filter((l) => l.id !== level.id);
    const updated = [level, ...existing].slice(0, 25);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_LEVELS, JSON.stringify(updated));
      } catch {}
    }
    return updated;
  }
}

export const ugcLevelService = new UgcLevelService();
