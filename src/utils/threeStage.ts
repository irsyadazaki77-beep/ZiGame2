import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { performanceService } from '../services/performanceService';
import type { PerformanceSettings } from '../types';
import { disposeThreeScene } from './threeCleanup';

export type CameraPreset3D = 'chase' | 'isometric' | 'diorama';
export type QualityLevel3D = 'ultra' | 'balanced' | 'performance';

export interface CameraPresetConfig {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

export interface BloomOptions {
  enabled: boolean;
  strength?: number;
  radius?: number;
  threshold?: number;
}

export interface PBRTextureSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  dispose: () => void;
}

export interface ThreeStageOptions {
  container: HTMLElement;
  backgroundColor?: number;
  fogColor?: number;
  fogDensity?: number;
  fogEnabled?: boolean;
  cameraPresets?: Record<CameraPreset3D, CameraPresetConfig>;
  initialPreset?: CameraPreset3D;
  fov?: number;
  near?: number;
  far?: number;
  manualCamera?: boolean;
  enableDefaultLighting?: boolean;
  enableShadows?: boolean;
  shadowBounds?: number;
  toneMappingExposure?: number;
  enableGridFloor?: boolean;
  gridSize?: number;
  gridPrimaryColor?: string;
  gridSecondaryColor?: string;
  bloom?: BloomOptions;
  maxDpr?: number;
  particleCapacity?: number;
}

// Pre-allocated module-scope math scratchpads (Zero GC in render loop)
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _shakeOffset = new THREE.Vector3();
const _shadowOffset = new THREE.Vector3();
const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3();
const _dummyEuler = new THREE.Euler();
const _dummyColor = new THREE.Color();

let cachedIsSoftwareGl: boolean | null = null;

/**
 * Detects Software WebGL (SwiftShader, llvmpipe, WARP) via GPU renderer string.
 */
export function detectSoftwareWebGL(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  if (typeof document === 'undefined') {
    cachedIsSoftwareGl = true;
    return true;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedIsSoftwareGl;
  } catch {
    cachedIsSoftwareGl = true;
    return true;
  }
}

/**
 * Deterministic PRNG for procedural PBR surface synthesis (zero runtime Math.random drift).
 */
function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function getSafeAnisotropy(renderer?: THREE.WebGLRenderer | null): number {
  try {
    return Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
  } catch {
    return 1;
  }
}

/**
 * Generates a high-sharpness procedural grid texture with SRGBColorSpace & max anisotropy.
 */
export function createCyberGridTexture(
  renderer: THREE.WebGLRenderer,
  primaryHex = '#06b6d4',
  bgHex = '#090d16',
  subdivisions = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    const step = 512 / subdivisions;
    for (let i = 1; i < subdivisions; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, 512);
      ctx.moveTo(0, p);
      ctx.lineTo(512, p);
      ctx.stroke();
    }

    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 508);

    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, 14, 14);
    ctx.fillRect(498, 0, 14, 14);
    ctx.fillRect(0, 498, 14, 14);
    ctx.fillRect(498, 498, 14, 14);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = getSafeAnisotropy(renderer);
  return tex;
}

/**
 * Generates an emissive neon grid texture suitable for map / emissiveMap slots.
 */
