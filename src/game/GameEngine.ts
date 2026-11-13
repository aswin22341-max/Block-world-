import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AvatarConfig,
  BlockCategory,
  BuildToolMode,
  EmoteType,
  GameSettings,
  HudSnapshot,
  MiniGameId,
  PetType,
  PlacedBlock,
  RemotePlayer,
  VehicleType,
  WORLD_ZONES,
} from '../types/game';
import { createMaterialLibrary, detectSoftwareWebGL, MaterialLibrary } from './materials';
import {
  animateAvatarModel,
  animatePetModel,
  CharacterRig,
  createAvatarModel,
  createPetModel,
  createVehicleModel,
  PetInstance,
  VehicleInstance,
} from './models';
import { buildBlockverseWorld, ColliderBox, getTerrainHeight, WorldBuildResult } from './worldBuilder';
import { soundEngine } from '../audio/soundEngine';

// Pre-allocated math helpers for zero-GC render loop
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();

interface WorldVehicleEntity {
  id: string;
  type: VehicleType;
  instance: VehicleInstance;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotY: number;
  speed: number;
  pitch: number;
  occupiedByPlayer: boolean;
}

interface PlacedBlockEntity {
  data: PlacedBlock;
  mesh: THREE.Object3D;
  collider: ColliderBox | null;
}

interface BotActor {
  id: string;
  name: string;
  rig: CharacterRig;
  pos: THREE.Vector3;
  rotY: number;
  target: THREE.Vector3;
  speed: number;
  anim: string;
  avatar: AvatarConfig;
  health: number;
  respawnTimer: number;
}

interface ParticleCube {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

interface ProjectileBolt {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  fromPlayer: boolean;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onCoinCollected: (amount: number, reason?: string) => void;
  onZoneDiscovered: (zoneId: string, zoneName: string) => void;
  onBlockPlaced: (block: PlacedBlock, fromRemote?: boolean) => void;
  onBlockUpdated: (block: PlacedBlock, fromRemote?: boolean) => void;
  onBlockRemoved: (blockId: string, fromRemote?: boolean) => void;
  onMiniGameComplete: (gameId: MiniGameId, rewardCoins: number, rewardXp: number, summary: string) => void;
  onHealthChange: (health: number) => void;
  onPlayerStateBroadcast: (state: {
    x: number;
    y: number;
    z: number;
    rotY: number;
    anim: string;
    emote: string;
    vehicle: VehicleType | null;
    score: number;
  }) => void;
  onSelectPlacedBlock: (block: PlacedBlock | null) => void;
  onInteractPrompt?: (text: string) => void;
  onEscapePressed: () => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sunLight!: THREE.DirectionalLight;
  private mats!: MaterialLibrary;
  private world!: WorldBuildResult;
  private isSoftwareGl = false;
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  // Player state
  private playerRig!: CharacterRig;
  private playerPos = new THREE.Vector3(0, 1.5, 12);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerRotY = Math.PI;
  private onGround = false;
  private coyoteTimer = 0;
  private playerAnim = 'idle';
  private playerEmote: EmoteType = 'none';
  private emoteTimer = 0;
  private playerHealth = 100;
  private isMenuPreviewMode = true;

  // Pet
  private petInstance: PetInstance | null = null;
  private petPos = new THREE.Vector3(2, 1, 14);
  private equippedPetType: PetType | null = 'dog';

  // Camera
  private camYaw = 0;
  private camPitch = 0.42;
  private camDistance = 12.5;
  private isDraggingCam = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerDownPos = { x: 0, y: 0 };

  // Input
  private keys: Record<string, boolean> = {};
  private joystickVec = { x: 0, y: 0 };
  private mobileJump = false;
  private mobileSprint = false;
  private settings: GameSettings = {
    soundEnabled: true,
    volume: 0.65,
    cameraSensitivity: 1.0,
    showMobileControls: 'auto',
    graphicsQuality: 'high',
  };

  // Vehicles
  private vehicles: WorldVehicleEntity[] = [];
  private activeVehicle: WorldVehicleEntity | null = null;

  // Placed / Editor blocks
  private placedBlocks = new Map<string, PlacedBlockEntity>();
  private buildEnabled = false;
  private buildToolMode: BuildToolMode = 'place';
  private buildPreset: { type: string; category: BlockCategory; color: string; sx: number; sy: number; sz: number } = {
    type: 'cube',
    category: 'block',
    color: '#3b82f6',
    sx: 2,
    sy: 2,
    sz: 2,
  };
  private selectedBlockId: string | null = null;
  private ghostMesh!: THREE.Mesh;

  // Remote & Bot Players
  private remoteRigs = new Map<string, { rig: CharacterRig; targetPos: THREE.Vector3; targetRotY: number; anim: string; emote: string; pet?: PetInstance; petPos?: THREE.Vector3 }>();
  private bots: BotActor[] = [];

  // Particles & Projectiles
  private particles: ParticleCube[] = [];
  private projectiles: ProjectileBolt[] = [];
  private particleGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);

  // Mini-games runtime state
  private activeMiniGame: MiniGameId = 'none';
  private miniGameTimer = 0;
  private miniGameScore = 0;
  private miniGameStatus = '';
  private obbyCheckpointIdx = 0;
  private raceCheckpointIdx = 0;
  private raceLap = 1;
  private raceBots: Array<{ mesh: THREE.Group; cpIdx: number; lap: number; progress: number; speed: number }> = [];
  private survivalWaveTimer = 0;
  private hideSeekRole: 'seeker' | 'hider' = 'seeker';
  private hideSeekPhase: 'hide' | 'seek' = 'hide';
  private hideSeekCaught = 0;
  private tycoonCash = 60;
  private tycoonAccum = 0;
  private petOrbs: THREE.Mesh[] = [];

  // Timers
  private hudTimer = 0;
  private broadcastTimer = 0;
  private discoveredZones = new Set<string>(['skyline-city']);

  constructor(container: HTMLElement, avatar: AvatarConfig, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.init(avatar);
  }

  private init(avatar: AvatarConfig) {
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color('#7dd3fc');
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2('#93c5fd', 0.0032);

    // Mandatory studio environment reflection
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.2, 550);

    // 3-Point Warm/Cool Lighting Rig
    const hemi = new THREE.HemisphereLight('#bae6fd', '#365314', 0.85);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight('#fffbeb', 1.65);
    this.sunLight.position.set(45, 75, 40);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    const d = 65;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const rimLight = new THREE.DirectionalLight('#93c5fd', 0.45);
    rimLight.position.set(-40, 30, -50);
    this.scene.add(rimLight);

