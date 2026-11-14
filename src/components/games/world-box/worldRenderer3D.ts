// ============================================================================
// WORLDBOX 3.5 — STUDIO THREE.JS 3D VOXEL DIORAMA RENDERER
// ============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BIOME_COLORS, MAX_PARTICLES, RACE_CONFIG } from './constants';
import { BiomeType, Kingdom, WorldState } from './types';
import { WorldBoxEngine } from './worldEngine';

export const CELL_3D = 0.68;

const MAX_TERRAIN_TILES = 128 * 96; // headroom above 108 * 66 = 7128
const MAX_LAVA_TILES = 4096;
const MAX_RESOURCE_INST = 4096;
const MAX_BUILDING_INST = 1024;
const MAX_UNIT_INST = 1200;
const MAX_CROWN_INST = 64;
const MAX_BLESSED_INST = 256;
const MAX_SOLDIER_INST = 600;
const MAX_DRAGON_INST = 64;
const MAX_UFO_INST = 32;
const MAX_SHOCKWAVE_INST = 32;
const MAX_KINGDOM_BANNERS = 12;
const CLOUD_CLUSTER_COUNT = 16;

const BIOME_HEIGHT: Record<BiomeType, number> = {
  deep_ocean: 0.22,
  shallow_water: 0.4,
  sand: 0.72,
  grass: 0.96,
  swamp: 0.84,
  forest: 1.08,
  scorched: 0.88,
  mountain: 2.25,
  lava: 0.86
};

// Reusable scratch objects for zero per-frame GC allocations
const _dummy = new THREE.Object3D();
const _dummy2 = new THREE.Object3D();
const _color = new THREE.Color();
const _tint = new THREE.Color();