export function createEmissiveGridTexture(
  renderer: THREE.WebGLRenderer,
  options: {
    primaryHex?: string;
    secondaryHex?: string;
    backgroundHex?: string;
    subdivisions?: number;
    repeatX?: number;
    repeatY?: number;
    size?: number;
  } = {}
): THREE.CanvasTexture {
  const size = options.size ?? 512;
  const subdivisions = options.subdivisions ?? 4;
  const primaryHex = options.primaryHex ?? '#22d3ee';
  const secondaryHex = options.secondaryHex ?? 'rgba(56, 189, 248, 0.25)';
  const backgroundHex = options.backgroundHex ?? '#050814';

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = backgroundHex;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = secondaryHex;
    ctx.lineWidth = Math.max(1, size / 256);
    const step = size / subdivisions;
    for (let i = 1; i < subdivisions; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    // Soft bloom halo along outer cell edges
    ctx.save();
    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = Math.max(4, size / 64);
    ctx.globalAlpha = 0.25;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    ctx.restore();

    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = Math.max(2, size / 128);
    ctx.strokeRect(1, 1, size - 2, size - 2);

    const node = Math.max(8, size / 40);
    ctx.fillStyle = primaryHex;
    ctx.fillRect(0, 0, node, node);
    ctx.fillRect(size - node, 0, node, node);
    ctx.fillRect(0, size - node, node, node);
    ctx.fillRect(size - node, size - node, node, node);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (options.repeatX || options.repeatY) {
    tex.repeat.set(options.repeatX ?? 1, options.repeatY ?? 1);
  }
  tex.anisotropy = getSafeAnisotropy(renderer);
  return tex;
}

/**
 * Generates a brushed metallic procedural bump/roughness texture.
 */
export function createBrushedMetalTexture(renderer: THREE.WebGLRenderer, baseHex = '#1e293b'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) {
      const y = (i * 17) % 256;
      const alpha = 0.03 + ((i * 31) % 7) * 0.01;
      ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, y, 256, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = getSafeAnisotropy(renderer);
  return tex;
}

/**
 * Procedural Wet Asphalt PBR texture maps (albedo, roughnessMap, bumpMap)
 * providing realistic specular puddle breakup and mineral grain for racing surfaces.
 */
export function createWetAsphaltMaps(
  renderer: THREE.WebGLRenderer,
  options: {
    baseColor?: string;
    stripeColor?: string;
    puddleIntensity?: number;
    repeatX?: number;
    repeatY?: number;
    size?: number;
  } = {}
): PBRTextureSet {
  const size = options.size ?? 512;
  const baseColor = options.baseColor ?? '#111622';
  const puddleIntensity = options.puddleIntensity ?? 0.65;
  const rand = createSeededRandom(0x41a2b9c3);
  const anisotropy = getSafeAnisotropy(renderer);

  const albedoCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  albedoCanvas.width = roughCanvas.width = bumpCanvas.width = size;
  albedoCanvas.height = roughCanvas.height = bumpCanvas.height = size;

  const aCtx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');

  if (aCtx && rCtx && bCtx) {
    aCtx.fillStyle = baseColor;
    aCtx.fillRect(0, 0, size, size);

    // Dry asphalt default roughness (~0.78 -> grayscale 200)
    rCtx.fillStyle = 'rgb(202, 202, 202)';
    rCtx.fillRect(0, 0, size, size);

    // Neutral mid-height bump
    bCtx.fillStyle = 'rgb(128, 128, 128)';
    bCtx.fillRect(0, 0, size, size);

    // Subtle tire wear tracks along V axis
    const laneLeft = size * 0.28;
    const laneRight = size * 0.72;
    [laneLeft, laneRight].forEach((cx) => {
      const grad = rCtx.createLinearGradient(cx - size * 0.12, 0, cx + size * 0.12, 0);
      grad.addColorStop(0, 'rgba(130, 130, 130, 0)');
      grad.addColorStop(0.5, 'rgba(95, 95, 95, 0.35)');
      grad.addColorStop(1, 'rgba(130, 130, 130, 0)');
      rCtx.fillStyle = grad;
      rCtx.fillRect(cx - size * 0.14, 0, size * 0.28, size);
    });

    // Organic wet specular puddle patches (low roughness = bright reflections)
    const puddleCount = 14;
    for (let i = 0; i < puddleCount; i++) {
      const px = rand() * size;
      const py = rand() * size;
      const rx = size * (0.08 + rand() * 0.16);
      const ry = size * (0.14 + rand() * 0.22);

      // Wrap across tile borders so repeat tiling stays seamless
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const x = px + ox * size;
          const y = py + oy * size;
          if (x + rx < 0 || x - rx > size || y + ry < 0 || y - ry > size) continue;

          rCtx.save();
          rCtx.translate(x, y);
          rCtx.scale(1, ry / rx);
          const pGrad = rCtx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
          const darkVal = Math.round(28 + (1 - puddleIntensity) * 55);
          pGrad.addColorStop(0, `rgba(${darkVal}, ${darkVal}, ${darkVal}, ${0.85 * puddleIntensity})`);
          pGrad.addColorStop(0.6, `rgba(${darkVal + 30}, ${darkVal + 30}, ${darkVal + 30}, ${0.45 * puddleIntensity})`);
          pGrad.addColorStop(1, 'rgba(180, 180, 180, 0)');
          rCtx.fillStyle = pGrad;
          rCtx.beginPath();
          rCtx.arc(0, 0, rx, 0, Math.PI * 2);
          rCtx.fill();
          rCtx.restore();

          // Wet areas look slightly darker in albedo
          aCtx.save();
          aCtx.translate(x, y);
          aCtx.scale(1, ry / rx);
          const aGrad = aCtx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
          aGrad.addColorStop(0, `rgba(4, 7, 15, ${0.38 * puddleIntensity})`);
          aGrad.addColorStop(1, 'rgba(4, 7, 15, 0)');
          aCtx.fillStyle = aGrad;
          aCtx.beginPath();
          aCtx.arc(0, 0, rx, 0, Math.PI * 2);
          aCtx.fill();
          aCtx.restore();
        }
      }
    }

    // Fine aggregate grit on albedo, roughness, and bump
    const grainCount = Math.floor(size * size * 0.045);
    for (let i = 0; i < grainCount; i++) {
      const gx = rand() * size;
      const gy = rand() * size;
      const gSize = 1 + (rand() > 0.72 ? 1.5 : 0);
      const bright = rand() > 0.48;

      aCtx.fillStyle = bright ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.14)';
      aCtx.fillRect(gx, gy, gSize, gSize);

      bCtx.fillStyle = bright ? 'rgba(230,230,230,0.38)' : 'rgba(40,40,40,0.38)';
      bCtx.fillRect(gx, gy, gSize, gSize);

      rCtx.fillStyle = bright ? 'rgba(235,235,235,0.22)' : 'rgba(155,155,155,0.18)';
      rCtx.fillRect(gx, gy, gSize, gSize);
    }

    // Optional subtle road stripe accent along edges
    if (options.stripeColor) {
      aCtx.fillStyle = options.stripeColor;
      aCtx.fillRect(size * 0.04, 0, size * 0.015, size);
      aCtx.fillRect(size * 0.945, 0, size * 0.015, size);
    }
  }

  const repeatX = options.repeatX ?? 1;
  const repeatY = options.repeatY ?? 1;

  const configure = (canvas: HTMLCanvasElement, colorSpace: THREE.ColorSpace) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = colorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = anisotropy;
    return tex;
  };

  const map = configure(albedoCanvas, THREE.SRGBColorSpace);
  const roughnessMap = configure(roughCanvas, THREE.NoColorSpace);
  const bumpMap = configure(bumpCanvas, THREE.NoColorSpace);

  return {
    map,
    roughnessMap,
    bumpMap,
    dispose: () => {
      map.dispose();
      roughnessMap.dispose();
      bumpMap.dispose();
    }
  };
}

/**
 * Procedural Stone Cathedral PBR texture maps (albedo, roughnessMap, bumpMap)
 * featuring ashlar masonry joints, aged patina, and chiseled micro-pitting.
 */
