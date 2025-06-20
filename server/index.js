const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const connectedPhones = {}; // { phoneId: socketId }
const connectedLaptops = {}; // { socketId: true }

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket logic
io.on('connection', (socket) => {
  console.log("🟢 Client connected:", socket.id);

  // Register Phone
  socket.on("register_phone", (phoneId) => {
    connectedPhones[phoneId] = socket.id;
    console.log(`📱 Phone registered: ${phoneId}`);
    // Notify laptops of available phones
    io.emit("available_phones", Object.keys(connectedPhones));
  });

  // Register Laptop
  socket.on("register_laptop", () => {
    connectedLaptops[socket.id] = true;
    console.log(`💻 Laptop registered: ${socket.id}`);
    // Send current phone list
    socket.emit("available_phones", Object.keys(connectedPhones));
  });

  // Laptop requests to start WebRTC stream
  socket.on("request_stream", ({ phoneDeviceId, laptopSocketId }) => {
    const phoneSocketId = connectedPhones[phoneDeviceId];
    if (phoneSocketId) {
      io.to(phoneSocketId).emit("start_webrtc_offer", { requestingLaptopSocketId: laptopSocketId });
    }
  });

  // WebRTC Signaling
  socket.on("sdp_offer_from_phone", ({ sdpOffer, phoneDeviceId, requestingLaptopSocketId }) => {
    io.to(requestingLaptopSocketId).emit("sdp_offer_from_phone", { sdpOffer, phoneDeviceId });
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

  // Relay control commands
  socket.on("control", ({ cmd, targetPhoneId }) => {
    const phoneSocketId = connectedPhones[targetPhoneId];
    if (phoneSocketId) {
      io.to(phoneSocketId).emit("control", cmd);
    }
  });

  // Pose change
  socket.on("pose-change", (pose) => {
    socket.broadcast.emit("pose-change", pose);
  });

  // Joint control
  socket.on("joint-control", (data) => {
    socket.broadcast.emit("joint-control", data);
  });

  // Clean up on disconnect
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);

    // Remove from phones if found
    for (const [phoneId, sockId] of Object.entries(connectedPhones)) {
      if (sockId === socket.id) {
        delete connectedPhones[phoneId];
        console.log(`❌ Phone removed: ${phoneId}`);
        io.emit("available_phones", Object.keys(connectedPhones));
        break;
      }
    }

    // Remove from laptops
    if (connectedLaptops[socket.id]) {
      delete connectedLaptops[socket.id];
      console.log(`❌ Laptop removed: ${socket.id}`);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
