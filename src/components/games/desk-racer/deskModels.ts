import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type DeskPowerUpType = 'nitro' | 'shield' | 'magnet' | 'eraser';

export const TRACK_CONTROL_POINTS: [number, number, number][] = [
  [0, 0, 12],
  [0, 0, -10],
  [-4, 0.8, -22],
  [-15, 1.4, -24],
  [-24, 0.6, -14],
  [-20, 0, -2],
  [-11, 0, 2],
  [-14, 0, 12],
  [-24, 0.9, 18],
  [-20, 1.2, 28],
  [-8, 0.4, 26],
  [0, 0, 20]
];

export const TRACK_HALF_WIDTH = 2.65;

export function createTrackRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e222a';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 600; i++) {
    ctx.fillRect(((i * 73) % 512), ((i * 137) % 512), 2, 2);
  }

  for (let y = 0; y < 512; y += 64) {
    const isRed = (y / 64) % 2 === 0;
    ctx.fillStyle = isRed ? '#ef4444' : '#f8fafc';
    ctx.fillRect(0, y, 36, 64);
    ctx.fillRect(512 - 36, y, 36, 64);
  }

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(42, 0, 6, 512);
  ctx.fillRect(512 - 48, 0, 6, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 38);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCheckeredTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const sq = 16;
  for (let y = 0; y < 64; y += sq) {
    for (let x = 0; x < 256; x += sq) {
      const even = (x / sq + y / sq) % 2 === 0;
      ctx.fillStyle = even ? '#f8fafc' : '#0f172a';
      ctx.fillRect(x, y, sq, sq);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function buildFormulaRacerGroup(isGhost = false): {
  group: THREE.Group;
  shieldBubble: THREE.Mesh;
  flameL: THREE.Mesh;
  flameR: THREE.Mesh;
  wheels: THREE.Mesh[];
} {
  const car = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const redPaint = new THREE.MeshPhysicalMaterial({
    color: isGhost ? 0x38bdf8 : 0xef4444,
    roughness: 0.18,
    metalness: 0.45,
    clearcoat: 1.0,
    transparent: isGhost,
    opacity: isGhost ? 0.42 : 1.0
  });

  const whiteTrim = new THREE.MeshStandardMaterial({
    color: isGhost ? 0xe0f2fe : 0xf8fafc,
    roughness: 0.32,
    metalness: 0.2,
    transparent: isGhost,
    opacity: isGhost ? 0.42 : 1.0
  });

  const darkCarbon = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.58,
    metalness: 0.35,
    transparent: isGhost,
    opacity: isGhost ? 0.35 : 1.0
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.85,
    metalness: 0.05,
    transparent: isGhost,
    opacity: isGhost ? 0.35 : 1.0
  });

  const tailGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    emissive: 0xef4444,
    emissiveIntensity: isGhost ? 0.5 : 2.1,
    transparent: isGhost,
    opacity: isGhost ? 0.5 : 1.0
  });

  // 1. Sculpted Rounded Monocoque Chassis
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.24, 1.56, 2, 0.08), redPaint);
  chassis.position.y = 0.23;
  chassis.castShadow = !isGhost;
  car.add(chassis);

  // 2. Sculpted Sidepods
  const sidepodL = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.19, 0.92, 2, 0.06), redPaint);
  sidepodL.position.set(-0.4, 0.2, 0.12);
  sidepodL.castShadow = !isGhost;
  const sidepodR = sidepodL.clone();
  sidepodR.position.x = 0.4;
  car.add(sidepodL, sidepodR);

  // 3. Tapered Nose Cone
  const nose = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.16, 0.68, 2, 0.06), whiteTrim);
  nose.position.set(0, 0.19, -0.96);
  nose.castShadow = !isGhost;
  car.add(nose);

  // 4. Front Spoiler Wing
  const frontWing = new THREE.Mesh(new RoundedBoxGeometry(1.16, 0.05, 0.28, 2, 0.02), darkCarbon);
  frontWing.position.set(0, 0.12, -1.24);
  frontWing.castShadow = !isGhost;
  car.add(frontWing);

  // 5. Rear High Downforce Wing + Rain Light
  const rearWing = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.06, 0.34, 2, 0.02), whiteTrim);
  rearWing.position.set(0, 0.52, 0.72);
  rearWing.castShadow = !isGhost;
  car.add(rearWing);

  const rearPillarL = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.28, 0.24, 2, 0.02), redPaint);
  rearPillarL.position.set(-0.48, 0.42, 0.72);
  const rearPillarR = rearPillarL.clone();
  rearPillarR.position.x = 0.48;
  car.add(rearPillarL, rearPillarR);

  const rainLight = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.08, 0.08, 2, 0.02), tailGlowMat);
  rainLight.position.set(0, 0.22, 0.8);
  car.add(rainLight);

  // 6. Cockpit Surround & Driver Helmet
  const cockpit = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.18, 0.56, 2, 0.06), darkCarbon);
  cockpit.position.set(0, 0.36, -0.05);
  car.add(cockpit);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), whiteTrim);
  helmet.position.set(0, 0.5, -0.02);
  car.add(helmet);

  const stripe = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.22, 0.28, 2, 0.02), redPaint);
  stripe.position.set(0, 0.56, -0.02);
  car.add(stripe);

  // 7. Four Racing Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.22, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelOffsets: [number, number, number][] = [
    [-0.54, 0.22, -0.68],
    [0.54, 0.22, -0.68],
    [-0.56, 0.22, 0.58],
    [0.56, 0.22, 0.58]
  ];
  for (const [wx, wy, wz] of wheelOffsets) {
    const wheel = new THREE.Mesh(wheelGeo, rubberMat);
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = !isGhost;
    car.add(wheel);
    wheels.push(wheel);
  }

  // 8. Shield Forcefield Bubble
  const bubbleGeo = new THREE.SphereGeometry(1.15, 20, 20);
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0284c7,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1
  });
  const shieldBubble = new THREE.Mesh(bubbleGeo, bubbleMat);
  shieldBubble.position.y = 0.35;
  shieldBubble.visible = false;
  car.add(shieldBubble);

  // 9. Twin Nitro Thruster Flames (Bloom-enabled)
  const flameGeo = new THREE.ConeGeometry(0.12, 0.68, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.6,
    roughness: 0.1
  });
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.24, 0.28, 1.05);
  flameL.visible = false;
  const flameR = flameL.clone();
  flameR.position.x = 0.24;
  flameR.visible = false;
  car.add(flameL, flameR);

  return { group: car, shieldBubble, flameL, flameR, wheels };
}