export function createStoneCathedralMaps(
  renderer: THREE.WebGLRenderer,
  options: {
    baseColor?: string;
    mortarColor?: string;
    tileRows?: number;
    tileCols?: number;
    repeatX?: number;
    repeatY?: number;
    size?: number;
  } = {}
): PBRTextureSet {
  const size = options.size ?? 512;
  const baseColor = options.baseColor ?? '#1b2030';
  const mortarColor = options.mortarColor ?? '#0b0e17';
  const rows = options.tileRows ?? 4;
  const cols = options.tileCols ?? 4;
  const rand = createSeededRandom(0x88d41f72);
  const anisotropy = getSafeAnisotropy(renderer);

  const albedoCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  albedoCanvas.width = roughCanvas.width = bumpCanvas.width = size;
  albedoCanvas.height = roughCanvas.height = bumpCanvas.height = size;

  const aCtx = albedoCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');

  if (aCtx && rCtx && bCtx) {
    aCtx.fillStyle = mortarColor;
    aCtx.fillRect(0, 0, size, size);

    // Mortar is rough (235) and recessed (30)
    rCtx.fillStyle = 'rgb(238, 238, 238)';
    rCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = 'rgb(28, 28, 28)';
    bCtx.fillRect(0, 0, size, size);

    const cellH = size / rows;
    const cellW = size / cols;
    const gap = Math.max(3, Math.round(size * 0.012));

    for (let r = 0; r < rows; r++) {
      const stagger = (r % 2) * (cellW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cellW + stagger + gap * 0.5;
        const y = r * cellH + gap * 0.5;
        const w = cellW - gap;
        const h = cellH - gap;

        const toneShift = Math.round((rand() - 0.5) * 18);
        aCtx.fillStyle = baseColor;
        aCtx.fillRect(x, y, w, h);
        aCtx.fillStyle = toneShift >= 0
          ? `rgba(148, 163, 184, ${toneShift / 220})`
          : `rgba(2, 6, 23, ${-toneShift / 140})`;
        aCtx.fillRect(x, y, w, h);

        // Polished slab faces vary between 120 and 185 roughness
        const roughVal = Math.round(125 + rand() * 58);
        rCtx.fillStyle = `rgb(${roughVal}, ${roughVal}, ${roughVal})`;
        rCtx.fillRect(x, y, w, h);

        // Slab bevel + elevated height
        const bumpVal = Math.round(165 + rand() * 35);
        bCtx.fillStyle = `rgb(${bumpVal}, ${bumpVal}, ${bumpVal})`;
        bCtx.fillRect(x, y, w, h);
        bCtx.strokeStyle = 'rgba(235, 235, 235, 0.45)';
        bCtx.lineWidth = 2;
        bCtx.strokeRect(x + 1, y + 1, Math.max(2, w - 2), Math.max(2, h - 2));
      }
    }

    // Subtle stone veins & chiseled micro-pitting
    for (let i = 0; i < 65; i++) {
      const vx = rand() * size;
      const vy = rand() * size;
      const len = 18 + rand() * 44;
      const ang = (rand() - 0.5) * 1.2;
      aCtx.strokeStyle = rand() > 0.5 ? 'rgba(203, 213, 225, 0.05)' : 'rgba(2, 6, 23, 0.16)';
      aCtx.lineWidth = 1;
      aCtx.beginPath();
      aCtx.moveTo(vx, vy);
      aCtx.lineTo(vx + Math.cos(ang) * len, vy + Math.sin(ang) * len);
      aCtx.stroke();

      bCtx.strokeStyle = 'rgba(70, 70, 70, 0.35)';
      bCtx.beginPath();
      bCtx.moveTo(vx, vy);
      bCtx.lineTo(vx + Math.cos(ang) * len, vy + Math.sin(ang) * len);
      bCtx.stroke();
    }

    const pitCount = Math.floor(size * size * 0.02);
    for (let i = 0; i < pitCount; i++) {
      const px = rand() * size;
      const py = rand() * size;
      const light = rand() > 0.5;
      bCtx.fillStyle = light ? 'rgba(220,220,220,0.22)' : 'rgba(40,40,40,0.28)';
      bCtx.fillRect(px, py, 2, 2);
      rCtx.fillStyle = light ? 'rgba(110,110,110,0.2)' : 'rgba(210,210,210,0.2)';
      rCtx.fillRect(px, py, 2, 2);
    }
  }

  const repeatX = options.repeatX ?? 1;
  const repeatY = options.repeatY ?? 1;

  const configure = (canvas: HTMLCanvasElement, colorSpace: THREE.ColorSpace) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = colorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = anisotropy;
    return tex;
  };

  const map = configure(albedoCanvas, THREE.SRGBColorSpace);
  const roughnessMap = configure(roughCanvas, THREE.NoColorSpace);
  const bumpMap = configure(bumpCanvas, THREE.NoColorSpace);

  return {
    map,
    roughnessMap,
    bumpMap,
    dispose: () => {
      map.dispose();
      roughnessMap.dispose();
      bumpMap.dispose();
    }
  };
}

/**
 * Widens vertical FOV smoothly on narrow portrait screens (aspect < 1) so left/right arena bounds are never clipped.
 */
export function computeAdaptiveAspectFov(baseFov: number, aspect: number, minAspect = 0.62): number {
  if (!Number.isFinite(aspect) || aspect >= 1 || aspect <= 0) return baseFov;
  const clampedAspect = Math.max(minAspect, aspect);
  const scale = Math.min(1.42, 1 + (1 - clampedAspect) * 0.65);
  return Math.min(95, baseFov * scale);
}

/**
 * 3D Game-Feel Camera Rig Helper:
 * - Decayed quadratic trauma screen shake
 * - Smooth speed-driven dynamic FOV kicks
 */
export class CameraRigHelper {
  private trauma = 0;
  private traumaTime = 0;
  private fovOffset = 0;
  private lastAppliedOffset = new THREE.Vector3();

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, Math.max(this.trauma, 0) + Math.max(0, amount));
  }

  public getTrauma(): number {
    return this.trauma;
  }

  public kickFov(deltaDegrees: number): void {
    this.fovOffset = THREE.MathUtils.clamp(this.fovOffset + deltaDegrees, -14, 20);
  }

  public getFovOffset(): number {
    return this.fovOffset;
  }

  /**
   * Computes current decayed quadratic trauma offset into `out` and decays trauma.
   */
  public stepShake(dt: number, out: THREE.Vector3 = _shakeOffset, amplitude = 0.55): THREE.Vector3 {
    const clampedDt = Math.min(Math.max(dt, 0), 0.1);
    if (this.trauma > 0.001) {
      this.traumaTime += clampedDt * 38;
      const shake = this.trauma * this.trauma;
      out.set(
        Math.sin(this.traumaTime * 1.7) * amplitude * shake,
        Math.cos(this.traumaTime * 2.3) * (amplitude * 0.82) * shake,
        Math.sin(this.traumaTime * 1.3) * (amplitude * 0.82) * shake
      );
      this.trauma = Math.max(0, this.trauma - clampedDt * 1.85);
    } else {
      out.set(0, 0, 0);
      this.trauma = 0;
    }
    this.lastAppliedOffset.copy(out);
    return out;
  }

  /**
   * Applies decayed trauma shake directly on top of a manual camera's basePosition.
   */
  public applyTraumaToCamera(
    camera: THREE.Camera,
    basePosition: THREE.Vector3,
    dt: number,
    amplitude = 0.45
  ): void {
    this.stepShake(dt, _shakeOffset, amplitude);
    camera.position.copy(basePosition).add(_shakeOffset);
  }

  /**
   * Applies additive shake on top of a camera managed externally (e.g. OrbitControls),
   * removing the previous frame's shake offset first so it never drifts.
   */
  public applyAdditiveShake(camera: THREE.Camera, dt: number, amplitude = 0.35): void {
    camera.position.sub(this.lastAppliedOffset);
    this.stepShake(dt, _shakeOffset, amplitude);
    camera.position.add(_shakeOffset);
  }

  /**
   * Smoothly adjusts camera FOV proportional to speedRatio [0..1+] + temporary fovOffset kicks.
   */
  public updateDynamicFov(
    camera: THREE.PerspectiveCamera,
    baseFov: number,
    speedRatio: number,
    dt: number,
    maxBoostDegrees = 14
  ): void {
    const clampedDt = Math.min(Math.max(dt, 0), 0.1);
    this.fovOffset = THREE.MathUtils.damp(this.fovOffset, 0, 7.5, clampedDt);
    const clampedRatio = THREE.MathUtils.clamp(speedRatio, -0.25, 1.35);
    const adaptiveBase = computeAdaptiveAspectFov(baseFov, camera.aspect);
    const desiredFov = adaptiveBase + clampedRatio * maxBoostDegrees + this.fovOffset;
    const nextFov = THREE.MathUtils.damp(camera.fov, desiredFov, 8.5, clampedDt);
    if (Math.abs(camera.fov - nextFov) > 0.03) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * Recovers manual FOV kicks back toward baseFov (with portrait aspect adaptation) when no speedRatio is driving it.
   */
  public stepFovRecovery(camera: THREE.PerspectiveCamera, baseFov: number, dt: number): void {
    const clampedDt = Math.min(Math.max(dt, 0), 0.1);
    this.fovOffset = THREE.MathUtils.damp(this.fovOffset, 0, 7.5, clampedDt);
    const adaptiveBase = computeAdaptiveAspectFov(baseFov, camera.aspect);
    const targetFov = adaptiveBase + this.fovOffset;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
  }

  public reset(): void {
    this.trauma = 0;
    this.traumaTime = 0;
    this.fovOffset = 0;
    this.lastAppliedOffset.set(0, 0, 0);
  }
}

