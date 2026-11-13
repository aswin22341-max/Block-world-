import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  anim: string;
  emote: string;
  vehicle: string | null;
  petType: string | null;
  avatar: Record<string, unknown>;
  score: number;
  lastSeen: number;
}

interface SharedBlock {
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
  category: string;
}

interface RoomState {
  id: string;
  name: string;
  hostName: string;
  maxPlayers: number;
  mode: string;
  players: Map<string, RoomPlayer>;
  blocks: SharedBlock[];
  chat: Array<{ id: string; sender: string; text: string; timestamp: number; isSystem?: boolean }>;
}

const rooms = new Map<string, RoomState>();

function ensureDefaultRooms() {
  const defaults = [
    { id: 'hub-skyline', name: 'Skyline City Hub', hostName: 'Blockverse', maxPlayers: 16, mode: 'Free Roam' },
    { id: 'obby-paradise', name: 'Obby Paradise', hostName: 'Blockverse', maxPlayers: 16, mode: 'Obby Parkour' },
    { id: 'turbo-speedway', name: 'Turbo Speedway', hostName: 'Blockverse', maxPlayers: 12, mode: 'Racing' },
  ];
  for (const d of defaults) {
    if (!rooms.has(d.id)) {
      rooms.set(d.id, {
        ...d,
        players: new Map(),
        blocks: [],
        chat: [
          {
            id: `sys-${d.id}`,
            sender: 'System',
            text: `Welcome to ${d.name}! Use WASD to move, Space to jump, E to interact.`,
            timestamp: Date.now(),
            isSystem: true,
          },
        ],
      });
    }
  }
}

ensureDefaultRooms();

