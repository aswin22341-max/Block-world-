import * as THREE from 'three';
import { AvatarConfig, FaceExpression, PetType, ShirtPattern, VehicleType } from '../types/game';

export interface CharacterRig {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  nameSprite?: THREE.Sprite;
  wingsGroup?: THREE.Group;
}

function makeFaceTexture(expression: FaceExpression, skinColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = skinColor;
  ctx.fillRect(0, 0, 128, 128);

  // Rosy cheeks
  ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
  ctx.beginPath();
  ctx.arc(28, 76, 10, 0, Math.PI * 2);
  ctx.arc(100, 76, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';

  if (expression === 'happy') {
    ctx.beginPath();
    ctx.arc(42, 54, 7, 0, Math.PI * 2);
    ctx.arc(86, 54, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(44, 52, 2.5, 0, Math.PI * 2);
    ctx.arc(88, 52, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 72, 20, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (expression === 'cool') {
    ctx.fillRect(34, 48, 16, 8);
    ctx.fillRect(78, 48, 16, 8);
    ctx.beginPath();
    ctx.moveTo(44, 82);
    ctx.quadraticCurveTo(66, 88, 86, 76);
    ctx.stroke();
  } else if (expression === 'surprised') {
    ctx.beginPath();
    ctx.arc(42, 52, 8, 0, Math.PI * 2);
    ctx.arc(86, 52, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 84, 11, 0, Math.PI * 2);
    ctx.stroke();
  } else if (expression === 'wink') {
    ctx.beginPath();
    ctx.arc(42, 54, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(86, 56, 9, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(64, 74, 18, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (expression === 'determined') {
    ctx.beginPath();
    ctx.moveTo(30, 42);
    ctx.lineTo(52, 50);
    ctx.moveTo(98, 42);
    ctx.lineTo(76, 50);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(42, 56, 6, 0, Math.PI * 2);
    ctx.arc(86, 56, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(48, 84);
    ctx.lineTo(80, 80);
    ctx.stroke();
  } else {
    // starry
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(42, 54, 9, 0, Math.PI * 2);
    ctx.arc(86, 54, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(64, 74, 18, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeShirtTexture(pattern: ShirtPattern, shirtColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = shirtColor;
  ctx.fillRect(0, 0, 128, 128);

  if (pattern === 'stripes') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = 12; y < 128; y += 28) {
      ctx.fillRect(0, y, 128, 10);
    }
  } else if (pattern === 'star') {
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = 64 + Math.cos(a) * 28;
      const y = 64 + Math.sin(a) * 28;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else if (pattern === 'hoodie') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(28, 86, 72, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(54, 16, 4, 34);
    ctx.fillRect(70, 16, 4, 34);
  } else if (pattern === 'jacket') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(60, 0, 8, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(0, 0, 44, 128);
    ctx.fillRect(84, 0, 44, 128);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createNameTagSprite(name: string, badgeColor = '#0f172a'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = badgeColor;
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  ctx.roundRect(16, 12, 224, 40, 12);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 22px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 16), 128, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.1, 0.52, 1);
  return sprite;
}

export function createAvatarModel(config: AvatarConfig, showNameTag = false): CharacterRig {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.85; // Hip height
  group.add(bodyPivot);

  const skinMat = new THREE.MeshStandardMaterial({ color: config.skinColor, roughness: 0.65, metalness: 0.05 });
  const shirtTex = makeShirtTexture(config.shirtPattern, config.shirtColor);
  const torsoMat = new THREE.MeshStandardMaterial({ map: shirtTex, roughness: 0.55, metalness: 0.08 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: config.shirtColor, roughness: 0.55, metalness: 0.08 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: config.pantsColor, roughness: 0.72, metalness: 0.04 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: config.shoesColor, roughness: 0.4, metalness: 0.15 });
  const hairMat = new THREE.MeshStandardMaterial({ color: config.hairColor, roughness: 0.75, metalness: 0.05 });

  // Torso (0.86 x 0.9 x 0.48)
  const torsoGeo = new THREE.BoxGeometry(0.88, 0.92, 0.48);
  const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
  torsoMesh.position.y = 0.46;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyPivot.add(torsoMesh);

  // Belt / Waist trim
  const beltMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.91, 0.1, 0.51),
    new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.35, metalness: 0.4 }),
  );
  beltMesh.position.y = 0.06;
  bodyPivot.add(beltMesh);

  // Head Group (mounted at top of torso)
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.92;
  bodyPivot.add(headGroup);

  const faceTex = makeFaceTexture(config.faceExpression, config.skinColor);
  const headMats = [
    skinMat, // +X
    skinMat, // -X
    skinMat, // +Y
    skinMat, // -Y
    new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.6 }), // +Z front
    skinMat, // -Z
  ];
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.68), headMats);
  headMesh.position.y = 0.36;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Hair Styles
  if (config.hairStyle === 'spiky') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.73, 0.2, 0.73), hairMat);
    cap.position.y = 0.66;
    headGroup.add(cap);
    for (let i = -1; i <= 1; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 4), hairMat);
      spike.position.set(i * 0.2, 0.84, 0.08);
      spike.rotation.x = 0.25;
      headGroup.add(spike);
    }
  } else if (config.hairStyle === 'bob') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.76), hairMat);
    top.position.y = 0.66;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.56, 0.22), hairMat);
    back.position.set(0, 0.42, -0.28);
    headGroup.add(top, back);
  } else if (config.hairStyle === 'mohawk') {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.72), hairMat);
    ridge.position.y = 0.82;
    headGroup.add(ridge);
  } else if (config.hairStyle === 'ponytail') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.73, 0.2, 0.73), hairMat);
    top.position.y = 0.66;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.24), hairMat);
    tail.position.set(0, 0.45, -0.46);
    tail.rotation.x = 0.25;
    headGroup.add(top, tail);
  } else if (config.hairStyle === 'curly') {
    for (let x = -0.24; x <= 0.25; x += 0.24) {
      for (let z = -0.22; z <= 0.23; z += 0.22) {
        const puff = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.28), hairMat);
        puff.position.set(x, 0.72, z);
        headGroup.add(puff);
      }
    }
  }

  // Hats
  const hatMat = new THREE.MeshStandardMaterial({ color: config.hatColor, roughness: 0.45, metalness: 0.15 });
  if (config.hatType === 'cap') {
    const dome = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.24, 0.74), hatMat);
    dome.position.y = 0.75;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.08, 0.34), hatMat);
    brim.position.set(0, 0.65, 0.42);
    headGroup.add(dome, brim);
  } else if (config.hatType === 'tophat') {
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.08, 0.96), hatMat);
    brim.position.y = 0.72;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.68), new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.7, roughness: 0.25 }));
    band.position.y = 0.81;
    const cyl = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.46, 0.66), hatMat);
    cyl.position.y = 1.04;
    headGroup.add(brim, band, cyl);
  } else if (config.hatType === 'crown') {
    const goldMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.85, roughness: 0.2 });
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.72), goldMat);
    ring.position.y = 0.76;
    headGroup.add(ring);
    for (let i = -1; i <= 1; i += 2) {
      const point = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 4), goldMat);
      point.position.set(i * 0.24, 0.92, 0.24);
      const pointB = point.clone();
      pointB.position.z = -0.24;
      headGroup.add(point, pointB);
    }
  } else if (config.hatType === 'wizard') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.06, 8), hatMat);
    brim.position.y = 0.72;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.72, 8), hatMat);
    cone.position.y = 1.08;
    headGroup.add(brim, cone);
  } else if (config.hatType === 'helmet') {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.56, 0.78), hatMat);
    shell.position.y = 0.54;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.59, 0.81), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }));
    stripe.position.y = 0.54;
    headGroup.add(shell, stripe);
  } else if (config.hatType === 'halo') {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.06, 8, 24),
      new THREE.MeshStandardMaterial({ color: '#fde047', emissive: '#f59e0b', emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.2 }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.96;
    headGroup.add(halo);
  }

  // Glasses
  if (config.glassesType === 'sunglasses') {
    const frameMat = new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.15, metalness: 0.7 });
    const leftLens = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.06), frameMat);
    leftLens.position.set(-0.16, 0.4, 0.36);
    const rightLens = leftLens.clone();
    rightLens.position.x = 0.16;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.06), frameMat);
    bridge.position.set(0, 0.43, 0.36);
    headGroup.add(leftLens, rightLens, bridge);
  } else if (config.glassesType === 'visor') {
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: '#06b6d4', emissive: '#0891b2', emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.6 }),
    );
    visor.position.set(0, 0.4, 0.33);
    headGroup.add(visor);
  } else if (config.glassesType === 'nerd') {
    const frameMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 });
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.05), frameMat);
    l.position.set(-0.16, 0.4, 0.36);
    const r = l.clone();
    r.position.x = 0.16;
    headGroup.add(l, r);
  } else if (config.glassesType === 'monocle') {
    const mono = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.025, 8, 16),
      new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.9, roughness: 0.2 }),
    );
    mono.position.set(0.16, 0.4, 0.36);
    headGroup.add(mono);
  }

  // Accessories
  let wingsGroup: THREE.Group | undefined;
  if (config.accessoryType === 'scarf') {
    const scarf = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.16, 0.62),
      new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.8 }),
    );
    scarf.position.y = 0.94;
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.44, 0.1),
      new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.8 }),
    );
    tail.position.set(0.22, 0.72, 0.29);
    bodyPivot.add(scarf, tail);
  } else if (config.accessoryType === 'cape') {
    const cape = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 1.05, 0.06),
      new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.7 }),
    );
    cape.position.set(0, 0.38, -0.31);
    cape.rotation.x = 0.12;
    bodyPivot.add(cape);
  } else if (config.accessoryType === 'wings') {
    wingsGroup = new THREE.Group();
    wingsGroup.position.set(0, 0.64, -0.28);
    const wingMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.45, metalness: 0.1 });
    const lw = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.08), wingMat);
    lw.position.set(-0.55, 0.1, -0.05);
    lw.rotation.y = 0.3;
    const rw = lw.clone();
    rw.position.x = 0.55;
    rw.rotation.y = -0.3;
    wingsGroup.add(lw, rw);
    bodyPivot.add(wingsGroup);
  } else if (config.accessoryType === 'headphones') {
    const hpMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', metalness: 0.5, roughness: 0.3 });
    const arc = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.14), hpMat);
    arc.position.y = 0.73;
    const cupL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.26), hpMat);
    cupL.position.set(-0.38, 0.36, 0);
    const cupR = cupL.clone();
    cupR.position.x = 0.38;
    headGroup.add(arc, cupL, cupR);
  }

  // Backpacks
  const packMat = new THREE.MeshStandardMaterial({ color: config.backpackColor, roughness: 0.5, metalness: 0.25 });
  if (config.backpackType === 'hiking') {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.32), packMat);
    bag.position.set(0, 0.48, -0.38);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.66, 8), new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.7 }));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 0.88, -0.38);
    bodyPivot.add(bag, roll);
  } else if (config.backpackType === 'jetpack') {
    const metalMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.85, roughness: 0.25 });
    const tankL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.72, 10), packMat);
    tankL.position.set(-0.2, 0.5, -0.36);
    const tankR = tankL.clone();
    tankR.position.x = 0.2;
    const nozL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.18, 8), metalMat);
    nozL.position.set(-0.2, 0.08, -0.36);
    const nozR = nozL.clone();
    nozR.position.x = 0.2;
    bodyPivot.add(tankL, tankR, nozL, nozR);
  } else if (config.backpackType === 'wingpack') {
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.6, 0.24), packMat);
    core.position.set(0, 0.52, -0.34);
    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.06), packMat);
    finL.position.set(-0.55, 0.62, -0.38);
    finL.rotation.z = 0.2;
    const finR = finL.clone();
    finR.position.x = 0.55;
    finR.rotation.z = -0.2;
    bodyPivot.add(core, finL, finR);
  } else if (config.backpackType === 'chest') {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.42), new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.6 }));
    chest.position.set(0, 0.48, -0.44);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.06), new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.8, roughness: 0.2 }));
    lock.position.set(0, 0.52, -0.66);
    bodyPivot.add(chest, lock);
  }

  // Arms (pivoted at shoulder)
  const makeArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.62, 0.82, 0);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.34), sleeveMat);
    sleeve.position.y = -0.22;
    sleeve.castShadow = true;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.32), skinMat);
    hand.position.y = -0.62;
    hand.castShadow = true;
    pivot.add(sleeve, hand);
    bodyPivot.add(pivot);
    return pivot;
  };
  const leftArmPivot = makeArm(-1);
  const rightArmPivot = makeArm(1);

  // Legs (pivoted at hip)
  const makeLeg = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.23, 0.0, 0);
    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.66, 0.38), pantsMat);
    legMesh.position.y = -0.34;
    legMesh.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.46), shoeMat);
    shoe.position.set(0, -0.75, 0.04);
    shoe.castShadow = true;
    pivot.add(legMesh, shoe);
    bodyPivot.add(pivot);
    return pivot;
  };
  const leftLegPivot = makeLeg(-1);
  const rightLegPivot = makeLeg(1);

  let nameSprite: THREE.Sprite | undefined;
  if (showNameTag) {
    nameSprite = createNameTagSprite(config.name || 'Player');
    nameSprite.position.set(0, 3.05, 0);
    group.add(nameSprite);
  }

  return {
    group,
    bodyPivot,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    nameSprite,
    wingsGroup,
  };
}