/**
 * Keeps a DirectionalLight's shadow frustum tightly centered on a moving target,
 * optionally snapping target coordinates to shadow-map texels to prevent shadow shimmering.
 */
export function followDirectionalShadow(
  light: THREE.DirectionalLight,
  targetPosition: THREE.Vector3,
  frustumSize = 16,
  texelSnap = true,
  lightOffset?: THREE.Vector3
): void {
  if (!light.userData.baseShadowOffset) {
    light.userData.baseShadowOffset = light.position.clone();
  }
  const offset = lightOffset || (light.userData.baseShadowOffset as THREE.Vector3) || _shadowOffset.set(12, 22, 14);

  let sx = targetPosition.x;
  const sy = targetPosition.y;
  let sz = targetPosition.z;

  if (texelSnap) {
    const mapSize = Math.max(256, light.shadow.mapSize.width || 1024);
    const worldUnitsPerTexel = (frustumSize * 2) / mapSize;
    if (worldUnitsPerTexel > 0) {
      sx = Math.round(sx / worldUnitsPerTexel) * worldUnitsPerTexel;
      sz = Math.round(sz / worldUnitsPerTexel) * worldUnitsPerTexel;
    }
  }

  const cam = light.shadow.camera;
  if (
    cam.left !== -frustumSize ||
    cam.right !== frustumSize ||
    cam.top !== frustumSize ||
    cam.bottom !== -frustumSize
  ) {
    cam.left = -frustumSize;
    cam.right = frustumSize;
    cam.top = frustumSize;
    cam.bottom = -frustumSize;
    cam.updateProjectionMatrix();
  }

  light.target.position.set(sx, sy, sz);
  light.target.updateMatrixWorld();
  light.position.set(sx + offset.x, sy + offset.y, sz + offset.z);
}

/**
 * Zero-GC 3D Instanced Particle & Explosion System
 */
export interface ParticleSlot3D {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
  life: number;
  maxLife: number;
  gravity: number;
  r: number;
  g: number;
  b: number;
}

export class InstancedParticlePool3D {
  public readonly mesh: THREE.InstancedMesh;
  private readonly slots: ParticleSlot3D[];
  private readonly capacity: number;
  private cursor = 0;

