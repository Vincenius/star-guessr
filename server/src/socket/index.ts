import { Server as IOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import leoProfanity from 'leo-profanity';
import { getRandomRepoIds, getReposByIds } from '../db';
import { computeRoundScore } from '../scoring';
import { RepoRecord, RepoForGame } from '../types';

const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;
const NICKNAME_RE = /^[a-zA-Z0-9 _-]{2,20}$/;
const REPEAT_CHAR_RE = /(.)\1{4,}/;
const ROUND_DURATION_S = 90;
const REVEAL_DURATION_S = 15;
const COUNTDOWN_DURATION_S = 5;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

interface Player {
  id: string;
  nickname: string;
  socketId: string;
  scores: number[];
  guesses: (number | null)[];
  submitted: boolean[];
  connected: boolean;
}

interface Room {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  repos: (RepoForGame & { stars: number })[];
  currentRound: number;
  phase: 'waiting' | 'playing' | 'reveal' | 'countdown' | 'finished';
  roundTimer: ReturnType<typeof setTimeout> | null;
  countdownTimer: ReturnType<typeof setTimeout> | null;
  roundStartTime: number;
  createdAt: number;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code: string;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function validateNickname(nick: string): string | null {
  if (!NICKNAME_RE.test(nick)) return 'Nickname must be 2–20 characters: letters, digits, spaces, _ or -';
  if (REPEAT_CHAR_RE.test(nick)) return 'Nickname not allowed';
  if (leoProfanity.check(nick)) return 'Nickname not allowed';
  return null;
}

function toRepoForGame(r: RepoRecord): RepoForGame & { stars: number } {
  return {
    id: r.id,
    name: r.name,
    owner: r.owner,
    description: r.description,
    language: r.language,
    created_at: r.created_at,
    topics: JSON.parse(r.topics || '[]') as string[],
    license: r.license,
    file_tree: JSON.parse(r.file_tree || '[]'),
    commits: JSON.parse(r.commits || '[]'),
    stars: r.stars,
  };
}

function sanitizeRepoForGame(r: RepoForGame & { stars: number }): RepoForGame {
  const { stars: _stars, ...rest } = r;
  void _stars;
  return rest;
}

function broadcastRoomState(io: IOServer, room: Room) {
  const playerList = Array.from(room.players.values()).map(p => ({
    id: p.id,
    nickname: p.nickname,
    connected: p.connected,
    isHost: p.id === room.hostId,
  }));
  io.to(room.code).emit('room:updated', { players: playerList, phase: room.phase, currentRound: room.currentRound });
}

function endRound(io: IOServer, room: Room) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  const roundIdx = room.currentRound;
  const repo = room.repos[roundIdx];

  for (const player of room.players.values()) {
    if (!player.submitted[roundIdx]) {
      player.guesses[roundIdx] = 0;
      player.submitted[roundIdx] = true;
      player.scores[roundIdx] = computeRoundScore(0, repo.stars);
    }
  }

  room.phase = 'reveal';

  const reveals = Array.from(room.players.values()).map(p => ({
    playerId: p.id,
    nickname: p.nickname,
    guess: p.guesses[roundIdx],
    score: p.scores[roundIdx],
    connected: p.connected,
  }));

  io.to(room.code).emit('game:round:end', {
    round: roundIdx,
    stars: repo.stars,
    reveals,
  });

  room.countdownTimer = setTimeout(() => {
    if (room.currentRound < 4) {
      room.currentRound++;
      startRound(io, room);
    } else {
      endGame(io, room);
    }
  }, (REVEAL_DURATION_S + COUNTDOWN_DURATION_S) * 1000);
}

function startRound(io: IOServer, room: Room) {
  room.phase = 'playing';
  room.roundStartTime = Date.now();
  const roundIdx = room.currentRound;

  for (const player of room.players.values()) {
    player.submitted[roundIdx] = false;
    player.guesses[roundIdx] = null;
    player.scores[roundIdx] = 0;
  }

  const repo = sanitizeRepoForGame(room.repos[roundIdx]);
  io.to(room.code).emit('game:round:start', { round: roundIdx, repo });

  room.roundTimer = setTimeout(() => {
    endRound(io, room);
  }, ROUND_DURATION_S * 1000);
}

function endGame(io: IOServer, room: Room) {
  room.phase = 'finished';

  const scores = Array.from(room.players.values()).map(p => ({
    playerId: p.id,
    nickname: p.nickname,
    totalScore: p.scores.reduce((a, b) => a + b, 0),
    roundScores: [...p.scores],
    roundGuesses: [...p.guesses],
    connected: p.connected,
  }));

  scores.sort((a, b) => b.totalScore - a.totalScore);
  io.to(room.code).emit('game:finished', { scores });
}

function cleanupExpiredRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      if (room.roundTimer) clearTimeout(room.roundTimer);
      if (room.countdownTimer) clearTimeout(room.countdownTimer);
      rooms.delete(code);
    }
  }
}

