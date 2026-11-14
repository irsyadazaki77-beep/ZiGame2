import * as THREE from 'three';
import { PieceColor, PieceType } from './chessEngine';

export function boardCoordToWorld(row: number, col: number): THREE.Vector3 {
  return new THREE.Vector3((col - 3.5) * 1.0, 0.18, (row - 3.5) * 1.0);
}

export function createRuneFrameTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0c0f17';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 28; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 1024, Math.random() * 1024);
    ctx.bezierCurveTo(
      Math.random() * 1024, Math.random() * 1024,
      Math.random() * 1024, Math.random() * 1024,
      Math.random() * 1024, Math.random() * 1024
    );
    ctx.stroke();
  }

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 5;
  ctx.strokeRect(36, 36, 952, 952);
  ctx.strokeRect(92, 92, 840, 840);

  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  ctx.fillStyle = '#fde68a';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 14;
  ctx.font = 'bold 34px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 22; i++) {
    const pos = 75 + i * 41;
    const ch1 = runes[i % runes.length];
    const ch2 = runes[(i + 7) % runes.length];
    ctx.fillText(ch1, pos, 64);
    ctx.fillText(ch2, pos, 960);
    ctx.fillText(ch1, 64, pos);
    ctx.fillText(ch2, 960, pos);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export interface BuiltChessPiece {
  group: THREE.Group;
  accentMat: THREE.MeshStandardMaterial;
  rimMat: THREE.MeshStandardMaterial;
  baseAccentEmissive: number;
}

export function buildWizardChessPieceGroup(type: PieceType, color: PieceColor, isShielded = false): BuiltChessPiece {
  const group = new THREE.Group();
  const isWhite = color === 'w';

  const stoneMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0xe7dfd3 : 0x1e222d,
    roughness: isWhite ? 0.52 : 0.45,
    metalness: 0.14
  });

  const metalMat = new THREE.MeshPhysicalMaterial({
    color: isWhite ? 0xd99b26 : 0xb45309,
    roughness: 0.18,
    metalness: 0.88,
    clearcoat: 0.6
  });

  const baseAccentEmissive = isShielded ? 1.55 : 0.95;
  const accentMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0x38bdf8 : 0xf97316,
    emissive: isWhite ? 0x0ea5e9 : 0xea580c,
    emissiveIntensity: baseAccentEmissive,
    roughness: 0.18,
    metalness: 0.25
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: isWhite ? 0x7dd3fc : 0xfb923c,
    emissive: isWhite ? 0x0284c7 : 0xea580c,
    emissiveIntensity: isShielded ? 1.4 : 0.35,
    roughness: 0.25,
    metalness: 0.55
  });

  // 1. Tiered Pedestal Base
  const basePoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.36, 0),
    new THREE.Vector2(0.34, 0.08),
    new THREE.Vector2(0.28, 0.14),
    new THREE.Vector2(0.26, 0.22),
    new THREE.Vector2(0, 0.22)
  ];
  const baseGeo = new THREE.LatheGeometry(basePoints, 20);
  const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // 2. Glowing Arcane Rim Ring
  const ringGeo = new THREE.TorusGeometry(0.31, 0.024, 10, 24);
  const ringMesh = new THREE.Mesh(ringGeo, rimMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = 0.09;
  group.add(ringMesh);

  // 3. Metallic Collar Ring
  const midRingGeo = new THREE.TorusGeometry(0.27, 0.022, 10, 24);
  const midRingMesh = new THREE.Mesh(midRingGeo, metalMat);
  midRingMesh.rotation.x = Math.PI / 2;
  midRingMesh.position.y = 0.15;
  midRingMesh.castShadow = true;
  group.add(midRingMesh);

  // 4. Torso / Column Body
  const bodyHeight = type === 'p' ? 0.42 : type === 'r' ? 0.56 : type === 'k' ? 0.78 : type === 'q' ? 0.72 : 0.6;
  const bodyGeo = new THREE.CylinderGeometry(0.16, 0.24, bodyHeight, 12);
  const bodyMesh = new THREE.Mesh(bodyGeo, stoneMat);
  bodyMesh.position.y = 0.22 + bodyHeight / 2;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 5. Armor Pauldrons
  const collarGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.1, 10);
  const collarMesh = new THREE.Mesh(collarGeo, metalMat);
  collarMesh.position.y = 0.22 + bodyHeight - 0.04;
  collarMesh.castShadow = true;
  group.add(collarMesh);

  const topY = 0.22 + bodyHeight;

  if (type === 'p') {
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), stoneMat);
    headMesh.position.y = topY + 0.12;
    headMesh.castShadow = true;
    group.add(headMesh);

    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.16), metalMat);
    visorMesh.position.set(0, topY + 0.13, 0.08);
    group.add(visorMesh);

    const shieldMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.05), metalMat);
    shieldMesh.position.set(-0.16, topY - 0.12, 0.18);
    shieldMesh.rotation.y = 0.25;
    shieldMesh.castShadow = true;
    group.add(shieldMesh);
  } else if (type === 'r') {
    const turretMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.22, 8), stoneMat);
    turretMesh.position.y = topY + 0.1;
    turretMesh.castShadow = true;
    group.add(turretMesh);

    const coreCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), accentMat);
    coreCrystal.position.y = topY + 0.28;
    group.add(coreCrystal);
  } else if (type === 'n') {
    const neckMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.24), stoneMat);
    neckMesh.position.set(0, topY + 0.14, 0.02);
    neckMesh.rotation.x = -0.25;
    neckMesh.castShadow = true;
    group.add(neckMesh);

    const snoutMesh = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 8), metalMat);
    snoutMesh.position.set(0, topY + 0.26, 0.18);
    snoutMesh.rotation.x = Math.PI / 2.3;
    snoutMesh.castShadow = true;
    group.add(snoutMesh);

    const eyeGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), accentMat);
    eyeGem.position.set(0, topY + 0.3, 0.08);
    group.add(eyeGem);
  } else if (type === 'b') {
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), stoneMat);
    headMesh.position.y = topY + 0.12;
    group.add(headMesh);

    const mitreMesh = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 12), metalMat);
    mitreMesh.position.y = topY + 0.32;
    mitreMesh.castShadow = true;
    group.add(mitreMesh);

    const staffOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 1), accentMat);
    staffOrb.position.set(0.2, topY + 0.35, 0.12);
    group.add(staffOrb);
  } else if (type === 'q') {
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), stoneMat);
    headMesh.position.y = topY + 0.14;
    group.add(headMesh);

    const crownGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), accentMat);
    crownGem.position.y = topY + 0.35;
    group.add(crownGem);
  } else if (type === 'k') {
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), stoneMat);
    headMesh.position.y = topY + 0.15;
    group.add(headMesh);

    const crossVert = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.18, 0.045), accentMat);
    crossVert.position.y = topY + 0.42;
    group.add(crossVert);

    const crossHoriz = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045, 0.045), accentMat);
    crossHoriz.position.y = topY + 0.44;
    group.add(crossHoriz);
  }

  group.rotation.y = isWhite ? Math.PI : 0;
  return { group, accentMat, rimMat, baseAccentEmissive };
}