    // Sky Sun Disc & Fluffy Blocky Clouds
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(12, 16, 16),
      new THREE.MeshBasicMaterial({ color: '#fef08a', fog: false }),
    );
    sunDisc.position.set(160, 150, -140);
    this.scene.add(sunDisc);

    const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, fog: false });
    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Group();
      const angle = (i / 16) * Math.PI * 2;
      const rad = 75 + (i % 3) * 42;
      cloud.position.set(Math.cos(angle) * rad, 52 + (i % 4) * 6, Math.sin(angle) * rad);
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(16, 4.5, 9), cloudMat);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 7), cloudMat);
      b2.position.set(4, 3.2, 0);
      cloud.add(b1, b2);
      this.scene.add(cloud);
    }

    // Materials & World
    this.mats = createMaterialLibrary(this.renderer, this.isSoftwareGl);
    this.world = buildBlockverseWorld(this.mats);
    this.scene.add(this.world.worldGroup);

    // Player Avatar
    this.playerRig = createAvatarModel(avatar, false);
    this.playerRig.group.position.copy(this.playerPos);
    this.scene.add(this.playerRig.group);

    // Starter Pet
    this.setEquippedPet(this.equippedPetType);

    // Vehicles
    this.world.vehicleSpawns.forEach((sp, i) => {
      this.spawnVehicleAt(sp.type, sp.x, sp.y, sp.z, sp.rotY, sp.color, `veh-${i}`);
    });

    // Build Ghost Preview
    this.ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.45, wireframe: false }),
    );
    this.ghostMesh.visible = false;
    this.scene.add(this.ghostMesh);

    // Friendly AI Citizen Bots
    this.spawnCitizenBots();

    // Pre-warm shaders on hardware GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.startLoop();
  }

  private spawnVehicleAt(
    type: VehicleType,
    x: number,
    y: number,
    z: number,
    rotY = 0,
    color?: string,
    id?: string,
  ) {
    const inst = createVehicleModel(type, color);
    inst.group.position.set(x, y, z);
    inst.group.rotation.y = rotY;
    this.scene.add(inst.group);
    const entity: WorldVehicleEntity = {
      id: id || `veh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type,
      instance: inst,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      rotY,
      speed: 0,
      pitch: 0,
      occupiedByPlayer: false,
    };
    this.vehicles.push(entity);
    return entity;
  }

  public spawnCustomVehicle(type: VehicleType) {
    if (this.activeVehicle) this.exitVehicle();
    const fx = Math.sin(this.playerRotY) * 5;
    const fz = Math.cos(this.playerRotY) * 5;
    const tx = this.playerPos.x + fx;
    const tz = this.playerPos.z + fz;
    const ty = type === 'boat' ? this.world.waterLevel + 0.1 : Math.max(0.15, getTerrainHeight(tx, tz) + 0.2);
    const v = this.spawnVehicleAt(type, tx, ty, tz, this.playerRotY);
    this.enterVehicle(v);
  }

  private spawnCitizenBots() {
    const botConfigs: Array<{ name: string; x: number; z: number; shirt: string; hair: string; skin: string }> = [
      { name: 'SkyBuilder99', x: 12, z: -8, shirt: '#10b981', hair: '#1e293b', skin: '#f5c69d' },
      { name: 'PixelRacer', x: -12, z: 18, shirt: '#f43f5e', hair: '#eab308', skin: '#e0ac69' },
      { name: 'BlockQueen', x: -30, z: -12, shirt: '#a855f7', hair: '#7c2d12', skin: '#8d5524' },
      { name: 'SunnyExplorer', x: 112, z: 18, shirt: '#f59e0b', hair: '#0f172a', skin: '#f1c27d' },
    ];
    botConfigs.forEach((b, i) => {
      const av: AvatarConfig = {
        name: b.name,
        skinColor: b.skin,
        hairStyle: i % 2 === 0 ? 'spiky' : 'ponytail',
        hairColor: b.hair,
        faceExpression: 'happy',
        shirtColor: b.shirt,
        shirtPattern: 'solid',
        pantsColor: '#334155',
        shoesColor: '#ffffff',
        hatType: i === 2 ? 'crown' : i === 0 ? 'cap' : 'none',
        hatColor: '#facc15',
        glassesType: i === 1 ? 'sunglasses' : 'none',
        accessoryType: 'none',
        backpackType: 'none',
        backpackColor: '#38bdf8',
      };
      const rig = createAvatarModel(av, true);
      rig.group.position.set(b.x, 0, b.z);
      this.scene.add(rig.group);
      this.bots.push({
        id: `bot-${i}`,
        name: b.name,
        rig,
        pos: new THREE.Vector3(b.x, 0, b.z),
        rotY: 0,
        target: new THREE.Vector3(b.x + 12, 0, b.z + 10),
        speed: 4.8 + i * 0.4,
        anim: 'walk',
        avatar: av,
        health: 100,
        respawnTimer: 0,
      });
    });
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onContextMenu = (e: Event) => e.preventDefault();
  private onContextLost = (e: Event) => e.preventDefault();

  private onResize = () => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    this.keys[e.code] = true;

    if (e.code === 'Escape') {
      this.callbacks.onEscapePressed();
      return;
    }

    if (this.isMenuPreviewMode) return;

    if (e.code === 'KeyE') {
      this.handleInteract();
    } else if (e.code === 'KeyF') {
      if (this.activeMiniGame === 'battle') {
        this.fireLaserBolt();
      } else {
        this.triggerEmote('dance');
      }
    } else if (e.code === 'KeyC') {
      this.triggerEmote(this.playerEmote === 'sit' ? 'none' : 'sit');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    this.isDraggingCam = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.isDraggingCam) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      const sens = 0.0055 * this.settings.cameraSensitivity;
      this.camYaw -= dx * sens;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * sens, 0.08, 1.32);
    }

    if (this.buildEnabled && !this.isMenuPreviewMode) {
      this.updateBuildGhost(e);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const movedDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    const wasOnCanvas = e.target === this.renderer.domElement;
    this.isDraggingCam = false;

    if (wasOnCanvas && movedDist < 6 && !this.isMenuPreviewMode) {
      if (this.buildEnabled) {
        this.handleBuildClick(e);
      } else if (this.activeMiniGame === 'battle') {
        this.fireLaserBolt();
      }
    }
  };

  private onWheel = (e: WheelEvent) => {
    this.camDistance = THREE.MathUtils.clamp(this.camDistance + e.deltaY * 0.01, 5.5, 28);
  };

  public rotateCameraByDelta(dx: number, dy: number) {
    const sens = 0.006 * this.settings.cameraSensitivity;
    this.camYaw -= dx * sens;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * sens, 0.08, 1.32);
  }

  public setMobileInput(vec: { x: number; y: number }, jump: boolean, sprint: boolean) {
    this.joystickVec = vec;
    this.mobileJump = jump;
    this.mobileSprint = sprint;
  }

  public setMenuPreviewMode(enabled: boolean) {
    this.isMenuPreviewMode = enabled;
  }

  public updateSettings(settings: GameSettings) {
    this.settings = settings;
    soundEngine.enabled = settings.soundEnabled;
    soundEngine.volume = settings.volume;
    if (this.renderer && !this.isSoftwareGl) {
      this.renderer.shadowMap.enabled = settings.graphicsQuality === 'high';
    }
  }

  public updateAvatar(avatar: AvatarConfig) {
    const oldPos = this.playerRig.group.position.clone();
    const oldRot = this.playerRig.group.rotation.y;
    this.scene.remove(this.playerRig.group);
    this.playerRig = createAvatarModel(avatar, false);
    this.playerRig.group.position.copy(oldPos);
    this.playerRig.group.rotation.y = oldRot;
    this.scene.add(this.playerRig.group);
  }

  public setEquippedPet(petType: PetType | null) {
    this.equippedPetType = petType;
    if (this.petInstance) {
      this.scene.remove(this.petInstance.group);
      this.petInstance = null;
    }
    if (petType) {
      this.petInstance = createPetModel(petType);
      this.petPos.set(this.playerPos.x + 1.8, this.playerPos.y + 0.5, this.playerPos.z + 1.5);
      this.petInstance.group.position.copy(this.petPos);
      this.scene.add(this.petInstance.group);
    }
  }

  public triggerEmote(emote: EmoteType) {
    this.playerEmote = emote;
    this.emoteTimer = emote === 'none' || emote === 'sit' ? 999 : 3.5;
    soundEngine.playClick();
  }

  public teleportTo(x: number, y: number, z: number) {
    if (this.activeVehicle) this.exitVehicle();
    this.playerPos.set(x, y, z);
    this.playerVel.set(0, 0, 0);
    this.spawnParticles(x, y + 1, z, '#38bdf8', 14);
    soundEngine.playCheckpoint();
  }

  public setBuildMode(
    enabled: boolean,
    toolMode: BuildToolMode,
    preset: { type: string; category: BlockCategory; color: string; sx: number; sy: number; sz: number },
  ) {
    this.buildEnabled = enabled;
    this.buildToolMode = toolMode;
    this.buildPreset = preset;
    this.ghostMesh.visible = enabled && toolMode === 'place';
  }

  public modifySelectedBlock(action: 'rotate' | 'grow' | 'shrink' | 'recolor' | 'delete', color?: string) {
    if (!this.selectedBlockId) return;
    const ent = this.placedBlocks.get(this.selectedBlockId);
    if (!ent) return;

    if (action === 'delete') {
      this.removePlacedBlock(this.selectedBlockId, false);
      this.selectedBlockId = null;
      this.callbacks.onSelectPlacedBlock(null);
      return;
    }

    if (action === 'rotate') ent.data.rotY += Math.PI / 4;
    if (action === 'grow') {
      ent.data.sx = Math.min(12, ent.data.sx + 0.5);
      ent.data.sy = Math.min(12, ent.data.sy + 0.5);
      ent.data.sz = Math.min(12, ent.data.sz + 0.5);
    }
    if (action === 'shrink') {
      ent.data.sx = Math.max(0.5, ent.data.sx - 0.5);
      ent.data.sy = Math.max(0.5, ent.data.sy - 0.5);
      ent.data.sz = Math.max(0.5, ent.data.sz - 0.5);
    }
    if (action === 'recolor' && color) {
      ent.data.color = color;
    }

    this.applyPlacedBlockTransform(ent);
    this.callbacks.onBlockUpdated({ ...ent.data }, false);
    this.callbacks.onSelectPlacedBlock({ ...ent.data });
    soundEngine.playPlace();
  }

  private applyPlacedBlockTransform(ent: PlacedBlockEntity) {
    const b = ent.data;
    ent.mesh.position.set(b.x, b.y, b.z);
    ent.mesh.rotation.y = b.rotY;
    if (b.category === 'block' || b.category === 'road' || b.category === 'water' || b.category === 'obstacle') {
      ent.mesh.scale.set(b.sx / 2, b.sy / 2, b.sz / 2);
    }
    if (ent.mesh instanceof THREE.Mesh && ent.mesh.material instanceof THREE.MeshStandardMaterial) {
      ent.mesh.material.color.set(b.color);
    }
    if (ent.collider) {
      ent.collider.minX = b.x - b.sx / 2;
      ent.collider.maxX = b.x + b.sx / 2;
      ent.collider.minY = b.y - b.sy / 2;
      ent.collider.maxY = b.y + b.sy / 2;
      ent.collider.minZ = b.z - b.sz / 2;
      ent.collider.maxZ = b.z + b.sz / 2;
    }
  }

  private updateBuildGhost(e: PointerEvent) {
    if (this.buildToolMode !== 'place') {
      this.ghostMesh.visible = false;
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_pointerNdc, this.camera);

    const targets: THREE.Object3D[] = [];
    this.placedBlocks.forEach((v) => targets.push(v.mesh));
    const hits = _raycaster.intersectObjects(targets, true);

    const snap = 2;
    let px = 0;
    let py = this.buildPreset.sy / 2;
    let pz = 0;

    if (hits.length > 0 && hits[0].face) {
      const pt = hits[0].point.clone().addScaledVector(hits[0].face.normal, 0.5);
      px = Math.round(pt.x / snap) * snap;
      py = Math.max(this.buildPreset.sy / 2, Math.round(pt.y / snap) * snap + this.buildPreset.sy / 2);
      pz = Math.round(pt.z / snap) * snap;
    } else {
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      if (_raycaster.ray.intersectPlane(groundPlane, _vec3A)) {
        px = Math.round(_vec3A.x / snap) * snap;
        pz = Math.round(_vec3A.z / snap) * snap;
        py = Math.max(0, getTerrainHeight(px, pz)) + this.buildPreset.sy / 2;
      } else {
        this.ghostMesh.visible = false;
        return;
      }
    }

    this.ghostMesh.visible = true;
    this.ghostMesh.position.set(px, py, pz);
    this.ghostMesh.scale.set(this.buildPreset.sx / 2, this.buildPreset.sy / 2, this.buildPreset.sz / 2);
    (this.ghostMesh.material as THREE.MeshBasicMaterial).color.set(this.buildPreset.color);
  }

  private handleBuildClick(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_pointerNdc, this.camera);

    const blockMeshes: THREE.Object3D[] = [];
    this.placedBlocks.forEach((v) => blockMeshes.push(v.mesh));
    const hits = _raycaster.intersectObjects(blockMeshes, true);

    const findOwnerBlockId = (obj: THREE.Object3D | null): string | null => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (cur.userData.placedBlockId) return cur.userData.placedBlockId;
        cur = cur.parent;
      }
      return null;
    };

    if (this.buildToolMode === 'delete') {
      if (hits.length > 0) {
        const bid = findOwnerBlockId(hits[0].object);
        if (bid) {
          this.removePlacedBlock(bid, false);
          soundEngine.playBreak();
        }
      }
      return;
    }

    if (this.buildToolMode === 'rotate' || this.buildToolMode === 'resize' || this.buildToolMode === 'recolor' || this.buildToolMode === 'move') {
      if (hits.length > 0) {
        const bid = findOwnerBlockId(hits[0].object);
        if (bid) {
          this.selectedBlockId = bid;
          const ent = this.placedBlocks.get(bid);
          if (ent) {
            if (this.buildToolMode === 'rotate') this.modifySelectedBlock('rotate');
            else if (this.buildToolMode === 'resize') this.modifySelectedBlock('grow');
            else if (this.buildToolMode === 'recolor') this.modifySelectedBlock('recolor', this.buildPreset.color);
            else this.callbacks.onSelectPlacedBlock({ ...ent.data });
          }
        }
      } else if (this.buildToolMode === 'move' && this.selectedBlockId) {
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        if (_raycaster.ray.intersectPlane(groundPlane, _vec3A)) {
          const ent = this.placedBlocks.get(this.selectedBlockId);
          if (ent) {
            ent.data.x = Math.round(_vec3A.x / 2) * 2;
            ent.data.z = Math.round(_vec3A.z / 2) * 2;
            this.applyPlacedBlockTransform(ent);
            this.callbacks.onBlockUpdated({ ...ent.data }, false);
            soundEngine.playPlace();
          }
        }
      }
      return;
    }

    // Place mode
    if (!this.ghostMesh.visible) this.updateBuildGhost(e);
    if (this.ghostMesh.visible) {
      const block: PlacedBlock = {
        id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: this.buildPreset.type,
        category: this.buildPreset.category,
        x: this.ghostMesh.position.x,
        y: this.ghostMesh.position.y,
        z: this.ghostMesh.position.z,
        sx: this.buildPreset.sx,
        sy: this.buildPreset.sy,
        sz: this.buildPreset.sz,
        rotY: 0,
        color: this.buildPreset.color,
      };
      this.addPlacedBlock(block, false);
    }
  }

  public addPlacedBlock(block: PlacedBlock, fromRemote = false) {
    if (this.placedBlocks.has(block.id)) return;

    let mesh: THREE.Object3D;
    let collider: ColliderBox | null = null;

    if (block.category === 'tree') {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.BoxGeometry(1, 3, 1),
        new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.85 }),
      );
      trunk.position.y = 0;
      const leaves = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 3.2, 3.2),
        new THREE.MeshStandardMaterial({ color: block.color || '#22c55e', roughness: 0.7 }),
      );
      leaves.position.y = 2.6;
      g.add(trunk, leaves);
      mesh = g;
      collider = {
        id: block.id,
        minX: block.x - 0.7,
        maxX: block.x + 0.7,
        minY: block.y - 1.5,
        maxY: block.y + 4,
        minZ: block.z - 0.7,
        maxZ: block.z + 0.7,
      };
    } else if (block.category === 'building') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(6, 7, 6),
        new THREE.MeshStandardMaterial({ color: block.color, map: this.mats.buildingGlassTexture, roughness: 0.45 }),
      );
      body.position.y = 2.5;
      body.castShadow = true;
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(6.6, 1.0, 6.6),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 }),
      );
      roof.position.y = 6.3;
      g.add(body, roof);
      mesh = g;
      collider = {
        id: block.id,
        minX: block.x - 3,
        maxX: block.x + 3,
        minY: block.y - 1,
        maxY: block.y + 6.8,
        minZ: block.z - 3,
        maxZ: block.z + 3,
      };
    } else if (block.category === 'checkpoint' || block.category === 'spawn') {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 0.35, 16),
        new THREE.MeshStandardMaterial({
          color: block.category === 'spawn' ? '#22c55e' : '#facc15',
          emissive: block.category === 'spawn' ? '#16a34a' : '#eab308',
          emissiveIntensity: 0.6,
        }),
      );
      mesh = m;
    } else {
      const isWater = block.category === 'water';
      const geo =
        block.type === 'cylinder'
          ? new THREE.CylinderGeometry(1, 1, 2, 16)
          : block.type === 'ramp'
            ? new THREE.BoxGeometry(2, 1.2, 2)
            : new THREE.BoxGeometry(2, 2, 2);
      const mat = isWater
        ? this.mats.waterMaterial
        : new THREE.MeshStandardMaterial({
            color: block.color,
            map: block.category === 'road' ? this.mats.roadTexture : this.mats.studTexture,
            roughness: 0.55,
            metalness: 0.08,
          });
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = !isWater;
      m.receiveShadow = true;
      mesh = m;
      if (!isWater) {
        collider = {
          id: block.id,
          minX: block.x - block.sx / 2,
          maxX: block.x + block.sx / 2,
          minY: block.y - block.sy / 2,
          maxY: block.y + block.sy / 2,
          minZ: block.z - block.sz / 2,
          maxZ: block.z + block.sz / 2,
        };
      }
    }

    mesh.userData.placedBlockId = block.id;
    const entity: PlacedBlockEntity = { data: block, mesh, collider };
    this.applyPlacedBlockTransform(entity);
    this.placedBlocks.set(block.id, entity);
    this.scene.add(mesh);
    if (collider) this.world.colliders.push(collider);

    if (!fromRemote) {
      soundEngine.playPlace();
      this.spawnParticles(block.x, block.y, block.z, block.color, 8);
    }
    this.callbacks.onBlockPlaced(block, fromRemote);
  }

  public updatePlacedBlockFromRemote(block: PlacedBlock) {
    const ent = this.placedBlocks.get(block.id);
    if (!ent) {
      this.addPlacedBlock(block, true);
      return;
    }
    ent.data = block;
    this.applyPlacedBlockTransform(ent);
    this.callbacks.onBlockUpdated(block, true);
  }

  public removePlacedBlock(blockId: string, fromRemote = false) {
    const ent = this.placedBlocks.get(blockId);
    if (!ent) return;
    this.scene.remove(ent.mesh);
    if (ent.collider) {
      const idx = this.world.colliders.indexOf(ent.collider);
      if (idx >= 0) this.world.colliders.splice(idx, 1);
    }
    this.placedBlocks.delete(blockId);
    if (!fromRemote) {
      soundEngine.playBreak();
    }
    this.callbacks.onBlockRemoved(blockId, fromRemote);
  }

  public getPlacedBlocks(): PlacedBlock[] {
    return Array.from(this.placedBlocks.values()).map((e) => ({ ...e.data }));
  }

  public loadCustomMapBlocks(blocks: PlacedBlock[]) {
    const existingIds = Array.from(this.placedBlocks.keys());
    existingIds.forEach((id) => this.removePlacedBlock(id, true));
    blocks.forEach((b) => this.addPlacedBlock(b, true));
    soundEngine.playCheckpoint();
  }

  public syncRemotePlayers(players: RemotePlayer[], selfId: string | null) {
    const seen = new Set<string>();
    for (const p of players) {
      if (p.id === selfId) continue;
      seen.add(p.id);
      const existing = this.remoteRigs.get(p.id);
      if (!existing) {
        const av: AvatarConfig = {
          name: p.name,
          skinColor: p.avatar?.skinColor || '#f5c69d',
          hairStyle: p.avatar?.hairStyle || 'spiky',
          hairColor: p.avatar?.hairColor || '#1e293b',
          faceExpression: p.avatar?.faceExpression || 'happy',
          shirtColor: p.avatar?.shirtColor || '#38bdf8',
          shirtPattern: p.avatar?.shirtPattern || 'solid',
          pantsColor: p.avatar?.pantsColor || '#1e293b',
          shoesColor: p.avatar?.shoesColor || '#ef4444',
          hatType: p.avatar?.hatType || 'none',
          hatColor: p.avatar?.hatColor || '#facc15',
          glassesType: p.avatar?.glassesType || 'none',
          accessoryType: p.avatar?.accessoryType || 'none',
          backpackType: p.avatar?.backpackType || 'none',
          backpackColor: p.avatar?.backpackColor || '#0ea5e9',
        };
        const rig = createAvatarModel(av, true);
        rig.group.position.set(p.x, p.y, p.z);
        this.scene.add(rig.group);
        this.remoteRigs.set(p.id, {
          rig,
          targetPos: new THREE.Vector3(p.x, p.y, p.z),
          targetRotY: p.rotY,
          anim: p.anim || 'idle',
          emote: p.emote || 'none',
        });
      } else {
        existing.targetPos.set(p.x, p.y, p.z);
        existing.targetRotY = p.rotY;
        existing.anim = p.anim || 'idle';
        existing.emote = p.emote || 'none';
      }
    }

    // Remove disconnected players
    for (const [id, ent] of this.remoteRigs.entries()) {
      if (!seen.has(id)) {
        this.scene.remove(ent.rig.group);
        this.remoteRigs.delete(id);
      }
    }
  }

  public startMiniGame(gameId: MiniGameId) {
    this.cleanupMiniGameObjects();
    this.activeMiniGame = gameId;
    this.miniGameScore = 0;

    if (gameId === 'none') {
      this.miniGameStatus = '';
      return;
    }

    if (gameId === 'obby') {
      this.obbyCheckpointIdx = 0;
      this.miniGameTimer = 0;
      const start = this.world.obbyCheckpoints[0];
      this.teleportTo(start.x, start.y + 1, start.z);
      this.miniGameStatus = 'Jump to the top of Sky Obby Tower!';
    } else if (gameId === 'racing') {
      this.raceCheckpointIdx = 1;
      this.raceLap = 1;
      this.miniGameTimer = 0;
      this.teleportTo(0, 0.5, 86);
      const car = this.spawnVehicleAt('sports', 0, 0.3, 86, Math.PI / 2, '#ef4444');
      this.enterVehicle(car);
      // Spawn 3 AI Race Cars
      const aiColors = ['#3b82f6', '#22c55e', '#facc15'];
      aiColors.forEach((c, idx) => {
        const ai = createVehicleModel('sports', c);
        ai.group.position.set(-4 - idx * 3, 0.3, 82 + idx * 4);
        this.scene.add(ai.group);
        this.raceBots.push({
          mesh: ai.group,
          cpIdx: 1,
          lap: 1,
          progress: 0,
          speed: 25 + idx * 2.2,
        });
      });
      this.miniGameStatus = 'Race 3 laps through all checkpoints!';
    } else if (gameId === 'survival') {
      this.miniGameTimer = 45;
      this.survivalWaveTimer = 0;
      this.resetSurvivalTiles();
      this.teleportTo(-58, 6.2, 32);
      this.miniGameStatus = 'Stay on the cyan tiles before they fall!';
    } else if (gameId === 'hideseek') {
      this.hideSeekRole = Math.random() > 0.35 ? 'seeker' : 'hider';
      this.hideSeekPhase = 'hide';
      this.hideSeekCaught = 0;
      this.miniGameTimer = 8;
      if (this.hideSeekRole === 'seeker') {
        this.teleportTo(-54, 1.5, -52);
        this.miniGameStatus = 'WAIT! Hiders are hiding in the maze...';
      } else {
        this.teleportTo(-54, 1.5, -72);
        this.miniGameStatus = 'HIDE in the Hedge Maze before Seeker enters!';
      }
      // Position bots in maze
      this.bots.forEach((b, i) => {
        b.pos.set(-62 + i * 6, 0, -76 + (i % 2) * 8);
      });
    } else if (gameId === 'tycoon') {
      this.miniGameTimer = 0;
      this.tycoonAccum = 0;
      this.teleportTo(42, 1.5, 11);
      this.miniGameStatus = 'Step on glowing pads to build your BlockMart Tycoon!';
    } else if (gameId === 'battle') {
      this.miniGameTimer = 45;
      this.playerHealth = 100;
      this.callbacks.onHealthChange(100);
      this.teleportTo(56, 1.5, 66);
      this.bots.forEach((b, i) => {
        b.pos.set(46 + (i % 2) * 18, 0, 56 + Math.floor(i / 2) * 18);
        b.health = 100;
        b.respawnTimer = 0;
      });
      this.miniGameStatus = 'Click or press F to tag rivals in the Arena!';
    } else if (gameId === 'petadventure') {
      this.miniGameTimer = 45;
      this.teleportTo(-24, 1.5, 66);
      for (let i = 0; i < 10; i++) {
        const orb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.65, 0),
          new THREE.MeshStandardMaterial({ color: '#f472b6', emissive: '#db2777', emissiveIntensity: 0.7 }),
        );
        const angle = (i / 10) * Math.PI * 2;
        const r = 6 + (i % 3) * 3.5;
        orb.position.set(-24 + Math.cos(angle) * r, 1.5, 66 + Math.sin(angle) * r);
        this.scene.add(orb);
        this.petOrbs.push(orb);
      }
      this.miniGameStatus = 'Collect 10 Pet Adventure Orbs with your pet!';
    }
    soundEngine.playCheckpoint();
  }

  private resetSurvivalTiles() {
    this.world.survivalTiles.forEach((t) => {
      t.state = 'idle';
      t.timer = 0;
      t.mesh.position.y = t.baseY;
      t.mesh.visible = true;
      (t.mesh.material as THREE.MeshStandardMaterial).color.set('#22d3ee');
      t.collider.minY = t.baseY - 0.32;
      t.collider.maxY = t.baseY + 0.32;
    });
  }

  private cleanupMiniGameObjects() {
    this.raceBots.forEach((b) => this.scene.remove(b.mesh));
    this.raceBots = [];
    this.petOrbs.forEach((o) => this.scene.remove(o));
    this.petOrbs = [];
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.projectiles = [];
    this.resetSurvivalTiles();
  }

  private handleInteract() {
    if (this.activeVehicle) {
      this.exitVehicle();
      return;
    }

    // Check nearby vehicle
    let closestVeh: WorldVehicleEntity | null = null;
    let closestDist = 5.0;
    for (const v of this.vehicles) {
      const d = v.pos.distanceTo(this.playerPos);
      if (d < closestDist) {
        closestDist = d;
        closestVeh = v;
      }
    }
    if (closestVeh) {
      this.enterVehicle(closestVeh);
      return;
    }

    // Hide & Seek tag check
    if (this.activeMiniGame === 'hideseek' && this.hideSeekRole === 'seeker' && this.hideSeekPhase === 'seek') {
      for (const b of this.bots) {
        if (b.pos.distanceTo(this.playerPos) < 4.5 && b.respawnTimer <= 0) {
          b.respawnTimer = 99;
          this.hideSeekCaught++;
          this.miniGameScore += 50;
          soundEngine.playTag();
          this.spawnParticles(b.pos.x, b.pos.y + 1, b.pos.z, '#facc15', 14);
          if (this.hideSeekCaught >= 3) {
            this.finishMiniGame('hideseek', 180, 140, 'Found all hidden players!');
          }
          return;
        }
      }
    }

    // Secret crystal interaction
    if (this.playerPos.distanceTo(this.world.secretCrystal.position) < 5.5) {
      this.callbacks.onCoinCollected(50, 'Secret Crystal Bonus!');
      this.spawnParticles(84, 2.5, -74, '#c084fc', 18);
      soundEngine.playWin();
      return;
    }

    // Tycoon pad interaction
    this.checkTycoonPads(true);
  }

  private enterVehicle(v: WorldVehicleEntity) {
    this.activeVehicle = v;
    v.occupiedByPlayer = true;
    this.playerEmote = 'none';
    soundEngine.playClick();
  }

  private exitVehicle() {
    if (!this.activeVehicle) return;
    const v = this.activeVehicle;
    v.occupiedByPlayer = false;
    v.speed = 0;
    this.playerPos.set(v.pos.x + 2.4, Math.max(0.5, v.pos.y + 0.5), v.pos.z);
    this.playerVel.set(0, 0, 0);
    this.activeVehicle = null;
    soundEngine.playClick();
  }

  private fireLaserBolt() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.9),
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0ea5e9', emissiveIntensity: 1.0 }),
    );
    const dir = new THREE.Vector3(Math.sin(this.playerRotY), 0, Math.cos(this.playerRotY)).normalize();
    mesh.position.set(this.playerPos.x + dir.x * 1.2, this.playerPos.y + 1.4, this.playerPos.z + dir.z * 1.2);
    mesh.rotation.y = this.playerRotY;
    this.scene.add(mesh);
    this.projectiles.push({ mesh, vel: dir.multiplyScalar(38), life: 1.4, fromPlayer: true });
    soundEngine.playTag();
  }

  private spawnParticles(x: number, y: number, z: number, color: string, count = 10) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        this.particleGeo,
        new THREE.MeshBasicMaterial({ color }),
      );
      m.position.set(x, y, z);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * 9, 3 + Math.random() * 6, (Math.random() - 0.5) * 9),
        life: 0.55 + Math.random() * 0.35,
      });
    }
  }

  private finishMiniGame(gameId: MiniGameId, coins: number, xp: number, summary: string) {
    soundEngine.playWin();
    this.spawnParticles(this.playerPos.x, this.playerPos.y + 2, this.playerPos.z, '#facc15', 22);
    this.activeMiniGame = 'none';
    this.cleanupMiniGameObjects();
    this.callbacks.onMiniGameComplete(gameId, coins, xp, summary);
  }

  private checkTycoonPads(manual = false) {
    for (const st of this.world.tycoonStages) {
      if (st.built) continue;
      if (this.playerPos.distanceTo(st.padPos) < 2.8 || (manual && this.playerPos.distanceTo(st.padPos) < 4.5)) {
        if (this.tycoonCash >= st.cost) {
          this.tycoonCash -= st.cost;
          st.built = true;
          st.structureGroup.visible = true;
          st.padMesh.visible = false;
          this.miniGameScore += 100;
          soundEngine.playWin();
          this.spawnParticles(st.padPos.x, 2, st.padPos.z, '#22c55e', 16);
          if (this.world.tycoonStages.every((s) => s.built)) {
            this.callbacks.onMiniGameComplete('tycoon', 300, 220, 'Completed all 5 BlockMart Tycoon upgrades!');
          }
        }
      }
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const rawDelta = this.clock.getDelta();
      const dt = Math.min(0.05, Math.max(0.001, rawDelta));
      const elapsed = this.clock.elapsedTime;

      this.updateSimulation(dt, elapsed);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };
    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSimulation(dt: number, elapsed: number) {
    // Animate world props & water shader
    if (this.mats.waterMaterial.userData.uTime) {
      this.mats.waterMaterial.userData.uTime.value = elapsed;
    }
    this.world.windmillBlade.rotation.z += dt * 1.1;
    this.world.fountainJet.scale.y = 0.85 + Math.sin(elapsed * 5) * 0.22;
    this.world.secretCrystal.rotation.y += dt * 1.5;
    this.world.secretCrystal.position.y = 2.4 + Math.sin(elapsed * 2.5) * 0.25;

    // Obby sweepers rotation
    for (const sw of this.world.obbySweepers) {
      sw.mesh.rotation.y += dt * sw.speed;
      if (this.activeMiniGame === 'obby') {
        const dx = this.playerPos.x - sw.cx;
        const dz = this.playerPos.z - sw.cz;
        if (Math.abs(this.playerPos.y - sw.cy) < 1.3 && Math.hypot(dx, dz) < 2.2) {
          const cp = this.world.obbyCheckpoints[this.obbyCheckpointIdx];
          this.playerPos.set(cp.x, cp.y + 1, cp.z);
          this.playerVel.set(0, 0, 0);
          soundEngine.playTag();
        }
      }
    }

    if (this.isMenuPreviewMode) {
      // Cinematic orbit over Skyline City when main menu is open
      const angle = elapsed * 0.14;
      this.camera.position.set(Math.cos(angle) * 46, 24, Math.sin(angle) * 46);
      this.camera.lookAt(0, 5, 0);
      animateAvatarModel(this.playerRig, 'idle', 'none', elapsed);
      return;
    }

    // Update Player or Vehicle
    if (this.activeVehicle) {
      this.updateVehiclePhysics(dt, elapsed);
    } else {
      this.updatePlayerPhysics(dt, elapsed);
    }

    // Keep sun shadow frustum centered near player
    this.sunLight.position.set(this.playerPos.x + 42, 72, this.playerPos.z + 36);
    this.sunLight.target.position.set(this.playerPos.x, 0, this.playerPos.z);

    // Update Pet follower
    this.updatePet(dt, elapsed);

    // Update Coins
    for (const c of this.world.coins) {
      c.mesh.rotation.y += dt * 2.5;
      if (c.mesh.visible) {
        if (this.playerPos.distanceTo(c.mesh.position) < 2.1) {
          c.mesh.visible = false;
          c.collectedAt = elapsed;
          soundEngine.playCoin();
          this.spawnParticles(c.x, c.y, c.z, '#facc15', 10);
          this.callbacks.onCoinCollected(c.value, 'World Coin Collected');
        }
      } else if (elapsed - c.collectedAt > 25) {
        c.mesh.visible = true;
      }
    }

    // Update Bots & Remote Players
    this.updateBots(dt, elapsed);
    this.updateRemotePlayers(dt, elapsed);

    // Update Mini-Games
    this.updateMiniGames(dt, elapsed);

    // Update Particles & Projectiles
    this.updateParticlesAndProjectiles(dt);

    // Smooth 3rd-person Camera Follow
    this.updateCamera(dt);

    // Zone Discovery & HUD Snapshot (10Hz)
    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.emitHudSnapshot();
    }

    // Network State Broadcast (15Hz)
    this.broadcastTimer += dt;
    if (this.broadcastTimer >= 0.066) {
      this.broadcastTimer = 0;
      this.callbacks.onPlayerStateBroadcast({
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        rotY: this.playerRotY,
        anim: this.playerAnim,
        emote: this.playerEmote,
        vehicle: this.activeVehicle ? this.activeVehicle.type : null,
        score: this.miniGameScore,
      });
    }
  }

  private updatePlayerPhysics(dt: number, elapsed: number) {
    // Emote timer
    if (this.playerEmote !== 'none' && this.playerEmote !== 'sit') {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.playerEmote = 'none';
    }

    // Input direction
    let moveX = this.joystickVec.x;
    let moveZ = this.joystickVec.y;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;

    const len = Math.hypot(moveX, moveZ);
    if (len > 1) {
      moveX /= len;
      moveZ /= len;
    }

    if (len > 0.12 && (this.playerEmote === 'sit' || this.playerEmote === 'dance')) {
      this.playerEmote = 'none';
    }

    const sprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.mobileSprint);
    const inWater = this.playerPos.y < this.world.waterLevel - 0.15;
    const targetSpeed = inWater ? 6.5 : sprinting ? 14.5 : 8.5;

    // Camera-relative horizontal vector
    _camForward.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)).normalize();
    _camRight.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)).normalize();

    _vec3A.set(0, 0, 0);
    _vec3A.addScaledVector(_camForward, -moveZ);
    _vec3A.addScaledVector(_camRight, moveX);

    if (_vec3A.lengthSq() > 0.001) {
      _vec3A.normalize();
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, _vec3A.x * targetSpeed, 14, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, _vec3A.z * targetSpeed, 14, dt);
      const targetAngle = Math.atan2(_vec3A.x, _vec3A.z);
      // Smooth angle wrap
      let diff = targetAngle - this.playerRotY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerRotY += diff * Math.min(1, dt * 14);
    } else {
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, 14, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, 14, dt);
    }

    // Gravity & Jump
    const jumpPressed = Boolean(this.keys['Space'] || this.mobileJump);
    if (inWater) {
      this.playerVel.y = jumpPressed ? 4.8 : THREE.MathUtils.damp(this.playerVel.y, (this.world.waterLevel - 0.55 - this.playerPos.y) * 5, 5, dt);
    } else {
      this.playerVel.y -= 28 * dt;
      if (this.onGround) this.coyoteTimer = 0.12;
      else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

      if (jumpPressed && this.coyoteTimer > 0) {
        this.playerVel.y = 12.2;
        this.onGround = false;
        this.coyoteTimer = 0;
        soundEngine.playJump();
        this.spawnParticles(this.playerPos.x, this.playerPos.y, this.playerPos.z, '#e2e8f0', 5);
      }
    }

    // Swept AABB Collision Resolution (X, Z, then Y)
    const halfW = 0.52;
    const height = 2.4;

    this.playerPos.x += this.playerVel.x * dt;
    this.resolveHorizontalCollisions(halfW, height, 'x');

    this.playerPos.z += this.playerVel.z * dt;
    this.resolveHorizontalCollisions(halfW, height, 'z');

    // Clamp world boundary
    this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -165, 165);
    this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -165, 165);

    this.playerPos.y += this.playerVel.y * dt;
    this.onGround = false;

    const terrainY = getTerrainHeight(this.playerPos.x, this.playerPos.z);
    if (this.playerPos.y <= terrainY) {
      this.playerPos.y = terrainY;
      if (this.playerVel.y < 0) this.playerVel.y = 0;
      this.onGround = true;
    }

    // Vertical collider check
    for (const c of this.world.colliders) {
      if (
        this.playerPos.x + halfW > c.minX &&
        this.playerPos.x - halfW < c.maxX &&
        this.playerPos.z + halfW > c.minZ &&
        this.playerPos.z - halfW < c.maxZ
      ) {
        if (this.playerPos.y <= c.maxY && this.playerPos.y >= c.maxY - 1.15 && this.playerVel.y <= 0) {
          this.playerPos.y = c.maxY;
          this.playerVel.y = 0;
          this.onGround = true;
        } else if (this.playerPos.y + height > c.minY && this.playerPos.y < c.minY && this.playerVel.y > 0) {
          this.playerPos.y = c.minY - height;
          this.playerVel.y = 0;
        }
      }
    }

    // Determine Animation State
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (inWater) this.playerAnim = 'swim';
    else if (!this.onGround) this.playerAnim = this.playerVel.y > 0.5 ? 'jump' : 'fall';
    else if (horizSpeed > 10.5) this.playerAnim = 'run';
    else if (horizSpeed > 0.8) this.playerAnim = 'walk';
    else this.playerAnim = 'idle';

    this.playerRig.group.position.copy(this.playerPos);
    this.playerRig.group.rotation.y = this.playerRotY;
    animateAvatarModel(this.playerRig, this.playerAnim, this.playerEmote, elapsed);
  }

  private resolveHorizontalCollisions(halfW: number, height: number, axis: 'x' | 'z') {
    for (const c of this.world.colliders) {
      if (this.playerPos.y + height <= c.minY + 0.05 || this.playerPos.y >= c.maxY - 0.05) continue;
      // Auto step-up for low curbs/ramps <= 0.65m
      if (c.maxY - this.playerPos.y <= 0.65) {
        if (
          this.playerPos.x + halfW > c.minX &&
          this.playerPos.x - halfW < c.maxX &&
          this.playerPos.z + halfW > c.minZ &&
          this.playerPos.z - halfW < c.maxZ
        ) {
          this.playerPos.y = c.maxY;
          continue;
        }
      }
      if (
        this.playerPos.x + halfW > c.minX &&
        this.playerPos.x - halfW < c.maxX &&
        this.playerPos.z + halfW > c.minZ &&
        this.playerPos.z - halfW < c.maxZ
      ) {
        if (axis === 'x') {
          if (this.playerVel.x > 0) this.playerPos.x = c.minX - halfW;
          else if (this.playerVel.x < 0) this.playerPos.x = c.maxX + halfW;
          this.playerVel.x = 0;
        } else {
          if (this.playerVel.z > 0) this.playerPos.z = c.minZ - halfW;
          else if (this.playerVel.z < 0) this.playerPos.z = c.maxZ + halfW;
          this.playerVel.z = 0;
        }
      }
    }
  }

  private updateVehiclePhysics(dt: number, elapsed: number) {
    const v = this.activeVehicle!;
    let throttle = -this.joystickVec.y;
    let steer = -this.joystickVec.x;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) throttle -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer += 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) steer -= 1;

    const maxSpeedMap: Record<VehicleType, number> = {
      sedan: 28,
      sports: 40,
      motorcycle: 34,
      bus: 22,
      truck: 24,
      boat: 30,
      airplane: 46,
    };
    const maxSpd = maxSpeedMap[v.type];
    const accel = v.type === 'sports' ? 28 : 19;

    if (Math.abs(throttle) > 0.05) {
      v.speed = THREE.MathUtils.clamp(v.speed + throttle * accel * dt, -maxSpd * 0.45, maxSpd);
    } else {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 2.8, dt);
    }

    const turnRate = v.type === 'motorcycle' ? 2.6 : v.type === 'bus' ? 1.5 : 2.1;
    if (Math.abs(v.speed) > 0.8) {
      const dirSign = v.speed >= 0 ? 1 : -1;
      v.rotY += steer * turnRate * dirSign * dt;
    }

    const fx = Math.sin(v.rotY);
    const fz = Math.cos(v.rotY);
    v.pos.x = THREE.MathUtils.clamp(v.pos.x + fx * v.speed * dt, -162, 162);
    v.pos.z = THREE.MathUtils.clamp(v.pos.z + fz * v.speed * dt, -162, 162);

    if (v.type === 'airplane') {
      const climb = this.keys['Space'] || this.mobileJump ? 1 : this.keys['ShiftLeft'] ? -1 : 0;
      const groundY = Math.max(0.1, getTerrainHeight(v.pos.x, v.pos.z));
      if (v.speed > 16 && climb > 0) {
        v.pos.y = Math.min(58, v.pos.y + 14 * dt);
        v.pitch = THREE.MathUtils.damp(v.pitch, -0.25, 5, dt);
      } else if (v.pos.y > groundY + 0.25) {
        const descent = climb < 0 ? -15 : v.speed < 12 ? -10 : -1.5;
        v.pos.y = Math.max(groundY + 0.1, v.pos.y + descent * dt);
        v.pitch = THREE.MathUtils.damp(v.pitch, climb < 0 ? 0.22 : 0.04, 5, dt);
      } else {
        v.pos.y = groundY + 0.1;
        v.pitch = THREE.MathUtils.damp(v.pitch, 0, 6, dt);
      }
      if (v.instance.propeller) {
        v.instance.propeller.rotation.z += dt * (8 + Math.abs(v.speed) * 0.9);
      }
    } else if (v.type === 'boat') {
      v.pos.y = this.world.waterLevel + 0.12 + Math.sin(elapsed * 3) * 0.06;
    } else {
      // Check bridge surface height too
      let surfaceY = getTerrainHeight(v.pos.x, v.pos.z);
      for (const c of this.world.colliders) {
        if (
          (c.tag === 'bridge' || c.tag === 'ramp') &&
          v.pos.x > c.minX &&
          v.pos.x < c.maxX &&
          v.pos.z > c.minZ &&
          v.pos.z < c.maxZ
        ) {
          surfaceY = Math.max(surfaceY, c.maxY);
        }
      }
      v.pos.y = Math.max(this.world.waterLevel + 0.2, surfaceY + 0.05);
    }

    // Rotate wheels
    v.instance.wheels.forEach((w) => {
      w.rotation.x += v.speed * dt * 1.4;
    });

    v.instance.group.position.copy(v.pos);
    v.instance.group.rotation.set(v.pitch, v.rotY, 0);

    // Keep player seated inside vehicle
    this.playerPos.copy(v.pos).add(v.instance.seatOffset);
    this.playerRotY = v.rotY;
    this.playerAnim = 'drive';
    this.playerRig.group.position.copy(this.playerPos);
    this.playerRig.group.rotation.y = this.playerRotY;
    animateAvatarModel(this.playerRig, 'drive', 'none', elapsed);

    // Smoothly align camera behind vehicle
    let yawDiff = (v.rotY + Math.PI) - this.camYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    if (!this.isDraggingCam && Math.abs(v.speed) > 2) {
      this.camYaw += yawDiff * dt * 1.8;
    }
  }

  private updatePet(dt: number, elapsed: number) {
    if (!this.petInstance) return;
    _vec3A.set(
      this.playerPos.x - Math.sin(this.playerRotY) * 1.9 + Math.cos(this.playerRotY) * 1.3,
      this.playerPos.y,
      this.playerPos.z - Math.cos(this.playerRotY) * 1.9 - Math.sin(this.playerRotY) * 1.3,
    );
    const dist = this.petPos.distanceTo(_vec3A);
    this.petPos.lerp(_vec3A, Math.min(1, dt * 6));
    this.petInstance.group.position.copy(this.petPos);
    if (dist > 0.4) {
      const lookYaw = Math.atan2(_vec3A.x - this.petPos.x, _vec3A.z - this.petPos.z);
      this.petInstance.group.rotation.y = lookYaw;
    }
    animatePetModel(this.petInstance, elapsed, dist > 0.35);
  }

  private updateBots(dt: number, elapsed: number) {
    for (const b of this.bots) {
      if (b.respawnTimer > 0) {
        b.respawnTimer -= dt;
        b.rig.group.visible = false;
        continue;
      }
      b.rig.group.visible = true;

      if (this.activeMiniGame === 'battle') {
        b.target.copy(this.playerPos);
      } else if (this.activeMiniGame === 'hideseek' && this.hideSeekRole === 'hider' && this.bots[0] === b) {
        b.target.copy(this.playerPos);
      } else if (b.pos.distanceTo(b.target) < 2.0) {
        b.target.set(
          THREE.MathUtils.clamp(b.pos.x + (Math.random() - 0.5) * 32, -95, 95),
          0,
          THREE.MathUtils.clamp(b.pos.z + (Math.random() - 0.5) * 32, -95, 95),
        );
      }

      _vec3A.subVectors(b.target, b.pos);
      _vec3A.y = 0;
      if (_vec3A.lengthSq() > 0.4) {
        _vec3A.normalize();
        b.pos.addScaledVector(_vec3A, b.speed * dt);
        b.pos.y = Math.max(0, getTerrainHeight(b.pos.x, b.pos.z));
        b.rotY = Math.atan2(_vec3A.x, _vec3A.z);
        b.anim = 'walk';
      } else {
        b.anim = 'idle';
      }
      b.rig.group.position.copy(b.pos);
      b.rig.group.rotation.y = b.rotY;
      animateAvatarModel(b.rig, b.anim, 'none', elapsed);
    }
  }

  private updateRemotePlayers(dt: number, elapsed: number) {
    this.remoteRigs.forEach((ent) => {
      ent.rig.group.position.lerp(ent.targetPos, Math.min(1, dt * 12));
      ent.rig.group.rotation.y = ent.targetRotY;
      animateAvatarModel(ent.rig, ent.anim, ent.emote, elapsed);
    });
  }

  private updateMiniGames(dt: number, elapsed: number) {
    if (this.activeMiniGame === 'none') return;

    if (this.activeMiniGame === 'obby') {
      this.miniGameTimer += dt;
      const nextCpIdx = this.obbyCheckpointIdx + 1;
      if (nextCpIdx < this.world.obbyCheckpoints.length) {
        const nextCp = this.world.obbyCheckpoints[nextCpIdx];
        if (this.playerPos.distanceTo(nextCp) < 3.2) {
          this.obbyCheckpointIdx = nextCpIdx;
          this.miniGameScore += 100;
          soundEngine.playCheckpoint();
          this.spawnParticles(nextCp.x, nextCp.y + 1, nextCp.z, '#fde047', 14);
          if (nextCpIdx === this.world.obbyCheckpoints.length - 1) {
            this.finishMiniGame('obby', 200, 150, `Cleared Sky Obby in ${this.miniGameTimer.toFixed(1)}s!`);
            return;
          }
        }
      }
      // Respawn at last checkpoint if fell
      if (this.playerPos.y < 0.2 && this.obbyCheckpointIdx > 0) {
        const cp = this.world.obbyCheckpoints[this.obbyCheckpointIdx];
        this.teleportTo(cp.x, cp.y + 1, cp.z);
      }
      this.miniGameStatus = `Checkpoint ${this.obbyCheckpointIdx}/${this.world.obbyCheckpoints.length - 1} · ${this.miniGameTimer.toFixed(1)}s`;
    } else if (this.activeMiniGame === 'racing') {
      this.miniGameTimer += dt;
      const cps = this.world.raceCheckpoints;
      const targetCp = cps[this.raceCheckpointIdx];
      if (this.playerPos.distanceTo(targetCp) < 11) {
        this.raceCheckpointIdx = (this.raceCheckpointIdx + 1) % cps.length;
        this.miniGameScore += 50;
        soundEngine.playCheckpoint();
        if (this.raceCheckpointIdx === 1) {
          this.raceLap++;
          if (this.raceLap > 3) {
            this.finishMiniGame('racing', 250, 180, `Finished Grand Prix in ${this.miniGameTimer.toFixed(1)}s!`);
            return;
          }
        }
      }

      // Move AI Race Bots
      this.raceBots.forEach((rb) => {
        const tgt = cps[rb.cpIdx];
        _vec3A.subVectors(tgt, rb.mesh.position);
        _vec3A.y = 0;
        if (_vec3A.length() < 6) {
          rb.cpIdx = (rb.cpIdx + 1) % cps.length;
          if (rb.cpIdx === 1) rb.lap++;
        } else {
          _vec3A.normalize();
          rb.mesh.position.addScaledVector(_vec3A, rb.speed * dt);
          rb.mesh.rotation.y = Math.atan2(_vec3A.x, _vec3A.z);
        }
        rb.progress = rb.lap * 100 + rb.cpIdx;
      });
      this.miniGameStatus = `Lap ${this.raceLap}/3 · CP ${this.raceCheckpointIdx}/${cps.length} · ${this.miniGameTimer.toFixed(1)}s`;
    } else if (this.activeMiniGame === 'survival') {
      this.miniGameTimer -= dt;
      this.survivalWaveTimer += dt;
      if (this.survivalWaveTimer >= 1.2) {
        this.survivalWaveTimer = 0;
        const idleTiles = this.world.survivalTiles.filter((t) => t.state === 'idle');
        for (let k = 0; k < 3 && idleTiles.length > 0; k++) {
          const pick = idleTiles.splice(Math.floor(Math.random() * idleTiles.length), 1)[0];
          pick.state = 'warning';
          pick.timer = 1.1;
          (pick.mesh.material as THREE.MeshStandardMaterial).color.set('#f59e0b');
        }
      }
      for (const t of this.world.survivalTiles) {
        if (t.state === 'warning') {
          t.timer -= dt;
          if (t.timer <= 0) {
            t.state = 'fallen';
            t.timer = 3.2;
            t.mesh.visible = false;
            t.collider.minY = -50;
            t.collider.maxY = -49;
          }
        } else if (t.state === 'fallen') {
          t.timer -= dt;
          if (t.timer <= 0) {
            t.state = 'idle';
            t.mesh.visible = true;
            (t.mesh.material as THREE.MeshStandardMaterial).color.set('#22d3ee');
            t.collider.minY = t.baseY - 0.32;
            t.collider.maxY = t.baseY + 0.32;
          }
        }
      }
      this.miniGameScore = Math.floor((45 - Math.max(0, this.miniGameTimer)) * 10);
      if (this.playerPos.y < 1.2) {
        this.finishMiniGame('survival', 60, 50, 'Fell into the pit! Try jumping sooner.');
        return;
      }
      if (this.miniGameTimer <= 0) {
        this.finishMiniGame('survival', 220, 160, 'Survived all falling tile waves!');
        return;
      }
      this.miniGameStatus = `Survive ${Math.ceil(this.miniGameTimer)}s remaining`;
    } else if (this.activeMiniGame === 'hideseek') {
      this.miniGameTimer -= dt;
      if (this.hideSeekPhase === 'hide' && this.miniGameTimer <= 0) {
        this.hideSeekPhase = 'seek';
        this.miniGameTimer = 35;
        soundEngine.playCheckpoint();
        if (this.hideSeekRole === 'seeker') {
          this.teleportTo(-54, 1.5, -72);
          this.miniGameStatus = 'SEEK! Press E near hidden players to tag them!';
        } else {
          this.miniGameStatus = 'STAY HIDDEN! Keep away from the Seeker!';
        }
      } else if (this.hideSeekPhase === 'seek') {
        if (this.hideSeekRole === 'hider' && this.bots[0].pos.distanceTo(this.playerPos) < 3.0) {
          this.finishMiniGame('hideseek', 50, 40, 'Caught by the Seeker!');
          return;
        }
        if (this.miniGameTimer <= 0) {
          const won = this.hideSeekRole === 'hider' || this.hideSeekCaught > 0;
          this.finishMiniGame('hideseek', won ? 190 : 70, 120, this.hideSeekRole === 'hider' ? 'You stayed hidden!' : `Tagged ${this.hideSeekCaught} hiders!`);
          return;
        }
      }
    } else if (this.activeMiniGame === 'tycoon') {
      const income = this.world.tycoonStages.reduce((sum, s) => sum + (s.built ? s.incomePerSec : 0), 0);
      this.tycoonAccum += income * dt;
      if (this.tycoonAccum >= 1) {
        const whole = Math.floor(this.tycoonAccum);
        this.tycoonCash += whole;
        this.tycoonAccum -= whole;
      }
      this.checkTycoonPads(false);
      this.miniGameStatus = `Tycoon Cash: $${this.tycoonCash} (+$${income}/s)`;
    } else if (this.activeMiniGame === 'battle') {
      this.miniGameTimer -= dt;
      if (this.miniGameTimer <= 0) {
        this.finishMiniGame('battle', 140 + this.miniGameScore, 140, `Battle finished with ${this.miniGameScore} pts!`);
        return;
      }
      this.miniGameStatus = `Score: ${this.miniGameScore} · Time: ${Math.ceil(this.miniGameTimer)}s`;
    } else if (this.activeMiniGame === 'petadventure') {
      this.miniGameTimer -= dt;
      for (let i = this.petOrbs.length - 1; i >= 0; i--) {
        const orb = this.petOrbs[i];
        orb.rotation.y += dt * 3;
        orb.position.y = 1.4 + Math.sin(elapsed * 4 + i) * 0.25;
        if (this.playerPos.distanceTo(orb.position) < 2.2 || this.petPos.distanceTo(orb.position) < 2.2) {
          this.scene.remove(orb);
          this.petOrbs.splice(i, 1);
          this.miniGameScore += 25;
          soundEngine.playPet();
          this.spawnParticles(orb.position.x, orb.position.y, orb.position.z, '#f472b6', 10);
        }
      }
      if (this.petOrbs.length === 0) {
        this.finishMiniGame('petadventure', 210, 170, 'Collected all 10 Pet Orbs!');
        return;
      }
      if (this.miniGameTimer <= 0) {
        this.finishMiniGame('petadventure', 80 + this.miniGameScore / 2, 80, `Collected ${10 - this.petOrbs.length}/10 Pet Orbs!`);
      }
      this.miniGameStatus = `Orbs left: ${this.petOrbs.length} · ${Math.ceil(this.miniGameTimer)}s`;
    }
  }

  private updateParticlesAndProjectiles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 18 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 6;
      p.mesh.scale.setScalar(Math.max(0.01, p.life * 1.4));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      if (pr.fromPlayer && this.activeMiniGame === 'battle') {
        for (const b of this.bots) {
          if (b.respawnTimer <= 0 && pr.mesh.position.distanceTo(b.pos.clone().add(_vec3B.set(0, 1.3, 0))) < 1.6) {
            b.respawnTimer = 3.0;
            this.miniGameScore += 25;
            this.spawnParticles(b.pos.x, b.pos.y + 1.4, b.pos.z, '#38bdf8', 14);
            soundEngine.playCoin();
            pr.life = 0;
            break;
          }
        }
      }
      if (pr.life <= 0) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number) {
    const targetFov = this.activeVehicle ? 68 : this.keys['ShiftLeft'] ? 65 : 60;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }

    _vec3C.set(this.playerPos.x, this.playerPos.y + 1.85, this.playerPos.z);
    const horizDist = Math.cos(this.camPitch) * this.camDistance;
    const vertDist = Math.sin(this.camPitch) * this.camDistance;
    _vec3B.set(
      _vec3C.x + Math.sin(this.camYaw) * horizDist,
      Math.max(0.8, _vec3C.y + vertDist),
      _vec3C.z + Math.cos(this.camYaw) * horizDist,
    );

    this.camera.position.lerp(_vec3B, Math.min(1, dt * 15));
    this.camera.lookAt(_vec3C);
  }

  private emitHudSnapshot() {
    let currentZone = WORLD_ZONES[0];
    let bestDist = Infinity;
    for (const z of WORLD_ZONES) {
      const d = Math.hypot(this.playerPos.x - z.x, this.playerPos.z - z.z);
      if (d < z.radius && d < bestDist) {
        bestDist = d;
        currentZone = z;
      }
    }
    if (!this.discoveredZones.has(currentZone.id)) {
      this.discoveredZones.add(currentZone.id);
      this.callbacks.onZoneDiscovered(currentZone.id, currentZone.name);
    }

    let nearInteractable: string | null = null;
    if (this.activeVehicle) {
      nearInteractable = `Press E to Exit ${this.activeVehicle.type.toUpperCase()}`;
    } else {
      for (const v of this.vehicles) {
        if (v.pos.distanceTo(this.playerPos) < 4.8) {
          nearInteractable = `Press E to Drive ${v.type.toUpperCase()}`;
          break;
        }
      }
      if (!nearInteractable && this.playerPos.distanceTo(this.world.secretCrystal.position) < 5.5) {
        nearInteractable = 'Press E to Harvest Secret Crystal (+50 Coins)';
      }
    }

    const minimapEntities: HudSnapshot['minimapEntities'] = [];
    this.remoteRigs.forEach((r) => {
      minimapEntities.push({ x: r.rig.group.position.x, z: r.rig.group.position.z, kind: 'remote', color: '#38bdf8' });
    });
    this.bots.forEach((b) => {
      minimapEntities.push({ x: b.pos.x, z: b.pos.z, kind: 'bot', color: '#a3e635' });
    });
    this.vehicles.forEach((v) => {
      if (!v.occupiedByPlayer) {
        minimapEntities.push({ x: v.pos.x, z: v.pos.z, kind: 'vehicle', color: '#facc15' });
      }
    });

    const speedKmh = this.activeVehicle
      ? Math.round(Math.abs(this.activeVehicle.speed) * 3.6)
      : Math.round(Math.hypot(this.playerVel.x, this.playerVel.z) * 3.6);

    const builtCount = this.world.tycoonStages.filter((s) => s.built).length;

    this.callbacks.onHudUpdate({
      zoneName: currentZone.name,
      playerPos: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
      playerRotY: this.playerRotY,
      inVehicle: this.activeVehicle ? this.activeVehicle.type : null,
      nearInteractable,
      speedKmh,
      minigame: {
        active: this.activeMiniGame,
        title: this.activeMiniGame.toUpperCase(),
        objective: this.miniGameStatus,
        timerSeconds: Math.max(0, Math.ceil(this.miniGameTimer)),
        score: this.miniGameScore,
        statusText: this.miniGameStatus,
        lap: this.raceLap,
        totalLaps: 3,
        tycoonCash: this.tycoonCash,
        tycoonTier: builtCount,
      },
      minimapEntities,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.mats.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
