export type HairStyle = 'spiky' | 'bob' | 'mohawk' | 'ponytail' | 'curly' | 'bald';
export type FaceExpression = 'happy' | 'cool' | 'surprised' | 'wink' | 'determined' | 'starry';
export type ShirtPattern = 'solid' | 'stripes' | 'star' | 'hoodie' | 'jacket';
export type HatType = 'none' | 'cap' | 'tophat' | 'crown' | 'wizard' | 'helmet' | 'halo';
export type GlassesType = 'none' | 'sunglasses' | 'nerd' | 'visor' | 'monocle';
export type AccessoryType = 'none' | 'scarf' | 'cape' | 'wings' | 'headphones';
export type BackpackType = 'none' | 'hiking' | 'jetpack' | 'wingpack' | 'chest';

export interface AvatarConfig {
  name: string;
  skinColor: string;
  hairStyle: HairStyle;
  hairColor: string;
  faceExpression: FaceExpression;
  shirtColor: string;
  shirtPattern: ShirtPattern;
  pantsColor: string;
  shoesColor: string;
  hatType: HatType;
  hatColor: string;
  glassesType: GlassesType;
  accessoryType: AccessoryType;
  backpackType: BackpackType;
  backpackColor: string;
}

export type VehicleType =
  | 'sedan'
  | 'sports'
  | 'motorcycle'
  | 'bus'
  | 'truck'
  | 'boat'
  | 'airplane';

export type PetType = 'dog' | 'cat' | 'dragon' | 'robot' | 'dino' | 'rabbit' | 'phoenix';

export interface OwnedPet {
  id: string;
  type: PetType;
  name: string;
  level: number;
  hunger: number; // 0..100
  xp: number;
}

export type BlockCategory =
  | 'block'
  | 'building'
  | 'tree'
  | 'road'
  | 'water'
  | 'obstacle'
  | 'spawn'
  | 'checkpoint';

export interface PlacedBlock {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rotY: number;
  color: string;
  category: BlockCategory;
}

export type EmoteType = 'none' | 'wave' | 'dance' | 'sit' | 'cheer';

export type MiniGameId =
  | 'none'
  | 'obby'
  | 'racing'
  | 'survival'
  | 'hideseek'
  | 'tycoon'
  | 'battle'
  | 'petadventure';

export type BuildToolMode = 'place' | 'move' | 'rotate' | 'resize' | 'recolor' | 'delete';

export interface SavedCustomMap {
  id: string;
  name: string;
  createdAt: number;
  blocks: PlacedBlock[];
}

export interface MissionItem {
  id: string;
  title: string;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardXp: number;
  claimed: boolean;
  type: 'daily' | 'weekly';
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  rewardCoins: number;
}

export interface ShopItem {
  id: string;
  name: string;
  category: 'hat' | 'glasses' | 'accessory' | 'backpack' | 'pet' | 'vehicle';
  itemKey: string;
  price: number;
  description: string;
}

export interface GameSettings {
  soundEnabled: boolean;
  volume: number;
  cameraSensitivity: number;
  showMobileControls: 'auto' | 'always' | 'off';
  graphicsQuality: 'high' | 'balanced';
}

export interface PlayerProgress {
  coins: number;
  xp: number;
  level: number;
  health: number;
  maxHealth: number;
  unlockedItems: string[];
  pets: OwnedPet[];
  equippedPetId: string | null;
  friends: string[];
  visitedZones: string[];
  blocksPlacedCount: number;
  minigamesWonCount: number;
  dailyRewardLastClaimed: number;
  missions: MissionItem[];
  achievements: AchievementItem[];
  savedMaps: SavedCustomMap[];
  leaderboardScore: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  mode: string;
}

export interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  anim: string;
  emote: string;
  vehicle: VehicleType | null;
  petType: PetType | null;
  avatar: Partial<AvatarConfig>;
  score: number;
  isBot?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface WorldZone {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
}

export interface HudSnapshot {
  zoneName: string;
  playerPos: { x: number; y: number; z: number };
  playerRotY: number;
  inVehicle: VehicleType | null;
  nearInteractable: string | null;
  speedKmh: number;
  minigame: {
    active: MiniGameId;
    title: string;
    objective: string;
    timerSeconds: number;
    score: number;
    statusText: string;
    lap?: number;
    totalLaps?: number;
    rank?: number;
    tycoonCash?: number;
    tycoonTier?: number;
  };
  minimapEntities: Array<{
    x: number;
    z: number;
    kind: 'remote' | 'bot' | 'vehicle' | 'checkpoint' | 'pet';
    color: string;
  }>;
}

