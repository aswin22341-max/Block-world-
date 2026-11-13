import { AvatarConfig, ChatMessage, PetType, PlacedBlock, RemotePlayer, RoomInfo, VehicleType } from '../types/game';

export interface MultiplayerCallbacks {
  onConnected: (playerId: string, rooms: RoomInfo[]) => void;
  onRoomsList: (rooms: RoomInfo[]) => void;
  onRoomJoined: (roomId: string, roomName: string, players: RemotePlayer[], blocks: PlacedBlock[], chat: ChatMessage[]) => void;
  onPlayerJoined: (player: RemotePlayer) => void;
  onPlayerState: (player: RemotePlayer) => void;
  onPlayerLeft: (playerId: string) => void;
  onChatMessage: (message: ChatMessage) => void;
  onBlockPlaced: (block: PlacedBlock) => void;
  onBlockUpdated: (block: PlacedBlock) => void;
  onBlockRemoved: (blockId: string) => void;
  onInviteReceived: (data: { from: string; roomId: string; roomName: string; targetZone: string }) => void;
  onStatusChange: (connected: boolean) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private callbacks: MultiplayerCallbacks;
  public playerId: string | null = null;
  public currentRoomId = 'hub-skyline';
  private reconnectTimer: number | null = null;
  private disposed = false;

  constructor(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  connect() {
    if (this.disposed || typeof window === 'undefined') return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.callbacks.onStatusChange(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'connected':
              this.playerId = msg.playerId;
              this.callbacks.onConnected(msg.playerId, msg.rooms || []);
              break;
            case 'rooms:list':
              this.callbacks.onRoomsList(msg.rooms || []);
              break;
            case 'room:created':
              this.joinRoom(msg.roomId, {});
              break;
            case 'room:joined':
              this.currentRoomId = msg.roomId;
              this.callbacks.onRoomJoined(
                msg.roomId,
                msg.roomName,
                msg.players || [],
                msg.blocks || [],
                msg.chat || [],
              );
              break;
            case 'player:joined':
              this.callbacks.onPlayerJoined(msg.player);
              break;
            case 'player:state':
              this.callbacks.onPlayerState(msg.player);
              break;
            case 'player:left':
              this.callbacks.onPlayerLeft(msg.playerId);
              break;
            case 'chat:message':
              this.callbacks.onChatMessage(msg.message);
              break;
            case 'block:placed':
              this.callbacks.onBlockPlaced(msg.block);
              break;
            case 'block:updated':
              this.callbacks.onBlockUpdated(msg.block);
              break;
            case 'block:removed':
              this.callbacks.onBlockRemoved(msg.blockId);
              break;
            case 'invite:received':
              this.callbacks.onInviteReceived(msg);
              break;
          }
        } catch {
          // Ignore invalid JSON
        }
      };

      ws.onclose = () => {
        this.callbacks.onStatusChange(false);
        this.ws = null;
        if (!this.disposed) {
          this.reconnectTimer = window.setTimeout(() => this.connect(), 2500);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      this.callbacks.onStatusChange(false);
    }
  }

  private send(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  createRoom(name: string, hostName: string, maxPlayers = 12, mode = 'Sandbox') {
    this.send({ type: 'room:create', name, hostName, maxPlayers, mode });
  }

  joinRoom(
    roomId: string,
    info: { name?: string; x?: number; y?: number; z?: number; rotY?: number; avatar?: AvatarConfig; petType?: PetType | null },
  ) {
    this.send({ type: 'room:join', roomId, ...info });
  }

  sendPlayerState(state: {
    name: string;
    x: number;
    y: number;
    z: number;
    rotY: number;
    anim: string;
    emote: string;
    vehicle: VehicleType | null;
    petType: PetType | null;
    avatar: AvatarConfig;
    score: number;
  }) {
    this.send({ type: 'player:state', ...state });
  }

  sendChat(text: string, sender: string) {
    this.send({ type: 'chat:send', text, sender });
  }

  sendPlaceBlock(block: PlacedBlock) {
    this.send({ type: 'block:place', block });
  }

  sendUpdateBlock(block: PlacedBlock) {
    this.send({ type: 'block:update', block });
  }

  sendRemoveBlock(blockId: string) {
    this.send({ type: 'block:remove', blockId });
  }

  sendInvite(zone: string) {
    this.send({ type: 'invite:send', zone });
  }

  dispose() {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
  }
}
