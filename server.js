
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5000",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map(); // roomId -> { messages: [], users: new Set() }
const users = new Map(); // socket.id -> { username, room }

// Mock AI Assistant (Production: replace with OpenAI/Groq)
async function generateAIResponse(prompt) {
  return new Promise((resolve) => {
    setTimeout(
      () => {
        const text = prompt.toLowerCase();

        if (text.includes("bug") || text.includes("error")) {
          resolve(`🔍 **Debug Checklist:**
• Array bounds & null pointer checks
• Loop conditions & edge cases
• Recent code changes review
• Console.log suspicious variables
• Stack trace analysis`);
        } else if (text.includes("fix")) {
          resolve(`🔧 **Common Fixes:**
1. Missing semicolons/brackets
2. Restart dev server/IDE
3. Clear browser cache (frontend)
4. Check package versions
5. Share full error + code snippet`);
        } else if (text.includes("help") || text.includes("@ai")) {
          resolve(`🆘 **AI Debug Assistant:**
• **Syntax**: paste broken code
• **Runtime**: share error logs  
• **Logic**: describe expected vs actual
• **Performance**: share algorithm
Just reply with your specific issue!`);
        } else {
          resolve(`🤖 **CodeGuard AI ready!**
Mention @ai with:
• "bug in [your problem]"
• "fix [error message]"
• "help with [language/concept]"`);
        }
      },
      1200 + Math.random() * 800,
    ); // 1.2-2s realistic delay
  });
}

io.on("connection", (socket) => {
  console.log(`👤 ${socket.id.slice(0, 8)} connected`);

  socket.on("joinRoom", ({ roomId, username }) => {
    // Leave previous room
    const prevUser = users.get(socket.id);
    if (prevUser && rooms.has(prevUser.room)) {
      const prevRoom = rooms.get(prevUser.room);
      prevRoom.users.delete(socket.id);
      socket.leave(prevUser.room);
    }

    // Setup new room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        messages: [],
        users: new Set(),
      });
    }

    const room = rooms.get(roomId);
    socket.join(roomId);
    users.set(socket.id, { username, room: roomId });
    room.users.add(socket.id);

    console.log(`📱 ${username} → #${roomId} (${room.users.size} online)`);

    // Send room state
    socket.emit("roomInfo", {
      online: room.users.size,
      messages: room.messages.slice(-30),
    });

    // Notify room
    socket.to(roomId).emit("userJoined", { username });
  });

  socket.on("chatMessage", async ({ text, room: roomId, username }) => {
    const user = users.get(socket.id);
    if (!user || user.room !== roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // User message
    const userMsg = {
      id: Date.now(),
      username,
      text,
      type: "user",
      timestamp: new Date().toLocaleTimeString(),
    };

    room.messages.push(userMsg);
    io.to(roomId).emit("newMessage", userMsg);

    // AI trigger words
    const triggers = ["@ai", "bug", "error", "fix", "help"];
    const shouldTriggerAI = triggers.some((trigger) =>
      text.toLowerCase().includes(trigger),
    );

    if (shouldTriggerAI) {
      const aiText = await generateAIResponse(text);
      const aiMsg = {
        id: Date.now() + 1,
        username: "CodeGuard AI",
        text: aiText,
        type: "ai",
        timestamp: new Date().toLocaleTimeString(),
      };

      room.messages.push(aiMsg);
      io.to(roomId).emit("newMessage", aiMsg);
    }
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user && rooms.has(user.room)) {
      const room = rooms.get(user.room);
      room.users.delete(socket.id);
      socket.to(user.room).emit("userLeft", { username: user.username });
      console.log(
        `📱 ${user.username} left #${user.room} (${room.users.size} online)`,
      );
      users.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 CodeCollab AI Server`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📁 Serving: ./public`);
  console.log(`✅ Ready for connections!\n`);
});