export function animateAvatarModel(
  rig: CharacterRig,
  anim: string,
  emote: string,
  time: number,
) {
  // Reset baseline
  rig.bodyPivot.position.y = 0.85;
  rig.bodyPivot.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);

  if (rig.wingsGroup) {
    rig.wingsGroup.rotation.y = Math.sin(time * 5) * 0.12;
  }

  if (anim === 'drive') {
    rig.bodyPivot.position.y = 0.65;
    rig.leftLegPivot.rotation.x = -Math.PI / 2.2;
    rig.rightLegPivot.rotation.x = -Math.PI / 2.2;
    rig.leftArmPivot.rotation.x = -Math.PI / 2.6;
    rig.rightArmPivot.rotation.x = -Math.PI / 2.6;
    return;
  }

  if (emote === 'sit' || anim === 'sit') {
    rig.bodyPivot.position.y = 0.5;
    rig.leftLegPivot.rotation.x = -Math.PI / 2;
    rig.rightLegPivot.rotation.x = -Math.PI / 2;
    rig.leftArmPivot.rotation.x = -0.35;
    rig.rightArmPivot.rotation.x = -0.35;
    return;
  }

  if (emote === 'dance' || anim === 'dance') {
    rig.bodyPivot.position.y = 0.85 + Math.abs(Math.sin(time * 7)) * 0.16;
    rig.bodyPivot.rotation.y = Math.sin(time * 3.5) * 0.35;
    rig.leftArmPivot.rotation.z = -1.6 - Math.sin(time * 7) * 0.6;
    rig.rightArmPivot.rotation.z = 1.6 + Math.sin(time * 7) * 0.6;
    rig.leftArmPivot.rotation.x = Math.cos(time * 7) * 0.4;
    rig.rightArmPivot.rotation.x = -Math.cos(time * 7) * 0.4;
    rig.leftLegPivot.rotation.x = Math.sin(time * 7) * 0.35;
    rig.rightLegPivot.rotation.x = -Math.sin(time * 7) * 0.35;
    return;
  }

  if (emote === 'wave') {
    rig.rightArmPivot.rotation.z = 2.5 + Math.sin(time * 10) * 0.4;
    rig.leftArmPivot.rotation.set(0, 0, -0.1);
    rig.leftLegPivot.rotation.set(0, 0, 0);
    rig.rightLegPivot.rotation.set(0, 0, 0);
    return;
  }

  if (emote === 'cheer') {
    rig.bodyPivot.position.y = 0.85 + Math.abs(Math.sin(time * 8)) * 0.25;
    rig.leftArmPivot.rotation.z = -2.6;
    rig.rightArmPivot.rotation.z = 2.6;
    rig.leftLegPivot.rotation.set(0, 0, 0);
    rig.rightLegPivot.rotation.set(0, 0, 0);
    return;
  }

  if (anim === 'jump' || anim === 'fall') {
    rig.leftArmPivot.rotation.set(0, 0, -0.75);
    rig.rightArmPivot.rotation.set(0, 0, 0.75);
    rig.leftLegPivot.rotation.x = anim === 'jump' ? 0.35 : -0.25;
    rig.rightLegPivot.rotation.x = anim === 'jump' ? -0.25 : 0.25;
    return;
  }

  if (anim === 'swim') {
    rig.bodyPivot.rotation.x = 0.95;
    rig.bodyPivot.position.y = 0.75 + Math.sin(time * 4) * 0.08;
    rig.leftArmPivot.rotation.x = -Math.PI / 2 + Math.sin(time * 6) * 0.7;
    rig.rightArmPivot.rotation.x = -Math.PI / 2 - Math.sin(time * 6) * 0.7;
    rig.leftLegPivot.rotation.x = Math.sin(time * 8) * 0.45;
    rig.rightLegPivot.rotation.x = -Math.sin(time * 8) * 0.45;
    return;
  }

  if (anim === 'walk' || anim === 'run') {
    const freq = anim === 'run' ? 12.5 : 7.5;
    const amp = anim === 'run' ? 0.95 : 0.55;
    const swing = Math.sin(time * freq) * amp;
    rig.bodyPivot.position.y = 0.85 + Math.abs(Math.cos(time * freq)) * (anim === 'run' ? 0.1 : 0.05);
    rig.bodyPivot.rotation.x = anim === 'run' ? 0.14 : 0.04;
    rig.leftArmPivot.rotation.set(swing, 0, -0.06);
    rig.rightArmPivot.rotation.set(-swing, 0, 0.06);
    rig.leftLegPivot.rotation.x = -swing;
    rig.rightLegPivot.rotation.x = swing;
    return;
  }

  // Idle breathing
  rig.leftArmPivot.rotation.set(Math.sin(time * 1.8) * 0.04, 0, -0.06);
  rig.rightArmPivot.rotation.set(-Math.sin(time * 1.8) * 0.04, 0, 0.06);
  rig.leftLegPivot.rotation.set(0, 0, 0);
  rig.rightLegPivot.rotation.set(0, 0, 0);
}

