import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../utils/threeStage';

export interface UseThreeHologramStageOptions {
  /** Source canvas Ref whose 2D context is textured onto the 3D holographic diorama board */
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Theme color hex (e.g. '#06b6d4') for neon rim bevels & 3D particle bursts */
  accentColor?: string;
  /** Aspect ratio of the 3D diorama board (width / height), default 1.15 */
  boardAspect?: number;
  /** Initial 3D camera preset */
  initialPreset?: CameraPreset3D;
  /** Current score to trigger 3D particle celebration & subtle FOV kick on score increase */
  score?: number;
}

export function useThreeHologramStage({
  sourceCanvasRef,
  accentColor = '#06b6d4',
  boardAspect = 1.15,
  initialPreset = 'chase',
  score = 0
}: UseThreeHologramStageOptions) {
  const stageMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ThreeStageController | null>(null);
  const canvasTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const boardGroupRef = useRef<THREE.Group | null>(null);
  const prevScoreRef = useRef<number>(score);
  const tiltTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>(initialPreset);
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const handleSelectPreset = useCallback((preset: CameraPreset3D) => {
    setCameraPreset(preset);
    controllerRef.current?.setCameraPreset(preset);
  }, []);

  const handleCycleQuality = useCallback(() => {
    setQuality((prev) => {
      const next: QualityLevel3D =
        prev === 'ultra' ? 'balanced' : prev === 'balanced' ? 'performance' : 'ultra';
      controllerRef.current?.setQualityLevel(next);
      return next;
    });
  }, []);

  const triggerBurst3D = useCallback(
    (normX = 0, normY = 0, count = 18, colorOverride?: string | number) => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      const w = 10 * boardAspect;
      const d = 10;
      const worldX = normX * (w * 0.45);
      const worldZ = normY * (d * 0.45);
      ctrl.particles.burst(worldX, 0.55, worldZ, count, colorOverride || accentColor, 6.5, 0.95, 11);
      ctrl.triggerTrauma(0.24);
    },
    [accentColor, boardAspect]
  );

  // Trigger celebratory 3D particles & camera feedback when score increases
  useEffect(() => {
    if (score > prevScoreRef.current) {
      const delta = score - prevScoreRef.current;
      const ctrl = controllerRef.current;
      if (ctrl) {
        const rx = (Math.random() - 0.5) * 6;
        const rz = (Math.random() - 0.5) * 5;
        ctrl.particles.burst(rx, 0.65, rz, Math.min(26, 8 + Math.floor(delta / 10)), accentColor, 6.5, 0.9, 10);
        if (delta >= 25) {
          ctrl.triggerTrauma(0.28);
          ctrl.kickFov(2.5);
        } else {
          ctrl.triggerTrauma(0.12);
        }
      }
    }
    prevScoreRef.current = score;
  }, [score, accentColor]);

  useEffect(() => {
    const mountEl = stageMountRef.current;
    const srcCanvas = sourceCanvasRef.current;
    if (!mountEl || !srcCanvas) return;

    let ctrl: ThreeStageController;
    try {
      ctrl = new ThreeStageController({
        container: mountEl,
        backgroundColor: 0x060a12,
        fogColor: 0x060a12,
        fogDensity: 0.016,
        initialPreset,
        gridPrimaryColor: accentColor,
        gridSecondaryColor: '#070b14',
        cameraPresets: {
          chase: { position: [0, 8.8, 9.2], lookAt: [0, 0.1, 0.4], fov: 50 },
          isometric: { position: [7.8, 9.6, 7.8], lookAt: [0, 0, 0], fov: 44 },
          diorama: { position: [0, 13.2, 1.4], lookAt: [0, 0, 0], fov: 45 }
        }
      });
    } catch {
      return;
    }

    controllerRef.current = ctrl;
    setQuality(ctrl.getQualityLevel());

    const boardW = 9.6 * boardAspect;
    const boardD = 9.6;

    // Build a multi-part 3D Arcade Diorama Table Group (8 distinct parts)
    const dioramaGroup = new THREE.Group();
    boardGroupRef.current = dioramaGroup;

    const accentThreeColor = new THREE.Color(accentColor);

    const chassisMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.82,
      roughness: 0.24,
      clearcoat: 0.8
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.65,
      roughness: 0.48
    });
    const neonMat = new THREE.MeshStandardMaterial({
      color: accentThreeColor,
      emissive: accentThreeColor,
      emissiveIntensity: 0.85,
      roughness: 0.2
    });

    // 1. Primary Sloped Armored Base Pedestal
    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(boardW + 0.9, 0.42, boardD + 0.9),
      chassisMat
    );
    baseMesh.position.y = 0.21;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    dioramaGroup.add(baseMesh);

    // 2. Secondary Inner Metallic Frame Bezel
    const bezelMesh = new THREE.Mesh(
      new THREE.BoxGeometry(boardW + 0.36, 0.52, boardD + 0.36),
      trimMat
    );
    bezelMesh.position.y = 0.28;
    bezelMesh.receiveShadow = true;
    dioramaGroup.add(bezelMesh);

    // 3, 4, 5, 6. Glowing Neon Perimeter Rails (North, South, East, West)
    const railH = new THREE.Mesh(new THREE.BoxGeometry(boardW + 0.5, 0.12, 0.12), neonMat);
    railH.position.set(0, 0.56, -(boardD * 0.5 + 0.18));
    const railSouth = railH.clone();
    railSouth.position.z = boardD * 0.5 + 0.18;

    const railV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, boardD + 0.5), neonMat);
    railV.position.set(-(boardW * 0.5 + 0.18), 0.56, 0);
    const railEast = railV.clone();
    railEast.position.x = boardW * 0.5 + 0.18;
    dioramaGroup.add(railH, railSouth, railV, railEast);

    // 7. Four Corner Pylon Turrets
    const pylonGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.72, 8);
    const corners = [
      [-(boardW * 0.5 + 0.25), -(boardD * 0.5 + 0.25)],
      [boardW * 0.5 + 0.25, -(boardD * 0.5 + 0.25)],
      [-(boardW * 0.5 + 0.25), boardD * 0.5 + 0.25],
      [boardW * 0.5 + 0.25, boardD * 0.5 + 0.25]
    ];
    corners.forEach(([cx, cz]) => {
      const pylon = new THREE.Mesh(pylonGeo, chassisMat);
      pylon.position.set(cx, 0.36, cz);
      pylon.castShadow = true;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), neonMat);
      cap.position.set(cx, 0.76, cz);
      dioramaGroup.add(pylon, cap);
    });

    // 8. Live Textured 3D Holographic Display Surface
    const canvasTex = new THREE.CanvasTexture(srcCanvas);
    canvasTex.colorSpace = THREE.SRGBColorSpace;
    canvasTex.anisotropy = ctrl.renderer.capabilities.getMaxAnisotropy();
    canvasTex.minFilter = THREE.LinearFilter;
    canvasTex.magFilter = THREE.LinearFilter;
    canvasTextureRef.current = canvasTex;

    const screenGeo = new THREE.PlaneGeometry(boardW, boardD);
    const screenMat = new THREE.MeshStandardMaterial({
      map: canvasTex,
      roughness: 0.22,
      metalness: 0.12,
      emissive: 0xffffff,
      emissiveMap: canvasTex,
      emissiveIntensity: 0.42
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.rotation.x = -Math.PI / 2;
    screenMesh.position.y = 0.55;
    screenMesh.receiveShadow = true;
    dioramaGroup.add(screenMesh);

    ctrl.scene.add(dioramaGroup);

    // Pointer & keyboard dynamic 3D tilt listener
    const onPointerMove = (e: PointerEvent) => {
      const rect = mountEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      tiltTargetRef.current.x = THREE.MathUtils.clamp(ny * 0.08, -0.1, 0.1);
      tiltTargetRef.current.y = THREE.MathUtils.clamp(nx * 0.08, -0.1, 0.1);
      ctrl.setFollowTarget(nx * 1.1, 0, ny * 1.1, 0.35);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        tiltTargetRef.current.y = -0.07;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        tiltTargetRef.current.y = 0.07;
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        tiltTargetRef.current.x = -0.06;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        tiltTargetRef.current.x = 0.06;
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    ctrl.startLoop((dt) => {
      if (canvasTextureRef.current) {
        canvasTextureRef.current.needsUpdate = true;
      }
      if (boardGroupRef.current) {
        boardGroupRef.current.rotation.x = THREE.MathUtils.damp(
          boardGroupRef.current.rotation.x,
          tiltTargetRef.current.x,
          6,
          dt
        );
        boardGroupRef.current.rotation.z = THREE.MathUtils.damp(
          boardGroupRef.current.rotation.z,
          -tiltTargetRef.current.y,
          6,
          dt
        );
      }
      tiltTargetRef.current.x = THREE.MathUtils.damp(tiltTargetRef.current.x, 0, 3, dt);
      tiltTargetRef.current.y = THREE.MathUtils.damp(tiltTargetRef.current.y, 0, 3, dt);
    });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
      if (canvasTextureRef.current) {
        canvasTextureRef.current.dispose();
        canvasTextureRef.current = null;
      }
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, [accentColor, boardAspect, initialPreset, sourceCanvasRef]);

  return {
    stageMountRef,
    cameraPreset,
    quality,
    handleSelectPreset,
    handleCycleQuality,
    triggerBurst3D,
    controllerRef
  };
}
