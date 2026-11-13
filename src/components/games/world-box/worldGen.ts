// ============================================================================
// WORLDBOX 2.0 — PROCEDURAL WORLD GENERATOR (OCTAVE FBM NOISE)
// ============================================================================

import { BiomeType, ResourceType, WorldTemplate } from './types';

export function pseudoNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.123) * 43758.5453;
  return n - Math.floor(n);
}

export function smoothNoise(x: number, y: number, scale: number, seed: number): number {
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

export function fbmNoise(x: number, y: number, seed: number): number {
  let value = 0;
  value += 0.55 * smoothNoise(x, y, 18, seed);
  value += 0.3 * smoothNoise(x, y, 9, seed + 17);
  value += 0.15 * smoothNoise(x, y, 4, seed + 31);
  return value;
}

export function isLandBiome(b: BiomeType): boolean {
  return b !== 'deep_ocean' && b !== 'shallow_water' && b !== 'lava';
}

export function isWaterBiome(b: BiomeType): boolean {
  return b === 'deep_ocean' || b === 'shallow_water';
}

export function populateProceduralTerrain(
  gridW: number,
  gridH: number,
  template: WorldTemplate,
  biomes: BiomeType[],
  resources: ResourceType[],
  seed: number = Math.random() * 1000
): void {
  const cx = gridW / 2;
  const cy = gridH / 2;

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x;
      resources[idx] = 'none';

      const nx = (x - cx) / (gridW * 0.5);
      const ny = (y - cy) / (gridH * 0.5);
      const distFromCenter = Math.hypot(nx, ny);
      let n = fbmNoise(x, y, seed);

      if (template === 'archipelago') {
        n = n - distFromCenter * 0.38;
      } else if (template === 'pangaea') {
        n = n + 0.14 - Math.pow(distFromCenter, 1.8) * 0.55;
      } else if (template === 'volcanic') {
        if (distFromCenter < 0.22) {
          biomes[idx] = distFromCenter < 0.11 ? 'lava' : 'mountain';
          if (biomes[idx] === 'mountain' && pseudoNoise(x, y, seed + 99) < 0.22) {
            resources[idx] = 'gold';
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

      biomes[idx] = biome;

      const rRoll = pseudoNoise(x * 1.7, y * 1.7, seed + 55);
      if (biome === 'forest' && rRoll < 0.42) {
        resources[idx] = rRoll < 0.34 ? 'tree' : 'berry';
      } else if (biome === 'grass' && rRoll < 0.08) {
        resources[idx] = rRoll < 0.05 ? 'berry' : 'tree';
      } else if (biome === 'mountain' && rRoll < 0.22) {
        resources[idx] = rRoll < 0.16 ? 'stone' : 'gold';
      }
    }
  }
}
