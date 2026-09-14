const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Кімнати: Map<roomId, { players: Map<socketId, username>, readyRestarts: Set<socketId> }>
const rooms = new Map();

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username || 'Player';

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        players: new Map(),
        readyRestarts: new Set()
      });
    }

    const room = rooms.get(roomId);
    room.players.set(socket.id, socket.username);

    if (room.players.size === 2) {
      room.readyRestarts.clear();
      io.to(roomId).emit('gameStart', { ready: true });
    }
  });

  socket.on('updateGrid', (grid) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('enemyGrid', grid);
    }
  });

  socket.on('sendGarbage', (amount) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('receiveGarbage', amount);
    }
  });

  socket.on('playerGameOver', () => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('opponentWon');
    }
  });

  // Синхронізований рестарт
  socket.on('requestRestart', () => {
    if (!socket.roomId || !rooms.has(socket.roomId)) return;
    const room = rooms.get(socket.roomId);
    room.readyRestarts.add(socket.id);

    if (room.readyRestarts.size >= 2) {
      room.readyRestarts.clear();
      io.to(socket.roomId).emit('matchRestarted');
    } else {
      socket.to(socket.roomId).emit('opponentWantsRestart');
    }
  });

  socket.on('disconnect', () => {
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      room.players.delete(socket.id);
      room.readyRestarts.delete(socket.id);

      if (room.players.size === 0) {
        rooms.delete(socket.roomId);
      } else {
        socket.to(socket.roomId).emit('opponentDisconnected');
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