  constructor(scene: THREE.Scene, capacity = 240) {
    this.capacity = capacity;
    const geo = new THREE.OctahedronGeometry(0.18, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.7,
      emissive: 0x222222,
      emissiveIntensity: 0.6
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    this.slots = Array.from({ length: capacity }, () => ({
      active: false,
      x: 0,
      y: -999,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      scale: 0,
      life: 0,
      maxLife: 1,
      gravity: 0,
      r: 1,
      g: 1,
      b: 1
    }));

    _dummyScale.set(0, 0, 0);
    _dummyPos.set(0, -999, 0);
    _dummyQuat.identity();
    _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
    _dummyColor.setHex(0xffffff);

    for (let i = 0; i < capacity; i++) {
      this.mesh.setMatrixAt(i, _dummyMatrix);
      this.mesh.setColorAt(i, _dummyColor);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  public burst(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number | string,
    speed = 6,
    scale = 1,
    gravity = 9.8
  ): void {
    _dummyColor.set(colorHex);
    for (let i = 0; i < count; i++) {
      const slot = this.slots[this.cursor];
      this.cursor = (this.cursor + 1) % this.capacity;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = speed * (0.4 + Math.random() * 0.8);

      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = Math.sin(phi) * Math.cos(theta) * spd;
      slot.vy = Math.abs(Math.cos(phi)) * spd * 0.85 + 1.2;
      slot.vz = Math.sin(phi) * Math.sin(theta) * spd;
      slot.rx = (Math.random() - 0.5) * 10;
      slot.ry = (Math.random() - 0.5) * 10;
      slot.rz = (Math.random() - 0.5) * 10;
      slot.scale = scale * (0.6 + Math.random() * 0.7);
      slot.maxLife = 0.35 + Math.random() * 0.45;
      slot.life = slot.maxLife;
      slot.gravity = gravity;
      slot.r = _dummyColor.r;
      slot.g = _dummyColor.g;
      slot.b = _dummyColor.b;
    }
  }

  public update(dt: number): void {
    let anyUpdated = false;
    for (let i = 0; i < this.capacity; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      anyUpdated = true;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        _dummyPos.set(0, -999, 0);
        _dummyScale.set(0, 0, 0);
        _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
        this.mesh.setMatrixAt(i, _dummyMatrix);
        continue;
      }

      s.vy -= s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;

      const ratio = Math.max(0, s.life / s.maxLife);
      const curScale = s.scale * ratio;
      _dummyPos.set(s.x, s.y, s.z);
      _dummyEuler.set(s.rx * s.life, s.ry * s.life, s.rz * s.life);
      _dummyQuat.setFromEuler(_dummyEuler);
      _dummyScale.set(curScale, curScale, curScale);
      _dummyMatrix.compose(_dummyPos, _dummyQuat, _dummyScale);
      this.mesh.setMatrixAt(i, _dummyMatrix);

      _dummyColor.setRGB(s.r, s.g, s.b);
      this.mesh.setColorAt(i, _dummyColor);
    }

    if (anyUpdated) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

/**
 * Studio 3D Stage Controller with Adaptive Quality, Selective Bloom Post-Processing,
 * CameraRigHelper (3D Trauma Shake & Dynamic FOV), Slow-Mo, and 60 FPS Guard.
 */
export class ThreeStageController {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly particles: InstancedParticlePool3D;
  public readonly cameraRig: CameraRigHelper;
  public readonly isSoftwareGl: boolean;
  public readonly keyLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly rimLight: THREE.DirectionalLight;

  private container: HTMLElement;
  private presets: Record<CameraPreset3D, CameraPresetConfig>;
  private currentPreset: CameraPreset3D;
  private quality: QualityLevel3D;
  private manualCamera: boolean;
  private enableShadowsOption: boolean;
  private maxAllowedDpr: number;
  private timeScale = 1.0;
  private slowMoTimer = 0;
  private currentCamPos = new THREE.Vector3();
  private currentCamLook = new THREE.Vector3();
  private targetOffset = new THREE.Vector3();
  private lookOffset = new THREE.Vector3();
  private frameId = 0;
  private resizeObserver: ResizeObserver | null = null;
  private fpsSamples: number[] = [];
  private isPaused = false;
  private disposed = false;
  private onTickCallback: ((dt: number, elapsed: number) => void) | null = null;

  private bloomConfig: BloomOptions;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private outputPass: OutputPass | null = null;

  private perfSettings: PerformanceSettings;
  private unsubscribePerf: (() => void) | null = null;

  constructor(options: ThreeStageOptions) {
    this.container = options.container;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.perfSettings = performanceService.getFastSettings();
    this.manualCamera = options.manualCamera ?? false;
    this.enableShadowsOption = options.enableShadows ?? true;
    this.bloomConfig = {
      enabled: options.bloom?.enabled ?? false,
      strength: options.bloom?.strength ?? 0.55,
      radius: options.bloom?.radius ?? 0.4,
      threshold: options.bloom?.threshold ?? 0.82
    };

    const isMobileDevice = typeof window !== 'undefined' && (
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      ('ontouchstart' in window && (window.innerWidth <= 840 || window.innerHeight <= 840))
    );
    this.maxAllowedDpr = options.maxDpr ?? (isMobileDevice ? 1.75 : 2.0);
    this.quality = this.resolveInitialQuality();

    this.presets = options.cameraPresets || {
      chase: { position: [0, 7.5, 13.5], lookAt: [0, 0.5, -1.5], fov: 55 },
      isometric: { position: [10.5, 13.5, 10.5], lookAt: [0, 0, 0], fov: 45 },
      diorama: { position: [0, 16.5, 4.5], lookAt: [0, 0, 0], fov: 48 }
    };
    this.currentPreset = options.initialPreset || 'chase';

    const bgHex = options.backgroundColor ?? 0x070b14;
    const fogHex = options.fogColor ?? bgHex;
    const fogDensity = options.fogDensity ?? 0.018;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(bgHex);
    if (options.fogEnabled !== false && fogDensity > 0) {
      this.scene.fog = new THREE.FogExp2(fogHex, fogDensity);
    }

    const w = Math.max(320, this.container.clientWidth || 800);
    const h = Math.max(240, this.container.clientHeight || 500);
    const initialCfg = this.presets[this.currentPreset];
    const camFov = options.fov ?? initialCfg.fov;
    const camNear = options.near ?? 0.1;
    const camFar = options.far ?? 250;

    this.camera = new THREE.PerspectiveCamera(camFov, w / h, camNear, camFar);
    this.cameraRig = new CameraRigHelper();
    this.currentCamPos.set(...initialCfg.position);
    this.currentCamLook.set(...initialCfg.lookAt);
    if (!this.manualCamera) {
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentCamLook);
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = options.toneMappingExposure ?? 1.12;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'w-full h-full block select-none touch-none';

    this.applyRendererQuality();
    this.renderer.setSize(w, h);

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // WebGL Context Lost & Restored resilience for mobile multitasking
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange, false);
    }

    // Studio Environment Map (RoomEnvironment + PMREMGenerator)
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // Safe fallback if PMREM fails on constrained context
    }

    // Three-Point Studio Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.75);
    this.hemiLight.position.set(0, 30, 0);

    const shadowD = options.shadowBounds ?? 16;
    this.keyLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    this.keyLight.position.set(12, 22, 14);
    this.keyLight.castShadow = !this.isSoftwareGl && this.enableShadowsOption;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 65;
    this.keyLight.shadow.camera.left = -shadowD;
    this.keyLight.shadow.camera.right = shadowD;
    this.keyLight.shadow.camera.top = shadowD;
    this.keyLight.shadow.camera.bottom = -shadowD;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;

    this.rimLight = new THREE.DirectionalLight(0xc084fc, 0.9);
    this.rimLight.position.set(-14, 12, -14);

    if (options.enableDefaultLighting !== false) {
      this.scene.add(this.hemiLight);
      this.scene.add(this.keyLight);
      this.scene.add(this.keyLight.target);
      this.scene.add(this.rimLight);
    }

    if (options.enableGridFloor !== false) {
      const gridSize = options.gridSize ?? 48;
      const gridTex = createCyberGridTexture(
        this.renderer,
        options.gridPrimaryColor || '#06b6d4',
        options.gridSecondaryColor || '#090d18',
        4
      );
      gridTex.repeat.set(gridSize / 4, gridSize / 4);
      const floorGeo = new THREE.PlaneGeometry(gridSize, gridSize);
      const floorMat = new THREE.MeshStandardMaterial({
        map: gridTex,
        roughness: 0.45,
        metalness: 0.35
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = -0.02;
      floorMesh.receiveShadow = true;
      this.scene.add(floorMesh);
    }

    const defaultCapacity = this.isSoftwareGl ? 120 : 260;
    this.particles = new InstancedParticlePool3D(this.scene, options.particleCapacity ?? defaultCapacity);

    // Initialize Post-Processing Pipeline (EffectComposer + UnrealBloomPass + OutputPass)
    if (this.bloomConfig.enabled && !this.isSoftwareGl) {
      this.initPostProcessing(w, h);
    }

    // Subscribe to global PerformanceService for adaptive DPR, shadows, and bloom toggling
    this.unsubscribePerf = performanceService.subscribe((settings) => {
      if (this.disposed) return;
      this.perfSettings = settings;
      this.quality = this.resolveQualityFromSettings(settings);
      this.applyRendererQuality();
    });

    // Responsive ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }
    window.addEventListener('resize', this.handleResize);
  }

  private resolveInitialQuality(): QualityLevel3D {
    if (this.isSoftwareGl) return 'performance';
    return this.resolveQualityFromSettings(this.perfSettings);
  }

  private resolveQualityFromSettings(settings: PerformanceSettings): QualityLevel3D {
    if (this.isSoftwareGl || settings.tier === 'low' || settings.batterySaver) {
      return 'performance';
    }
    if (settings.tier === 'medium') {
      return 'balanced';
    }
    return 'ultra';
  }

  private initPostProcessing(width: number, height: number): void {
    try {
      const composer = new EffectComposer(this.renderer);
      composer.setPixelRatio(this.renderer.getPixelRatio());
      composer.setSize(width, height);

      const renderPass = new RenderPass(this.scene, this.camera);
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        this.bloomConfig.strength ?? 0.55,
        this.bloomConfig.radius ?? 0.4,
        this.bloomConfig.threshold ?? 0.82
      );
      const outputPass = new OutputPass();

      composer.addPass(renderPass);
      composer.addPass(bloomPass);
      composer.addPass(outputPass);

      this.composer = composer;
      this.renderPass = renderPass;
      this.bloomPass = bloomPass;
      this.outputPass = outputPass;
    } catch {
      this.composer = null;
      this.renderPass = null;
      this.bloomPass = null;
      this.outputPass = null;
    }
  }

  private applyRendererQuality(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.keyLight.castShadow = false;
      return;
    }

    const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const perfCap = this.perfSettings?.dprCap ?? 1.75;
    let targetDpr = 1;
    let shadowsAllowed = this.enableShadowsOption && (this.perfSettings?.enableShadows ?? true);

    if (this.quality === 'performance') {
      targetDpr = 1;
      shadowsAllowed = false;
    } else if (this.quality === 'balanced') {
      targetDpr = Math.min(rawDpr, perfCap, 1.5, this.maxAllowedDpr);
    } else {
      targetDpr = Math.min(rawDpr, perfCap, this.maxAllowedDpr);
    }

    this.renderer.setPixelRatio(Math.max(1, targetDpr));
    this.renderer.shadowMap.enabled = shadowsAllowed;
    this.keyLight.castShadow = shadowsAllowed;

    if (this.composer) {
      this.composer.setPixelRatio(Math.max(1, targetDpr));
    }
  }

  public isPostProcessingActive(): boolean {
    return Boolean(
      this.bloomConfig.enabled &&
      !this.isSoftwareGl &&
      this.quality !== 'performance' &&
      this.perfSettings.enableGlow &&
      this.composer
    );
  }

  public setBloomParams(params: Partial<BloomOptions>): void {
    if (params.enabled !== undefined) {
      this.bloomConfig.enabled = params.enabled;
      if (params.enabled && !this.composer && !this.isSoftwareGl) {
        const w = Math.max(300, this.container.clientWidth || 800);
        const h = Math.max(220, this.container.clientHeight || 500);
        this.initPostProcessing(w, h);
      }
    }
    if (this.bloomPass) {
      if (params.strength !== undefined) {
        this.bloomConfig.strength = params.strength;
        this.bloomPass.strength = params.strength;
      }
      if (params.radius !== undefined) {
        this.bloomConfig.radius = params.radius;
        this.bloomPass.radius = params.radius;
      }
      if (params.threshold !== undefined) {
        this.bloomConfig.threshold = params.threshold;
        this.bloomPass.threshold = params.threshold;
      }
    }
  }

  public followShadow(
    targetPosition: THREE.Vector3,
    frustumSize = 16,
    texelSnap = true,
    light: THREE.DirectionalLight = this.keyLight,
    lightOffset?: THREE.Vector3
  ): void {
    followDirectionalShadow(light, targetPosition, frustumSize, texelSnap, lightOffset);
  }

  public handleResize = (): void => {
    if (this.disposed || !this.container) return;
    const w = Math.max(300, this.container.clientWidth || 800);
    const h = Math.max(220, this.container.clientHeight || 500);
    const aspect = w / h;
    this.camera.aspect = aspect;
    if (!this.manualCamera) {
      const cfg = this.presets[this.currentPreset];
      if (cfg) {
        this.camera.fov = computeAdaptiveAspectFov(cfg.fov, aspect);
      }
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
  };

  public setCameraPreset(preset: CameraPreset3D): void {
    if (this.presets[preset]) {
      this.currentPreset = preset;
    }
  }

  public getCameraPreset(): CameraPreset3D {
    return this.currentPreset;
  }

  public getQualityLevel(): QualityLevel3D {
    return this.quality;
  }

  public setQualityLevel(level: QualityLevel3D): void {
    this.quality = this.isSoftwareGl ? 'performance' : level;
    this.applyRendererQuality();
  }

  /**
   * Adds 3D camera trauma (0.0 to 1.0) for rotational & translational screen-shake.
   */
  public triggerTrauma(amount: number): void {
    this.cameraRig.addTrauma(amount);
  }

  /**
   * Triggers a temporary FOV kick (positive = zoom out speed sense, negative = zoom in focus).
   */
  public kickFov(deltaDegrees: number): void {
    this.cameraRig.kickFov(deltaDegrees);
  }

  /**
   * Triggers temporary slow-motion or hit-stop time dilation.
   */
  public triggerSlowMo(scale = 0.35, durationSec = 0.28): void {
    this.timeScale = scale;
    this.slowMoTimer = durationSec;
  }

  /**
   * Sets dynamic target tracking offset for chase/follow cameras.
   */
  public setFollowTarget(x: number, y: number, z: number, factor = 0.35): void {
    this.targetOffset.set(x * factor, y * factor * 0.5, z * factor);
    this.lookOffset.set(x * factor * 1.15, y * factor * 0.6, z * factor * 1.15);
  }

  /**
   * Advances camera kinematics, trauma shake, particles, and adaptive quality monitor.
   * Returns scaled delta time (incorporating slow-mo).
   */
  public step(rawDt: number): number {
    const clampedDt = Math.min(rawDt, 0.1);

    // Adaptive FPS check
    if (!this.isSoftwareGl && clampedDt > 0) {
      const fps = 1 / clampedDt;
      this.fpsSamples.push(fps);
      if (this.fpsSamples.length >= 45) {
        const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
        this.fpsSamples.length = 0;
        if (avg < 42 && this.quality === 'ultra') {
          this.setQualityLevel('balanced');
        } else if (avg < 32 && this.quality === 'balanced') {
          this.setQualityLevel('performance');
        }
      }
    }

    // Slow-motion timer
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= clampedDt;
      if (this.slowMoTimer <= 0) {
        this.timeScale = 1.0;
      }
    } else {
      this.timeScale = THREE.MathUtils.damp(this.timeScale, 1.0, 10, clampedDt);
    }

    const scaledDt = clampedDt * this.timeScale;

    if (!this.manualCamera) {
      // Smooth camera preset & target interpolation
      const cfg = this.presets[this.currentPreset];
      _targetPos.set(
        cfg.position[0] + this.targetOffset.x,
        cfg.position[1] + this.targetOffset.y,
        cfg.position[2] + this.targetOffset.z
      );
      _targetLook.set(
        cfg.lookAt[0] + this.lookOffset.x,
        cfg.lookAt[1] + this.lookOffset.y,
        cfg.lookAt[2] + this.lookOffset.z
      );

      this.currentCamPos.x = THREE.MathUtils.damp(this.currentCamPos.x, _targetPos.x, 6.5, clampedDt);
      this.currentCamPos.y = THREE.MathUtils.damp(this.currentCamPos.y, _targetPos.y, 6.5, clampedDt);
      this.currentCamPos.z = THREE.MathUtils.damp(this.currentCamPos.z, _targetPos.z, 6.5, clampedDt);

      this.currentCamLook.x = THREE.MathUtils.damp(this.currentCamLook.x, _targetLook.x, 8.5, clampedDt);
      this.currentCamLook.y = THREE.MathUtils.damp(this.currentCamLook.y, _targetLook.y, 8.5, clampedDt);
      this.currentCamLook.z = THREE.MathUtils.damp(this.currentCamLook.z, _targetLook.z, 8.5, clampedDt);

      this.cameraRig.applyTraumaToCamera(this.camera, this.currentCamPos, clampedDt, 0.55);
      this.camera.lookAt(this.currentCamLook);
      this.cameraRig.stepFovRecovery(this.camera, cfg.fov, clampedDt);
    }

    // Step instanced 3D particles
    this.particles.update(scaledDt);

    return scaledDt;
  }

  public render(): void {
    if (this.disposed) return;
    if (this.isPostProcessingActive() && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private handleVisibilityChange = (): void => {
    if (this.disposed) return;
    if (typeof document !== 'undefined') {
      this.isPaused = document.hidden;
      if (!this.isPaused) {
        this.handleResize();
      }
    }
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.stopLoop();
  };

  private handleContextRestored = (): void => {
    this.handleResize();
    if (this.onTickCallback && !this.disposed) {
      this.startLoop(this.onTickCallback);
    }
  };

  /**
   * Starts a hardware-accelerated or software-WebGL fence-paced animation loop.
   */
  public startLoop(onTick: (dt: number, elapsed: number) => void): void {
    this.onTickCallback = onTick;
    this.stopLoop();
    let lastTime = performance.now();
    const startTime = lastTime;

    const afterDraw = (cb: () => void) => {
      if (this.disposed) return;
      try {
        const gl = this.renderer.getContext() as WebGL2RenderingContext;
        if (gl && typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (this.disposed) return;
            const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (state === gl.UNSIGNALED) {
              this.frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              this.frameId = window.setTimeout(cb, 80);
            }
          };
          this.frameId = window.setTimeout(poll, 5);
          return;
        }
      } catch {
        // Fallback if WebGL2 sync not supported
      }
      this.frameId = window.setTimeout(cb, 80);
    };

    const loop = () => {
      if (this.disposed) return;
      if (this.isPaused) {
        this.frameId = window.requestAnimationFrame(loop);
        return;
      }

      const now = performance.now();
      const rawDt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;

      const scaledDt = this.step(rawDt);
      onTick(scaledDt, elapsed);
      this.render();

      if (this.isSoftwareGl) {
        afterDraw(loop);
      } else {
        this.frameId = window.requestAnimationFrame(loop);
      }
    };

    this.frameId = window.requestAnimationFrame(loop);
  }

  public stopLoop(): void {
    if (this.frameId) {
      window.cancelAnimationFrame(this.frameId);
      window.clearTimeout(this.frameId);
      this.frameId = 0;
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    this.onTickCallback = null;

    if (this.unsubscribePerf) {
      this.unsubscribePerf();
      this.unsubscribePerf = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    window.removeEventListener('resize', this.handleResize);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    if (this.bloomPass) {
      try {
        this.bloomPass.dispose();
      } catch {}
      this.bloomPass = null;
    }
    if (this.outputPass) {
      try {
        this.outputPass.dispose();
      } catch {}
      this.outputPass = null;
    }
    if (this.composer) {
      try {
        this.composer.dispose();
      } catch {}
      this.composer = null;
    }
    this.renderPass = null;

    disposeThreeScene(this.scene, this.renderer);
  }
}

/**
 * ============================================================================
 * COMPOSITE 3–12 PART PROCEDURAL 3D MODEL FACTORY
 * Every hero actor, vehicle, turret, and monster is assembled from 3–12 parts
 * with varied PBR roughness/metalness and grounded bottom-center pivots.
 * ============================================================================
 */

export function buildStarfighter3D(primaryColor = 0x6366f1, accentColor = 0x22d3ee, isSoftwareGl = false): {
  group: THREE.Group;
  shieldMesh: THREE.Mesh;
  thrusterL: THREE.Mesh;
  thrusterR: THREE.Mesh;
} {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.78,
    roughness: 0.2,
    clearcoat: 0.85
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    metalness: 0.65,
    roughness: 0.45
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.85,
    roughness: 0.18
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: accentColor,
    metalness: 0.1,
    roughness: 0.12,
    transmission: isSoftwareGl ? 0 : 0.85,
    transparent: true,
    opacity: isSoftwareGl ? 0.6 : 0.95
  });

  // 1. Primary Fuselage Hull
  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 8), hullMat);
  fuselage.rotation.x = -Math.PI / 2;
  fuselage.scale.set(1, 1, 0.58);
  fuselage.castShadow = true;
  group.add(fuselage);

