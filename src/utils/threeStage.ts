import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { disposeThreeScene } from './threeCleanup';

export type CameraPreset3D = 'chase' | 'isometric' | 'diorama';
export type QualityLevel3D = 'ultra' | 'balanced' | 'performance';

export interface CameraPresetConfig {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

export interface ThreeStageOptions {
  container: HTMLElement;
  backgroundColor?: number;
  fogColor?: number;
  fogDensity?: number;
  cameraPresets?: Record<CameraPreset3D, CameraPresetConfig>;
  initialPreset?: CameraPreset3D;
  shadowBounds?: number;
  enableGridFloor?: boolean;
  gridSize?: number;
  gridPrimaryColor?: string;
  gridSecondaryColor?: string;
}

// Pre-allocated module-scope math scratchpads (Zero GC in render loop)
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _shakeOffset = new THREE.Vector3();
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

    // Sub-grid lines
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

    // Main perimeter border
    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 508);

    // Corner node accents
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
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
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
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
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
 * Studio 3D Stage Controller with Adaptive Camera Rig, 3D Trauma Shake, Dynamic FOV, Slow-Mo, and 60 FPS Guard.
 */
export class ThreeStageController {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly particles: InstancedParticlePool3D;
  public readonly isSoftwareGl: boolean;
  public readonly keyLight: THREE.DirectionalLight;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly rimLight: THREE.DirectionalLight;

  private container: HTMLElement;
  private presets: Record<CameraPreset3D, CameraPresetConfig>;
  private currentPreset: CameraPreset3D;
  private quality: QualityLevel3D;
  private trauma = 0;
  private traumaTime = 0;
  private fovOffset = 0;
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

