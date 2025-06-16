const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

// Define allowed origin (e.g., your frontend URL)
const allowedOrigin = "https://robot-website-dx5m.vercel.app/"; // or your deployed frontend domain

// Set up CORS for Express
app.use(cors({
  origin: allowedOrigin,
  credentials: true // Allow cookies/auth if needed
}));

const server = http.createServer(app);

// Set up CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  socket.on("move", (direction) => {
    socket.broadcast.emit("move", direction);
  });

  socket.on("camera-data", (chunk) => {
    socket.broadcast.emit("camera-data", chunk);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
