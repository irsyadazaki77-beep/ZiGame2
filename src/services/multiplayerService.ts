export interface MultiplayerParticipant {
  name: string;
  avatar: string;
  score: number;
  finished: boolean;
}

export interface MultiplayerRoom {
  code: string;
  gameId: string;
  status: 'waiting' | 'active' | 'finished';
  createdAt: number;
  updatedAt: number;
  host: MultiplayerParticipant;
  guest: MultiplayerParticipant | null;
  isBotMatch?: boolean;
}

class MultiplayerService {
  private localRooms = new Map<string, MultiplayerRoom>();

  public async createRoom(gameId: string, playerName: string, playerAvatar: string): Promise<MultiplayerRoom> {
    try {
      const res = await fetch('/api/multiplayer/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, playerName, playerAvatar }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          this.localRooms.set(data.room.code, data.room);
          return data.room;
        }
      }
    } catch {}

    // Offline / local fallback room
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const fallback: MultiplayerRoom = {
      code,
      gameId,
      status: 'waiting',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      host: { name: playerName || 'Player 1', avatar: playerAvatar || '👾', score: 0, finished: false },
      guest: null,
    };
    this.localRooms.set(code, fallback);
    return fallback;
  }

  public async joinRoom(code: string, playerName: string, playerAvatar: string): Promise<MultiplayerRoom | null> {
    const cleanCode = code.toUpperCase().trim();
    try {
      const res = await fetch(`/api/multiplayer/rooms/${encodeURIComponent(cleanCode)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, playerAvatar }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          this.localRooms.set(cleanCode, data.room);
          return data.room;
        }
      }
    } catch {}

    const local = this.localRooms.get(cleanCode);
    if (local) {
      local.guest = { name: playerName || 'Challenger', avatar: playerAvatar || '🚀', score: 0, finished: false };
      local.status = 'active';
      return { ...local };
    }
    return null;
  }

  public createBotMatch(gameId: string, playerName: string, playerAvatar: string): MultiplayerRoom {
    const code = `BOT-${Math.floor(100 + Math.random() * 900)}`;
    const room: MultiplayerRoom = {
      code,
      gameId,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      host: { name: playerName || 'Player 1', avatar: playerAvatar || '👾', score: 0, finished: false },
      guest: { name: 'NEON-AI v2', avatar: '🤖', score: 0, finished: false },
      isBotMatch: true,
    };
    this.localRooms.set(code, room);
    return room;
  }

  public async syncScore(
    code: string,
    role: 'host' | 'guest',
    score: number,
    finished = false
  ): Promise<MultiplayerRoom | null> {
    const cleanCode = code.toUpperCase().trim();
    const local = this.localRooms.get(cleanCode);

    if (local?.isBotMatch && local.guest) {
      local.host.score = Math.max(local.host.score, score);
      if (finished) {
        local.host.finished = true;
        local.guest.finished = true;
        local.status = 'finished';
      } else {
        // Simulated live AI rival pacing
        const delta = Math.floor(Math.random() * 15) + 5;
        local.guest.score = Math.max(local.guest.score, Math.floor(score * 0.88) + delta);
      }
      local.updatedAt = Date.now();
      return { ...local };
    }

    try {
      const res = await fetch(`/api/multiplayer/rooms/${encodeURIComponent(cleanCode)}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, score, finished }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          this.localRooms.set(cleanCode, data.room);
          return data.room;
        }
      }
    } catch {}

    if (local) {
      if (role === 'host') {
        local.host.score = Math.max(local.host.score, score);
        if (finished) local.host.finished = true;
      } else if (local.guest) {
        local.guest.score = Math.max(local.guest.score, score);
        if (finished) local.guest.finished = true;
      }
      return { ...local };
    }
    return null;
  }
}

export const multiplayerService = new MultiplayerService();
