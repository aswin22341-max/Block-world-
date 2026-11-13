import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AvatarConfig,
  BlockCategory,
  BuildToolMode,
  ChatMessage,
  DEFAULT_AVATAR,
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  EmoteType,
  GameSettings,
  HudSnapshot,
  MiniGameId,
  PetType,
  PlacedBlock,
  PlayerProgress,
  RemotePlayer,
  RoomInfo,
  SavedCustomMap,
  SHOP_CATALOG,
  VehicleType,
} from './types/game';
import { GameEngine } from './game/GameEngine';
import { MultiplayerClient } from './network/multiplayerClient';
import { GameMenus, MenuTab } from './components/GameMenus';
import { InGameHud } from './components/InGameHud';
import { MobileControls } from './components/MobileControls';
import { StartPage } from './components/StartPage';
import { soundEngine } from './audio/soundEngine';

const STORAGE_AVATAR = 'blockverse_avatar_v1';
const STORAGE_PROGRESS = 'blockverse_progress_v1';
const STORAGE_SETTINGS = 'blockverse_settings_v1';

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const mpRef = useRef<MultiplayerClient | null>(null);

  const [avatar, setAvatar] = useState<AvatarConfig>(() => loadStored(STORAGE_AVATAR, DEFAULT_AVATAR));
  const [progress, setProgress] = useState<PlayerProgress>(() => loadStored(STORAGE_PROGRESS, DEFAULT_PROGRESS));
  const [settings, setSettings] = useState<GameSettings>(() => loadStored(STORAGE_SETTINGS, DEFAULT_SETTINGS));

  const [startScreenOpen, setStartScreenOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState<MenuTab>('play');

  const [wsConnected, setWsConnected] = useState(false);
  const [rooms, setRooms] = useState<RoomInfo[]>([
    { id: 'hub-skyline', name: 'Skyline City Hub', hostName: 'Blockverse', playerCount: 4, maxPlayers: 16, mode: 'Free Roam' },
    { id: 'obby-paradise', name: 'Obby Paradise', hostName: 'Blockverse', playerCount: 2, maxPlayers: 16, mode: 'Obby Parkour' },
    { id: 'turbo-speedway', name: 'Turbo Speedway', hostName: 'Blockverse', playerCount: 3, maxPlayers: 12, mode: 'Racing' },
  ]);
  const [currentRoomId, setCurrentRoomId] = useState('hub-skyline');
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'System',
      text: 'Welcome to BLOCKVERSE 3D! Press PLAY to explore, build, drive, and compete.',
      timestamp: Date.now(),
      isSystem: true,
    },
  ]);

  const [buildMode, setBuildMode] = useState(false);
  const [editorMode, setEditorMode] = useState(false);
  const [buildTool, setBuildTool] = useState<BuildToolMode>('place');
  const [buildPreset, setBuildPreset] = useState<{
    type: string;
    category: BlockCategory;
    color: string;
    sx: number;
    sy: number;
    sz: number;
  }>({
    type: 'cube',
    category: 'block',
    color: '#3b82f6',
    sx: 2,
    sy: 2,
    sz: 2,
  });
  const [selectedBlock, setSelectedBlock] = useState<PlacedBlock | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const [hud, setHud] = useState<HudSnapshot>({
    zoneName: 'Skyline City',
    playerPos: { x: 0, y: 1.5, z: 12 },
    playerRotY: Math.PI,
    inVehicle: null,
    nearInteractable: null,
    speedKmh: 0,
    minigame: {
      active: 'none',
      title: '',
      objective: '',
      timerSeconds: 0,
      score: 0,
      statusText: '',
    },
    minimapEntities: [],
  });

  // Mutable refs for engine callbacks
  const avatarRef = useRef(avatar);
  avatarRef.current = avatar;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const startScreenRef = useRef(startScreenOpen);
  startScreenRef.current = startScreenOpen;
  const remotePlayersRef = useRef<Map<string, RemotePlayer>>(new Map());
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const addRewards = useCallback((coinsDelta: number, xpDelta: number, reason?: string) => {
    setProgress((prev) => {
      let nextXp = prev.xp + xpDelta;
      let nextLevel = prev.level;
      while (nextXp >= nextLevel * 250) {
        nextXp -= nextLevel * 250;
        nextLevel++;
      }
      return {
        ...prev,
        coins: prev.coins + coinsDelta,
        xp: nextXp,
        level: nextLevel,
        leaderboardScore: prev.leaderboardScore + coinsDelta + xpDelta,
      };
    });
    if (reason) showToast(`${reason} (+${coinsDelta} Coins)`);
  }, [showToast]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AVATAR, JSON.stringify(avatar));
    } catch {}
  }, [avatar]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(progress));
    } catch {}
  }, [progress]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
    } catch {}
    engineRef.current?.updateSettings(settings);
  }, [settings]);

  useEffect(() => {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(touch);
  }, []);

  // Initialize Three.js GameEngine & WebSocket MultiplayerClient ONCE
  useEffect(() => {
    const el = canvasMountRef.current;
    if (!el) return;

    const equippedPet = progressRef.current.pets.find((p) => p.id === progressRef.current.equippedPetId);

    const mp = new MultiplayerClient({
      onStatusChange: (connected) => setWsConnected(connected),
      onConnected: (_id, list) => {
        if (list.length > 0) setRooms(list);
        mp.joinRoom('hub-skyline', {
          name: avatarRef.current.name,
          avatar: avatarRef.current,
          petType: progressRef.current.pets.find((p) => p.id === progressRef.current.equippedPetId)?.type || null,
        });
      },
      onRoomsList: (list) => setRooms(list),
      onRoomJoined: (roomId, roomName, players, blocks, chat) => {
        setCurrentRoomId(roomId);
        remotePlayersRef.current.clear();
        players.forEach((p) => remotePlayersRef.current.set(p.id, p));
        setRemotePlayers(players.filter((p) => p.id !== mp.playerId));
        engineRef.current?.syncRemotePlayers(players, mp.playerId);
        blocks.forEach((b) => engineRef.current?.addPlacedBlock(b, true));
        if (chat.length > 0) setChatMessages(chat);
        showToast(`Joined ${roomName}`);
      },
      onPlayerJoined: (player) => {
        remotePlayersRef.current.set(player.id, player);
        const list = Array.from(remotePlayersRef.current.values());
        setRemotePlayers(list.filter((p) => p.id !== mp.playerId));
        engineRef.current?.syncRemotePlayers(list, mp.playerId);
      },
      onPlayerState: (player) => {
        remotePlayersRef.current.set(player.id, player);
        const list = Array.from(remotePlayersRef.current.values());
        engineRef.current?.syncRemotePlayers(list, mp.playerId);
      },
      onPlayerLeft: (pid) => {
        remotePlayersRef.current.delete(pid);
        const list = Array.from(remotePlayersRef.current.values());
        setRemotePlayers(list.filter((p) => p.id !== mp.playerId));
        engineRef.current?.syncRemotePlayers(list, mp.playerId);
      },
      onChatMessage: (msg) => {
        setChatMessages((prev) => [...prev.slice(-45), msg]);
      },
      onBlockPlaced: (block) => {
        engineRef.current?.addPlacedBlock(block, true);
      },
      onBlockUpdated: (block) => {
        engineRef.current?.updatePlacedBlockFromRemote(block);
      },
      onBlockRemoved: (blockId) => {
        engineRef.current?.removePlacedBlock(blockId, true);
      },
      onInviteReceived: (data) => {
        showToast(`${data.from} invited you to ${data.targetZone} in ${data.roomName}!`);
      },
    });
    mpRef.current = mp;
    mp.connect();

    const engine = new GameEngine(el, avatarRef.current, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onCoinCollected: (amount, reason) => addRewards(amount, Math.round(amount * 0.5), reason),
      onZoneDiscovered: (zoneId, zoneName) => {
        setProgress((prev) => {
          if (prev.visitedZones.includes(zoneId)) return prev;
          const nextVisited = [...prev.visitedZones, zoneId];
          const missions = prev.missions.map((m) =>
            m.id === 'd-explore' ? { ...m, progress: Math.max(m.progress, nextVisited.length) } : m,
          );
          const achievements = prev.achievements.map((a) =>
            a.id === 'ach-explorer' && nextVisited.length >= 6 && !a.unlocked
              ? { ...a, unlocked: true }
              : a,
          );
          return {
            ...prev,
            visitedZones: nextVisited,
            coins: prev.coins + 40,
            xp: prev.xp + 30,
            missions,
            achievements,
          };
        });
        showToast(`Discovered ${zoneName}! (+40 Coins)`);
      },
      onBlockPlaced: (block, fromRemote) => {
        if (!fromRemote) {
          mp.sendPlaceBlock(block);
          setProgress((prev) => {
            const count = prev.blocksPlacedCount + 1;
            const missions = prev.missions.map((m) =>
              m.id === 'd-build' || m.id === 'w-architect' ? { ...m, progress: m.progress + 1 } : m,
            );
            const achievements = prev.achievements.map((a) =>
              a.id === 'ach-architect' && count >= 25 && !a.unlocked ? { ...a, unlocked: true } : a,
            );
            return { ...prev, blocksPlacedCount: count, xp: prev.xp + 5, missions, achievements };
          });
        }
      },
      onBlockUpdated: (block, fromRemote) => {
        if (!fromRemote) mp.sendUpdateBlock(block);
      },
      onBlockRemoved: (blockId, fromRemote) => {
        if (!fromRemote) mp.sendRemoveBlock(blockId);
      },
      onMiniGameComplete: (_gameId, rewardCoins, rewardXp, summary) => {
        addRewards(rewardCoins, rewardXp, summary);
        setProgress((prev) => {
          const wins = prev.minigamesWonCount + 1;
          const missions = prev.missions.map((m) =>
            m.id === 'd-minigame' || m.id === 'w-master' ? { ...m, progress: m.progress + 1 } : m,
          );
          const achievements = prev.achievements.map((a) =>
            a.id === 'ach-champion' && !a.unlocked ? { ...a, unlocked: true } : a,
          );
          return { ...prev, minigamesWonCount: wins, missions, achievements };
        });
      },
      onHealthChange: (hp) => {
        setProgress((prev) => ({ ...prev, health: hp }));
      },
      onPlayerStateBroadcast: (state) => {
        const pet = progressRef.current.pets.find((p) => p.id === progressRef.current.equippedPetId);
        mp.sendPlayerState({
          ...state,
          name: avatarRef.current.name,
          avatar: avatarRef.current,
          petType: pet?.type || null,
        });
      },
      onSelectPlacedBlock: (block) => setSelectedBlock(block),
      onEscapePressed: () => {
        if (startScreenRef.current) return;
        setMenuOpen((prev) => {
          const next = !prev;
          engineRef.current?.setMenuPreviewMode(next);
          return next;
        });
      },
    });

    engine.setEquippedPet(equippedPet?.type || 'dog');
    engine.updateSettings(settings);
    engine.setMenuPreviewMode(true);
    engineRef.current = engine;

    return () => {
      mp.dispose();
      engine.dispose();
      engineRef.current = null;
    };
  }, [addRewards, showToast]);

  const handleCloseMenu = () => {
    setMenuOpen(false);
    engineRef.current?.setMenuPreviewMode(false);
    soundEngine.playClick();
  };

  const handleOpenMenu = (tab: MenuTab) => {
    setMenuTab(tab);
    setMenuOpen(true);
    engineRef.current?.setMenuPreviewMode(true);
    soundEngine.playClick();
  };

  const handleSaveAvatar = (next: AvatarConfig) => {
    setAvatar(next);
    engineRef.current?.updateAvatar(next);
    showToast('Avatar customized & saved!');
    soundEngine.playCheckpoint();
  };

  const handleToggleBuildMode = (build: boolean, editor: boolean) => {
    setBuildMode(build);
    setEditorMode(editor);
    engineRef.current?.setBuildMode(build, buildTool, buildPreset);
    soundEngine.playClick();
  };

  const handleChangeBuildTool = (tool: BuildToolMode) => {
    setBuildTool(tool);
    engineRef.current?.setBuildMode(buildMode, tool, buildPreset);
    soundEngine.playClick();
  };

  const handleChangeBuildPreset = (preset: typeof buildPreset) => {
    setBuildPreset(preset);
    engineRef.current?.setBuildMode(buildMode, buildTool, preset);
  };

  const handleBuyItem = (itemId: string) => {
    const item = SHOP_CATALOG.find((i) => i.id === itemId);
    if (!item) return;
    setProgress((prev) => {
      if (prev.unlockedItems.includes(item.id) || prev.coins < item.price) return prev;
      let nextPets = prev.pets;
      let nextEquipped = prev.equippedPetId;
      if (item.category === 'pet') {
        const newPet = {
          id: `pet-${Date.now()}`,
          type: item.itemKey as PetType,
          name: item.name,
          level: 1,
          hunger: 100,
          xp: 0,
        };
        nextPets = [...prev.pets, newPet];
        nextEquipped = newPet.id;
        engineRef.current?.setEquippedPet(newPet.type);
      }
      return {
        ...prev,
        coins: prev.coins - item.price,
        unlockedItems: [...prev.unlockedItems, item.id],
        pets: nextPets,
        equippedPetId: nextEquipped,
      };
    });
    soundEngine.playWin();
    showToast(`Purchased ${item.name}!`);
  };

  const handleEquipPet = (petId: string) => {
    const pet = progress.pets.find((p) => p.id === petId);
    if (!pet) return;
    setProgress((prev) => ({ ...prev, equippedPetId: petId }));
    engineRef.current?.setEquippedPet(pet.type);
    soundEngine.playPet();
    showToast(`Equipped ${pet.name}!`);
  };

  const handleFeedPet = (petId: string) => {
    if (progress.coins < 15) {
      showToast('Need 15 Coins to feed pet!');
      return;
    }
    setProgress((prev) => ({
      ...prev,
      coins: prev.coins - 15,
      pets: prev.pets.map((p) =>
        p.id === petId ? { ...p, hunger: Math.min(100, p.hunger + 30), xp: p.xp + 25 } : p,
      ),
    }));
    soundEngine.playPet();
  };

  const handleUpgradePet = (petId: string) => {
    if (progress.coins < 60) {
      showToast('Need 60 Coins to upgrade pet!');
      return;
    }
    setProgress((prev) => {
      const nextPets = prev.pets.map((p) =>
        p.id === petId ? { ...p, level: p.level + 1, xp: 0, hunger: 100 } : p,
      );
      const hasLv3 = nextPets.some((p) => p.level >= 3);
      const achievements = prev.achievements.map((a) =>
        a.id === 'ach-petlover' && hasLv3 ? { ...a, unlocked: true } : a,
      );
      return { ...prev, coins: prev.coins - 60, pets: nextPets, achievements };
    });
    soundEngine.playWin();
    showToast('Pet leveled up!');
  };

  const handleRenamePet = (petId: string, name: string) => {
    setProgress((prev) => ({
      ...prev,
      pets: prev.pets.map((p) => (p.id === petId ? { ...p, name } : p)),
    }));
  };

  const handleClaimDaily = () => {
    setProgress((prev) => ({
      ...prev,
      coins: prev.coins + 150,
      xp: prev.xp + 100,
      dailyRewardLastClaimed: Date.now(),
    }));
    soundEngine.playWin();
    showToast('Claimed Daily Reward (+150 Coins, +100 XP)!');
  };

  const handleClaimMission = (missionId: string) => {
    setProgress((prev) => {
      const target = prev.missions.find((m) => m.id === missionId);
      if (!target || target.claimed || target.progress < target.target) return prev;
      return {
        ...prev,
        coins: prev.coins + target.rewardCoins,
        xp: prev.xp + target.rewardXp,
        missions: prev.missions.map((m) => (m.id === missionId ? { ...m, claimed: true } : m)),
      };
    });
    soundEngine.playWin();
    showToast('Mission reward claimed!');
  };

  const handleSaveMap = (name: string) => {
    const blocks = engineRef.current?.getPlacedBlocks() || [];
    const newMap: SavedCustomMap = {
      id: `map-${Date.now()}`,
      name,
      createdAt: Date.now(),
      blocks,
    };
    setProgress((prev) => ({ ...prev, savedMaps: [...prev.savedMaps, newMap] }));
    soundEngine.playCheckpoint();
    showToast(`Saved map "${name}" (${blocks.length} items)`);
  };

  const handleLoadMap = (map: SavedCustomMap) => {
    engineRef.current?.loadCustomMapBlocks(map.blocks);
    showToast(`Loaded custom map "${map.name}"`);
  };

  const showMobileHud =
    settings.showMobileControls === 'always' || (settings.showMobileControls === 'auto' && isTouchDevice);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Dedicated WebGL Mount Container (never unmounted on React UI state changes) */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* In-Game HUD */}
      {!startScreenOpen && !menuOpen && (
        <InGameHud
          hud={hud}
          progress={progress}
          playerName={avatar.name}
          chatMessages={chatMessages}
          remotePlayers={remotePlayers}
          onSendChat={(text) => {
            if (wsConnected) {
              mpRef.current?.sendChat(text, avatar.name);
            } else {
              setChatMessages((prev) => [
                ...prev.slice(-40),
                { id: `loc-${Date.now()}`, sender: avatar.name, text, timestamp: Date.now() },
              ]);
            }
          }}
          onEmote={(em: EmoteType) => engineRef.current?.triggerEmote(em)}
          onOpenMenu={handleOpenMenu}
          onExitMiniGame={() => engineRef.current?.startMiniGame('none')}
          buildMode={buildMode}
          editorMode={editorMode}
          onToggleBuildMode={handleToggleBuildMode}
          buildTool={buildTool}
          onChangeBuildTool={handleChangeBuildTool}
          buildPreset={buildPreset}
          onChangeBuildPreset={handleChangeBuildPreset}
          selectedBlock={selectedBlock}
          onModifySelected={(action, color) => engineRef.current?.modifySelectedBlock(action, color)}
          onSaveMap={handleSaveMap}
          onLoadMap={handleLoadMap}
          onInteract={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
          }}
        />
      )}

      {/* Mobile Touch Controls */}
      {!startScreenOpen && !menuOpen && showMobileHud && (
        <MobileControls
          onMove={(vec, jump, sprint) => engineRef.current?.setMobileInput(vec, jump, sprint)}
          onCameraDrag={(dx, dy) => engineRef.current?.rotateCameraByDelta(dx, dy)}
          onInteract={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))}
        />
      )}

      {/* Start Page */}
      {startScreenOpen && (
        <StartPage
          playerName={avatar.name}
          onChangePlayerName={(name) => {
            const next = { ...avatar, name };
            setAvatar(next);
            engineRef.current?.updateAvatar(next);
          }}
          onStartPlay={() => {
            setStartScreenOpen(false);
            setMenuOpen(false);
            engineRef.current?.setMenuPreviewMode(false);
            soundEngine.playCheckpoint();
          }}
          onOpenMenuTab={(tab) => {
            setStartScreenOpen(false);
            handleOpenMenu(tab);
          }}
          coins={progress.coins}
          level={progress.level}
        />
      )}

      {/* Main Menu / Modals */}
      {!startScreenOpen && menuOpen && (
        <GameMenus
          activeTab={menuTab}
          onChangeTab={setMenuTab}
          onCloseMenu={handleCloseMenu}
          avatar={avatar}
          onSaveAvatar={handleSaveAvatar}
          progress={progress}
          settings={settings}
          onUpdateSettings={setSettings}
          onTeleportZone={(x, y, z) => engineRef.current?.teleportTo(x, y, z)}
          onStartMiniGame={(id: MiniGameId) => engineRef.current?.startMiniGame(id)}
          onSpawnVehicle={(v: VehicleType) => engineRef.current?.spawnCustomVehicle(v)}
          onBuyItem={handleBuyItem}
          onEquipPet={handleEquipPet}
          onFeedPet={handleFeedPet}
          onUpgradePet={handleUpgradePet}
          onRenamePet={handleRenamePet}
          onClaimDailyReward={handleClaimDaily}
          onClaimMission={handleClaimMission}
          rooms={rooms}
          currentRoomId={currentRoomId}
          remotePlayers={remotePlayers}
          wsConnected={wsConnected}
          onCreateRoom={(name, max, mode) => mpRef.current?.createRoom(name, avatar.name, max, mode)}
          onJoinRoom={(roomId) =>
            mpRef.current?.joinRoom(roomId, {
              name: avatar.name,
              avatar,
              petType: progress.pets.find((p) => p.id === progress.equippedPetId)?.type || null,
            })
          }
          onInviteFriend={(friendName) => {
            mpRef.current?.sendInvite(hud.zoneName);
            showToast(`Sent world invite to ${friendName}!`);
          }}
          onAddFriend={(name) => {
            setProgress((prev) =>
              prev.friends.includes(name) ? prev : { ...prev, friends: [...prev.friends, name] },
            );
            showToast(`Added ${name} to friends!`);
          }}
          onResetProgress={() => {
            localStorage.removeItem(STORAGE_PROGRESS);
            localStorage.removeItem(STORAGE_AVATAR);
            setProgress(DEFAULT_PROGRESS);
            setAvatar(DEFAULT_AVATAR);
            engineRef.current?.updateAvatar(DEFAULT_AVATAR);
            showToast('Progress reset to defaults.');
          }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900 border border-sky-400/60 text-xs font-bold text-white shadow-2xl pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