setInterval(cleanupExpiredRooms, 5 * 60 * 1000);

export function registerSocketHandlers(io: IOServer) {
  io.on('connection', (socket: Socket) => {
    const playerId = uuidv4();

    socket.on('room:create', (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        socket.emit('room:error', { message: 'Invalid payload' });
        return;
      }
      const { nickname } = data as { nickname?: unknown };
      if (typeof nickname !== 'string') {
        socket.emit('room:error', { message: 'Nickname required' });
        return;
      }
      const nickErr = validateNickname(nickname.trim());
      if (nickErr) {
        socket.emit('room:error', { message: nickErr });
        return;
      }

      const code = generateRoomCode();
      const player: Player = {
        id: playerId,
        nickname: nickname.trim(),
        socketId: socket.id,
        scores: [],
        guesses: [],
        submitted: [],
        connected: true,
      };

      const room: Room = {
        code,
        hostId: playerId,
        players: new Map([[playerId, player]]),
        repos: [],
        currentRound: 0,
        phase: 'waiting',
        roundTimer: null,
        countdownTimer: null,
        roundStartTime: 0,
        createdAt: Date.now(),
      };

      rooms.set(code, room);
      void socket.join(code);

      socket.emit('room:created', {
        code,
        playerId,
        player: { id: playerId, nickname: player.nickname, isHost: true, connected: true },
      });
    });

    socket.on('room:join', (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        socket.emit('room:error', { message: 'Invalid payload' });
        return;
      }
      const { code, nickname } = data as { code?: unknown; nickname?: unknown };

      if (typeof code !== 'string' || !ROOM_CODE_RE.test(code)) {
        socket.emit('room:error', { message: 'Invalid room code' });
        return;
      }
      if (typeof nickname !== 'string') {
        socket.emit('room:error', { message: 'Nickname required' });
        return;
      }
      const nickErr = validateNickname(nickname.trim());
      if (nickErr) {
        socket.emit('room:error', { message: nickErr });
        return;
      }

      const room = rooms.get(code);
      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }
      if (room.phase !== 'waiting') {
        socket.emit('room:error', { message: 'Game already started' });
        return;
      }
      if (room.players.size >= 8) {
        socket.emit('room:error', { message: 'Room is full' });
        return;
      }

      const player: Player = {
        id: playerId,
        nickname: nickname.trim(),
        socketId: socket.id,
        scores: [],
        guesses: [],
        submitted: [],
        connected: true,
      };

      room.players.set(playerId, player);
      void socket.join(code);

      const playerList = Array.from(room.players.values()).map(p => ({
        id: p.id,
        nickname: p.nickname,
        connected: p.connected,
        isHost: p.id === room.hostId,
      }));

      socket.emit('room:joined', { playerId, players: playerList, code });
      socket.to(code).emit('room:player:joined', {
        player: { id: playerId, nickname: player.nickname, connected: true, isHost: false },
      });
    });

    socket.on('room:start', (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        socket.emit('room:error', { message: 'Invalid payload' });
        return;
      }
      const { code } = data as { code?: unknown };
      if (typeof code !== 'string' || !ROOM_CODE_RE.test(code)) {
        socket.emit('room:error', { message: 'Invalid room code' });
        return;
      }

      const room = rooms.get(code);
      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      const requestingPlayer = Array.from(room.players.values()).find(p => p.socketId === socket.id);
      if (!requestingPlayer || requestingPlayer.id !== room.hostId) {
        socket.emit('room:error', { message: 'Only host can start the game' });
        return;
      }
      if (room.phase !== 'waiting') {
        socket.emit('room:error', { message: 'Game already started' });
        return;
      }
      if (room.players.size < 2) {
        socket.emit('room:error', { message: 'At least 2 players required' });
        return;
      }

      const repoIds = getRandomRepoIds(5);
      const records = getReposByIds(repoIds);
      if (records.length < 5) {
        socket.emit('room:error', { message: 'Not enough repos. Run the fetch script first.' });
        return;
      }
      room.repos = records.map(toRepoForGame);
      room.currentRound = 0;

      io.to(code).emit('game:start', { totalRounds: 5 });
      startRound(io, room);
    });

    socket.on('game:guess', (data: unknown) => {
      if (typeof data !== 'object' || data === null) {
        socket.emit('room:error', { message: 'Invalid payload' });
        return;
      }
      const { code, guess } = data as { code?: unknown; guess?: unknown };

      if (typeof code !== 'string' || !ROOM_CODE_RE.test(code)) {
        socket.emit('room:error', { message: 'Invalid room code' });
        return;
      }
      if (typeof guess !== 'number' || !Number.isInteger(guess) || guess < 0) {
        socket.emit('room:error', { message: 'guess must be a non-negative integer' });
        return;
      }

      const room = rooms.get(code);
      if (!room || room.phase !== 'playing') return;

      const player = Array.from(room.players.values()).find(p => p.socketId === socket.id);
      if (!player) return;

      const roundIdx = room.currentRound;
      if (player.submitted[roundIdx]) return;

      player.guesses[roundIdx] = guess;
      player.submitted[roundIdx] = true;
      player.scores[roundIdx] = computeRoundScore(guess, room.repos[roundIdx].stars);

      io.to(code).emit('game:player:submitted', { playerId: player.id, nickname: player.nickname });

      const allSubmitted = Array.from(room.players.values())
        .filter(p => p.connected)
        .every(p => p.submitted[roundIdx]);

      if (allSubmitted) {
        endRound(io, room);
      }
    });

    socket.on('disconnect', () => {
      for (const [code, room] of rooms) {
        const player = room.players.get(playerId);
        if (player && player.socketId === socket.id) {
          player.connected = false;
          io.to(code).emit('player:disconnected', { playerId, nickname: player.nickname });

          if (room.phase === 'playing') {
            const allSubmitted = Array.from(room.players.values())
              .filter(p => p.connected)
              .every(p => p.submitted[room.currentRound]);
            if (allSubmitted) endRound(io, room);
          }
          break;
        }
      }
    });

    socket.on('room:reconnect', (data: unknown) => {
      if (typeof data !== 'object' || data === null) return;
      const { code, oldPlayerId } = data as { code?: unknown; oldPlayerId?: unknown };
      if (typeof code !== 'string' || !ROOM_CODE_RE.test(code)) return;
      if (typeof oldPlayerId !== 'string') return;

      const room = rooms.get(code);
      if (!room) return;

      const player = room.players.get(oldPlayerId);
      if (!player) return;

      player.socketId = socket.id;
      player.connected = true;
      void socket.join(code);

      io.to(code).emit('player:reconnected', { playerId: oldPlayerId, nickname: player.nickname });

      if (room.phase === 'waiting') {
        const playerList = Array.from(room.players.values()).map(p => ({
          id: p.id,
          nickname: p.nickname,
          connected: p.connected,
          isHost: p.id === room.hostId,
        }));
        socket.emit('room:updated', { players: playerList, phase: room.phase, currentRound: room.currentRound });
      } else if (room.phase === 'playing') {
        const repo = sanitizeRepoForGame(room.repos[room.currentRound]);
        const elapsed = (Date.now() - room.roundStartTime) / 1000;
        socket.emit('game:round:start', { round: room.currentRound, repo, elapsed });
      } else if (room.phase === 'finished') {
        const scores = Array.from(room.players.values()).map(p => ({
          playerId: p.id,
          nickname: p.nickname,
          totalScore: p.scores.reduce((a, b) => a + b, 0),
          roundScores: [...p.scores],
          roundGuesses: [...p.guesses],
          connected: p.connected,
        }));
        scores.sort((a, b) => b.totalScore - a.totalScore);
        socket.emit('game:finished', { scores });
      }
    });
  });
}
