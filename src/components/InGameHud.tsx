import React, { useState } from 'react';
import {
  BlockCategory,
  BuildToolMode,
  ChatMessage,
  EmoteType,
  HudSnapshot,
  PlacedBlock,
  PlayerProgress,
  RemotePlayer,
  SavedCustomMap,
} from '../types/game';
import { MiniMap } from './MiniMap';
import {
  ChevronDown,
  ChevronUp,
  Coins,
  Hammer,
  Heart,
  Map as MapIcon,
  Menu,
  MessageSquare,
  RotateCw,
  Save,
  Send,
  Smile,
  Trash2,
  Users,
} from 'lucide-react';
import { MenuTab } from './GameMenus';

interface InGameHudProps {
  hud: HudSnapshot;
  progress: PlayerProgress;
  playerName: string;
  chatMessages: ChatMessage[];
  remotePlayers: RemotePlayer[];
  onSendChat: (text: string) => void;
  onEmote: (emote: EmoteType) => void;
  onOpenMenu: (tab: MenuTab) => void;
  onExitMiniGame: () => void;
  buildMode: boolean;
  editorMode: boolean;
  onToggleBuildMode: (build: boolean, editor: boolean) => void;
  buildTool: BuildToolMode;
  onChangeBuildTool: (tool: BuildToolMode) => void;
  buildPreset: { type: string; category: BlockCategory; color: string; sx: number; sy: number; sz: number };
  onChangeBuildPreset: (preset: { type: string; category: BlockCategory; color: string; sx: number; sy: number; sz: number }) => void;
  selectedBlock: PlacedBlock | null;
  onModifySelected: (action: 'rotate' | 'grow' | 'shrink' | 'recolor' | 'delete', color?: string) => void;
  onSaveMap: (name: string) => void;
  onLoadMap: (map: SavedCustomMap) => void;
  onInteract: () => void;
}

const BLOCK_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#f8fafc', '#334155'];
const QUICK_EMOJIS = ['👋', '😄', '🎉', '🚗', '🏆', '🧱'];

interface PaletteItem {
  label: string;
  type: string;
  category: BlockCategory;
  sx: number;
  sy: number;
  sz: number;
  defaultColor?: string;
}

const BUILD_ITEMS: PaletteItem[] = [
  { label: 'Cube', type: 'cube', category: 'block', sx: 2, sy: 2, sz: 2 },
  { label: 'Wall', type: 'wall', category: 'block', sx: 4, sy: 4, sz: 1 },
  { label: 'Floor', type: 'floor', category: 'block', sx: 4, sy: 0.6, sz: 4 },
  { label: 'Cylinder', type: 'cylinder', category: 'block', sx: 2, sy: 2, sz: 2 },
  { label: 'Ramp', type: 'ramp', category: 'block', sx: 3, sy: 1.5, sz: 4 },
];

const EDITOR_ITEMS: PaletteItem[] = [
  { label: 'Building', type: 'building', category: 'building', sx: 6, sy: 7, sz: 6, defaultColor: '#3b82f6' },
  { label: 'Tree', type: 'tree', category: 'tree', sx: 3, sy: 5, sz: 3, defaultColor: '#22c55e' },
  { label: 'Road', type: 'road', category: 'road', sx: 6, sy: 0.3, sz: 6, defaultColor: '#334155' },
  { label: 'Water', type: 'water', category: 'water', sx: 6, sy: 0.4, sz: 6, defaultColor: '#0ea5e9' },
  { label: 'Obstacle', type: 'obstacle', category: 'obstacle', sx: 2, sy: 3, sz: 2, defaultColor: '#ef4444' },
  { label: 'Spawn', type: 'spawn', category: 'spawn', sx: 2, sy: 0.5, sz: 2, defaultColor: '#22c55e' },
  { label: 'Checkpoint', type: 'checkpoint', category: 'checkpoint', sx: 2, sy: 0.5, sz: 2, defaultColor: '#facc15' },
];

