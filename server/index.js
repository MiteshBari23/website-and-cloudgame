const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Optional for dev
    methods: ["GET", "POST"]
  }
});

app.use(cors());

// ✅ Serve React static build
app.use(express.static(path.join(__dirname, "../dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist", "index.html"));
});

// ✅ Socket events
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("move-ball", (direction) => {
    console.log("🔄 move-ball:", direction);
    socket.broadcast.emit("move-ball", direction);
  });

  socket.on("toggle-camera", (status) => {
    console.log("🎥 toggle-camera:", status);
    io.emit("toggle-camera", status);
  });

  socket.on("camera-frame", (data) => {
    io.emit("camera-frame", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
