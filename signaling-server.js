const { Server } = require("socket.io");

const io = new Server(process.env.PORT || 3001, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "*", // Will be your Vercel deployment URL
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  const usersInRoom = {}; // { roomId: { socketId: { username, profilePic } } }

  socket.on("join-room", ({ roomId, username, profilePic }) => {
    socket.join(roomId);

    if (!usersInRoom[roomId]) usersInRoom[roomId] = {};
    usersInRoom[roomId][socket.id] = { username, profilePic };

    // Notify others in the room
    socket.to(roomId).emit("user-joined", {
      id: socket.id,
      username,
      profilePic,
    });

    // Send current users to the newly joined socket
    const others = Object.entries(usersInRoom[roomId])
      .filter(([id]) => id !== socket.id)
      .map(([id, user]) => ({ id, ...user }));

    socket.emit("room-users", others);
  });

  socket.on("disconnect", () => {
    for (const roomId in usersInRoom) {
      if (usersInRoom[roomId][socket.id]) {
        socket.to(roomId).emit("user-left", socket.id);
        delete usersInRoom[roomId][socket.id];
      }
    }
  });
});

console.log(`✅ Signaling server running on port ${process.env.PORT || 3001}`);
