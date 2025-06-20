const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.on("connection", (socket) => {
  console.log("📲 Client connected:", socket.id);

  socket.on("pose-change", (pose) => {
    console.log(`🔄 Relaying pose: ${pose}`);
    socket.broadcast.emit("pose-change", pose);
  });

  socket.on("camera-frame", (data) => {
    socket.broadcast.emit("camera-frame", data);
  });

  socket.on("start-camera", () => {
    socket.broadcast.emit("start-camera");
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
