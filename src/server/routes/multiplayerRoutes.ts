import { Router } from 'express';
import crypto from 'node:crypto';
import { sendApiError } from '../requestContext';

export interface MultiplayerRoomState {
  code: string;
  gameId: string;
  status: 'waiting' | 'active' | 'finished';
  createdAt: number;
  updatedAt: number;
  host: {
    name: string;
    avatar: string;
    score: number;
    finished: boolean;
  };
  guest: {
    name: string;
    avatar: string;
    score: number;
    finished: boolean;
  } | null;
}

const rooms = new Map<string, MultiplayerRoomState>();
const ROOM_TTL_MS = 1000 * 60 * 30; // 30 minutes

function pruneExpiredRooms(): void {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.updatedAt > ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export const multiplayerRoutes = Router();

// Create a new 1v1 room
multiplayerRoutes.post('/multiplayer/rooms', (req, res) => {
  pruneExpiredRooms();
  const { gameId, playerName, playerAvatar } = req.body || {};

  if (!gameId || typeof gameId !== 'string') {
    return sendApiError(res, 400, 'INVALID_GAME_ID', 'gameId wajib diisi.');
  }

  const code = generateRoomCode();
  const now = Date.now();
  const room: MultiplayerRoomState = {
    code,
    gameId: String(gameId).slice(0, 48),
    status: 'waiting',
    createdAt: now,
    updatedAt: now,
    host: {
      name: String(playerName || 'Player 1').slice(0, 24),
      avatar: String(playerAvatar || '👾').slice(0, 8),
      score: 0,
      finished: false,
    },
    guest: null,
  };

  rooms.set(code, room);
  return res.status(201).json({ success: true, room });
});

// Get room status
multiplayerRoutes.get('/multiplayer/rooms/:code', (req, res) => {
  pruneExpiredRooms();
  const code = String(req.params.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    return sendApiError(res, 404, 'NOT_FOUND', 'Room multiplayer tidak ditemukan atau sudah berakhir.');
  }
  return res.json({ success: true, room });
});

// Join an existing 1v1 room
multiplayerRoutes.post('/multiplayer/rooms/:code/join', (req, res) => {
  pruneExpiredRooms();
  const code = String(req.params.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    return sendApiError(res, 404, 'NOT_FOUND', 'Kode room tidak ditemukan.');
  }

  const { playerName, playerAvatar } = req.body || {};
  room.guest = {
    name: String(playerName || 'Challenger').slice(0, 24),
    avatar: String(playerAvatar || '🚀').slice(0, 8),
    score: 0,
    finished: false,
  };
  room.status = 'active';
  room.updatedAt = Date.now();

  return res.json({ success: true, room });
});

// Sync live score & state inside a 1v1 room
multiplayerRoutes.post('/multiplayer/rooms/:code/sync', (req, res) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    return sendApiError(res, 404, 'NOT_FOUND', 'Room tidak ditemukan.');
  }

  const { role, score, finished } = req.body || {};
  const numericScore = Number.isFinite(Number(score)) ? Math.max(0, Math.floor(Number(score))) : 0;

  if (role === 'host') {
    room.host.score = Math.max(room.host.score, numericScore);
    if (finished) room.host.finished = true;
  } else if (role === 'guest' && room.guest) {
    room.guest.score = Math.max(room.guest.score, numericScore);
    if (finished) room.guest.finished = true;
  }

  if (room.host.finished && room.guest?.finished) {
    room.status = 'finished';
  }
  room.updatedAt = Date.now();

  return res.json({ success: true, room });
});