  constructor(options: ThreeStageOptions) {
    this.container = options.container;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.quality = this.isSoftwareGl ? 'performance' : 'ultra';

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
    this.scene.fog = new THREE.FogExp2(fogHex, fogDensity);

    const w = Math.max(320, this.container.clientWidth || 800);
    const h = Math.max(240, this.container.clientHeight || 500);
    const initialCfg = this.presets[this.currentPreset];

    this.camera = new THREE.PerspectiveCamera(initialCfg.fov, w / h, 0.1, 250);
    this.currentCamPos.set(...initialCfg.position);
    this.currentCamLook.set(...initialCfg.lookAt);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentCamLook);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    // Mobile DPR auto-clamping: limit to 1.75 max to prevent high-DPI GPU throttling and battery drain
    const isMobileDevice = typeof window !== 'undefined' && (
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      ('ontouchstart' in window && (window.innerWidth <= 840 || window.innerHeight <= 840))
    );
    const maxAllowedDpr = isMobileDevice ? 1.75 : 2.0;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxAllowedDpr));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'w-full h-full block select-none touch-none';

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
    this.scene.add(this.hemiLight);

    const shadowD = options.shadowBounds ?? 16;
    this.keyLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    this.keyLight.position.set(12, 22, 14);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 65;
    this.keyLight.shadow.camera.left = -shadowD;
    this.keyLight.shadow.camera.right = shadowD;
    this.keyLight.shadow.camera.top = shadowD;
    this.keyLight.shadow.camera.bottom = -shadowD;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xc084fc, 0.9);
    this.rimLight.position.set(-14, 12, -14);
    this.scene.add(this.rimLight);

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

    this.particles = new InstancedParticlePool3D(this.scene, this.isSoftwareGl ? 120 : 260);

    // Responsive ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }
    window.addEventListener('resize', this.handleResize);
  }

  public handleResize = (): void => {
    if (this.disposed || !this.container) return;
    const w = Math.max(300, this.container.clientWidth || 800);
    const h = Math.max(220, this.container.clientHeight || 500);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
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
    this.quality = level;
    if (this.isSoftwareGl) return;
    if (level === 'performance') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    } else if (level === 'balanced') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.shadowMap.enabled = true;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
    }
  }

  /**
   * Adds 3D camera trauma (0.0 to 1.0) for rotational & translational screen-shake.
   */
  public triggerTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  /**
   * Triggers a temporary FOV kick (positive = zoom out speed sense, negative = zoom in focus).
   */
  public kickFov(deltaDegrees: number): void {
    this.fovOffset = THREE.MathUtils.clamp(this.fovOffset + deltaDegrees, -14, 18);
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

    // 3D Trauma Shake (Quadratic falloff)
    if (this.trauma > 0.001) {
      this.traumaTime += clampedDt * 38;
      const shake = this.trauma * this.trauma;
      _shakeOffset.set(
        Math.sin(this.traumaTime * 1.7) * 0.55 * shake,
        Math.cos(this.traumaTime * 2.3) * 0.45 * shake,
        Math.sin(this.traumaTime * 1.3) * 0.45 * shake
      );
      this.trauma = Math.max(0, this.trauma - clampedDt * 1.85);
    } else {
      _shakeOffset.set(0, 0, 0);
      this.trauma = 0;
    }

    this.camera.position.copy(this.currentCamPos).add(_shakeOffset);
    this.camera.lookAt(this.currentCamLook);

    // Dynamic FOV kick recovery
    this.fovOffset = THREE.MathUtils.damp(this.fovOffset, 0, 7.5, clampedDt);
    const targetFov = cfg.fov + this.fovOffset;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // Step instanced 3D particles
    this.particles.update(scaledDt);

    return scaledDt;
  }

  public render(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
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
        // Power-saving mode when mobile device is locked or user switched apps/tabs
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

  // 1. Central Core Body
  const bodySize = type === 'commander' ? 0.95 : type === 'tank' ? 0.78 : 0.52;
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(bodySize, 1), hullMat);
  body.scale.set(1, 0.55, 1.25);
  body.castShadow = true;
  g.add(body);

  // 2. Glowing Cockpit Eye
  const eye = new THREE.Mesh(new THREE.SphereGeometry(bodySize * 0.38, 10, 10), coreMat);
  eye.position.set(0, 0.12, bodySize * 0.55);
  g.add(eye);

  // 3 & 4. Solar/Blade Wings
  const wingSpan = type === 'commander' ? 2.4 : type === 'interceptor' ? 1.8 : 1.35;
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(wingSpan * 0.5, 0.08, 0.65), darkMat);
  wingL.position.set(-wingSpan * 0.38, 0, 0);
  wingL.rotation.z = -0.22;
  const wingR = wingL.clone();
  wingR.position.x = wingSpan * 0.38;
  wingR.rotation.z = 0.22;
  g.add(wingL, wingR);

  // 5. Rear Engine Ring
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

  // 1 & 2. Legs (pivoted so character stands at y=0)
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.38, 6, 8);
  const legL = new THREE.Mesh(legGeo, suitMat);
  legL.position.set(-0.15, 0.28, 0);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.x = 0.15;
  group.add(legL, legR);

  // 3. Armored Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.56, 0.28), armorMat);
  torso.position.set(0, 0.78, 0);
  torso.castShadow = true;
  group.add(torso);

  // 4. Chest Reactor Core
  const chestCore = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), visorMat);
  chestCore.rotation.x = Math.PI / 2;
  chestCore.position.set(0, 0.82, 0.14);
  group.add(chestCore);

  // 5 & 6. Arms
  const armGeo = new THREE.CapsuleGeometry(0.09, 0.34, 6, 8);
  const armL = new THREE.Mesh(armGeo, armorMat);
  armL.position.set(-0.34, 0.78, 0);
  const armR = armL.clone();
  armR.position.x = 0.34;
  group.add(armL, armR);

  // 7. Cyber Helmet
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), armorMat);
  head.position.set(0, 1.24, 0);
  head.castShadow = true;
  group.add(head);

  // 8. Glowing Visor Strip
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.16), visorMat);
  visor.position.set(0, 1.25, 0.14);
  group.add(visor);

  return { group, legL, legR, armL, armR };
}
