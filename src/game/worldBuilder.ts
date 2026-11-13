import * as THREE from 'three';
import { MaterialLibrary } from './materials';
import { VehicleType } from '../types/game';

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  tag?: 'solid' | 'obby' | 'survival' | 'ramp' | 'bridge';
}

export interface WorldCoinPickup {
  id: string;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  collectedAt: number;
  value: number;
}

export interface ObbySweeper {
  mesh: THREE.Mesh;
  cx: number;
  cy: number;
  cz: number;
  speed: number;
  radius: number;
}

export interface SurvivalTile {
  id: number;
  mesh: THREE.Mesh;
  collider: ColliderBox;
  state: 'idle' | 'warning' | 'fallen';
  timer: number;
  baseY: number;
}

export interface TycoonStage {
  tier: number;
  name: string;
  cost: number;
  incomePerSec: number;
  padMesh: THREE.Mesh;
  padPos: THREE.Vector3;
  structureGroup: THREE.Group;
  built: boolean;
}

export interface WorldBuildResult {
  worldGroup: THREE.Group;
  colliders: ColliderBox[];
  coins: WorldCoinPickup[];
  obbyCheckpoints: THREE.Vector3[];
  obbySweepers: ObbySweeper[];
  raceCheckpoints: THREE.Vector3[];
  survivalTiles: SurvivalTile[];
  tycoonStages: TycoonStage[];
  vehicleSpawns: Array<{ type: VehicleType; x: number; y: number; z: number; rotY: number; color?: string }>;
  windmillBlade: THREE.Group;
  fountainJet: THREE.Mesh;
  secretCrystal: THREE.Mesh;
  waterLevel: number;
}

export function getTerrainHeight(x: number, z: number): number {
  // River channel cutting north-south around x = 66..78
  const riverCenter = 70 + Math.sin(z * 0.04) * 10;
  const distRiver = Math.abs(x - riverCenter);
  if (distRiver < 9 && z > -70 && z < 110) {
    return -1.8;
  }

  // Ocean beach on far east (x > 118)
  if (x > 122) {
    return Math.max(-2.4, -((x - 122) * 0.14));
  }

  // Mountain foothills in NE (x > 55, z < -60)
  const dxM = x - 102;
  const dzM = z + 102;
  const distM = Math.hypot(dxM, dzM);
  if (distM < 44) {
    const t = 1 - distM / 44;
    return Math.floor(t * 14) * 1.1; // Stepped blocky mountain terraces
  }

  // Outer perimeter natural cliffs beyond radius 165
  const distCenter = Math.hypot(x, z);
  if (distCenter > 165) {
    return Math.min(18, (distCenter - 165) * 0.45);
  }

  return 0;
}