export function buildPowerUpMesh(type: DeskPowerUpType): THREE.Group {
  const grp = new THREE.Group();
  const boxGeo = new RoundedBoxGeometry(0.65, 0.65, 0.65, 2, 0.1);

  let color = 0x38bdf8;
  if (type === 'shield') color = 0x10b981;
  else if (type === 'magnet') color = 0xf59e0b;
  else if (type === 'eraser') color = 0xec4899;

  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.65,
    roughness: 0.2,
    metalness: 0.3
  });

  const box = new THREE.Mesh(boxGeo, mat);
  box.castShadow = true;
  grp.add(box);

  const ringGeo = new THREE.TorusGeometry(0.55, 0.045, 8, 20);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: color,
    emissiveIntensity: 1.4
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  grp.add(ring);

  grp.position.y = 0.45;
  return grp;
}

export function buildHazardMesh(type: 'coffee' | 'eraser' | 'pen'): THREE.Group {
  const grp = new THREE.Group();

  if (type === 'coffee') {
    const poolGeo = new THREE.CircleGeometry(0.9, 16);
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.12,
      metalness: 0.25,
      transparent: true,
      opacity: 0.88
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.04;
    grp.add(pool);
  } else if (type === 'eraser') {
    const eraserGeo = new RoundedBoxGeometry(0.85, 0.35, 1.4, 2, 0.08);
    const eraserMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.7 });
    const eraser = new THREE.Mesh(eraserGeo, eraserMat);
    eraser.position.y = 0.2;
    eraser.castShadow = true;
    grp.add(eraser);
  } else {
    const penGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 12);
    penGeo.rotateZ(Math.PI / 2);
    const penMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.28, metalness: 0.55 });
    const pen = new THREE.Mesh(penGeo, penMat);
    pen.position.y = 0.12;
    pen.castShadow = true;
    grp.add(pen);
  }

  return grp;
}