  // 2. Cockpit Glass Canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), canopyMat);
  canopy.scale.set(0.85, 0.55, 1.75);
  canopy.position.set(0, 0.18, -0.1);
  group.add(canopy);

  // 3. Swept Main Delta Wings
  const mainWing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.9), wingMat);
  mainWing.position.set(0, 0, 0.32);
  mainWing.castShadow = true;
  group.add(mainWing);

  // 4 & 5. Angled Forward Canards
  const canardL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.32), wingMat);
  canardL.position.set(-0.42, 0.02, -0.45);
  canardL.rotation.y = 0.35;
  const canardR = canardL.clone();
  canardR.position.x = 0.42;
  canardR.rotation.y = -0.35;
  group.add(canardL, canardR);

  // 6 & 7. Twin Vertical Tail Fins
  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.62), trimMat);
  finL.position.set(-0.38, 0.24, 0.62);
  finL.rotation.z = 0.18;
  const finR = finL.clone();
  finR.position.x = 0.38;
  finR.rotation.z = -0.18;
  group.add(finL, finR);

  // 8 & 9. Wingtip Plasma Cannon Pods
  const podGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.95, 8);
  podGeo.rotateX(Math.PI / 2);
  const podL = new THREE.Mesh(podGeo, trimMat);
  podL.position.set(-1.18, 0, 0.22);
  const podR = podL.clone();
  podR.position.x = 1.18;
  group.add(podL, podR);

  // 10 & 11. Twin Afterburner Thruster Cones
  const flameGeo = new THREE.ConeGeometry(0.14, 0.75, 8);
  flameGeo.rotateX(Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({ color: accentColor });
  const thrusterL = new THREE.Mesh(flameGeo, flameMat);
  thrusterL.position.set(-0.24, 0, 1.38);
  const thrusterR = thrusterL.clone();
  thrusterR.position.x = 0.24;
  group.add(thrusterL, thrusterR);

  // 12. Energy Forcefield Sphere
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.45, 1),
    new THREE.MeshBasicMaterial({
      color: accentColor,
      wireframe: true,
      transparent: true,
      opacity: 0.32
    })
  );
  shieldMesh.visible = false;
  group.add(shieldMesh);

  return { group, shieldMesh, thrusterL, thrusterR };
}