export const WORLD_ZONES: WorldZone[] = [
  { id: 'skyline-city', name: 'Skyline City', description: 'Downtown skyscrapers, central park & shopping mall', x: 0, y: 0, z: 0, radius: 55, color: '#38bdf8' },
  { id: 'shopping-mall', name: 'BlockMart Mall', description: 'Grand retail plaza & rooftop lounge', x: -34, y: 0, z: -28, radius: 22, color: '#f472b6' },
  { id: 'emerald-village', name: 'Emerald Village', description: 'Cozy houses, windmill & pine forest', x: -92, y: 0, z: 68, radius: 42, color: '#4ade80' },
  { id: 'crystal-beach', name: 'Crystal River & Beach', description: 'Golden shore, bridges, boats & lighthouse', x: 108, y: 0, z: 22, radius: 48, color: '#facc15' },
  { id: 'summit-peaks', name: 'Summit Peaks & Secret Cave', description: 'Snowy mountains & hidden crystal cavern', x: 96, y: 0, z: -96, radius: 48, color: '#a78bfa' },
  { id: 'airport', name: 'Blockverse Airport', description: 'Runway, control tower & flyable airplanes', x: -94, y: 0, z: -94, radius: 46, color: '#fb923c' },
  { id: 'obby-tower', name: 'Sky Obby Tower', description: 'Parkour obstacle course in the clouds', x: 10, y: 0, z: -88, radius: 26, color: '#ec4899' },
  { id: 'race-circuit', name: 'Grand Prix Circuit', description: 'High-speed asphalt track with turbo pads', x: 0, y: 0, z: 112, radius: 48, color: '#ef4444' },
];

export const DEFAULT_AVATAR: AvatarConfig = {
  name: 'BloxExplorer',
  skinColor: '#f5c69d',
  hairStyle: 'spiky',
  hairColor: '#2d1b12',
  faceExpression: 'happy',
  shirtColor: '#2563eb',
  shirtPattern: 'star',
  pantsColor: '#1e293b',
  shoesColor: '#ef4444',
  hatType: 'none',
  hatColor: '#f59e0b',
  glassesType: 'none',
  accessoryType: 'none',
  backpackType: 'none',
  backpackColor: '#0ea5e9',
};

export const SHOP_CATALOG: ShopItem[] = [
  { id: 'hat-cap', name: 'Street Cap', category: 'hat', itemKey: 'cap', price: 80, description: 'Classic colorful blocky baseball cap' },
  { id: 'hat-tophat', name: 'Gentleman Top Hat', category: 'hat', itemKey: 'tophat', price: 180, description: 'Tall executive top hat with gold band' },
  { id: 'hat-crown', name: 'Royal Gold Crown', category: 'hat', itemKey: 'crown', price: 350, description: 'Solid gold crown with ruby accents' },
  { id: 'hat-wizard', name: 'Starlight Wizard Hat', category: 'hat', itemKey: 'wizard', price: 240, description: 'Pointed arcane hat for builders' },
  { id: 'hat-helmet', name: 'Turbo Racing Helmet', category: 'hat', itemKey: 'helmet', price: 220, description: 'Protective aerodynamic racer helmet' },
  { id: 'hat-halo', name: 'Sky Halo', category: 'hat', itemKey: 'halo', price: 420, description: 'Floating golden ring above your avatar' },

  { id: 'glasses-sunglasses', name: 'Cool Shades', category: 'glasses', itemKey: 'sunglasses', price: 90, description: 'Dark tinted block sunglasses' },
  { id: 'glasses-visor', name: 'Cyber Visor', category: 'glasses', itemKey: 'visor', price: 210, description: 'Sleek wrap-around glowing visor' },
  { id: 'glasses-nerd', name: 'Architect Frames', category: 'glasses', itemKey: 'nerd', price: 70, description: 'Crisp square frames for master builders' },
  { id: 'glasses-monocle', name: 'Gold Monocle', category: 'glasses', itemKey: 'monocle', price: 150, description: 'Refined single-lens eyepiece' },

  { id: 'acc-scarf', name: 'Cozy Scarf', category: 'accessory', itemKey: 'scarf', price: 110, description: 'Warm winter neck wrap' },
  { id: 'acc-cape', name: 'Hero Cape', category: 'accessory', itemKey: 'cape', price: 260, description: 'Flowing blocky adventurer cape' },
  { id: 'acc-wings', name: 'Angel Wings', category: 'accessory', itemKey: 'wings', price: 450, description: 'Feathered back wings' },
  { id: 'acc-headphones', name: 'Studio Headphones', category: 'accessory', itemKey: 'headphones', price: 160, description: 'Chunky bass-boosted headset' },

  { id: 'pack-hiking', name: 'Explorer Pack', category: 'backpack', itemKey: 'hiking', price: 120, description: 'Rugged field backpack' },
  { id: 'pack-jetpack', name: 'Rocket Jetpack', category: 'backpack', itemKey: 'jetpack', price: 500, description: 'Twin-thruster metallic jetpack' },
  { id: 'pack-wingpack', name: 'Glider Pack', category: 'backpack', itemKey: 'wingpack', price: 320, description: 'Compact aero wing pack' },
  { id: 'pack-chest', name: 'Treasure Chest Pack', category: 'backpack', itemKey: 'chest', price: 280, description: 'Carry your loot on your back' },

  { id: 'pet-cat', name: 'Whiskers Cat', category: 'pet', itemKey: 'cat', price: 150, description: 'Curious blocky feline companion' },
  { id: 'pet-rabbit', name: 'Hoppy Rabbit', category: 'pet', itemKey: 'rabbit', price: 140, description: 'Speedy long-eared bunny' },
  { id: 'pet-dino', name: 'Rexy Dino', category: 'pet', itemKey: 'dino', price: 280, description: 'Friendly emerald mini-dinosaur' },
  { id: 'pet-robot', name: 'Beep-Boop Bot', category: 'pet', itemKey: 'robot', price: 340, description: 'Hovering utility drone pet' },
  { id: 'pet-dragon', name: 'Ember Dragon', category: 'pet', itemKey: 'dragon', price: 550, description: 'Winged flame dragon follower' },
  { id: 'pet-phoenix', name: 'Solar Phoenix', category: 'pet', itemKey: 'phoenix', price: 750, description: 'Legendary radiant sky phoenix' },
];

