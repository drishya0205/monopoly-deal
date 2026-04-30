import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager.js';
import { BotAI } from './BotAI.js';
import { PHASES } from '../shared/constants.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const rooms = new RoomManager();

// Serve static files in production
app.use(express.static(path.join(__dirname, '../../dist')));
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Broadcast game state to all players in a room
function broadcastState(room) {
  if (!room.game) return;
  for (const p of room.players) {
    if (p.isBot) continue;
    const socketId = playerSockets.get(p.id);
    if (socketId) {
      io.to(socketId).emit('game-state', room.game.getStateForPlayer(p.id));
    }
  }
}

// Run bot turns
function processBots(room) {
  if (!room.game || room.game.phase === PHASES.GAME_OVER) return;

  // Handle bot payments first
  if (room.game.phase === PHASES.PAYMENT && room.game.pendingAction) {
    for (const target of room.game.pendingAction.targets) {
      const player = room.game.getPlayer(target.playerId);
      if (player?.isBot && !target.resolved) {
        setTimeout(() => {
          BotAI.handlePayment(room.game, target.playerId);
          broadcastState(room);
          processBots(room);
        }, 800);
        return;
      }
    }
  }

  // Handle bot turns
  const current = room.game.players[room.game.currentPlayerIndex];
  if (current?.isBot && room.game.phase !== PHASES.GAME_OVER) {
    setTimeout(() => {
      if (room.game.phase === PHASES.DRAW) {
        BotAI.takeTurn(room.game, current.id);
      }
      broadcastState(room);
      processBots(room);
    }, 1200);
  }
}

// Map playerId -> socketId
const playerSockets = new Map();
// Map socketId -> playerId
const socketPlayers = new Map();

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('create-room', ({ playerName }, cb) => {
    const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const room = rooms.createRoom(playerId, playerName);
    playerSockets.set(playerId, socket.id);
    socketPlayers.set(socket.id, playerId);
    socket.join(room.code);
    cb({ playerId, roomCode: room.code, room: sanitizeRoom(room) });
  });

  socket.on('join-room', ({ roomCode, playerName }, cb) => {
    const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const result = rooms.joinRoom(roomCode.toUpperCase(), playerId, playerName);
    if (result.error) return cb({ error: result.error });
    playerSockets.set(playerId, socket.id);
    socketPlayers.set(socket.id, playerId);
    socket.join(roomCode);
    io.to(roomCode).emit('room-updated', sanitizeRoom(result.room));
    cb({ playerId, roomCode, room: sanitizeRoom(result.room) });
  });

  socket.on('add-bot', (_, cb) => {
    const playerId = socketPlayers.get(socket.id);
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return cb({ error: 'Not in a room' });
    const result = rooms.addBot(room.code, playerId);
    if (result.error) return cb({ error: result.error });
    io.to(room.code).emit('room-updated', sanitizeRoom(result.room));
    cb({ success: true });
  });

  socket.on('remove-bot', ({ botId }, cb) => {
    const playerId = socketPlayers.get(socket.id);
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return cb({ error: 'Not in a room' });
    const result = rooms.removeBot(room.code, playerId, botId);
    if (result.error) return cb({ error: result.error });
    io.to(room.code).emit('room-updated', sanitizeRoom(result.room));
    cb({ success: true });
  });

  socket.on('start-game', (_, cb) => {
    const playerId = socketPlayers.get(socket.id);
    const room = rooms.getRoomForPlayer(playerId);
    if (!room) return cb({ error: 'Not in a room' });
    const result = rooms.startGame(room.code, playerId);
    if (result.error) return cb({ error: result.error });
    broadcastState(room);
    cb({ success: true });
    // If first player is a bot, process
    processBots(room);
  });

  socket.on('draw-cards', (_, cb) => {
    const playerId = socketPlayers.get(socket.id);
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return cb({ error: 'No active game' });
    const result = room.game.drawCards(playerId);
    if (result.error) return cb({ error: result.error });
    broadcastState(room);
    cb({ success: true });
  });

  socket.on('play-card', ({ cardId, action }, cb) => {
    const playerId = socketPlayers.get(socket.id);
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return cb({ error: 'No active game' });
    const result = room.game.playCard(playerId, cardId, action);
    if (result.error) return cb({ error: result.error });
    broadcastState(room);
    cb(result);
    processBots(room);
  });

  socket.on('end-turn', (_, cb) => {
    const playerId = socketPlayers.get(socket.id);
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return cb({ error: 'No active game' });
    const result = room.game.endTurn(playerId);
    if (result.error) return cb({ error: result.error });
    broadcastState(room);
    cb(result);
    processBots(room);
  });

  socket.on('discard-cards', ({ cardIds }, cb) => {
    const playerId = socketPlayers.get(socket.id);
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return cb({ error: 'No active game' });
    const result = room.game.discardCards(playerId, cardIds);
    broadcastState(room);
    cb(result);
    processBots(room);
  });

  socket.on('pay-debt', ({ cardIds }, cb) => {
    const playerId = socketPlayers.get(socket.id);
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return cb({ error: 'No active game' });
    const result = cardIds.length === 0
      ? room.game.payNothing(playerId)
      : room.game.payDebt(playerId, cardIds);
    if (result.error) return cb({ error: result.error });
    broadcastState(room);
    cb(result);
    processBots(room);
  });

  socket.on('just-say-no', ({ cardId }, cb) => {
    const playerId = socketPlayers.get(socket.id);
    const room = rooms.getRoomForPlayer(playerId);
    if (!room?.game) return cb({ error: 'No active game' });
    const result = room.game.respondJustSayNo(playerId, cardId);
    broadcastState(room);
    cb(result);
    processBots(room);
  });

  socket.on('disconnect', () => {
    const playerId = socketPlayers.get(socket.id);
    if (playerId) {
      rooms.playerDisconnected(playerId);
      const room = rooms.getRoomForPlayer(playerId);
      if (room) broadcastState(room);
      socketPlayers.delete(socket.id);
    }
  });
});

function sanitizeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })),
    started: room.started,
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎴 Monopoly Deal server running on port ${PORT}`));
