const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Роздаємо статичні файли (наш index.html) з поточної папки
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const rooms = new Map();

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId }) => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    const room = rooms.get(roomId);
    room.add(socket.id);

    if (room.size === 2) {
      io.to(roomId).emit('gameStart');
    }
  });

  socket.on('updateGrid', (grid) => {
    if (socket.roomId) socket.to(socket.roomId).emit('enemyGrid', grid);
  });

  socket.on('sendGarbage', (amount) => {
    if (socket.roomId) socket.to(socket.roomId).emit('receiveGarbage', amount);
  });

  socket.on('playerGameOver', () => {
    if (socket.roomId) socket.to(socket.roomId).emit('opponentWon');
  });

  socket.on('disconnect', () => {
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      room.delete(socket.id);
      if (room.size === 0) {
        rooms.delete(socket.roomId);
      } else {
        socket.to(socket.roomId).emit('opponentDisconnected');
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