export function buildBlockverseWorld(mats: MaterialLibrary): WorldBuildResult {
  const worldGroup = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const coins: WorldCoinPickup[] = [];
  const waterLevel = -0.55;

  const addBoxCollider = (
    id: string,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    tag: ColliderBox['tag'] = 'solid',
  ): ColliderBox => {
    const c: ColliderBox = {
      id,
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minY: cy - h / 2,
      maxY: cy + h / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      tag,
    };
    colliders.push(c);
    return c;
  };

  const addBlockMesh = (
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    color: string | number,
    options?: {
      useStud?: boolean;
      useGlass?: boolean;
      roughness?: number;
      metalness?: number;
      collider?: boolean;
      tag?: ColliderBox['tag'];
      parent?: THREE.Object3D;
    },
  ) => {
    const mat = new THREE.MeshStandardMaterial({
      color,
      map: options?.useGlass
        ? mats.buildingGlassTexture
        : options?.useStud
          ? mats.studTexture
          : null,
      roughness: options?.roughness ?? 0.58,
      metalness: options?.metalness ?? 0.08,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (options?.parent || worldGroup).add(mesh);
    if (options?.collider !== false) {
      addBoxCollider(`blk-${colliders.length}`, cx, cy, cz, w, h, d, options?.tag || 'solid');
    }
    return mesh;
  };

  // 1. Main Ground & Beach & Water
  const grassGround = new THREE.Mesh(
    new THREE.BoxGeometry(280, 2, 340),
    new THREE.MeshStandardMaterial({ map: mats.grassTexture, roughness: 0.85, metalness: 0.02 }),
  );
  grassGround.position.set(-16, -1.0, 0);
  grassGround.receiveShadow = true;
  worldGroup.add(grassGround);

  // Sandy Beach Strip
  const beachMesh = new THREE.Mesh(
    new THREE.BoxGeometry(56, 1.8, 340),
    new THREE.MeshStandardMaterial({ map: mats.sandTexture, roughness: 0.9, metalness: 0.02 }),
  );
  beachMesh.position.set(106, -0.92, 0);
  beachMesh.receiveShadow = true;
  worldGroup.add(beachMesh);

  // Ocean & River Water Surface
  const waterGeo = new THREE.PlaneGeometry(420, 420, 42, 42);
  const waterMesh = new THREE.Mesh(waterGeo, mats.waterMaterial);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(60, waterLevel, 0);
  waterMesh.receiveShadow = true;
  worldGroup.add(waterMesh);

  // River Channel carved visual blocks (banks)
  for (let z = -70; z <= 105; z += 10) {
    const rx = 70 + Math.sin(z * 0.04) * 10;
    const bankL = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.2, 10.5),
      new THREE.MeshStandardMaterial({ map: mats.sandTexture, roughness: 0.85 }),
    );
    bankL.position.set(rx - 9.5, -0.45, z);
    const bankR = bankL.clone();
    bankR.position.x = rx + 9.5;
    worldGroup.add(bankL, bankR);
  }

  // 2. City Road Network (offset Y = 0.03 to prevent Z-fighting)
  const addRoad = (x: number, z: number, w: number, d: number, rotate90 = false) => {
    const roadMat = new THREE.MeshStandardMaterial({
      map: mats.roadTexture,
      roughness: 0.8,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), roadMat);
    mesh.position.set(x, 0.04, z);
    if (rotate90) mesh.rotation.y = Math.PI / 2;
    mesh.receiveShadow = true;
    worldGroup.add(mesh);
  };

  addRoad(0, 0, 12, 175, false);
  addRoad(-20, 0, 12, 130, true);
  addRoad(0, -45, 12, 130, true);
  addRoad(0, 45, 12, 130, true);

  // Central Spawn Plaza
  const plaza = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.14, 28),
    new THREE.MeshStandardMaterial({ color: '#cbd5e1', map: mats.studTexture, roughness: 0.55 }),
  );
  plaza.position.set(0, 0.07, 0);
  plaza.receiveShadow = true;
  worldGroup.add(plaza);

  // Fountain in Central Park (x: 24, z: 22)
  addBlockMesh(24, 0.4, 22, 9, 0.8, 9, '#94a3b8', { useStud: true });
  const fountainWater = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.5, 7.2),
    mats.waterMaterial,
  );
  fountainWater.position.set(24, 0.65, 22);
  worldGroup.add(fountainWater);
  addBlockMesh(24, 1.5, 22, 2.2, 2.2, 2.2, '#e2e8f0', { useStud: true });
  const fountainJet = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.78 }),
  );
  fountainJet.position.set(24, 3.3, 22);
  worldGroup.add(fountainJet);

  // 3. Skyline City Skyscrapers & Houses
  const skyscraperSpecs = [
    { x: -28, z: 24, w: 14, h: 32, d: 14, color: '#3b82f6' },
    { x: 28, z: -24, w: 14, h: 38, d: 14, color: '#6366f1' },
    { x: -52, z: -20, w: 12, h: 26, d: 12, color: '#0ea5e9' },
    { x: 46, z: 24, w: 13, h: 28, d: 13, color: '#ec4899' },
    { x: 48, z: -58, w: 15, h: 34, d: 15, color: '#14b8a6' },
  ];
  for (const s of skyscraperSpecs) {
    addBlockMesh(s.x, s.h / 2, s.z, s.w, s.h, s.d, s.color, { useGlass: true });
    // Rooftop crown + antenna
    addBlockMesh(s.x, s.h + 1.2, s.z, s.w * 0.65, 2.4, s.d * 0.65, '#334155');
    addBlockMesh(s.x, s.h + 5.5, s.z, 0.5, 6.5, 0.5, '#cbd5e1', { collider: false });
  }

  // Grand Shopping Mall (BlockMart Mall at x: -34, z: -28)
  addBlockMesh(-34, 6, -28, 24, 12, 18, '#f472b6', { useGlass: true });
  addBlockMesh(-34, 12.8, -28, 25, 1.6, 19, '#1e293b');
  addBlockMesh(-34, 9.5, -18.5, 14, 3.2, 1.2, '#facc15', { collider: false }); // Mall Neon Sign
  addBlockMesh(-34, 2.5, -18.8, 6, 5, 0.6, '#38bdf8', { collider: false }); // Entrance glass

  // Cozy City & Village Houses
  const addHouse = (x: number, z: number, bodyColor: string, roofColor: string) => {
    addBlockMesh(x, 2.5, z, 8, 5, 7, bodyColor, { useStud: true });
    // Pitched blocky roof steps
    addBlockMesh(x, 5.6, z, 9, 1.2, 8, roofColor, { useStud: true });
    addBlockMesh(x, 6.7, z, 6.5, 1.0, 5.8, roofColor, { useStud: true });
    // Door
    addBlockMesh(x, 1.6, z + 3.55, 1.8, 3.2, 0.25, '#78350f', { collider: false });
    // Windows
    addBlockMesh(x - 2.3, 2.8, z + 3.55, 1.4, 1.4, 0.2, '#bae6fd', { collider: false });
    addBlockMesh(x + 2.3, 2.8, z + 3.55, 1.4, 1.4, 0.2, '#bae6fd', { collider: false });
  };

  addHouse(-24, -62, '#fef08a', '#ef4444');
  addHouse(24, -62, '#bae6fd', '#2563eb');
  addHouse(-82, 62, '#fed7aa', '#ea580c');
  addHouse(-102, 74, '#bbf7d0', '#16a34a');
  addHouse(-86, 86, '#fbcfe8', '#db2777');
  addHouse(-112, 54, '#fde68a', '#b45309');

  // Emerald Village Windmill (x: -102, z: 54)
  addBlockMesh(-102, 6, 54, 5.5, 12, 5.5, '#f8fafc', { useStud: true });
  addBlockMesh(-102, 13, 54, 6.2, 2.2, 6.2, '#dc2626', { useStud: true });
  const windmillBlade = new THREE.Group();
  windmillBlade.position.set(-102, 10.5, 57.2);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 6.2, 0.2),
      new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.6 }),
    );
    arm.rotation.z = (i * Math.PI) / 2;
    arm.position.set(Math.sin(-arm.rotation.z) * 3.1, Math.cos(arm.rotation.z) * 3.1, 0);
    windmillBlade.add(arm);
  }
  worldGroup.add(windmillBlade);

  // 4. Two Drivable Bridges over Crystal River
  const buildBridge = (zPos: number) => {
    const rx = 70 + Math.sin(zPos * 0.04) * 10;
    addBlockMesh(rx, 0.65, zPos, 24, 0.7, 9, '#94a3b8', { useStud: true, tag: 'bridge' });
    addBlockMesh(rx, 1.6, zPos - 4.2, 24, 1.1, 0.6, '#475569', { tag: 'bridge' });
    addBlockMesh(rx, 1.6, zPos + 4.2, 24, 1.1, 0.6, '#475569', { tag: 'bridge' });
    // Approach ramps
    addBlockMesh(rx - 13.5, 0.35, zPos, 3.2, 0.5, 9, '#cbd5e1', { tag: 'ramp' });
    addBlockMesh(rx + 13.5, 0.35, zPos, 3.2, 0.5, 9, '#cbd5e1', { tag: 'ramp' });
  };
  buildBridge(0);
  buildBridge(45);

  // Wooden Beach Pier & Lighthouse (x: 118, z: 22)
  addBlockMesh(124, 0.5, 22, 20, 0.6, 5, '#b45309', { useStud: true, tag: 'bridge' });
  addBlockMesh(112, 8, 42, 6, 16, 6, '#f8fafc', { useStud: true });
  addBlockMesh(112, 10, 42, 6.2, 4, 6.2, '#ef4444', { collider: false });
  addBlockMesh(112, 17.5, 42, 4.2, 3, 4.2, '#fde047', { collider: false });

  // 5. Summit Peaks Mountain & Secret Crystal Cavern (x: 102, z: -102)
  const mountainMat = new THREE.MeshStandardMaterial({ color: '#64748b', map: mats.studTexture, roughness: 0.82 });
  const snowMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 });
  const layers = [
    { r: 34, h: 4, y: 2 },
    { r: 26, h: 4, y: 6 },
    { r: 18, h: 4, y: 10 },
    { r: 10, h: 5, y: 14.5 },
  ];
  for (const [idx, l] of layers.entries()) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(l.r * 1.5, l.h, l.r * 1.5), idx >= 2 ? snowMat : mountainMat);
    m.position.set(102, l.y, -102);
    m.castShadow = true;
    m.receiveShadow = true;
    worldGroup.add(m);
    addBoxCollider(`mtn-${idx}`, 102, l.y, -102, l.r * 1.5, l.h, l.r * 1.5, 'solid');
  }
  // Secret Crystal Cave Archway & Glowing Crystal at (84, 2, -74)
  addBlockMesh(80, 3.5, -74, 3, 7, 6, '#475569');
  addBlockMesh(88, 3.5, -74, 3, 7, 6, '#475569');
  addBlockMesh(84, 7.5, -74, 11, 2.5, 6, '#334155');
  const secretCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6, 0),
    new THREE.MeshStandardMaterial({ color: '#c084fc', emissive: '#9333ea', emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.4 }),
  );
  secretCrystal.position.set(84, 2.4, -74);
  worldGroup.add(secretCrystal);

  // 6. Blockverse International Airport (x: -94, z: -94)
  addBlockMesh(-94, 0.12, -94, 18, 0.24, 88, '#1e293b', { collider: false });
  for (let rz = -130; rz <= -58; rz += 12) {
    addBlockMesh(-94, 0.26, rz, 1.4, 0.06, 6, '#f8fafc', { collider: false });
  }
  // Control Tower
  addBlockMesh(-112, 10, -88, 6, 20, 6, '#e2e8f0', { useStud: true });
  addBlockMesh(-112, 21.5, -88, 9, 3.2, 9, '#38bdf8', { useGlass: true });
  // Hangar
  addBlockMesh(-114, 5, -112, 14, 10, 18, '#fb923c', { useStud: true });

  // 7. Instanced Forest Trees (Pine & Oak) & Perimeter Cliffs
  const trunkGeo = new THREE.BoxGeometry(1.1, 3.2, 1.1);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.85 });
  const leafGeo = new THREE.BoxGeometry(3.6, 3.8, 3.6);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.72 });

  const treeCoords: Array<[number, number, number]> = [];
  for (let i = 0; i < 85; i++) {
    const angle = (i * 2.39996) % (Math.PI * 2);
    const radius = 58 + ((i * 37) % 104);
    const tx = Math.cos(angle) * radius - 14;
    const tz = Math.sin(angle) * radius;
    // Skip roads, river, beach, airport, race track
    if (Math.abs(tx) < 16 || Math.abs(tz) < 16) continue;
    if (tx > 56 && tx < 140) continue;
    if (tx < -70 && tz < -50) continue;
    if (tz > 75 && Math.abs(tx) < 55) continue;
    const scale = 0.85 + ((i % 5) * 0.08);
    treeCoords.push([tx, tz, scale]);
  }

  const trunksInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
  const leavesInst = new THREE.InstancedMesh(leafGeo, leafMat, treeCoords.length);
  trunksInst.castShadow = true;
  leavesInst.castShadow = true;
  const dummy = new THREE.Object3D();
  const tintColor = new THREE.Color();

  treeCoords.forEach(([tx, tz, sc], idx) => {
    const ty = getTerrainHeight(tx, tz);
    dummy.position.set(tx, ty + 1.6 * sc, tz);
    dummy.scale.set(sc, sc, sc);
    dummy.rotation.y = (idx * 0.7) % Math.PI;
    dummy.updateMatrix();
    trunksInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(tx, ty + 4.4 * sc, tz);
    dummy.updateMatrix();
    leavesInst.setMatrixAt(idx, dummy.matrix);

    tintColor.setHSL(0.32 + (idx % 4) * 0.025, 0.65, 0.42 + (idx % 3) * 0.05);
    leavesInst.setColorAt(idx, tintColor);
  });
  trunksInst.instanceMatrix.needsUpdate = true;
  leavesInst.instanceMatrix.needsUpdate = true;
  if (leavesInst.instanceColor) leavesInst.instanceColor.needsUpdate = true;
  trunksInst.computeBoundingSphere();
  leavesInst.computeBoundingSphere();
  worldGroup.add(trunksInst, leavesInst);

  // 8. MINI-GAME 1: SKY OBBY TOWER (x: 10, z: -88)
  const obbyCheckpoints: THREE.Vector3[] = [];
  const obbySweepers: ObbySweeper[] = [];
  const obbyColors = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
  // Starting Obby Platform
  addBlockMesh(10, 0.5, -72, 8, 1, 8, '#ec4899', { useStud: true, tag: 'obby' });
  obbyCheckpoints.push(new THREE.Vector3(10, 1.2, -72));

  for (let i = 1; i <= 12; i++) {
    const px = 10 + Math.sin(i * 0.7) * 7;
    const py = 1.0 + i * 1.45;
    const pz = -72 - i * 5.2;
    const size = i % 3 === 0 ? 5.5 : 4.2;
    addBlockMesh(px, py, pz, size, 0.9, size, obbyColors[i % obbyColors.length], { useStud: true, tag: 'obby' });

    if (i % 3 === 0) {
      obbyCheckpoints.push(new THREE.Vector3(px, py + 0.6, pz));
      // Glowing checkpoint beacon
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 1.6, 12),
        new THREE.MeshStandardMaterial({ color: '#fde047', emissive: '#f59e0b', emissiveIntensity: 0.7 }),
      );
      beacon.position.set(px, py + 1.25, pz);
      worldGroup.add(beacon);
    }

    if (i === 4 || i === 8 || i === 10) {
      const sweeper = new THREE.Mesh(
        new THREE.BoxGeometry(5.8, 0.6, 0.6),
        new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#dc2626', emissiveIntensity: 0.4 }),
      );
      sweeper.position.set(px, py + 1.05, pz);
      worldGroup.add(sweeper);
      obbySweepers.push({ mesh: sweeper, cx: px, cy: py + 1.05, cz: pz, speed: 1.8 + i * 0.15, radius: 2.9 });
    }
  }

  // 9. MINI-GAME 2: GRAND PRIX RACE CIRCUIT (centered x: 0, z: 112)
  const raceCheckpoints: THREE.Vector3[] = [
    new THREE.Vector3(0, 0.5, 86),
    new THREE.Vector3(38, 0.5, 96),
    new THREE.Vector3(44, 0.5, 126),
    new THREE.Vector3(0, 0.5, 138),
    new THREE.Vector3(-42, 0.5, 126),
    new THREE.Vector3(-38, 0.5, 96),
  ];
  // Track oval surface blocks
  for (let a = 0; a < 36; a++) {
    const theta = (a / 36) * Math.PI * 2;
    const rx = Math.cos(theta) * 44;
    const rz = 112 + Math.sin(theta) * 26;
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.85 }),
    );
    seg.position.set(rx, 0.1, rz);
    seg.rotation.y = -theta;
    seg.receiveShadow = true;
    worldGroup.add(seg);
  }
  // Start/Finish Checkered Gantry
  addBlockMesh(-6, 4, 86, 1.2, 8, 1.2, '#f8fafc');
  addBlockMesh(6, 4, 86, 1.2, 8, 1.2, '#f8fafc');
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(13.5, 1.8, 1.2),
    new THREE.MeshStandardMaterial({ map: mats.checkerTexture, roughness: 0.4 }),
  );
  banner.position.set(0, 7.6, 86);
  worldGroup.add(banner);

  // 10. MINI-GAME 3: FALLING TILES SURVIVAL ARENA (x: -58, z: 32)
  const survivalTiles: SurvivalTile[] = [];
  addBlockMesh(-58, 0.4, 32, 26, 0.8, 26, '#0f172a', { collider: false }); // Pit floor below
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      const tx = -58 + gx * 4.4;
      const tz = 32 + gz * 4.4;
      const ty = 4.2;
      const tileMesh = new THREE.Mesh(
        new THREE.BoxGeometry(4.0, 0.65, 4.0),
        new THREE.MeshStandardMaterial({ color: '#22d3ee', map: mats.studTexture, roughness: 0.45 }),
      );
      tileMesh.position.set(tx, ty, tz);
      tileMesh.castShadow = true;
      tileMesh.receiveShadow = true;
      worldGroup.add(tileMesh);
      const col = addBoxCollider(`surv-${gx}-${gz}`, tx, ty, tz, 4.0, 0.65, 4.0, 'survival');
      survivalTiles.push({
        id: survivalTiles.length,
        mesh: tileMesh,
        collider: col,
        state: 'idle',
        timer: 0,
        baseY: ty,
      });
    }
  }

  // 11. MINI-GAME 4: HIDE & SEEK HEDGE MAZE (x: -54, z: -72)
  addBlockMesh(-54, 0.1, -72, 32, 0.2, 32, '#14532d', { collider: false });
  const mazeWalls: Array<[number, number, number, number]> = [
    [-54, -88, 32, 2],
    [-54, -56, 32, 2],
    [-70, -72, 2, 32],
    [-38, -72, 2, 24],
    [-60, -78, 14, 2],
    [-48, -66, 14, 2],
    [-58, -64, 2, 12],
    [-46, -78, 2, 10],
  ];
  for (const [wx, wz, ww, wd] of mazeWalls) {
    addBlockMesh(wx, 2.2, wz, ww, 4.4, wd, '#166534', { useStud: true });
  }

  // 12. MINI-GAME 5: BLOCKMART TYCOON PLOT (x: 42, z: -2)
  const tycoonStages: TycoonStage[] = [];
  addBlockMesh(42, 0.15, -2, 22, 0.3, 22, '#334155', { collider: false });
  const stageConfigs = [
    { name: 'Cube Dropper Mk.1', cost: 0, income: 8, ox: -5, oz: -5, color: '#22c55e', h: 3.2 },
    { name: 'Conveyor Line', cost: 40, income: 16, ox: 0, oz: -5, color: '#38bdf8', h: 1.5 },
    { name: 'Auto Packager', cost: 90, income: 30, ox: 5, oz: -5, color: '#f59e0b', h: 4.5 },
    { name: 'Showroom Floor 2', cost: 180, income: 55, ox: 0, oz: 2, color: '#a855f7', h: 8.5 },
    { name: 'Mega Neon Tower', cost: 320, income: 110, ox: 0, oz: 6, color: '#ec4899', h: 14.0 },
  ];
  stageConfigs.forEach((sc, idx) => {
    const padPos = new THREE.Vector3(34 + idx * 4.2, 0.35, 7);
    const padMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.3, 3.2),
      new THREE.MeshStandardMaterial({
        color: idx === 0 ? '#22c55e' : '#eab308',
        emissive: idx === 0 ? '#16a34a' : '#ca8a04',
        emissiveIntensity: 0.45,
      }),
    );
    padMesh.position.copy(padPos);
    worldGroup.add(padMesh);

    const structureGroup = new THREE.Group();
    structureGroup.visible = false;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, sc.h, 4.5),
      new THREE.MeshStandardMaterial({ color: sc.color, map: mats.studTexture, roughness: 0.45 }),
    );
    mesh.position.set(42 + sc.ox, sc.h / 2 + 0.3, -2 + sc.oz);
    mesh.castShadow = true;
    structureGroup.add(mesh);
    worldGroup.add(structureGroup);

    tycoonStages.push({
      tier: idx + 1,
      name: sc.name,
      cost: sc.cost,
      incomePerSec: sc.income,
      padMesh,
      padPos,
      structureGroup,
      built: false,
    });
  });

  // 13. MINI-GAME 6: BATTLE ARENA (x: 56, z: 66)
  addBlockMesh(56, 0.15, 66, 30, 0.3, 30, '#1e1b4b', { collider: false });
  addBlockMesh(56, 2, 51, 30, 4, 1.5, '#6366f1');
  addBlockMesh(56, 2, 81, 30, 4, 1.5, '#6366f1');
  addBlockMesh(41, 2, 66, 1.5, 4, 30, '#6366f1');
  addBlockMesh(71, 2, 66, 1.5, 4, 30, '#6366f1');
  // Arena cover blocks
  addBlockMesh(50, 1.5, 60, 3.5, 3, 3.5, '#f43f5e', { useStud: true });
  addBlockMesh(62, 1.5, 60, 3.5, 3, 3.5, '#06b6d4', { useStud: true });
  addBlockMesh(50, 1.5, 72, 3.5, 3, 3.5, '#06b6d4', { useStud: true });
  addBlockMesh(62, 1.5, 72, 3.5, 3, 3.5, '#f43f5e', { useStud: true });

  // 14. MINI-GAME 7: PET SANCTUARY MEADOW (x: -24, z: 66)
  addBlockMesh(-24, 0.2, 66, 22, 0.4, 22, '#dcfce7', { useStud: true, collider: false });
  addBlockMesh(-24, 2.2, 58, 6, 4, 2, '#f59e0b', { useStud: true });
  addBlockMesh(-29, 0.6, 66, 2.2, 1.0, 2.2, '#fb7185');
  addBlockMesh(-19, 0.6, 66, 2.2, 1.0, 2.2, '#38bdf8');

  // 15. Collectible Coins Scattered Around World
  const coinGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.22, 14);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    emissive: '#d97706',
    emissiveIntensity: 0.45,
    metalness: 0.8,
    roughness: 0.2,
  });
  const coinPositions: Array<[number, number, number, number]> = [
    [0, 1.4, -12, 15],
    [14, 1.4, 12, 15],
    [-16, 1.4, 14, 15],
    [-34, 1.4, -14, 25],
    [24, 2.6, 22, 30],
    [70, 1.8, 0, 25],
    [114, 1.4, 22, 30],
    [84, 2.2, -74, 100], // Secret crystal cave treasure!
    [-92, 1.4, 68, 25],
    [-94, 1.4, -74, 25],
    [-24, 1.4, 66, 25],
    [42, 1.4, 8, 20],
  ];
  coinPositions.forEach(([cx, cy, cz, val], i) => {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.position.set(cx, cy, cz);
    worldGroup.add(m);
    coins.push({ id: `coin-${i}`, mesh: m, x: cx, y: cy, z: cz, collectedAt: -999, value: val });
  });

  // 16. Vehicle Spawns Across World
  const vehicleSpawns: WorldBuildResult['vehicleSpawns'] = [
    { type: 'sedan', x: -8, y: 0.1, z: 16, rotY: 0, color: '#3b82f6' },
    { type: 'sports', x: 8, y: 0.1, z: 82, rotY: Math.PI / 2, color: '#ef4444' },
    { type: 'motorcycle', x: 10, y: 0.1, z: 14, rotY: -Math.PI / 2, color: '#f97316' },
    { type: 'bus', x: -16, y: 0.1, z: -12, rotY: Math.PI, color: '#eab308' },
    { type: 'truck', x: -46, y: 0.1, z: 12, rotY: 0.4, color: '#10b981' },
    { type: 'boat', x: 134, y: waterLevel + 0.1, z: 22, rotY: Math.PI / 2, color: '#06b6d4' },
    { type: 'airplane', x: -94, y: 0.25, z: -116, rotY: 0, color: '#f8fafc' },
  ];

  return {
    worldGroup,
    colliders,
    coins,
    obbyCheckpoints,
    obbySweepers,
    raceCheckpoints,
    survivalTiles,
    tycoonStages,
    vehicleSpawns,
    windmillBlade,
    fountainJet,
    secretCrystal,
    waterLevel,
  };
}