export interface BrazierEmberSystem {
  mesh: THREE.InstancedMesh;
  flameCore: THREE.Mesh;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

export function createBrazierWithEmbers(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  emberCount = 48
): BrazierEmberSystem {
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b18,
    roughness: 0.45,
    metalness: 0.85
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 1.85, 8), standMat);
  pillar.position.set(x, y - 1.05, z);
  pillar.castShadow = true;
  pillar.receiveShadow = true;
  scene.add(pillar);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.28, 0.42, 10), standMat);
  bowl.position.set(x, y - 0.08, z);
  bowl.castShadow = true;
  scene.add(bowl);

  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xfdba74,
    emissive: 0xf97316,
    emissiveIntensity: 2.1,
    roughness: 0.2
  });
  const flameCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 1), flameMat);
  flameCore.position.set(x, y + 0.26, z);
  scene.add(flameCore);

  const emberGeo = new THREE.DodecahedronGeometry(0.055, 0);
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf97316,
    emissiveIntensity: 2.4,
    roughness: 0.15
  });
  const mesh = new THREE.InstancedMesh(emberGeo, emberMat, emberCount);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const seeds = Array.from({ length: emberCount }, (_, i) => ({
    phase: (i / emberCount) * 3.2,
    speed: 0.8 + (i % 7) * 0.18,
    radius: 0.12 + (i % 5) * 0.08,
    angle: i * 1.7,
    spin: (i % 2 === 0 ? 1 : -1) * (2.5 + (i % 4))
  }));

  const dummy = new THREE.Object3D();

  const update = (dt: number, elapsed: number) => {
    flameCore.rotation.y += dt * 1.8;
    const pulse = 0.92 + Math.sin(elapsed * 9.5 + x) * 0.14;
    flameCore.scale.set(pulse, 1.15 + Math.cos(elapsed * 13) * 0.18, pulse);

    for (let i = 0; i < emberCount; i++) {
      const s = seeds[i];
      const t = ((elapsed * s.speed + s.phase) % 2.4) / 2.4;
      const angle = s.angle + elapsed * 1.4;
      const spread = s.radius * (1 + t * 1.8);
      dummy.position.set(
        x + Math.cos(angle) * spread,
        y + 0.2 + t * 2.8,
        z + Math.sin(angle) * spread
      );
      dummy.rotation.set(elapsed * s.spin, elapsed * s.spin * 0.7, 0);
      const scale = Math.max(0.01, (1 - t) * 1.15);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  const dispose = () => {
    emberGeo.dispose();
    emberMat.dispose();
    flameCore.geometry.dispose();
    flameMat.dispose();
    pillar.geometry.dispose();
    bowl.geometry.dispose();
    standMat.dispose();
  };

  return { mesh, flameCore, update, dispose };
}

export function disposePieceGroupTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