/**
 * Instanced Trackside Safety Bollards + Elevated Track Support Pylons (single draw call each).
 */
export function buildInstancedTrackProps(
  scene: THREE.Scene,
  trackCurve: THREE.CatmullRomCurve3,
  isSoftwareGl: boolean
): { dispose: () => void } {
  const up = new THREE.Vector3(0, 1, 0);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // 1. Trackside Glowing/Striped Safety Bollards along both edges
  const bollardCount = 72;
  const bollardGeo = new RoundedBoxGeometry(0.16, 0.38, 0.16, 2, 0.04);
  const bollardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.75,
    roughness: 0.3,
    metalness: 0.4
  });
  const bollardInst = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardCount * 2);
  bollardInst.castShadow = !isSoftwareGl;

  for (let i = 0; i < bollardCount; i++) {
    const u = i / bollardCount;
    const pt = trackCurve.getPointAt(u);
    const tan = trackCurve.getTangentAt(u).normalize();
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const yaw = Math.atan2(tan.x, tan.z);

    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1;
      const idx = i * 2 + side;
      dummy.position.copy(pt).addScaledVector(right, sign * (TRACK_HALF_WIDTH + 0.18));
      dummy.position.y += 0.2;
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      bollardInst.setMatrixAt(idx, dummy.matrix);
      color.setHex(i % 2 === 0 ? 0x38bdf8 : 0xf43f5e);
      bollardInst.setColorAt(idx, color);
    }
  }
  bollardInst.instanceMatrix.needsUpdate = true;
  if (bollardInst.instanceColor) bollardInst.instanceColor.needsUpdate = true;
  bollardInst.computeBoundingSphere();
  scene.add(bollardInst);

  // 2. Track Support Pylons beneath elevated coaster sections
  const pylonGeo = new THREE.CylinderGeometry(0.18, 0.24, 1, 10);
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.7 });
  const pylonPts: { x: number; h: number; z: number }[] = [];
  for (let i = 0; i < 48; i++) {
    const pt = trackCurve.getPointAt(i / 48);
    if (pt.y > 0.12) {
      pylonPts.push({ x: pt.x, h: pt.y + 0.05, z: pt.z });
    }
  }
  const pylonInst = new THREE.InstancedMesh(pylonGeo, pylonMat, Math.max(1, pylonPts.length));
  pylonInst.castShadow = !isSoftwareGl;
  pylonInst.receiveShadow = true;
  pylonPts.forEach((p, idx) => {
    dummy.position.set(p.x, p.h * 0.5 - 0.05, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, p.h, 1);
    dummy.updateMatrix();
    pylonInst.setMatrixAt(idx, dummy.matrix);
  });
  if (pylonPts.length === 0) {
    dummy.position.set(0, -50, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    pylonInst.setMatrixAt(0, dummy.matrix);
  }
  pylonInst.instanceMatrix.needsUpdate = true;
  pylonInst.computeBoundingSphere();
  scene.add(pylonInst);

  return {
    dispose: () => {
      bollardGeo.dispose();
      bollardMat.dispose();
      pylonGeo.dispose();
      pylonMat.dispose();
    }
  };
}