export const InGameHud: React.FC<InGameHudProps> = ({
  hud,
  progress,
  playerName,
  chatMessages,
  remotePlayers,
  onSendChat,
  onEmote,
  onOpenMenu,
  onExitMiniGame,
  buildMode,
  editorMode,
  onToggleBuildMode,
  buildTool,
  onChangeBuildTool,
  buildPreset,
  onChangeBuildPreset,
  selectedBlock,
  onModifySelected,
  onSaveMap,
  onLoadMap,
  onInteract,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [mapName, setMapName] = useState('');
  const [showMapsDrawer, setShowMapsDrawer] = useState(false);

  const xpNeeded = progress.level * 250;
  const xpPct = Math.min(100, Math.round((progress.xp / xpNeeded) * 100));

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-10 select-none">
      {/* TOP-LEFT: Player Stats & Active Mini-Game Objective */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 max-w-xs pointer-events-auto">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 shadow-lg space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-white truncate">{playerName}</span>
              <span className="text-[11px] font-mono text-sky-400 shrink-0">Lv.{progress.level}</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-amber-400 tabular-nums shrink-0">
              <Coins className="w-3.5 h-3.5" />
              <span>{progress.coins.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-400" /> HP
                </span>
                <span className="tabular-nums">{progress.health}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: `${progress.health}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                <span>XP</span>
                <span className="tabular-nums">{xpPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                <div className="h-full bg-sky-400" style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Active Mini-Game Objective */}
        {hud.minigame.active !== 'none' && (
          <div className="bg-slate-900/95 border border-amber-400/60 rounded-xl px-3.5 py-2.5 shadow-lg space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-amber-400 tracking-wide">{hud.minigame.title}</span>
              <button
                type="button"
                onClick={onExitMiniGame}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-200"
              >
                Exit
              </button>
            </div>
            <div className="text-xs text-white font-medium">{hud.minigame.statusText}</div>
          </div>
        )}
      </div>

      {/* TOP-RIGHT: Mini-map + Player List + Menu Button */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlayersOpen(!playersOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-white shadow-lg"
          >
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span className="tabular-nums">{remotePlayers.length + 5} Online</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenMenu('play')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-white shadow-lg"
          >
            <Menu className="w-3.5 h-3.5" />
            <span>Menu</span>
          </button>
        </div>

        <MiniMap hud={hud} />

        {playersOpen && (
          <div className="w-52 bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-xl space-y-1.5 text-xs">
            <div className="font-semibold text-slate-300 pb-1 border-b border-slate-800">Players in Room</div>
            <div className="text-sky-300 font-medium">{playerName} (You)</div>
            {remotePlayers.map((p) => (
              <div key={p.id} className="text-slate-200 truncate">
                {p.name}
              </div>
            ))}
            <div className="text-slate-400">SkyBuilder99 · AI</div>
            <div className="text-slate-400">PixelRacer · AI</div>
            <div className="text-slate-400">BlockQueen · AI</div>
            <div className="text-slate-400">SunnyExplorer · AI</div>
          </div>
        )}
      </div>

      {/* CENTER-TOP INTERACT PROMPT */}
      {hud.nearInteractable && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={onInteract}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-lg border border-amber-200"
          >
            {hud.nearInteractable}
          </button>
        </div>
      )}

      {/* VEHICLE SPEEDOMETER */}
      {hud.inVehicle && (
        <div className="absolute bottom-28 right-5 bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-right pointer-events-auto hidden md:block">
          <div className="text-[11px] text-slate-400 uppercase">{hud.inVehicle}</div>
          <div className="text-2xl font-mono font-bold text-sky-400 tabular-nums">{hud.speedKmh} km/h</div>
          <button
            type="button"
            onClick={onInteract}
            className="mt-1 px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-[11px] font-semibold"
          >
            Exit (E)
          </button>
        </div>
      )}

      {/* BOTTOM-LEFT: Collapsible Multiplayer Chat & Emotes */}
      <div className="hidden md:flex flex-col absolute bottom-4 left-4 w-72 pointer-events-auto">
        <div className="flex items-center justify-between mb-1.5">
          <button
            type="button"
            onClick={() => setChatOpen(!chatOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-semibold text-slate-200"
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>{chatOpen ? 'Hide Chat' : 'Show Chat'}</span>
          </button>
          <div className="flex items-center gap-1">
            {(['wave', 'dance', 'sit', 'cheer'] as const).map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => onEmote(em)}
                className="px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-200 capitalize"
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {chatOpen && (
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 shadow-xl space-y-2">
            <div className="h-32 overflow-y-auto space-y-1 text-xs pr-1">
              {chatMessages.map((m) => (
                <div key={m.id} className={m.isSystem ? 'text-amber-300' : 'text-slate-200'}>
                  {!m.isSystem && <span className="font-bold text-sky-400">{m.sender}: </span>}
                  <span>{m.text}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => onSendChat(em)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-xs"
                >
                  {em}
                </button>
              ))}
            </div>
            <form onSubmit={handleChatSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type message..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
              />
              <button type="submit" className="px-2.5 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-bold">
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* BOTTOM-CENTER: Collapsible Action & Build/World Editor Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto max-w-[94vw]">
        <button
          type="button"
          onClick={() => setDockCollapsed(!dockCollapsed)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-slate-900/95 border border-b-0 border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
        </button>

        {!dockCollapsed && (
          <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 shadow-2xl space-y-2.5">
            {/* Mode Switch Row */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => onToggleBuildMode(false, false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  !buildMode && !editorMode ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                Explore
              </button>
              <button
                type="button"
                onClick={() => onToggleBuildMode(true, false)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  buildMode && !editorMode ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>Build Blocks</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleBuildMode(true, true)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  editorMode ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>World Editor</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenMenu('minigames')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white whitespace-nowrap"
              >
                Mini-Games
              </button>
              <button
                type="button"
                onClick={() => onOpenMenu('inventory')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white whitespace-nowrap"
              >
                Vehicles & Pets
              </button>
              <button
                type="button"
                onClick={() => onOpenMenu('avatar')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white whitespace-nowrap"
              >
                Avatar
              </button>
            </div>

            {/* Build / World Editor Toolbar */}
            {(buildMode || editorMode) && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {(['place', 'move', 'rotate', 'resize', 'recolor', 'delete'] as const).map((tool) => (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => onChangeBuildTool(tool)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize ${
                        buildTool === tool ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {tool}
                    </button>
                  ))}

                  <div className="h-4 w-px bg-slate-700 mx-1" />

                  {BLOCK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChangeBuildPreset({ ...buildPreset, color: c })}
                      className={`w-5 h-5 rounded border ${buildPreset.color === c ? 'border-white scale-110' : 'border-slate-700'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                {/* Preset Items */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {(editorMode ? EDITOR_ITEMS : BUILD_ITEMS).map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => {
                        onChangeBuildTool('place');
                        onChangeBuildPreset({
                          type: item.type,
                          category: item.category,
                          color: item.defaultColor ?? buildPreset.color,
                          sx: item.sx,
                          sy: item.sy,
                          sz: item.sz,
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                        buildPreset.type === item.type ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}

                  {editorMode && (
                    <button
                      type="button"
                      onClick={() => setShowMapsDrawer(!showMapsDrawer)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold"
                    >
                      <Save className="w-3 h-3" />
                      <span>Save / Load Map</span>
                    </button>
                  )}
                </div>

                {/* Selected Block Quick Actions */}
                {selectedBlock && (
                  <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-slate-300">
                    <span>Selected: {selectedBlock.type}</span>
                    <button
                      type="button"
                      onClick={() => onModifySelected('rotate')}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white"
                    >
                      <RotateCw className="w-3 h-3" /> Rotate
                    </button>
                    <button
                      type="button"
                      onClick={() => onModifySelected('grow')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white"
                    >
                      +Size
                    </button>
                    <button
                      type="button"
                      onClick={() => onModifySelected('shrink')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white"
                    >
                      -Size
                    </button>
                    <button
                      type="button"
                      onClick={() => onModifySelected('delete')}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                )}

                {/* Save / Load Custom Map Panel */}
                {editorMode && showMapsDrawer && (
                  <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Custom map name..."
                        value={mapName}
                        onChange={(e) => setMapName(e.target.value)}
                        className="flex-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (mapName.trim()) {
                            onSaveMap(mapName.trim());
                            setMapName('');
                          }
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs"
                      >
                        Save Map
                      </button>
                    </div>
                    {progress.savedMaps.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {progress.savedMaps.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onLoadMap(m)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-sky-300"
                          >
                            Load: {m.name} ({m.blocks.length})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
