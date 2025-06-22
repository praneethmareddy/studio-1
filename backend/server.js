
// server.js

require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

// --- Setup ---
const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST"]
}));

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI;

// --- MongoDB Setup ---
if (MONGO_URI) {
  mongoose.connect(MONGO_URI).then(() => {
    console.log("✅ MongoDB connected");
  }).catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
} else {
  console.warn("⚠️ MONGO_URI not found in .env, skipping MongoDB connection. Chat history will not be saved.");
}

// --- Mongoose Model ---
const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  text: { type: String, required: true },
  userId: { type: String, required: true },
  senderName: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", messageSchema);

// --- In-Memory Store for Socket Info ---
const rooms = {};

// --- Socket.IO Events ---
io.on("connection", (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // Join room
  socket.on("join-room", async ({ roomId, name }) => {
    if (!roomId || !name) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {};
    }
    rooms[roomId][socket.id] = { name };
    
    console.log(`✅ ${name} (${socket.id}) joined room: ${roomId}`);
    
    // Get list of all other users in the room
    const otherUsers = Object.keys(rooms[roomId])
      .filter(id => id !== socket.id)
      .map(id => ({ id, name: rooms[roomId][id].name }));

    // Send the list of existing users to the newly joined user
    socket.emit("existing-users", otherUsers);
    
    // Send previous messages to the newly joined user
    if (MONGO_URI) {
      const messages = await Message.find({ roomId }).sort({ timestamp: 1 });
      socket.emit("previous-messages", messages);
    }

    // Notify others in the room
    socket.to(roomId).emit("user-joined", {
      id: socket.id,
      name
    });
  });

  // Chat Message
  socket.on("send-message", async ({ roomId, message }) => {
    const user = rooms[roomId]?.[socket.id];
    if (!user || !roomId || !message) return;

    const newMsg = {
      roomId,
      text: message,
      userId: socket.id,
      senderName: user.name,
      timestamp: new Date()
    };
    
    // Save to DB if connected
    if (MONGO_URI) {
      await new Message(newMsg).save();
    }

    // Send to other users in the room
    socket.to(roomId).emit("receive-message", newMsg);
  });

  // WebRTC Offer
  socket.on("offer", ({ target, sdp, name }) => {
    io.to(target).emit("offer", {
      sdp,
      caller: socket.id,
      name
    });
  });

  // WebRTC Answer
  socket.on("answer", ({ target, sdp, name }) => {
    io.to(target).emit("answer", {
      sdp,
      answerer: socket.id,
      name
    });
  });

  // ICE Candidate
  socket.on("ice-candidate", ({ target, candidate }) => {
    io.to(target).emit("ice-candidate", {
      candidate,
      from: socket.id
    });
  });

  // Media State Changes
  socket.on("video-state-changed", ({ roomId, isVideoEnabled }) => {
    socket.to(roomId).emit("user-video-state-changed", {
        userId: socket.id,
        isVideoEnabled,
    });
  });

  socket.on("audio-state-changed", ({ roomId, isAudioEnabled }) => {
      socket.to(roomId).emit("user-audio-state-changed", {
          userId: socket.id,
          isAudioEnabled,
      });
  });


  // Disconnect Handling
  socket.on("disconnect", () => {
    let userRoomId = null;
    let userName = 'Unknown';
    // Find the room the user was in
    for (const roomId in rooms) {
        if (rooms[roomId][socket.id]) {
            userRoomId = roomId;
            userName = rooms[roomId][socket.id].name;
            delete rooms[roomId][socket.id];
            if (Object.keys(rooms[roomId]).length === 0) {
                delete rooms[roomId];
            }
            break;
        }
    }
    
    if (userRoomId) {
        io.to(userRoomId).emit("user-disconnected", socket.id);
        console.log(`❌ ${userName} (${socket.id}) disconnected from room ${userRoomId}`);
    } else {
        console.log(`❌ Disconnected: ${socket.id}`);
    }
  });
});

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});
