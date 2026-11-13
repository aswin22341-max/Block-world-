import React, { useState } from 'react';
import {
  AvatarConfig,
  FaceExpression,
  GameSettings,
  HairStyle,
  MiniGameId,
  PetType,
  PlayerProgress,
  RemotePlayer,
  RoomInfo,
  ShirtPattern,
  SHOP_CATALOG,
  VehicleType,
  WORLD_ZONES,
} from '../types/game';
import { AvatarPreview3D } from './AvatarPreview3D';
import {
  Award,
  Car,
  Check,
  Coins,
  Compass,
  Gamepad2,
  Gift,
  Lock,
  Package,
  Play,
  Plus,
  Settings,
  ShoppingBag,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';

export type MenuTab = 'play' | 'avatar' | 'worlds' | 'minigames' | 'inventory' | 'shop' | 'settings';

interface GameMenusProps {
  activeTab: MenuTab;
  onChangeTab: (tab: MenuTab) => void;
  onCloseMenu: () => void;
  avatar: AvatarConfig;
  onSaveAvatar: (next: AvatarConfig) => void;
  progress: PlayerProgress;
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onTeleportZone: (x: number, y: number, z: number) => void;
  onStartMiniGame: (id: MiniGameId) => void;
  onSpawnVehicle: (type: VehicleType) => void;
  onBuyItem: (itemId: string) => void;
  onEquipPet: (petId: string) => void;
  onFeedPet: (petId: string) => void;
  onUpgradePet: (petId: string) => void;
  onRenamePet: (petId: string, name: string) => void;
  onClaimDailyReward: () => void;
  onClaimMission: (missionId: string) => void;
  rooms: RoomInfo[];
  currentRoomId: string;
  remotePlayers: RemotePlayer[];
  wsConnected: boolean;
  onCreateRoom: (name: string, maxPlayers: number, mode: string) => void;
  onJoinRoom: (roomId: string) => void;
  onInviteFriend: (friendName: string) => void;
  onAddFriend: (name: string) => void;
  onResetProgress: () => void;
}

const SKIN_SWATCHES = ['#fde0c8', '#f5c69d', '#e0ac69', '#c68642', '#8d5524', '#5c3317', '#93c5fd', '#86efac'];
const COLOR_SWATCHES = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#f8fafc', '#1e293b'];

const MINI_GAME_CARDS: Array<{ id: MiniGameId; title: string; subtitle: string; reward: string; accent: string }> = [
  { id: 'obby', title: 'Obby Parkour', subtitle: 'Leap across floating sky platforms and dodge spinning sweepers.', reward: '200 Coins · 150 XP', accent: 'border-pink-500/60' },
  { id: 'racing', title: 'Grand Prix Racing', subtitle: 'Drive a turbo sports car across 3 laps against AI racers.', reward: '250 Coins · 180 XP', accent: 'border-red-500/60' },
  { id: 'survival', title: 'Falling Tiles Survival', subtitle: 'Stay atop crumbling cyan platforms over the hazard pit.', reward: '220 Coins · 160 XP', accent: 'border-cyan-500/60' },
  { id: 'hideseek', title: 'Hide and Seek', subtitle: 'Outsmart rivals inside the Hedge Maze as Seeker or Hider.', reward: '190 Coins · 120 XP', accent: 'border-emerald-500/60' },
  { id: 'tycoon', title: 'BlockMart Tycoon', subtitle: 'Build droppers, conveyors, and a neon tower for passive cash.', reward: '300 Coins · 220 XP', accent: 'border-amber-500/60' },
  { id: 'battle', title: 'Battle Arena', subtitle: 'Friendly laser-cube blaster match with instant respawns.', reward: '140+ Coins · 140 XP', accent: 'border-indigo-500/60' },
  { id: 'petadventure', title: 'Pet Adventure', subtitle: 'Team up with your equipped pet to gather glowing Sanctuary Orbs.', reward: '210 Coins · 170 XP', accent: 'border-fuchsia-500/60' },
];

const VEHICLE_LIST: Array<{ type: VehicleType; label: string; desc: string }> = [
  { type: 'sedan', label: 'City Sedan', desc: 'Balanced everyday street cruiser' },
  { type: 'sports', label: 'Turbo Sports Car', desc: 'High top speed & sharp drift' },
  { type: 'motorcycle', label: 'Street Motorcycle', desc: 'Nimble two-wheel agile rider' },
  { type: 'bus', label: 'Metro Bus', desc: 'Heavy multi-seat city transit' },
  { type: 'truck', label: 'Cargo Truck', desc: 'Rugged industrial hauler' },
  { type: 'boat', label: 'Ocean Speedboat', desc: 'Fast river & coastline cruiser' },
  { type: 'airplane', label: 'Stunt Airplane', desc: 'Take off & fly above the city' },
];

export const GameMenus: React.FC<GameMenusProps> = (props) => {
  const {
    activeTab,
    onChangeTab,
    onCloseMenu,
    avatar,
    onSaveAvatar,
    progress,
    settings,
    onUpdateSettings,
  } = props;

  const [draftAvatar, setDraftAvatar] = useState<AvatarConfig>(avatar);
  const [shopFilter, setShopFilter] = useState<'all' | 'hat' | 'glasses' | 'accessory' | 'backpack' | 'pet'>('all');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomMode, setNewRoomMode] = useState('Sandbox');
  const [friendInput, setFriendInput] = useState('');
  const [renamingPetId, setRenamingPetId] = useState<string | null>(null);
  const [petNameDraft, setPetNameDraft] = useState('');

  const canClaimDaily = Date.now() - progress.dailyRewardLastClaimed > 20 * 60 * 60 * 1000;
  const xpNeeded = progress.level * 250;

  const isUnlocked = (category: string, key: string) => {
    if (key === 'none') return true;
    const item = SHOP_CATALOG.find((i) => i.category === category && i.itemKey === key);
    if (!item) return true;
    return progress.unlockedItems.includes(item.id);
  };

  const navItems: Array<{ id: MenuTab; label: string; icon: React.ReactNode }> = [
    { id: 'play', label: 'Play', icon: <Play className="w-4 h-4" /> },
    { id: 'avatar', label: 'Avatar', icon: <User className="w-4 h-4" /> },
    { id: 'worlds', label: 'Worlds', icon: <Compass className="w-4 h-4" /> },
    { id: 'minigames', label: 'Mini-Games', icon: <Gamepad2 className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> },
    { id: 'shop', label: 'Shop', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-3 md:p-6">
      <div className="w-full max-w-6xl h-[90vh] max-h-[820px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Bar Contract: Brand — Nav Tabs — Primary Action */}
        <header className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center font-display font-extrabold text-slate-950 text-lg">
              B
            </div>
            <span className="font-display font-extrabold text-lg tracking-tight text-white whitespace-nowrap">
              BLOCKVERSE 3D
            </span>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto py-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-sm font-bold text-amber-400 tabular-nums">
              <Coins className="w-4 h-4" />
              <span>{progress.coins.toLocaleString()}</span>
            </div>
            <button
              type="button"
              onClick={onCloseMenu}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume</span>
            </button>
          </div>
        </header>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {/* PLAY TAB */}
          {activeTab === 'play' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">
                      Level {progress.level} · {progress.xp}/{xpNeeded} XP · {progress.visitedZones.length}/{WORLD_ZONES.length} Biomes
                    </div>
                    <h2 className="text-2xl font-display font-bold text-white">Welcome back, {avatar.name}</h2>
                    <p className="text-sm text-slate-300 mt-1">
                      Explore Skyline City, build custom structures, drive 7 vehicles, and compete in mini-games.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onCloseMenu}
                    className="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm whitespace-nowrap shrink-0 transition-colors"
                  >
                    Enter World
                  </button>
                </div>

                {/* Daily & Weekly Missions */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Daily Missions & Weekly Challenges</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {progress.missions.map((m) => {
                      const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
                      const done = m.progress >= m.target;
                      return (
                        <div key={m.id} className="rounded-xl bg-slate-800/50 border border-slate-700/80 p-4 flex flex-col justify-between gap-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[11px] text-slate-400 capitalize">{m.type} challenge</div>
                              <div className="text-sm font-semibold text-white">{m.title}</div>
                            </div>
                            <span className="text-xs font-mono tabular-nums text-amber-400">+{m.rewardCoins}c</span>
                          </div>
                          <div className="space-y-2">
                            <div className="h-2 rounded-full bg-slate-950 overflow-hidden">
                              <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-400 tabular-nums">
                              <span>
                                {Math.min(m.progress, m.target)} / {m.target}
                              </span>
                              {m.claimed ? (
                                <span className="text-emerald-400 font-semibold">Claimed</span>
                              ) : done ? (
                                <button
                                  type="button"
                                  onClick={() => props.onClaimMission(m.id)}
                                  className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-bold text-xs"
                                >
                                  Claim
                                </button>
                              ) : (
                                <span>In progress</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Achievements */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4 text-sky-400" />
                    <span>Achievements</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {progress.achievements.map((a) => (
                      <div
                        key={a.id}
                        className={`rounded-xl border p-3.5 ${
                          a.unlocked ? 'bg-slate-800/70 border-emerald-500/40' : 'bg-slate-900/60 border-slate-800 opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">{a.title}</span>
                          {a.unlocked ? <Check className="w-4 h-4 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
                        </div>
                        <p className="text-xs text-slate-400">{a.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Daily Reward & Leaderboard */}
              <div className="space-y-5">
                <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-5">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-2">
                    <Gift className="w-4 h-4" />
                    <span>Daily Check-In Bonus</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-4">Claim 150 Coins and 100 XP every day you visit Blockverse 3D.</p>
                  <button
                    type="button"
                    disabled={!canClaimDaily}
                    onClick={props.onClaimDailyReward}
                    className={`w-full py-2.5 rounded-lg text-xs font-bold transition-colors ${
                      canClaimDaily
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {canClaimDaily ? 'Claim +150 Coins' : 'Already Claimed Today'}
                  </button>
                </div>

                <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-5">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm mb-3">
                    <Trophy className="w-4 h-4" />
                    <span>World Leaderboard</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      { name: avatar.name, score: progress.leaderboardScore, me: true },
                      ...props.remotePlayers.map((p) => ({ name: p.name, score: p.score || 100, me: false })),
                      { name: 'SkyBuilder99', score: 940, me: false },
                      { name: 'PixelRacer', score: 780, me: false },
                      { name: 'BlockQueen', score: 610, me: false },
                    ]
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 6)
                      .map((row, idx) => (
                        <div
                          key={`${row.name}-${idx}`}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                            row.me ? 'bg-sky-500/20 border border-sky-500/40 text-white' : 'bg-slate-900/60 text-slate-300'
                          }`}
                        >
                          <span className="font-medium truncate">
                            {idx + 1}. {row.name}
                          </span>
                          <span className="font-mono tabular-nums text-amber-400">{row.score} pts</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AVATAR CUSTOMIZER TAB */}
          {activeTab === 'avatar' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-4">
                <AvatarPreview3D avatar={draftAvatar} />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => onSaveAvatar(draftAvatar)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors"
                  >
                    Save Avatar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftAvatar(avatar)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm"
                  >
                    Revert
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Player Name</label>
                    <input
                      type="text"
                      maxLength={16}
                      value={draftAvatar.name}
                      onChange={(e) => setDraftAvatar({ ...draftAvatar, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Face Expression</label>
                    <select
                      value={draftAvatar.faceExpression}
                      onChange={(e) => setDraftAvatar({ ...draftAvatar, faceExpression: e.target.value as FaceExpression })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                    >
                      <option value="happy">Happy Smile</option>
                      <option value="cool">Cool Smirk</option>
                      <option value="surprised">Surprised</option>
                      <option value="wink">Playful Wink</option>
                      <option value="determined">Determined</option>
                      <option value="starry">Starry Eyes</option>
                    </select>
                  </div>
                </div>

                {/* Skin Color */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Skin Tone</label>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDraftAvatar({ ...draftAvatar, skinColor: c })}
                        className={`w-7 h-7 rounded-lg border-2 ${draftAvatar.skinColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Skin ${c}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Hair & Shirt */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Hair Style</label>
                    <select
                      value={draftAvatar.hairStyle}
                      onChange={(e) => setDraftAvatar({ ...draftAvatar, hairStyle: e.target.value as HairStyle })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                    >
                      <option value="spiky">Spiky</option>
                      <option value="bob">Classic Bob</option>
                      <option value="mohawk">Mohawk</option>
                      <option value="ponytail">Ponytail</option>
                      <option value="curly">Curly</option>
                      <option value="bald">No Hair</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Shirt Pattern</label>
                    <select
                      value={draftAvatar.shirtPattern}
                      onChange={(e) => setDraftAvatar({ ...draftAvatar, shirtPattern: e.target.value as ShirtPattern })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
                    >
                      <option value="star">Star Tee</option>
                      <option value="solid">Solid Color</option>
                      <option value="stripes">Stripes</option>
                      <option value="hoodie">Pocket Hoodie</option>
                      <option value="jacket">Open Jacket</option>
                    </select>
                  </div>
                </div>

                {/* Color Pickers for Hair, Shirt, Pants, Shoes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      ['Hair Color', 'hairColor'],
                      ['Shirt Color', 'shirtColor'],
                      ['Pants Color', 'pantsColor'],
                      ['Shoes Color', 'shoesColor'],
                    ] as const
                  ).map(([label, field]) => (
                    <div key={field}>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">{label}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_SWATCHES.slice(0, 6).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setDraftAvatar({ ...draftAvatar, [field]: c })}
                            className={`w-6 h-6 rounded border ${draftAvatar[field] === c ? 'border-white' : 'border-slate-700'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hats, Glasses, Accessories, Backpacks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Hat (Unlock in Shop)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['none', 'cap', 'tophat', 'crown', 'wizard', 'helmet', 'halo'] as const).map((h) => {
                        const ok = isUnlocked('hat', h);
                        return (
                          <button
                            key={h}
                            type="button"
                            disabled={!ok}
                            onClick={() => setDraftAvatar({ ...draftAvatar, hatType: h })}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize border ${
                              draftAvatar.hatType === h
                                ? 'bg-sky-500 text-slate-950 border-sky-300'
                                : ok
                                  ? 'bg-slate-800 text-slate-200 border-slate-700'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {h} {!ok && '🔒'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Glasses</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['none', 'sunglasses', 'nerd', 'visor', 'monocle'] as const).map((g) => {
                        const ok = isUnlocked('glasses', g);
                        return (
                          <button
                            key={g}
                            type="button"
                            disabled={!ok}
                            onClick={() => setDraftAvatar({ ...draftAvatar, glassesType: g })}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize border ${
                              draftAvatar.glassesType === g
                                ? 'bg-sky-500 text-slate-950 border-sky-300'
                                : ok
                                  ? 'bg-slate-800 text-slate-200 border-slate-700'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {g} {!ok && '🔒'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Accessory</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['none', 'scarf', 'cape', 'wings', 'headphones'] as const).map((a) => {
                        const ok = isUnlocked('accessory', a);
                        return (
                          <button
                            key={a}
                            type="button"
                            disabled={!ok}
                            onClick={() => setDraftAvatar({ ...draftAvatar, accessoryType: a })}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize border ${
                              draftAvatar.accessoryType === a
                                ? 'bg-sky-500 text-slate-950 border-sky-300'
                                : ok
                                  ? 'bg-slate-800 text-slate-200 border-slate-700'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {a} {!ok && '🔒'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Backpack</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(['none', 'hiking', 'jetpack', 'wingpack', 'chest'] as const).map((p) => {
                        const ok = isUnlocked('backpack', p);
                        return (
                          <button
                            key={p}
                            type="button"
                            disabled={!ok}
                            onClick={() => setDraftAvatar({ ...draftAvatar, backpackType: p })}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize border ${
                              draftAvatar.backpackType === p
                                ? 'bg-sky-500 text-slate-950 border-sky-300'
                                : ok
                                  ? 'bg-slate-800 text-slate-200 border-slate-700'
                                  : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {p} {!ok && '🔒'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WORLDS & MULTIPLAYER ROOMS TAB */}
          {activeTab === 'worlds' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <h3 className="text-sm font-semibold text-white">Fast-Travel World Biomes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {WORLD_ZONES.map((z) => {
                    const visited = progress.visitedZones.includes(z.id);
                    return (
                      <div key={z.id} className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                            <span>{visited ? 'Discovered' : 'Unexplored'}</span>
                            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: z.color }} />
                          </div>
                          <div className="text-sm font-bold text-white">{z.name}</div>
                          <p className="text-xs text-slate-400 mt-0.5">{z.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            props.onTeleportZone(z.x, 1.5, z.z + 10);
                            onCloseMenu();
                          }}
                          className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors"
                        >
                          Teleport Here
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-sky-400" />
                      <span>Multiplayer Rooms</span>
                    </h3>
                    <span className="text-xs text-slate-400">
                      {props.wsConnected ? 'WebSocket Online' : 'Local AI Simulation'}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {props.rooms.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{r.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {r.mode} · {r.playerCount}/{r.maxPlayers} players
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            props.onJoinRoom(r.id);
                            onCloseMenu();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                            props.currentRoomId === r.id
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                          }`}
                        >
                          {props.currentRoomId === r.id ? 'Joined' : 'Join'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Create Room */}
                  <div className="pt-2 border-t border-slate-700/80 space-y-2">
                    <div className="text-xs font-semibold text-slate-300">Create Custom Room</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Room name..."
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                      />
                      <select
                        value={newRoomMode}
                        onChange={(e) => setNewRoomMode(e.target.value)}
                        className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                      >
                        <option value="Sandbox">Sandbox</option>
                        <option value="Obby">Obby</option>
                        <option value="Racing">Racing</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (newRoomName.trim()) {
                            props.onCreateRoom(newRoomName.trim(), 12, newRoomMode);
                            setNewRoomName('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Friends System */}
                <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-white">Friends & World Visits</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add friend username..."
                      value={friendInput}
                      onChange={(e) => setFriendInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (friendInput.trim()) {
                          props.onAddFriend(friendInput.trim());
                          setFriendInput('');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {progress.friends.map((f) => (
                      <div key={f} className="flex items-center justify-between bg-slate-900/70 px-3 py-2 rounded-lg text-xs">
                        <span className="font-medium text-slate-200">{f}</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => props.onInviteFriend(f)}
                            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                          >
                            Invite
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              props.onTeleportZone(14, 1.5, -8);
                              onCloseMenu();
                            }}
                            className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          >
                            Visit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MINI-GAMES TAB */}
          {activeTab === 'minigames' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MINI_GAME_CARDS.map((mg) => (
                <div key={mg.id} className={`rounded-xl bg-slate-800/70 border ${mg.accent} p-5 flex flex-col justify-between gap-4`}>
                  <div>
                    <div className="text-xs text-amber-400 font-semibold mb-1">{mg.reward}</div>
                    <h3 className="text-lg font-display font-bold text-white">{mg.title}</h3>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{mg.subtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      props.onStartMiniGame(mg.id);
                      onCloseMenu();
                    }}
                    className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors"
                  >
                    Play {mg.title}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* INVENTORY (PETS & VEHICLES) TAB */}
          {activeTab === 'inventory' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pets Manager */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white">Your Collectible Pets</h3>
                <div className="space-y-3">
                  {progress.pets.map((pet) => {
                    const equipped = progress.equippedPetId === pet.id;
                    return (
                      <div key={pet.id} className="rounded-xl bg-slate-800/70 border border-slate-700 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            {renamingPetId === pet.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={petNameDraft}
                                  onChange={(e) => setPetNameDraft(e.target.value)}
                                  className="px-2 py-1 rounded bg-slate-950 border border-slate-600 text-xs text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (petNameDraft.trim()) props.onRenamePet(pet.id, petNameDraft.trim());
                                    setRenamingPetId(null);
                                  }}
                                  className="px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-bold"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{pet.name}</span>
                                <span className="text-xs text-slate-400 capitalize">({pet.type})</span>
                              </div>
                            )}
                            <div className="text-xs text-slate-400 tabular-nums mt-0.5">
                              Level {pet.level} · Hunger {pet.hunger}% · XP {pet.xp}/100
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => props.onEquipPet(pet.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                              equipped ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 hover:bg-slate-600 text-white'
                            }`}
                          >
                            {equipped ? 'Equipped' : 'Equip'}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => props.onFeedPet(pet.id)}
                            className="px-3 py-1.5 rounded-lg bg-amber-400/90 hover:bg-amber-300 text-slate-950 text-xs font-bold"
                          >
                            Feed (-15 Coins)
                          </button>
                          <button
                            type="button"
                            onClick={() => props.onUpgradePet(pet.id)}
                            className="px-3 py-1.5 rounded-lg bg-sky-500/90 hover:bg-sky-400 text-slate-950 text-xs font-bold"
                          >
                            Upgrade (-60 Coins)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingPetId(pet.id);
                              setPetNameDraft(pet.name);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium"
                          >
                            Rename
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vehicle Garage */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Car className="w-4 h-4 text-sky-400" />
                  <span>Vehicle Garage (Spawn Anywhere)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {VEHICLE_LIST.map((v) => (
                    <div key={v.type} className="rounded-xl bg-slate-800/70 border border-slate-700 p-4 flex flex-col justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white">{v.label}</div>
                        <p className="text-xs text-slate-400 mt-0.5">{v.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          props.onSpawnVehicle(v.type);
                          onCloseMenu();
                        }}
                        className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
                      >
                        Spawn & Drive
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SHOP TAB */}
          {activeTab === 'shop' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['all', 'hat', 'glasses', 'accessory', 'backpack', 'pet'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setShopFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                        shopFilter === cat ? 'bg-sky-500 text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="text-sm font-bold text-amber-400 tabular-nums">Balance: {progress.coins.toLocaleString()} Coins</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {SHOP_CATALOG.filter((i) => shopFilter === 'all' || i.category === shopFilter).map((item) => {
                  const owned = progress.unlockedItems.includes(item.id);
                  const affordable = progress.coins >= item.price;
                  return (
                    <div key={item.id} className="rounded-xl bg-slate-800/70 border border-slate-700 p-4 flex flex-col justify-between gap-3">
                      <div>
                        <div className="text-[11px] text-slate-400 capitalize">{item.category}</div>
                        <div className="text-sm font-bold text-white mt-0.5">{item.name}</div>
                        <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                      </div>
                      <button
                        type="button"
                        disabled={owned || !affordable}
                        onClick={() => props.onBuyItem(item.id)}
                        className={`w-full py-2 rounded-lg text-xs font-bold ${
                          owned
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : affordable
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {owned ? 'Owned' : `Buy · ${item.price} Coins`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white">Audio, Controls & Graphics</h3>

                <label className="flex items-center justify-between text-sm text-slate-200">
                  <span>Sound Effects</span>
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) => onUpdateSettings({ ...settings, soundEnabled: e.target.checked })}
                    className="w-4 h-4 accent-sky-500"
                  />
                </label>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Volume</span>
                    <span className="tabular-nums">{Math.round(settings.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.volume}
                    onChange={(e) => onUpdateSettings({ ...settings, volume: parseFloat(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Camera Sensitivity</span>
                    <span className="tabular-nums">{settings.cameraSensitivity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="2.2"
                    step="0.1"
                    value={settings.cameraSensitivity}
                    onChange={(e) => onUpdateSettings({ ...settings, cameraSensitivity: parseFloat(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Mobile Touch Controls</label>
                  <select
                    value={settings.showMobileControls}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, showMobileControls: e.target.value as GameSettings['showMobileControls'] })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="auto">Auto-detect Touch Screen</option>
                    <option value="always">Always Show On-Screen Controls</option>
                    <option value="off">Off (Desktop Only)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={props.onResetProgress}
                    className="px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold"
                  >
                    Reset Saved Progress
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white">Desktop & Vehicle Controls</h3>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-700/60">
                    <span>Move / Steer</span>
                    <span className="font-mono text-sky-300">W A S D / Arrows</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/60">
                    <span>Jump / Airplane Climb</span>
                    <span className="font-mono text-sky-300">SPACE</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/60">
                    <span>Sprint / Airplane Dive</span>
                    <span className="font-mono text-sky-300">SHIFT</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/60">
                    <span>Rotate Camera</span>
                    <span className="font-mono text-sky-300">Drag Mouse + Scroll Zoom</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/60">
                    <span>Enter / Exit Vehicle or Interact</span>
                    <span className="font-mono text-sky-300">E</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/60">
                    <span>Dance / Battle Fire</span>
                    <span className="font-mono text-sky-300">F / Click</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/60">
                    <span>Sit Emote</span>
                    <span className="font-mono text-sky-300">C</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Pause / Main Menu</span>
                    <span className="font-mono text-sky-300">ESC</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between px-5 py-2.5 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400 shrink-0">
          <span>Developer: Adway 3rd D</span>
          <span>BLOCKVERSE 3D</span>
        </footer>
      </div>
    </div>
  );
};