function getPublicRoomList() {
  return Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    hostName: r.hostName,
    playerCount: r.players.size,
    maxPlayers: r.maxPlayers,
    mode: r.mode,
  }));
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: getPublicRoomList() });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: getPublicRoomList() });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clientMeta = new Map<WebSocket, { playerId: string; roomId: string }>();

  function broadcastToRoom(roomId: string, payload: unknown, excludeWs?: WebSocket) {
    const data = JSON.stringify(payload);
    for (const [ws, meta] of clientMeta.entries()) {
      if (meta.roomId === roomId && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  function broadcastRoomList() {
    const data = JSON.stringify({ type: 'rooms:list', rooms: getPublicRoomList() });
    for (const ws of clientMeta.keys()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  wss.on('connection', (ws) => {
    const playerId = `p-${Math.random().toString(36).slice(2, 9)}`;
    clientMeta.set(ws, { playerId, roomId: 'hub-skyline' });

    ws.send(
      JSON.stringify({
        type: 'connected',
        playerId,
        rooms: getPublicRoomList(),
      }),
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const meta = clientMeta.get(ws);
        if (!meta) return;

        if (msg.type === 'room:create') {
          const roomId = `room-${Math.random().toString(36).slice(2, 7)}`;
          const newRoom: RoomState = {
            id: roomId,
            name: String(msg.name || 'Custom World').slice(0, 32),
            hostName: String(msg.hostName || 'Builder').slice(0, 20),
            maxPlayers: Math.min(20, Math.max(2, Number(msg.maxPlayers) || 12)),
            mode: String(msg.mode || 'Sandbox'),
            players: new Map(),
            blocks: [],
            chat: [
              {
                id: `sys-${Date.now()}`,
                sender: 'System',
                text: `Room "${String(msg.name || 'Custom World')}" created.`,
                timestamp: Date.now(),
                isSystem: true,
              },
            ],
          };
          rooms.set(roomId, newRoom);
          broadcastRoomList();
          ws.send(JSON.stringify({ type: 'room:created', roomId }));
          return;
        }

        if (msg.type === 'room:join') {
          const targetRoomId = String(msg.roomId || 'hub-skyline');
          const targetRoom = rooms.get(targetRoomId) || rooms.get('hub-skyline')!;

          // Remove from previous room
          const prevRoom = rooms.get(meta.roomId);
          if (prevRoom && prevRoom.players.has(meta.playerId)) {
            prevRoom.players.delete(meta.playerId);
            broadcastToRoom(prevRoom.id, { type: 'player:left', playerId: meta.playerId }, ws);
          }

          if (targetRoom.players.size >= targetRoom.maxPlayers) {
            ws.send(JSON.stringify({ type: 'room:error', message: 'Room is full' }));
            return;
          }

          meta.roomId = targetRoom.id;
          const player: RoomPlayer = {
            id: meta.playerId,
            name: String(msg.name || 'Player').slice(0, 20),
            x: Number(msg.x) || 0,
            y: Number(msg.y) || 2,
            z: Number(msg.z) || 12,
            rotY: Number(msg.rotY) || 0,
            anim: 'idle',
            emote: 'none',
            vehicle: null,
            petType: msg.petType || null,
            avatar: msg.avatar || {},
            score: Number(msg.score) || 0,
            lastSeen: Date.now(),
          };
          targetRoom.players.set(meta.playerId, player);

          // Send full state to joining client
          ws.send(
            JSON.stringify({
              type: 'room:joined',
              roomId: targetRoom.id,
              roomName: targetRoom.name,
              players: Array.from(targetRoom.players.values()),
              blocks: targetRoom.blocks,
              chat: targetRoom.chat.slice(-40),
            }),
          );

          broadcastToRoom(targetRoom.id, { type: 'player:joined', player }, ws);
          broadcastRoomList();
          return;
        }

        const room = rooms.get(meta.roomId);
        if (!room) return;

        if (msg.type === 'player:state') {
          const p = room.players.get(meta.playerId);
          if (p) {
            p.x = Number(msg.x) || 0;
            p.y = Number(msg.y) || 0;
            p.z = Number(msg.z) || 0;
            p.rotY = Number(msg.rotY) || 0;
            p.anim = String(msg.anim || 'idle');
            p.emote = String(msg.emote || 'none');
            p.vehicle = msg.vehicle || null;
            p.petType = msg.petType || null;
            if (msg.avatar) p.avatar = msg.avatar;
            if (msg.name) p.name = String(msg.name).slice(0, 20);
            if (typeof msg.score === 'number') p.score = msg.score;
            p.lastSeen = Date.now();
            broadcastToRoom(room.id, { type: 'player:state', player: p }, ws);
          }
          return;
        }

        if (msg.type === 'chat:send') {
          const text = String(msg.text || '').trim().slice(0, 200);
          if (!text) return;
          const p = room.players.get(meta.playerId);
          const entry = {
            id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender: p?.name || String(msg.sender || 'Player'),
            text,
            timestamp: Date.now(),
          };
          room.chat.push(entry);
          if (room.chat.length > 80) room.chat.shift();
          broadcastToRoom(room.id, { type: 'chat:message', message: entry });
          return;
        }

        if (msg.type === 'block:place' && msg.block) {
          const b = msg.block as SharedBlock;
          if (!room.blocks.some((existing) => existing.id === b.id)) {
            room.blocks.push(b);
            if (room.blocks.length > 800) room.blocks.shift();
            broadcastToRoom(room.id, { type: 'block:placed', block: b }, ws);
          }
          return;
        }

        if (msg.type === 'block:update' && msg.block) {
          const b = msg.block as SharedBlock;
          const idx = room.blocks.findIndex((existing) => existing.id === b.id);
          if (idx >= 0) {
            room.blocks[idx] = b;
            broadcastToRoom(room.id, { type: 'block:updated', block: b }, ws);
          }
          return;
        }

        if (msg.type === 'block:remove' && msg.blockId) {
          room.blocks = room.blocks.filter((b) => b.id !== msg.blockId);
          broadcastToRoom(room.id, { type: 'block:removed', blockId: msg.blockId }, ws);
          return;
        }

        if (msg.type === 'invite:send') {
          broadcastToRoom(room.id, {
            type: 'invite:received',
            from: room.players.get(meta.playerId)?.name || 'Friend',
            roomId: room.id,
            roomName: room.name,
            targetZone: msg.zone || 'Central Plaza',
          });
          return;
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      const meta = clientMeta.get(ws);
      if (meta) {
        const room = rooms.get(meta.roomId);
        if (room && room.players.has(meta.playerId)) {
          room.players.delete(meta.playerId);
          broadcastToRoom(room.id, { type: 'player:left', playerId: meta.playerId });
        }
        clientMeta.delete(ws);
        broadcastRoomList();
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BLOCKVERSE 3D server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