export function buildEnemyShip3D(type: 'scout' | 'interceptor' | 'tank' | 'commander'): THREE.Group {
  const g = new THREE.Group();
  const colors = {
    scout: { hull: 0xf43f5e, glow: 0xfb7185 },
    interceptor: { hull: 0xf59e0b, glow: 0xfbbf24 },
    tank: { hull: 0xa855f7, glow: 0xc084fc },
    commander: { hull: 0x06b6d4, glow: 0x22d3ee }
  }[type];

  const hullMat = new THREE.MeshStandardMaterial({
    color: colors.hull,
    metalness: 0.72,
    roughness: 0.28
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.55
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: colors.glow,
    emissive: colors.glow,
    emissiveIntensity: 0.9,
    roughness: 0.15
  });

  const bodySize = type === 'commander' ? 0.95 : type === 'tank' ? 0.78 : 0.52;
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(bodySize, 1), hullMat);
  body.scale.set(1, 0.55, 1.25);
  body.castShadow = true;
  g.add(body);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(bodySize * 0.38, 10, 10), coreMat);
  eye.position.set(0, 0.12, bodySize * 0.55);
  g.add(eye);

  const wingSpan = type === 'commander' ? 2.4 : type === 'interceptor' ? 1.8 : 1.35;
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(wingSpan * 0.5, 0.08, 0.65), darkMat);
  wingL.position.set(-wingSpan * 0.38, 0, 0);
  wingL.rotation.z = -0.22;
  const wingR = wingL.clone();
  wingR.position.x = wingSpan * 0.38;
  wingR.rotation.z = 0.22;
  g.add(wingL, wingR);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(bodySize * 0.45, 0.06, 8, 16), coreMat);
  ring.position.set(0, 0, -bodySize * 0.7);
  g.add(ring);

  return g;
}

