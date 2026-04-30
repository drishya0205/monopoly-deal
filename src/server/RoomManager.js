import { GameEngine } from './GameEngine.js';
import { MAX_PLAYERS, MIN_PLAYERS } from '../shared/constants.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.playerToRoom = new Map();
  }

  createRoom(playerId, playerName) {
    const code = this._generateCode();
    const room = {
      code,
      hostId: playerId,
      players: [{ id: playerId, name: playerName, isBot: false, ready: true }],
      game: null,
      started: false,
    };
    this.rooms.set(code, room);
    this.playerToRoom.set(playerId, code);
    return room;
  }

  joinRoom(code, playerId, playerName) {
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };
    if (room.started) return { error: 'Game already started' };
    if (room.players.length >= MAX_PLAYERS) return { error: 'Room is full' };
    if (room.players.find(p => p.id === playerId)) return { error: 'Already in room' };

    room.players.push({ id: playerId, name: playerName, isBot: false, ready: true });
    this.playerToRoom.set(playerId, code);
    return { room };
  }

  addBot(roomCode, hostId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== hostId) return { error: 'Only host can add bots' };
    if (room.players.length >= MAX_PLAYERS) return { error: 'Room is full' };

    const botNames = ['Bot Alice', 'Bot Bob', 'Bot Carol', 'Bot Dave'];
    const botCount = room.players.filter(p => p.isBot).length;
    const botId = `bot_${Date.now()}_${botCount}`;
    const botName = botNames[botCount] || `Bot ${botCount + 1}`;

    room.players.push({ id: botId, name: botName, isBot: true, ready: true });
    return { room, botId, botName };
  }

  removeBot(roomCode, hostId, botId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.hostId !== hostId) return { error: 'Not authorized' };
    room.players = room.players.filter(p => p.id !== botId);
    return { room };
  }

  startGame(roomCode, hostId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== hostId) return { error: 'Only host can start' };
    if (room.players.length < MIN_PLAYERS) return { error: `Need at least ${MIN_PLAYERS} players` };

    room.game = new GameEngine(room.players);
    room.game.startGame();
    room.started = true;
    return { room };
  }

  getRoom(code) { return this.rooms.get(code); }

  getRoomForPlayer(playerId) {
    const code = this.playerToRoom.get(playerId);
    return code ? this.rooms.get(code) : null;
  }

  leaveRoom(playerId) {
    const code = this.playerToRoom.get(playerId);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== playerId);
    this.playerToRoom.delete(playerId);
    if (room.players.length === 0) {
      this.rooms.delete(code);
    } else if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
    }
    return room;
  }

  playerDisconnected(playerId) {
    const room = this.getRoomForPlayer(playerId);
    if (!room || !room.game) return;
    const player = room.game.getPlayer(playerId);
    if (player) player.connected = false;
  }

  playerReconnected(playerId) {
    const room = this.getRoomForPlayer(playerId);
    if (!room || !room.game) return null;
    const player = room.game.getPlayer(playerId);
    if (player) player.connected = true;
    return room;
  }

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }
}