function hashTile(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function createWaterWaveBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 4) {
      for (let x = 0; x < 256; x += 4) {
        const v =
          128 +
          Math.sin((x / 256) * Math.PI * 6) * 28 +
          Math.cos((y / 256) * Math.PI * 6) * 28 +
          Math.sin(((x + y) / 256) * Math.PI * 10) * 18;
        const c = Math.max(0, Math.min(255, Math.round(v)));
        ctx.fillStyle = `rgb(${c},${c},${c})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  return tex;
}

export function getWorldDimensions3D(gridW: number, gridH: number): { width: number; depth: number } {
  return {
    width: gridW * CELL_3D,
    depth: gridH * CELL_3D
  };
}

export function tileToWorld3D(tx: number, ty: number, gridW: number, gridH: number): { x: number; z: number } {
  return {
    x: (tx - gridW / 2 + 0.5) * CELL_3D,
    z: (ty - gridH / 2 + 0.5) * CELL_3D
  };
}

export function world3DToTile(
  wx: number,
  wz: number,
  gridW: number,
  gridH: number
): { tx: number; ty: number } | null {
  const tx = Math.floor(wx / CELL_3D + gridW / 2);
  const ty = Math.floor(wz / CELL_3D + gridH / 2);
  if (tx < 0 || tx >= gridW || ty < 0 || ty >= gridH) return null;
  return { tx, ty };
}

export function getTerrainSurfaceY(biome: BiomeType, tx: number, ty: number): number {
  const base = BIOME_HEIGHT[biome] ?? 0.9;
  if (biome === 'mountain') {
    return base + hashTile(tx, ty) * 1.15;
  }
  if (biome === 'grass' || biome === 'forest') {
    return base + hashTile(tx, ty) * 0.14;
  }
  return base;
}

interface CloudSeed {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  speedMul: number;
}

interface KingdomBannerSlot {
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  texture: THREE.CanvasTexture;
  lastKey: string;
}

export class WorldBoxRenderer3D {
  public readonly root = new THREE.Group();
  public readonly terrainMesh: THREE.InstancedMesh;

  private readonly snowCapMesh: THREE.InstancedMesh;
  private readonly lavaMesh: THREE.InstancedMesh;
  private readonly waterPlane: THREE.Mesh;
  private readonly waterBumpTex: THREE.CanvasTexture;
  private readonly pedestalMesh: THREE.Mesh;
  private readonly trimFrameMesh: THREE.Mesh;
  private readonly brushRing: THREE.Mesh;
  private readonly selectionHalo: THREE.Mesh;

  // Resource instanced pools
  private readonly treeTrunkMesh: THREE.InstancedMesh;
  private readonly treeCanopyMesh: THREE.InstancedMesh;
  private readonly treeTopCanopyMesh: THREE.InstancedMesh;
  private readonly rockMesh: THREE.InstancedMesh;
  private readonly goldMesh: THREE.InstancedMesh;
  private readonly fireMesh: THREE.InstancedMesh;

  // Building instanced pools
  private readonly buildingBodyMesh: THREE.InstancedMesh;
  private readonly buildingRoofMesh: THREE.InstancedMesh;

  // Unit & Hero detail instanced pools
  private readonly unitBodyMesh: THREE.InstancedMesh;
  private readonly unitHeadMesh: THREE.InstancedMesh;
  private readonly crownMesh: THREE.InstancedMesh;
  private readonly soldierSpearMesh: THREE.InstancedMesh;
  private readonly blessedAuraMesh: THREE.InstancedMesh;
  private readonly dragonWingMesh: THREE.InstancedMesh;
  private readonly ufoBeamMesh: THREE.InstancedMesh;

  // Atmosphere, FX & Kingdom Banners
  private readonly cloudMesh: THREE.InstancedMesh;
  private readonly cloudSeeds: CloudSeed[] = [];
  private readonly simParticleMesh: THREE.InstancedMesh;
  private readonly shockwaveMesh: THREE.InstancedMesh;
  private readonly disasterBeamMesh: THREE.InstancedMesh;
  private readonly kingdomBanners: KingdomBannerSlot[] = [];

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];

  private lastTerrainVersion = -1;
  private lastTerritorySyncTick = -1;
  private lastShowBorders = true;
  private lastGridW = 0;
  private lastGridH = 0;
  private prevElapsed = 0;

  private readonly kingdomColorCache = new Map<number, string>();

  constructor(scene: THREE.Scene) {
    // 1. Ornate Tabletop Diorama Base Pedestal + Bronze Rim
    const pedGeo = new THREE.BoxGeometry(1, 1.5, 1);
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x090f1c,
      roughness: 0.78,
      metalness: 0.28
    });
    this.pedestalMesh = new THREE.Mesh(pedGeo, pedMat);
    this.pedestalMesh.position.y = -0.76;
    this.pedestalMesh.receiveShadow = true;
    this.root.add(this.pedestalMesh);
    this.geometries.push(pedGeo);
    this.materials.push(pedMat);

    const trimGeo = new THREE.BoxGeometry(1, 0.36, 1);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.42,
      metalness: 0.65
    });
    this.trimFrameMesh = new THREE.Mesh(trimGeo, trimMat);
    this.trimFrameMesh.position.y = -0.14;
    this.trimFrameMesh.receiveShadow = true;
    this.root.add(this.trimFrameMesh);
    this.geometries.push(trimGeo);
    this.materials.push(trimMat);

    // 2. Terrain Voxel Columns (InstancedMesh, 1:1 indexed by y * gridW + x)
    const tileGeo = new THREE.BoxGeometry(CELL_3D * 0.99, 1, CELL_3D * 0.99);
    const tileMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.76,
      metalness: 0.08
    });
    this.terrainMesh = new THREE.InstancedMesh(tileGeo, tileMat, MAX_TERRAIN_TILES);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = false;
    this.terrainMesh.count = 0;
    this.root.add(this.terrainMesh);
    this.geometries.push(tileGeo);
    this.materials.push(tileMat);

    // Mountain Snow Caps
    const snowGeo = new THREE.BoxGeometry(CELL_3D * 0.76, 0.3, CELL_3D * 0.76);
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.5,
      metalness: 0.05
    });
    this.snowCapMesh = new THREE.InstancedMesh(snowGeo, snowMat, 2048);
    this.snowCapMesh.receiveShadow = true;
    this.snowCapMesh.count = 0;
    this.root.add(this.snowCapMesh);
    this.geometries.push(snowGeo);
    this.materials.push(snowMat);

    // Glowing Lava Tiles
    const lavaGeo = new THREE.BoxGeometry(CELL_3D * 0.98, 0.22, CELL_3D * 0.98);
    const lavaMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.75,
      roughness: 0.25
    });
    this.lavaMesh = new THREE.InstancedMesh(lavaGeo, lavaMat, MAX_LAVA_TILES);
    this.lavaMesh.count = 0;
    this.root.add(this.lavaMesh);
    this.geometries.push(lavaGeo);
    this.materials.push(lavaMat);

    // 3. Shimmering Animated Ocean Water Plane
    this.waterBumpTex = createWaterWaveBumpTexture();
    this.textures.push(this.waterBumpTex);

    const waterGeo = new THREE.PlaneGeometry(1, 1);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.28,
      roughness: 0.14,
      metalness: 0.12,
      bumpMap: this.waterBumpTex,
      bumpScale: 0.08,
      transparent: true,
      opacity: 0.68,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12
    });
    this.waterPlane = new THREE.Mesh(waterGeo, waterMat);
    this.waterPlane.rotation.x = -Math.PI / 2;
    this.waterPlane.position.y = 0.56;
    this.waterPlane.receiveShadow = true;
    this.root.add(this.waterPlane);
    this.geometries.push(waterGeo);
    this.materials.push(waterMat);

    // 4. Resources (2-Tier Trees, Rocks, Gold, Fire)
    const trunkGeo = new THREE.CylinderGeometry(0.055, 0.09, 0.4, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    this.treeTrunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, MAX_RESOURCE_INST);
    this.treeTrunkMesh.castShadow = true;
    this.treeTrunkMesh.count = 0;
    this.root.add(this.treeTrunkMesh);
    this.geometries.push(trunkGeo);
    this.materials.push(trunkMat);

    const canopyGeo = new THREE.ConeGeometry(0.3, 0.54, 6);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.05
    });
    this.treeCanopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, MAX_RESOURCE_INST);
    this.treeCanopyMesh.castShadow = true;
    this.treeCanopyMesh.receiveShadow = true;
    this.treeCanopyMesh.count = 0;
    this.root.add(this.treeCanopyMesh);
    this.geometries.push(canopyGeo);
    this.materials.push(canopyMat);

    const topCanopyGeo = new THREE.ConeGeometry(0.21, 0.42, 6);
    this.treeTopCanopyMesh = new THREE.InstancedMesh(topCanopyGeo, canopyMat, MAX_RESOURCE_INST);
    this.treeTopCanopyMesh.castShadow = true;
    this.treeTopCanopyMesh.count = 0;
    this.root.add(this.treeTopCanopyMesh);
    this.geometries.push(topCanopyGeo);

    const rockGeo = new THREE.DodecahedronGeometry(0.21, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0.15 });
    this.rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, MAX_RESOURCE_INST);
    this.rockMesh.castShadow = true;
    this.rockMesh.count = 0;
    this.root.add(this.rockMesh);
    this.geometries.push(rockGeo);
    this.materials.push(rockMat);

    const goldGeo = new THREE.OctahedronGeometry(0.21, 0);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.75,
      metalness: 0.88,
      roughness: 0.18
    });
    this.goldMesh = new THREE.InstancedMesh(goldGeo, goldMat, MAX_RESOURCE_INST);
    this.goldMesh.castShadow = true;
    this.goldMesh.count = 0;
    this.root.add(this.goldMesh);
    this.geometries.push(goldGeo);
    this.materials.push(goldMat);

    const fireGeo = new THREE.ConeGeometry(0.19, 0.56, 5);
    const fireMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf97316,
      emissiveIntensity: 2.2,
      roughness: 0.2
    });
    this.fireMesh = new THREE.InstancedMesh(fireGeo, fireMat, MAX_RESOURCE_INST);
    this.fireMesh.count = 0;
    this.root.add(this.fireMesh);
    this.geometries.push(fireGeo);
    this.materials.push(fireMat);

    // 5. Buildings (Walls + Faction Roofs)
    const bBodyGeo = new RoundedBoxGeometry(0.46, 0.48, 0.46, 2, 0.04);
    const bBodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.58, metalness: 0.16 });
    this.buildingBodyMesh = new THREE.InstancedMesh(bBodyGeo, bBodyMat, MAX_BUILDING_INST);
    this.buildingBodyMesh.castShadow = true;
    this.buildingBodyMesh.receiveShadow = true;
    this.buildingBodyMesh.count = 0;
    this.root.add(this.buildingBodyMesh);
    this.geometries.push(bBodyGeo);
    this.materials.push(bBodyMat);

    const bRoofGeo = new THREE.ConeGeometry(0.39, 0.38, 4);
    bRoofGeo.rotateY(Math.PI / 4);
    const bRoofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.25 });
    this.buildingRoofMesh = new THREE.InstancedMesh(bRoofGeo, bRoofMat, MAX_BUILDING_INST);
    this.buildingRoofMesh.castShadow = true;
    this.buildingRoofMesh.count = 0;
    this.root.add(this.buildingRoofMesh);
    this.geometries.push(bRoofGeo);
    this.materials.push(bRoofMat);

    // 6. Units & Creatures (Bodies, Heads, Crowns, Soldier Spears, Blessed Auras, Dragon Wings, UFO Beams)
    const uBodyGeo = new RoundedBoxGeometry(0.24, 0.32, 0.2, 2, 0.04);
    const uBodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.22 });
    this.unitBodyMesh = new THREE.InstancedMesh(uBodyGeo, uBodyMat, MAX_UNIT_INST);
    this.unitBodyMesh.castShadow = true;
    this.unitBodyMesh.count = 0;
    this.root.add(this.unitBodyMesh);
    this.geometries.push(uBodyGeo);
    this.materials.push(uBodyMat);

    const uHeadGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const uHeadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    this.unitHeadMesh = new THREE.InstancedMesh(uHeadGeo, uHeadMat, MAX_UNIT_INST);
    this.unitHeadMesh.castShadow = true;
    this.unitHeadMesh.count = 0;
    this.root.add(this.unitHeadMesh);
    this.geometries.push(uHeadGeo);
    this.materials.push(uHeadMat);

    const crownGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.1, 6);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 1.35,
      metalness: 0.9,
      roughness: 0.15
    });
    this.crownMesh = new THREE.InstancedMesh(crownGeo, crownMat, MAX_CROWN_INST);
    this.crownMesh.count = 0;
    this.root.add(this.crownMesh);
    this.geometries.push(crownGeo);
    this.materials.push(crownMat);

    const spearGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.52, 5);
    const spearMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.85,
      roughness: 0.25
    });
    this.soldierSpearMesh = new THREE.InstancedMesh(spearGeo, spearMat, MAX_SOLDIER_INST);
    this.soldierSpearMesh.count = 0;
    this.root.add(this.soldierSpearMesh);
    this.geometries.push(spearGeo);
    this.materials.push(spearMat);

    const auraGeo = new THREE.TorusGeometry(0.24, 0.03, 6, 18);
    auraGeo.rotateX(Math.PI / 2);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85
    });
    this.blessedAuraMesh = new THREE.InstancedMesh(auraGeo, auraMat, MAX_BLESSED_INST);
    this.blessedAuraMesh.count = 0;
    this.root.add(this.blessedAuraMesh);
    this.geometries.push(auraGeo);
    this.materials.push(auraMat);

    const wingGeo = new THREE.BoxGeometry(1.4, 0.06, 0.44);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 0.55,
      roughness: 0.45
    });
    this.dragonWingMesh = new THREE.InstancedMesh(wingGeo, wingMat, MAX_DRAGON_INST);
    this.dragonWingMesh.castShadow = true;
    this.dragonWingMesh.count = 0;
    this.root.add(this.dragonWingMesh);
    this.geometries.push(wingGeo);
    this.materials.push(wingMat);

    const ufoBeamGeo = new THREE.ConeGeometry(0.95, 2.7, 16, 1, true);
    const ufoBeamMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.ufoBeamMesh = new THREE.InstancedMesh(ufoBeamGeo, ufoBeamMat, MAX_UFO_INST);
    this.ufoBeamMesh.count = 0;
    this.root.add(this.ufoBeamMesh);
    this.geometries.push(ufoBeamGeo);
    this.materials.push(ufoBeamMat);

    // 7. Drifting Atmospheric Clouds
    const cloudGeo = new RoundedBoxGeometry(2.6, 0.65, 1.5, 2, 0.22);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.55
    });
    this.cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, CLOUD_CLUSTER_COUNT * 2);
    this.cloudMesh.castShadow = false;
    this.root.add(this.cloudMesh);
    this.geometries.push(cloudGeo);
    this.materials.push(cloudMat);

    for (let i = 0; i < CLOUD_CLUSTER_COUNT; i++) {
      this.cloudSeeds.push({
        x: (hashTile(i * 3 + 1, 7) - 0.5) * 68,
        y: 7.4 + hashTile(i, 19) * 2.2,
        z: (hashTile(i * 5 + 2, 11) - 0.5) * 42,
        sx: 0.8 + hashTile(i, 3) * 0.9,
        sy: 0.75 + hashTile(i, 5) * 0.5,
        sz: 0.8 + hashTile(i, 9) * 0.8,
        speedMul: 0.6 + hashTile(i, 13) * 0.7
      });
    }

    // 8. Particles, Shockwaves & Sky Disaster Beams
    const partGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.simParticleMesh = new THREE.InstancedMesh(partGeo, partMat, MAX_PARTICLES);
    this.simParticleMesh.count = 0;
    this.root.add(this.simParticleMesh);
    this.geometries.push(partGeo);
    this.materials.push(partMat);

    const swGeo = new THREE.TorusGeometry(1, 0.07, 8, 32);
    swGeo.rotateX(Math.PI / 2);
    const swMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.shockwaveMesh = new THREE.InstancedMesh(swGeo, swMat, MAX_SHOCKWAVE_INST);
    this.shockwaveMesh.count = 0;
    this.root.add(this.shockwaveMesh);
    this.geometries.push(swGeo);
    this.materials.push(swMat);

    const beamGeo = new THREE.CylinderGeometry(0.18, 0.65, 14, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.disasterBeamMesh = new THREE.InstancedMesh(beamGeo, beamMat, MAX_SHOCKWAVE_INST);
    this.disasterBeamMesh.count = 0;
    this.root.add(this.disasterBeamMesh);
    this.geometries.push(beamGeo);
    this.materials.push(beamMat);

    // 9. 3D Brush Hover Ring & Inspected Unit Halo
    const ringGeo = new THREE.RingGeometry(0.84, 1.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });
    this.brushRing = new THREE.Mesh(ringGeo, ringMat);
    this.brushRing.visible = false;
    this.root.add(this.brushRing);
    this.geometries.push(ringGeo);
    this.materials.push(ringMat);

    const haloGeo = new THREE.TorusGeometry(0.34, 0.05, 8, 24);
    haloGeo.rotateX(Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    this.selectionHalo = new THREE.Mesh(haloGeo, haloMat);
    this.selectionHalo.visible = false;
    this.root.add(this.selectionHalo);
    this.geometries.push(haloGeo);
    this.materials.push(haloMat);

    // 10. Pre-allocated Kingdom Name Banner Sprites
    for (let i = 0; i < MAX_KINGDOM_BANNERS; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(4.2, 1.05, 1);
      sprite.visible = false;
      this.root.add(sprite);
      this.materials.push(mat);
      this.textures.push(texture);
      this.kingdomBanners.push({ sprite, canvas, ctx, texture, lastKey: '' });
    }

    scene.add(this.root);
  }

  public raycastTerrain(
    raycaster: THREE.Raycaster,
    gridW: number,
    gridH: number
  ): { tx: number; ty: number } | null {
    const hits = raycaster.intersectObject(this.terrainMesh, false);
    if (hits.length > 0 && hits[0].instanceId !== undefined) {
      const id = hits[0].instanceId;
      const tx = id % gridW;
      const ty = Math.floor(id / gridW);
      if (tx >= 0 && tx < gridW && ty >= 0 && ty < gridH) {
        return { tx, ty };
      }
    }
    return null;
  }

  public setBrushCursor(
    tile: { tx: number; ty: number } | null,
    gridW: number,
    gridH: number,
    radiusTiles: number,
    accentHex: string,
    biomeAtCursor?: BiomeType
  ): void {
    if (!tile) {
      this.brushRing.visible = false;
      return;
    }
    const { x, z } = tileToWorld3D(tile.tx, tile.ty, gridW, gridH);
    const surfY = biomeAtCursor ? getTerrainSurfaceY(biomeAtCursor, tile.tx, tile.ty) : 0.95;
    this.brushRing.position.set(x, Math.max(0.62, surfY + 0.08), z);
    const worldR = Math.max(0.45, radiusTiles * CELL_3D);
    this.brushRing.scale.setScalar(worldR);
    (this.brushRing.material as THREE.MeshBasicMaterial).color.set(accentHex);
    this.brushRing.visible = true;
  }

  private updateKingdomBanners(kingdoms: Kingdom[], s: WorldState): void {
    for (let i = 0; i < MAX_KINGDOM_BANNERS; i++) {
      const slot = this.kingdomBanners[i];
      const k = kingdoms[i];
      if (!k) {
        slot.sprite.visible = false;
        continue;
      }

      const key = `${k.id}|${k.name}|${k.population}|${k.borderColor}`;
      if (slot.lastKey !== key && slot.ctx) {
        const ctx = slot.ctx;
        ctx.clearRect(0, 0, 256, 64);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = k.borderColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(8, 8, 240, 48, 12);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = `${k.name} (${k.population})`;
        ctx.fillText(label.slice(0, 22), 128, 33);

        slot.texture.needsUpdate = true;
        slot.lastKey = key;
      }

      const cx = Math.max(0, Math.min(s.gridW - 1, Math.round(k.capitalX)));
      const cy = Math.max(0, Math.min(s.gridH - 1, Math.round(k.capitalY)));
      const { x, z } = tileToWorld3D(cx, cy, s.gridW, s.gridH);
      const surfY = getTerrainSurfaceY(s.biomes[cy * s.gridW + cx], cx, cy);
      slot.sprite.position.set(x, surfY + 2.4, z);
      slot.sprite.visible = true;
    }
  }

  private syncStaticWorldGeometry(s: WorldState, showKingdomBorders: boolean): void {
    const { width, depth } = getWorldDimensions3D(s.gridW, s.gridH);
    if (this.lastGridW !== s.gridW || this.lastGridH !== s.gridH) {
      this.pedestalMesh.scale.set(width + 1.8, 1, depth + 1.8);
      this.trimFrameMesh.scale.set(width + 2.4, 1, depth + 2.4);
      this.waterPlane.scale.set(width, depth, 1);
      this.lastGridW = s.gridW;
      this.lastGridH = s.gridH;
    }

    this.kingdomColorCache.clear();
    for (let i = 0; i < s.kingdoms.length; i++) {
      this.kingdomColorCache.set(s.kingdoms[i].id, s.kingdoms[i].color);
    }

    let tileCount = 0;
    let snowCount = 0;
    let lavaCount = 0;

    for (let y = 0; y < s.gridH; y++) {
      const row = y * s.gridW;
      const wz = (y - s.gridH / 2 + 0.5) * CELL_3D;
      for (let x = 0; x < s.gridW; x++) {
        if (tileCount >= MAX_TERRAIN_TILES) break;
        const idx = row + x;
        const biome = s.biomes[idx];
        const wx = (x - s.gridW / 2 + 0.5) * CELL_3D;
        const h = getTerrainSurfaceY(biome, x, y);

        _dummy.position.set(wx, h / 2, wz);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1, h, 1);
        _dummy.updateMatrix();
        this.terrainMesh.setMatrixAt(tileCount, _dummy.matrix);

        const palette = BIOME_COLORS[biome] ?? ['#0f172a', '#1e293b'];
        _color.set(palette[(x + y) % 2]);

        // Kingdom territory color tint & crisp border outline on land tiles
        if (showKingdomBorders && s.territory[idx] !== -1) {
          const kHex = this.kingdomColorCache.get(s.territory[idx]);
          if (kHex) {
            const isBorder =
              (x > 0 && s.territory[idx - 1] !== s.territory[idx]) ||
              (x < s.gridW - 1 && s.territory[idx + 1] !== s.territory[idx]) ||
              (y > 0 && s.territory[idx - s.gridW] !== s.territory[idx]) ||
              (y < s.gridH - 1 && s.territory[idx + s.gridW] !== s.territory[idx]);
            _tint.set(kHex);
            _color.lerp(_tint, isBorder ? 0.65 : 0.22);
          }
        }

        this.terrainMesh.setColorAt(tileCount, _color);
        tileCount++;

        if (biome === 'mountain' && h > 2.75 && snowCount < 2048) {
          _dummy.position.set(wx, h + 0.14, wz);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          this.snowCapMesh.setMatrixAt(snowCount, _dummy.matrix);
          snowCount++;
        } else if (biome === 'lava' && lavaCount < MAX_LAVA_TILES) {
          _dummy.position.set(wx, h + 0.02, wz);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          this.lavaMesh.setMatrixAt(lavaCount, _dummy.matrix);
          lavaCount++;
        }
      }
    }

    this.terrainMesh.count = tileCount;
    this.terrainMesh.instanceMatrix.needsUpdate = true;
    if (this.terrainMesh.instanceColor) this.terrainMesh.instanceColor.needsUpdate = true;

    this.snowCapMesh.count = snowCount;
    this.snowCapMesh.instanceMatrix.needsUpdate = true;

    this.lavaMesh.count = lavaCount;
    this.lavaMesh.instanceMatrix.needsUpdate = true;
  }

  public sync(engine: WorldBoxEngine, selectedUnitId: number | null, elapsedSec: number): void {
    const s = engine.state;
    const showBorders = engine.laws.showKingdomBorders;
    const dt = this.prevElapsed > 0 ? Math.min(0.05, Math.max(0.001, elapsedSec - this.prevElapsed)) : 0.016;
    this.prevElapsed = elapsedSec;

    // Animated ocean ripple surface & subtle tide bob
    this.waterPlane.position.y = 0.55 + Math.sin(elapsedSec * 1.5) * 0.025;
    this.waterBumpTex.offset.x = (this.waterBumpTex.offset.x + dt * 0.04) % 1;
    this.waterBumpTex.offset.y = (this.waterBumpTex.offset.y + dt * 0.025) % 1;

    // Drifting atmospheric clouds following windAngle
    const windCos = Math.cos(s.windAngle);
    const windSin = Math.sin(s.windAngle);
    const halfW = (s.gridW * CELL_3D) * 0.55;
    const halfD = (s.gridH * CELL_3D) * 0.55;
    let cIdx = 0;
    for (let i = 0; i < this.cloudSeeds.length; i++) {
      const c = this.cloudSeeds[i];
      c.x += windCos * c.speedMul * dt * 1.25;
      c.z += windSin * c.speedMul * dt * 1.25;
      if (c.x > halfW) c.x = -halfW;
      if (c.x < -halfW) c.x = halfW;
      if (c.z > halfD) c.z = -halfD;
      if (c.z < -halfD) c.z = halfD;

      _dummy.position.set(c.x, c.y, c.z);
      _dummy.rotation.set(0, s.windAngle * 0.25, 0);
      _dummy.scale.set(c.sx, c.sy, c.sz);
      _dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(cIdx++, _dummy.matrix);

      _dummy.position.set(c.x + c.sx * 0.75, c.y - 0.16, c.z + 0.45);
      _dummy.scale.set(c.sx * 0.65, c.sy * 0.75, c.sz * 0.7);
      _dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(cIdx++, _dummy.matrix);
    }
    this.cloudMesh.count = cIdx;
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    // Rebuild 3D terrain instances only when dirty, borders toggled, or periodic territory update
    const territoryPeriodic =
      showBorders && Math.floor(s.tickCount / 15) !== Math.floor(this.lastTerritorySyncTick / 15);
    if (
      s.terrainDirty ||
      this.lastTerrainVersion === -1 ||
      this.lastShowBorders !== showBorders ||
      territoryPeriodic
    ) {
      this.syncStaticWorldGeometry(s, showBorders);
      s.terrainDirty = false;
      this.lastTerrainVersion = s.tickCount;
      this.lastTerritorySyncTick = s.tickCount;
      this.lastShowBorders = showBorders;
    }

    this.updateKingdomBanners(s.kingdoms, s);

    // Sync 3D Resources (2-tier trees, berry bushes, rocks, gold, fire)
    let treeCount = 0;
    let rockCount = 0;
    let goldCount = 0;
    let fireCount = 0;

    for (let y = 0; y < s.gridH; y++) {
      const row = y * s.gridW;
      const wz = (y - s.gridH / 2 + 0.5) * CELL_3D;
      for (let x = 0; x < s.gridW; x++) {
        const idx = row + x;
        const res = s.resources[idx];
        if (res === 'none') continue;
        const wx = (x - s.gridW / 2 + 0.5) * CELL_3D;
        const surfY = getTerrainSurfaceY(s.biomes[idx], x, y);

        if ((res === 'tree' || res === 'berry') && treeCount < MAX_RESOURCE_INST) {
          const isTree = res === 'tree';
          const scale = isTree ? 0.9 + hashTile(x + 3, y) * 0.35 : 0.46;
          const sway = Math.sin(elapsedSec * 1.9 + x * 0.45) * 0.045;
          _dummy.position.set(wx, surfY + 0.17 * scale, wz);
          _dummy.rotation.set(0, 0, sway);
          _dummy.scale.setScalar(scale);
          _dummy.updateMatrix();
          this.treeTrunkMesh.setMatrixAt(treeCount, _dummy.matrix);

          _dummy2.position.set(wx, surfY + (isTree ? 0.5 : 0.24) * scale, wz);
          _dummy2.rotation.set(0, hashTile(x, y) * Math.PI, sway);
          _dummy2.scale.set(
            isTree ? scale : scale * 1.35,
            isTree ? scale : scale * 0.72,
            isTree ? scale : scale * 1.35
          );
          _dummy2.updateMatrix();
          this.treeCanopyMesh.setMatrixAt(treeCount, _dummy2.matrix);
          _color.set(isTree ? (s.biomes[idx] === 'forest' ? 0x15803d : 0x22c55e) : 0xf43f5e);
          this.treeCanopyMesh.setColorAt(treeCount, _color);

          // Upper pine crown for trees
          if (isTree) {
            _dummy2.position.set(wx, surfY + 0.78 * scale, wz);
            _dummy2.scale.setScalar(scale * 0.92);
          } else {
            _dummy2.scale.setScalar(0.001);
          }
          _dummy2.updateMatrix();
          this.treeTopCanopyMesh.setMatrixAt(treeCount, _dummy2.matrix);
          _color.set(s.biomes[idx] === 'forest' ? 0x16a34a : 0x4ade80);
          this.treeTopCanopyMesh.setColorAt(treeCount, _color);
          treeCount++;
        } else if (res === 'stone' && rockCount < MAX_RESOURCE_INST) {
          _dummy.position.set(wx, surfY + 0.14, wz);
          _dummy.rotation.set(hashTile(x, y) * 2, hashTile(y, x) * 3, 0);
          _dummy.scale.setScalar(0.85 + hashTile(x, y) * 0.4);
          _dummy.updateMatrix();
          this.rockMesh.setMatrixAt(rockCount, _dummy.matrix);
          rockCount++;
        } else if (res === 'gold' && goldCount < MAX_RESOURCE_INST) {
          _dummy.position.set(wx, surfY + 0.18, wz);
          _dummy.rotation.set(0, elapsedSec * 1.1 + x, 0.25);
          _dummy.scale.setScalar(0.95);
          _dummy.updateMatrix();
          this.goldMesh.setMatrixAt(goldCount, _dummy.matrix);
          goldCount++;
        } else if (res === 'fire' && fireCount < MAX_RESOURCE_INST) {
          const flicker = 0.8 + Math.sin(elapsedSec * 14 + x * 2.1 + y) * 0.32;
          _dummy.position.set(wx, surfY + 0.24 * flicker, wz);
          _dummy.rotation.set(0, elapsedSec * 4 + x, 0);
          _dummy.scale.set(1, flicker, 1);
          _dummy.updateMatrix();
          this.fireMesh.setMatrixAt(fireCount, _dummy.matrix);
          fireCount++;
        }
      }
    }

    this.treeTrunkMesh.count = treeCount;
    this.treeTrunkMesh.instanceMatrix.needsUpdate = true;
    this.treeCanopyMesh.count = treeCount;
    this.treeCanopyMesh.instanceMatrix.needsUpdate = true;
    if (this.treeCanopyMesh.instanceColor) this.treeCanopyMesh.instanceColor.needsUpdate = true;
    this.treeTopCanopyMesh.count = treeCount;
    this.treeTopCanopyMesh.instanceMatrix.needsUpdate = true;
    if (this.treeTopCanopyMesh.instanceColor) this.treeTopCanopyMesh.instanceColor.needsUpdate = true;

    this.rockMesh.count = rockCount;
    this.rockMesh.instanceMatrix.needsUpdate = true;
    this.goldMesh.count = goldCount;
    this.goldMesh.instanceMatrix.needsUpdate = true;
    this.fireMesh.count = fireCount;
    this.fireMesh.instanceMatrix.needsUpdate = true;

    // Sync 3D Buildings
    let bCount = 0;
    for (let i = 0; i < s.buildings.length && bCount < MAX_BUILDING_INST; i++) {
      const b = s.buildings[i];
      const idx = b.y * s.gridW + b.x;
      const surfY = idx >= 0 && idx < s.biomes.length ? getTerrainSurfaceY(s.biomes[idx], b.x, b.y) : 0.95;
      const wx = (b.x - s.gridW / 2 + 0.5) * CELL_3D;
      const wz = (b.y - s.gridH / 2 + 0.5) * CELL_3D;

      const scaleXZ = b.type === 'hall' ? 1.48 : b.type === 'tower' ? 0.95 : 1.05;
      const scaleY = b.type === 'tower' ? 1.9 : b.type === 'hall' ? 1.45 : b.type === 'mine' ? 0.78 : 0.95;

      _dummy.position.set(wx, surfY + 0.24 * scaleY, wz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      _dummy.updateMatrix();
      this.buildingBodyMesh.setMatrixAt(bCount, _dummy.matrix);

      _dummy2.position.set(wx, surfY + 0.48 * scaleY + 0.17 * scaleXZ, wz);
      _dummy2.rotation.set(0, 0, 0);
      _dummy2.scale.set(scaleXZ * 1.12, scaleXZ, scaleXZ * 1.12);
      _dummy2.updateMatrix();
      this.buildingRoofMesh.setMatrixAt(bCount, _dummy2.matrix);
      _color.set(b.type === 'mine' ? '#facc15' : RACE_CONFIG[b.race].primaryColor);
      this.buildingRoofMesh.setColorAt(bCount, _color);
      bCount++;
    }
    this.buildingBodyMesh.count = bCount;
    this.buildingBodyMesh.instanceMatrix.needsUpdate = true;
    this.buildingRoofMesh.count = bCount;
    this.buildingRoofMesh.instanceMatrix.needsUpdate = true;
    if (this.buildingRoofMesh.instanceColor) this.buildingRoofMesh.instanceColor.needsUpdate = true;

    // Sync 3D Units, Crowns, Soldier Spears, Blessed Auras, Dragon Wings, UFO Beams
    let uCount = 0;
    let crownCount = 0;
    let soldierCount = 0;
    let blessedCount = 0;
    let wingCount = 0;
    let ufoCount = 0;
    this.selectionHalo.visible = false;

    for (let i = 0; i < s.units.length && uCount < MAX_UNIT_INST; i++) {
      const u = s.units[i];
      const tx = Math.max(0, Math.min(s.gridW - 1, Math.floor(u.x)));
      const ty = Math.max(0, Math.min(s.gridH - 1, Math.floor(u.y)));
      const surfY = getTerrainSurfaceY(s.biomes[ty * s.gridW + tx], tx, ty);
      const wx = (u.x - s.gridW / 2 + 0.5) * CELL_3D;
      const wz = (u.y - s.gridH / 2 + 0.5) * CELL_3D;
      const cfg = RACE_CONFIG[u.race];
      const bob = Math.abs(Math.sin(u.animFrame * 0.25)) * 0.1;
      const yaw = Math.atan2(u.vx, u.vy || 0.001);

      if (u.race === 'dragon') {
        const flyY = Math.max(surfY, 0.7) + 2.6 + Math.sin(elapsedSec * 3.5 + u.id) * 0.28;
        _dummy.position.set(wx, flyY, wz);
        _dummy.rotation.set(0, yaw, 0);
        _dummy.scale.set(2.2, 1.4, 3.0);
        _dummy.updateMatrix();
        this.unitBodyMesh.setMatrixAt(uCount, _dummy.matrix);
        _color.set('#dc2626');
        this.unitBodyMesh.setColorAt(uCount, _color);

        _dummy2.position.set(wx + Math.sin(yaw) * 0.45, flyY + 0.2, wz + Math.cos(yaw) * 0.45);
        _dummy2.rotation.set(0, yaw, 0);
        _dummy2.scale.set(1.6, 1.4, 2.0);
        _dummy2.updateMatrix();
        this.unitHeadMesh.setMatrixAt(uCount, _dummy2.matrix);
        _color.set('#fb923c');
        this.unitHeadMesh.setColorAt(uCount, _color);
        uCount++;

        if (wingCount < MAX_DRAGON_INST) {
          const flap = Math.sin(elapsedSec * 11 + u.id) * 0.4;
          _dummy.position.set(wx, flyY + 0.14, wz);
          _dummy.rotation.set(flap, yaw, 0);
          _dummy.scale.set(1.32, 1, 1.32);
          _dummy.updateMatrix();
          this.dragonWingMesh.setMatrixAt(wingCount++, _dummy.matrix);
        }
      } else if (u.race === 'ufo') {
        const flyY = Math.max(surfY, 0.7) + 2.9 + Math.sin(elapsedSec * 2.8 + u.id) * 0.16;
        _dummy.position.set(wx, flyY, wz);
        _dummy.rotation.set(0, elapsedSec * 3.2, 0);
        _dummy.scale.set(2.8, 0.55, 2.8);
        _dummy.updateMatrix();
        this.unitBodyMesh.setMatrixAt(uCount, _dummy.matrix);
        _color.set('#64748b');
        this.unitBodyMesh.setColorAt(uCount, _color);

        _dummy2.position.set(wx, flyY + 0.18, wz);
        _dummy2.rotation.set(0, elapsedSec * 3.2, 0);
        _dummy2.scale.set(1.4, 1.0, 1.4);
        _dummy2.updateMatrix();
        this.unitHeadMesh.setMatrixAt(uCount, _dummy2.matrix);
        _color.set('#22d3ee');
        this.unitHeadMesh.setColorAt(uCount, _color);
        uCount++;

        if (ufoCount < MAX_UFO_INST) {
          _dummy.position.set(wx, flyY - 1.35, wz);
          _dummy.rotation.set(0, elapsedSec * 2, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          this.ufoBeamMesh.setMatrixAt(ufoCount++, _dummy.matrix);
        }
      } else if (u.race === 'tornado') {
        const baseH = Math.max(surfY, 0.6) + 0.95;
        _dummy.position.set(wx, baseH, wz);
        _dummy.rotation.set(0.15, elapsedSec * 10 + u.id, 0);
        _dummy.scale.set(1.5, 4.4, 1.5);
        _dummy.updateMatrix();
        this.unitBodyMesh.setMatrixAt(uCount, _dummy.matrix);
        _color.set('#94a3b8');
        this.unitBodyMesh.setColorAt(uCount, _color);

        _dummy2.position.set(wx, baseH + 0.95, wz);
        _dummy2.rotation.set(0, elapsedSec * 12, 0);
        _dummy2.scale.set(2.5, 1.9, 2.5);
        _dummy2.updateMatrix();
        this.unitHeadMesh.setMatrixAt(uCount, _dummy2.matrix);
        _color.set('#e2e8f0');
        this.unitHeadMesh.setColorAt(uCount, _color);
        uCount++;
      } else {
        const gScale = u.traits.includes('Giant') ? 1.45 : u.race === 'sheep' || u.race === 'wolf' ? 0.85 : 1.0;
        const bodyY = Math.max(surfY, 0.55) + 0.16 * gScale + bob;
        _dummy.position.set(wx, bodyY, wz);
        _dummy.rotation.set(0, yaw, 0);
        _dummy.scale.setScalar(gScale);
        _dummy.updateMatrix();
        this.unitBodyMesh.setMatrixAt(uCount, _dummy.matrix);
        _color.set(cfg.primaryColor);
        this.unitBodyMesh.setColorAt(uCount, _color);

        _dummy2.position.set(wx, bodyY + 0.24 * gScale, wz);
        _dummy2.rotation.set(0, yaw, 0);
        _dummy2.scale.setScalar(gScale);
        _dummy2.updateMatrix();
        this.unitHeadMesh.setMatrixAt(uCount, _dummy2.matrix);
        _color.set(
          u.race === 'orc'
            ? '#4ade80'
            : u.race === 'sheep'
            ? '#f8fafc'
            : u.race === 'wolf'
            ? '#475569'
            : '#fed7aa'
        );
        this.unitHeadMesh.setColorAt(uCount, _color);
        uCount++;

        if (u.isKing && crownCount < MAX_CROWN_INST) {
          _dummy.position.set(wx, bodyY + 0.42 * gScale, wz);
          _dummy.rotation.set(0, elapsedSec * 2, 0);
          _dummy.scale.setScalar(gScale);
          _dummy.updateMatrix();
          this.crownMesh.setMatrixAt(crownCount++, _dummy.matrix);
        }

        if (u.isSoldier && cfg.isCivilized && soldierCount < MAX_SOLDIER_INST) {
          _dummy.position.set(wx + Math.cos(yaw) * 0.16 * gScale, bodyY + 0.12 * gScale, wz - Math.sin(yaw) * 0.16 * gScale);
          _dummy.rotation.set(0.22, yaw, 0);
          _dummy.scale.setScalar(gScale);
          _dummy.updateMatrix();
          this.soldierSpearMesh.setMatrixAt(soldierCount++, _dummy.matrix);
        }

        if (u.traits.includes('Blessed') && blessedCount < MAX_BLESSED_INST) {
          _dummy.position.set(wx, bodyY + 0.34 * gScale, wz);
          _dummy.rotation.set(0, elapsedSec * 2.5, 0);
          _dummy.scale.setScalar(gScale);
          _dummy.updateMatrix();
          this.blessedAuraMesh.setMatrixAt(blessedCount++, _dummy.matrix);
        }
      }

      if (selectedUnitId !== null && u.id === selectedUnitId) {
        const flyOffset = cfg.isFlying ? 2.6 : 0;
        this.selectionHalo.position.set(wx, Math.max(surfY, 0.6) + 0.08 + flyOffset, wz);
        this.selectionHalo.rotation.z = elapsedSec * 2.5;
        this.selectionHalo.scale.setScalar(1 + Math.sin(elapsedSec * 5) * 0.14);
        this.selectionHalo.visible = true;
      }
    }

    this.unitBodyMesh.count = uCount;
    this.unitBodyMesh.instanceMatrix.needsUpdate = true;
    if (this.unitBodyMesh.instanceColor) this.unitBodyMesh.instanceColor.needsUpdate = true;

    this.unitHeadMesh.count = uCount;
    this.unitHeadMesh.instanceMatrix.needsUpdate = true;
    if (this.unitHeadMesh.instanceColor) this.unitHeadMesh.instanceColor.needsUpdate = true;

    this.crownMesh.count = crownCount;
    this.crownMesh.instanceMatrix.needsUpdate = true;

    this.soldierSpearMesh.count = soldierCount;
    this.soldierSpearMesh.instanceMatrix.needsUpdate = true;

    this.blessedAuraMesh.count = blessedCount;
    this.blessedAuraMesh.instanceMatrix.needsUpdate = true;

    this.dragonWingMesh.count = wingCount;
    this.dragonWingMesh.instanceMatrix.needsUpdate = true;

    this.ufoBeamMesh.count = ufoCount;
    this.ufoBeamMesh.instanceMatrix.needsUpdate = true;

    // Sync Engine Particles into 3D space
    let pCount = 0;
    const pool = engine.particlePool.pool;
    const cap = Math.min(engine.particlePool.capacity, MAX_PARTICLES);
    for (let i = 0; i < cap; i++) {
      const p = pool[i];
      if (!p.active) continue;
      const wx = (p.x - s.gridW / 2 + 0.5) * CELL_3D;
      const wz = (p.y - s.gridH / 2 + 0.5) * CELL_3D;
      const lifeRatio = Math.max(0.15, p.life / Math.max(1, p.maxLife));
      const py = 1.2 + (1 - lifeRatio) * 2.5;
      _dummy.position.set(wx, py, wz);
      _dummy.rotation.set(elapsedSec * 4, elapsedSec * 3, 0);
      _dummy.scale.setScalar(Math.max(0.5, p.size * 0.45) * lifeRatio);
      _dummy.updateMatrix();
      this.simParticleMesh.setMatrixAt(pCount, _dummy.matrix);
      _color.set(p.color);
      this.simParticleMesh.setColorAt(pCount, _color);
      pCount++;
    }
    this.simParticleMesh.count = pCount;
    this.simParticleMesh.instanceMatrix.needsUpdate = true;
    if (this.simParticleMesh.instanceColor) this.simParticleMesh.instanceColor.needsUpdate = true;

    // Sync 3D Shockwave Rings & Sky Disaster Beams
    let swCount = 0;
    let beamCount = 0;
    for (let i = 0; i < s.shockwaves.length && swCount < MAX_SHOCKWAVE_INST; i++) {
      const sw = s.shockwaves[i];
      const wx = (sw.x - s.gridW / 2 + 0.5) * CELL_3D;
      const wz = (sw.y - s.gridH / 2 + 0.5) * CELL_3D;
      const rad = Math.max(0.4, sw.radius * CELL_3D);
      _dummy.position.set(wx, 1.08, wz);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(rad, 1, rad);
      _dummy.updateMatrix();
      this.shockwaveMesh.setMatrixAt(swCount, _dummy.matrix);
      _color.set(sw.color);
      this.shockwaveMesh.setColorAt(swCount, _color);
      swCount++;

      if (sw.alpha > 0.45 && beamCount < MAX_SHOCKWAVE_INST) {
        const beamScaleXZ = Math.max(0.2, sw.alpha * 1.15);
        _dummy.position.set(wx, 7.6, wz);
        _dummy.rotation.set(0, elapsedSec * 6, 0);
        _dummy.scale.set(beamScaleXZ, 1, beamScaleXZ);
        _dummy.updateMatrix();
        this.disasterBeamMesh.setMatrixAt(beamCount, _dummy.matrix);
        this.disasterBeamMesh.setColorAt(beamCount, _color);
        beamCount++;
      }
    }
    this.shockwaveMesh.count = swCount;
    this.shockwaveMesh.instanceMatrix.needsUpdate = true;
    if (this.shockwaveMesh.instanceColor) this.shockwaveMesh.instanceColor.needsUpdate = true;

    this.disasterBeamMesh.count = beamCount;
    this.disasterBeamMesh.instanceMatrix.needsUpdate = true;
    if (this.disasterBeamMesh.instanceColor) this.disasterBeamMesh.instanceColor.needsUpdate = true;
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.root.clear();
  }
}