export interface VehicleInstance {
  group: THREE.Group;
  type: VehicleType;
  wheels: THREE.Object3D[];
  propeller?: THREE.Object3D;
  seatOffset: THREE.Vector3;
}

export function createVehicleModel(type: VehicleType, primaryColor?: string): VehicleInstance {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  let propeller: THREE.Object3D | undefined;
  let seatOffset = new THREE.Vector3(0, 0.7, 0);

  const defaultColors: Record<VehicleType, string> = {
    sedan: '#3b82f6',
    sports: '#ef4444',
    motorcycle: '#f97316',
    bus: '#eab308',
    truck: '#10b981',
    boat: '#06b6d4',
    airplane: '#f8fafc',
  };
  const bodyColor = primaryColor || defaultColors[type];
  const paintMat = new THREE.MeshPhysicalMaterial({ color: bodyColor, roughness: 0.25, metalness: 0.35, clearcoat: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8, metalness: 0.1 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2, metalness: 0.9 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#bae6fd', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.72 });
  const lightMat = new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#facc15', emissiveIntensity: 0.8 });

  const addWheel = (x: number, y: number, z: number, radius = 0.45, width = 0.34) => {
    const wGroup = new THREE.Group();
    wGroup.position.set(x, y, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), darkMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.03, 10), chromeMat);
    rim.rotation.z = Math.PI / 2;
    wGroup.add(tire, rim);
    group.add(wGroup);
    wheels.push(wGroup);
  };

  if (type === 'sedan' || type === 'sports') {
    const isSports = type === 'sports';
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, isSports ? 0.58 : 0.72, isSports ? 4.3 : 4.0), paintMat);
    chassis.position.y = isSports ? 0.62 : 0.72;
    chassis.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, isSports ? 0.54 : 0.66, 2.0), glassMat);
    cabin.position.set(0, isSports ? 1.12 : 1.32, -0.15);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.12, 1.85), paintMat);
    roof.position.set(0, isSports ? 1.4 : 1.66, -0.15);
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    hlL.position.set(-0.66, 0.72, isSports ? 2.15 : 2.0);
    const hlR = hlL.clone();
    hlR.position.x = 0.66;
    group.add(chassis, cabin, roof, hlL, hlR);

    if (isSports) {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.4), darkMat);
      spoiler.position.set(0, 1.15, -1.95);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 4.32), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }));
      stripe.position.y = 0.63;
      group.add(spoiler, stripe);
    }
    addWheel(-1.05, 0.44, 1.3);
    addWheel(1.05, 0.44, 1.3);
    addWheel(-1.05, 0.44, -1.3);
    addWheel(1.05, 0.44, -1.3);
    seatOffset.set(0, 0.85, -0.15);
  } else if (type === 'motorcycle') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.55, 2.0), paintMat);
    frame.position.y = 0.7;
    frame.castShadow = true;
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.18), chromeMat);
    fork.position.set(0, 0.9, 0.82);
    fork.rotation.x = -0.35;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.14), darkMat);
    handle.position.set(0, 1.24, 0.7);
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.14), lightMat);
    headlight.position.set(0, 1.0, 0.98);
    group.add(frame, fork, handle, headlight);
    addWheel(0, 0.42, 0.96, 0.42, 0.24);
    addWheel(0, 0.42, -0.92, 0.42, 0.26);
    seatOffset.set(0, 0.95, -0.15);
  } else if (type === 'bus') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.1, 6.4), paintMat);
    body.position.y = 1.5;
    body.castShadow = true;
    const windows = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.8, 5.6), glassMat);
    windows.position.set(0, 1.9, 0.1);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.26, 0.24), darkMat);
    bumper.position.set(0, 0.56, 3.16);
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.24, 0.1), lightMat);
    hlL.position.set(-0.85, 0.82, 3.21);
    const hlR = hlL.clone();
    hlR.position.x = 0.85;
    group.add(body, windows, bumper, hlL, hlR);
    addWheel(-1.22, 0.5, 2.0, 0.5, 0.4);
    addWheel(1.22, 0.5, 2.0, 0.5, 0.4);
    addWheel(-1.22, 0.5, -2.0, 0.5, 0.4);
    addWheel(1.22, 0.5, -2.0, 0.5, 0.4);
    seatOffset.set(0, 1.2, 2.0);
  } else if (type === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.65, 2.0), paintMat);
    cab.position.set(0, 1.32, 1.5);
    cab.castShadow = true;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 0.12), glassMat);
    windshield.position.set(0, 1.65, 2.48);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.95, 3.6), new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.6 }));
    cargo.position.set(0, 1.48, -1.4);
    cargo.castShadow = true;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 5.6), darkMat);
    bed.position.set(0, 0.65, -0.3);
    group.add(cab, windshield, cargo, bed);
    addWheel(-1.18, 0.5, 1.6, 0.5, 0.38);
    addWheel(1.18, 0.5, 1.6, 0.5, 0.38);
    addWheel(-1.18, 0.5, -1.8, 0.5, 0.38);
    addWheel(1.18, 0.5, -1.8, 0.5, 0.38);
    seatOffset.set(0, 1.2, 1.4);
  } else if (type === 'boat') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.72, 4.6), paintMat);
    hull.position.y = 0.36;
    hull.castShadow = true;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.4, 4), paintMat);
    bow.rotation.y = Math.PI / 4;
    bow.rotation.x = Math.PI / 2;
    bow.position.set(0, 0.36, 2.9);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.16, 3.8), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 }));
    deck.position.y = 0.74;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.52, 0.14), glassMat);
    screen.position.set(0, 1.05, 0.9);
    screen.rotation.x = -0.35;
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.5), darkMat);
    motor.position.set(0, 0.68, -2.45);
    group.add(hull, bow, deck, screen, motor);
    seatOffset.set(0, 0.85, -0.2);
  } else if (type === 'airplane') {
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.25, 5.2), paintMat);
    fuselage.position.y = 1.15;
    fuselage.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.28, 5.22), new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.4 }));
    stripe.position.y = 1.15;
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.58, 1.8), glassMat);
    canopy.position.set(0, 1.98, 0.2);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.18, 1.45), paintMat);
    wing.position.set(0, 1.25, 0.5);
    wing.castShadow = true;
    const tailH = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.85), paintMat);
    tailH.position.set(0, 1.4, -2.25);
    const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.9), new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.4 }));
    tailV.position.set(0, 1.95, -2.25);

    const propGroup = new THREE.Group();
    propGroup.position.set(0, 1.15, 2.7);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.28, 10), chromeMat);
    hub.rotation.x = Math.PI / 2;
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 0.06), darkMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 0.06), darkMat);
    propGroup.add(hub, blade1, blade2);
    propeller = propGroup;

    group.add(fuselage, stripe, canopy, wing, tailH, tailV, propGroup);
    addWheel(-0.95, 0.34, 1.1, 0.34, 0.22);
    addWheel(0.95, 0.34, 1.1, 0.34, 0.22);
    addWheel(0, 0.25, -2.2, 0.25, 0.18);
    seatOffset.set(0, 1.4, 0.2);
  }

  return { group, type, wheels, propeller, seatOffset };
}