export function buildCyberActionHero3D(primaryColor = 0x38bdf8, visorColor = 0xf43f5e): {
  group: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
} {
  const group = new THREE.Group();

  const armorMat = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    metalness: 0.68,
    roughness: 0.24,
    clearcoat: 0.75
  });
  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.4,
    roughness: 0.6
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: visorColor,
    emissive: visorColor,
    emissiveIntensity: 0.95,
    roughness: 0.15
  });

  const legGeo = new THREE.CapsuleGeometry(0.11, 0.38, 6, 8);
  const legL = new THREE.Mesh(legGeo, suitMat);
  legL.position.set(-0.15, 0.28, 0);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.x = 0.15;
  group.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.56, 0.28), armorMat);
  torso.position.set(0, 0.78, 0);
  torso.castShadow = true;
  group.add(torso);

  const chestCore = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), visorMat);
  chestCore.rotation.x = Math.PI / 2;
  chestCore.position.set(0, 0.82, 0.14);
  group.add(chestCore);

  const armGeo = new THREE.CapsuleGeometry(0.09, 0.34, 6, 8);
  const armL = new THREE.Mesh(armGeo, armorMat);
  armL.position.set(-0.34, 0.78, 0);
  const armR = armL.clone();
  armR.position.x = 0.34;
  group.add(armL, armR);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), armorMat);
  head.position.set(0, 1.24, 0);
  head.castShadow = true;
  group.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.16), visorMat);
  visor.position.set(0, 1.25, 0.14);
  group.add(visor);

  return { group, legL, legR, armL, armR };
}
