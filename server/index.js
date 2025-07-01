// index.js (backend)
const express = require("express");
const app = express(); // ✅ move this to the top
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const mongoose = require("mongoose");

// Setup
app.use(cors());
app.use(express.json({ limit: "100mb" }));

// Ensure uploads dir exists
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/robotpose", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const Recording = mongoose.model("Recording", {
  name: String,
  filePath: String,
  createdAt: { type: Date, default: Date.now },
});

// Multer setup
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Upload video
app.post("/upload", upload.single("video"), async (req, res) => {
  const { originalname, path: filePath } = req.file;
  const recording = new Recording({ name: originalname, filePath });
  await recording.save();
  res.json({ message: "Upload successful", id: recording._id });
});

// Get list of recordings
app.get("/recordings", async (req, res) => {
  const recordings = await Recording.find().sort({ createdAt: -1 });
  res.json(recordings);
});

// Serve video by ID
app.get("/video/:id", async (req, res) => {
  const recording = await Recording.findById(req.params.id);
  if (!recording) return res.status(404).send("Not found");
  res.sendFile(path.resolve(recording.filePath));
});

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// WebSocket setup (from your original code)
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const connectedPhones = {};
const connectedLaptops = {};

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("register_phone", (phoneId) => {
    connectedPhones[phoneId] = socket.id;
    io.emit("available_phones", Object.keys(connectedPhones));
  });

  socket.on("register_laptop", () => {
    connectedLaptops[socket.id] = true;
    socket.emit("available_phones", Object.keys(connectedPhones));
  });

  socket.on("request_stream", ({ phoneDeviceId, laptopSocketId }) => {
    const phoneSocketId = connectedPhones[phoneDeviceId];
    if (phoneSocketId) {
      io.to(phoneSocketId).emit("start_webrtc_offer", {
        requestingLaptopSocketId: laptopSocketId,
      });
    }
  });

  socket.on("sdp_offer_from_phone", ({ sdpOffer, phoneDeviceId, requestingLaptopSocketId }) => {
    io.to(requestingLaptopSocketId).emit("sdp_offer_from_phone", {
      sdpOffer,
      phoneDeviceId,
    });
  });

  socket.on("sdp_answer_from_laptop", ({ sdpAnswer, phoneDeviceId }) => {
    const phoneSocketId = connectedPhones[phoneDeviceId];
    if (phoneSocketId) {
      io.to(phoneSocketId).emit("sdp_answer_from_laptop", sdpAnswer);
    }
  });

  socket.on("ice_candidate_from_phone", ({ candidate, phoneDeviceId, requestingLaptopSocketId }) => {
    io.to(requestingLaptopSocketId).emit("ice_candidate_from_phone", candidate);
  });

  socket.on("ice_candidate_from_laptop", ({ candidate, phoneDeviceId }) => {
    const phoneSocketId = connectedPhones[phoneDeviceId];
    if (phoneSocketId) {
      io.to(phoneSocketId).emit("ice_candidate_from_laptop", candidate);
    }
  });

  socket.on("control", ({ cmd, targetPhoneId }) => {
    const phoneSocketId = connectedPhones[targetPhoneId];
    if (phoneSocketId) {
      io.to(phoneSocketId).emit("control", cmd);
    }
  });

  socket.on("pose-change", (pose) => {
    socket.broadcast.emit("pose-change", pose);
  });

  socket.on("joint-control", (data) => {
    socket.broadcast.emit("joint-control", data);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);

    for (const [phoneId, sockId] of Object.entries(connectedPhones)) {
      if (sockId === socket.id) {
        delete connectedPhones[phoneId];
        io.emit("available_phones", Object.keys(connectedPhones));
        break;
      }
    }

    if (connectedLaptops[socket.id]) {
      delete connectedLaptops[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