export const DEFAULT_PROGRESS: PlayerProgress = {
  coins: 350,
  xp: 0,
  level: 1,
  health: 100,
  maxHealth: 100,
  unlockedItems: ['hat-none', 'glasses-none', 'acc-none', 'pack-none', 'pet-dog'],
  pets: [
    {
      id: 'starter-dog',
      type: 'dog',
      name: 'Biscuit',
      level: 1,
      hunger: 90,
      xp: 0,
    },
  ],
  equippedPetId: 'starter-dog',
  friends: ['SkyBuilder99', 'PixelRacer', 'BlockQueen'],
  visitedZones: ['skyline-city'],
  blocksPlacedCount: 0,
  minigamesWonCount: 0,
  dailyRewardLastClaimed: 0,
  leaderboardScore: 120,
  missions: [
    { id: 'd-explore', title: 'Discover 3 World Zones', target: 3, progress: 1, rewardCoins: 120, rewardXp: 80, claimed: false, type: 'daily' },
    { id: 'd-build', title: 'Place 10 Custom Blocks', target: 10, progress: 0, rewardCoins: 100, rewardXp: 60, claimed: false, type: 'daily' },
    { id: 'd-minigame', title: 'Complete 1 Mini-Game', target: 1, progress: 0, rewardCoins: 150, rewardXp: 120, claimed: false, type: 'daily' },
    { id: 'w-master', title: 'Win 3 Mini-Games This Week', target: 3, progress: 0, rewardCoins: 400, rewardXp: 350, claimed: false, type: 'weekly' },
    { id: 'w-architect', title: 'Build 50 Blocks in Sandbox', target: 50, progress: 0, rewardCoins: 350, rewardXp: 300, claimed: false, type: 'weekly' },
  ],
  achievements: [
    { id: 'ach-first-step', title: 'Blockverse Citizen', description: 'Enter the 3D Sandbox World', unlocked: true, rewardCoins: 50 },
    { id: 'ach-architect', title: 'Master Architect', description: 'Place 25 blocks in the world', unlocked: false, rewardCoins: 200 },
    { id: 'ach-explorer', title: 'World Traveler', description: 'Discover 6 different world biomes', unlocked: false, rewardCoins: 250 },
    { id: 'ach-champion', title: 'Mini-Game Champion', description: 'Win any mini-game challenge', unlocked: false, rewardCoins: 300 },
    { id: 'ach-petlover', title: 'Best Friends Forever', description: 'Upgrade a pet to Level 3', unlocked: false, rewardCoins: 200 },
  ],
  savedMaps: [],
};

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  volume: 0.65,
  cameraSensitivity: 1.0,
  showMobileControls: 'auto',
  graphicsQuality: 'high',
};