export interface PetInstance {
  group: THREE.Group;
  type: PetType;
  wings?: THREE.Group;
  tail?: THREE.Object3D;
}

export function createPetModel(type: PetType): PetInstance {
  const group = new THREE.Group();
  let wings: THREE.Group | undefined;
  let tail: THREE.Object3D | undefined;

  const palette: Record<PetType, { body: string; accent: string }> = {
    dog: { body: '#d97706', accent: '#fef3c7' },
    cat: { body: '#f97316', accent: '#fff7ed' },
    dragon: { body: '#dc2626', accent: '#facc15' },
    robot: { body: '#38bdf8', accent: '#0f172a' },
    dino: { body: '#22c55e', accent: '#bef264' },
    rabbit: { body: '#f8fafc', accent: '#f472b6' },
    phoenix: { body: '#f59e0b', accent: '#ef4444' },
  };
  const colors = palette[type];
  const bodyMat = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.55, metalness: type === 'robot' ? 0.65 : 0.05 });
  const accentMat = new THREE.MeshStandardMaterial({ color: colors.accent, roughness: 0.5, metalness: type === 'robot' ? 0.8 : 0.05 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.44, 0.78), bodyMat);
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.48, 0.52), bodyMat);
  head.position.set(0, 0.72, 0.34);
  head.castShadow = true;
  group.add(head);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.06), eyeMat);
  eyeL.position.set(-0.14, 0.76, 0.6);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.14;
  group.add(eyeL, eyeR);

  // Legs
  for (const lx of [-0.2, 0.2]) {
    for (const lz of [-0.25, 0.25]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), accentMat);
      leg.position.set(lx, 0.13, lz);
      group.add(leg);
    }
  }

  // Tail
  const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.42), accentMat);
  tailMesh.position.set(0, 0.48, -0.52);
  tailMesh.rotation.x = 0.4;
  group.add(tailMesh);
  tail = tailMesh;

  // Type-specific features
  if (type === 'dog' || type === 'cat') {
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.12), accentMat);
    earL.position.set(-0.2, 1.0, 0.32);
    const earR = earL.clone();
    earR.position.x = 0.2;
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.16), accentMat);
    snout.position.set(0, 0.64, 0.64);
    group.add(earL, earR, snout);
  } else if (type === 'rabbit') {
    const earL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.1), accentMat);
    earL.position.set(-0.14, 1.14, 0.32);
    const earR = earL.clone();
    earR.position.x = 0.14;
    group.add(earL, earR);
  } else if (type === 'dino') {
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), accentMat);
      spike.position.set(0, 0.7 + (i === 0 ? 0.28 : 0), 0.24 - i * 0.26);
      group.add(spike);
    }
  } else if (type === 'robot') {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 6), accentMat);
    antenna.position.set(0, 1.08, 0.34);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#facc15', emissive: '#eab308', emissiveIntensity: 0.9 }),
    );
    bulb.position.set(0, 1.24, 0.34);
    group.add(antenna, bulb);
  } else if (type === 'dragon' || type === 'phoenix') {
    wings = new THREE.Group();
    wings.position.set(0, 0.56, 0);
    const lw = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.36), accentMat);
    lw.position.set(-0.48, 0.05, 0);
    const rw = lw.clone();
    rw.position.x = 0.48;
    wings.add(lw, rw);
    group.add(wings);

    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), accentMat);
    crest.position.set(0, 1.04, 0.34);
    group.add(crest);
  }

  return { group, type, wings, tail };
}

export function animatePetModel(pet: PetInstance, time: number, isMoving: boolean) {
  const hop = isMoving ? Math.abs(Math.sin(time * 10)) * 0.24 : Math.sin(time * 3) * 0.06;
  const hoverOffset = pet.type === 'dragon' || pet.type === 'phoenix' || pet.type === 'robot' ? 0.35 : 0;
  pet.group.position.y += hop + hoverOffset;
  if (pet.wings) {
    pet.wings.rotation.z = Math.sin(time * 12) * 0.35;
  }
  if (pet.tail) {
    pet.tail.rotation.y = Math.sin(time * 8) * 0.35;
  }
}
