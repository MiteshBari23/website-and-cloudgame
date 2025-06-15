const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

// Optional health check
app.get("/", (req, res) => {
  res.send("🤖 WebRTC Robot Server is running");
});

// Store connected clients
const phones = {};
const laptops = {};

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  // 🔧 Phone registers
  socket.on("register_phone", () => {
    phones[socket.id] = socket;
    console.log("📱 Phone registered:", socket.id);
    io.emit("available_phones", Object.keys(phones));
  });

  // 💻 Laptop registers
  socket.on("register_laptop", () => {
    laptops[socket.id] = socket;
    console.log("💻 Laptop registered:", socket.id);
    io.emit("available_phones", Object.keys(phones));
  });

  // 📞 Laptop asks to start stream from phone
  socket.on("request_stream", (targetPhoneId) => {
    if (phones[targetPhoneId]) {
      console.log(`📡 Laptop ${socket.id} requested stream from phone ${targetPhoneId}`);
      phones[targetPhoneId].emit("start_webrtc_offer", socket.id);
    }
  });

  // 📤 Phone sends SDP offer to laptop
  socket.on("sdp_offer_from_phone", ({ offer, laptopSocketId }) => {
    if (laptops[laptopSocketId]) {
      laptops[laptopSocketId].emit("sdp_offer_from_phone", {
        offer,
        phoneSocketId: socket.id
      });
    }
  });

  // 📥 Laptop sends SDP answer to phone
  socket.on("sdp_answer_from_laptop", ({ answer, phoneSocketId }) => {
    if (phones[phoneSocketId]) {
      phones[phoneSocketId].emit("sdp_answer_from_laptop", { answer });
    }
  });

  // ❄️ ICE candidates
  socket.on("ice_candidate_from_phone", ({ candidate, laptopSocketId }) => {
    if (laptops[laptopSocketId]) {
      laptops[laptopSocketId].emit("ice_candidate_from_phone", { candidate });
    }
  });

  socket.on("ice_candidate_from_laptop", ({ candidate, phoneSocketId }) => {
    if (phones[phoneSocketId]) {
      phones[phoneSocketId].emit("ice_candidate_from_laptop", { candidate });
    }
  });

  // 🕹️ Control command from laptop to phone
  socket.on("control", ({ phoneSocketId, command }) => {
    if (phones[phoneSocketId]) {
      phones[phoneSocketId].emit("control", { command });
    }
  });

  // 🔌 Cleanup on disconnect
  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    delete phones[socket.id];
    delete laptops[socket.id];
    io.emit("available_phones", Object.keys(phones));
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
