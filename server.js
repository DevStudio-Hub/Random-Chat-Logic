const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:4200"],
    methods: ["GET", "POST"],
  },
});

let waitingUser = null;

const userRooms = new Map();

io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  if (waitingUser) {
    const roomId = `${waitingUser.id}-${socket.id}`;
    socket.join(roomId);
    waitingUser.join(roomId);

    userRooms.set(socket.id, roomId);
    userRooms.set(waitingUser.id, roomId);

    socket.emit("matched");
    waitingUser.emit("matched");

    console.log(`Room created: ${roomId}`);
    waitingUser = null;
  } else {
    waitingUser = socket;
    socket.emit("waiting");
  }

  socket.on("message", (text) => {
    const roomId = userRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit("message", { from: "stranger", text });
    }
  });

  socket.on("disconnect", () => {
    console.log(` Disconnected: ${socket.id}`);

    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }

    const roomId = userRooms.get(socket.id);
    if (roomId) {
      const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      for (const clientId of clients) {
        if (clientId !== socket.id) {
          io.to(clientId).emit("stranger-disconnected");
          userRooms.delete(clientId);
        }
      }
      userRooms.delete(socket.id);
    }
  });

  socket.on("find-new", () => {
    const oldRoom = userRooms.get(socket.id);
    if (oldRoom) {
      socket.leave(oldRoom);
      userRooms.delete(socket.id);
    }

    if (waitingUser) {
      const roomId = `${waitingUser.id}-${socket.id}`;
      socket.join(roomId);
      waitingUser.join(roomId);

      userRooms.set(socket.id, roomId);
      userRooms.set(waitingUser.id, roomId);

      socket.emit("matched");
      waitingUser.emit("matched");

      waitingUser = null;
    } else {
      waitingUser = socket;
      socket.emit("waiting");
    }
  });
});

server.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
