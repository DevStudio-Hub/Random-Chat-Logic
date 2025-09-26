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


let waitingUsers = [];
const userRooms = new Map();


function findMatch(currentUser) {
 
  for (let i = 0; i < waitingUsers.length; i++) {
    const user = waitingUsers[i];

    
    const genderMatch =
      currentUser.profile.myGender === user.profile.partnerGender &&
      user.profile.myGender === currentUser.profile.partnerGender;


    const interestsMatch = user.profile.interests.some(interest =>
      currentUser.profile.interests.includes(interest)
    );

    if (genderMatch && interestsMatch) {

      waitingUsers.splice(i, 1);
      return user;
    }
  }

  for (let i = 0; i < waitingUsers.length; i++) {
    const user = waitingUsers[i];

    const genderMatch =
      currentUser.profile.myGender === user.profile.partnerGender &&
      user.profile.myGender === currentUser.profile.partnerGender;

    if (genderMatch) {
      waitingUsers.splice(i, 1);
      return user;
    }
  }

  
  return null;
}


io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("set-profile", (profile) => {
    socket.profile = profile;

  
    let matchedUser = findMatch(socket);

    if (matchedUser) {
      const roomId = `${matchedUser.socket.id}-${socket.id}`;
      socket.join(roomId);
      matchedUser.socket.join(roomId);

      userRooms.set(socket.id, roomId);
      userRooms.set(matchedUser.socket.id, roomId);

     
      socket.emit("matched", {
        partnerGender: matchedUser.profile.myGender,
        interests: matchedUser.profile.interests,
      });

      matchedUser.socket.emit("matched", {
        partnerGender: profile.myGender,
        interests: profile.interests,
      });

      console.log(`Room created: ${roomId}`);
    } else {
      waitingUsers.push({ socket, profile });
      socket.emit("waiting");
    }
  });

  socket.on("message", (text) => {
    const roomId = userRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit("message", { from: "stranger", text });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id}`);
    waitingUsers = waitingUsers.filter(u => u.socket.id !== socket.id);

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

    let matchedUser = findMatch(socket);
    if (matchedUser) {
      const roomId = `${matchedUser.socket.id}-${socket.id}`;
      socket.join(roomId);
      matchedUser.socket.join(roomId);

      userRooms.set(socket.id, roomId);
      userRooms.set(matchedUser.socket.id, roomId);

      socket.emit("matched", {
        partnerGender: matchedUser.profile.myGender,
        interests: matchedUser.profile.interests,
      });
      matchedUser.socket.emit("matched", {
        partnerGender: socket.profile.myGender,
        interests: socket.profile.interests,
      });

      console.log(`Room created: ${roomId}`);
    } else {
      waitingUsers.push({ socket, profile: socket.profile });
      socket.emit("waiting");
    }
  });
});

server.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
