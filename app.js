// Socket.IO connection
const socket = io("http://localhost:5000");

// DOM Elements
const themeToggle = document.getElementById("themeToggle");
const body = document.body;

const navItems = document.querySelectorAll(".nav-item");
const tabContents = document.querySelectorAll(".tab-content");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const createRoomBtn = document.getElementById("createRoomBtn");
const roomCards = document.querySelectorAll(".room-card");
const enterRoomBtns = document.querySelectorAll(".enter-room-btn");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");

// State
let currentRoom = null;
let currentUsername = "Guest_" + Math.floor(Math.random() * 1000);

// Initialize
document.addEventListener("DOMContentLoaded", function () {
  setupTheme();
  setupNavigation();
  setupChat();
});

// === THEME TOGGLE (Fixed) ===
function setupTheme() {
  // Default to dark theme
  body.classList.add("dark-theme");
  themeToggle.textContent = "☀️";

  themeToggle.addEventListener("click", () => {
    body.classList.toggle("dark-theme");
    body.classList.toggle("light-theme");

    themeToggle.textContent = body.classList.contains("dark-theme")
      ? "☀️"
      : "🌙";

    localStorage.setItem(
      "theme",
      body.classList.contains("dark-theme") ? "dark" : "light",
    );
  });

  // Load saved theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    body.classList.remove("dark-theme");
    body.classList.add("light-theme");
    themeToggle.textContent = "🌙";
  }
}

// === SIMPLE TAB NAVIGATION ===
function setupNavigation() {
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = item.getAttribute("data-tab");

      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      showTab(tab);
    });
  });
}

function showTab(tabId) {
  tabContents.forEach((content) => content.classList.remove("active"));
  document.getElementById(tabId + "-tab").classList.add("active");
}

// === ROOM JOINING ===
joinRoomBtn.addEventListener("click", () => {
  showTab("rooms");
});

createRoomBtn.addEventListener("click", () => {
  const roomName = prompt("Enter new room name:");
  if (roomName && roomName.trim()) {
    const roomId = roomName.trim().toLowerCase().replace(/\s+/g, "-");
    joinRoom(roomId);
  }
});

roomCards.forEach((card) => {
  card.addEventListener("click", () => {
    const roomId = card.getAttribute("data-room");
    joinRoom(roomId);
  });
});

enterRoomBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const roomId = btn.closest(".room-card").getAttribute("data-room");
    joinRoom(roomId);
  });
});

function joinRoom(roomId) {
  currentRoom = roomId;
  socket.emit("joinRoom", {
    roomId,
    username: currentUsername,
  });

  showTab("chat");

  // Update chat header
  const roomIcon = document.querySelector(".current-room-header .room-icon");
  const onlineCount = document.querySelector(".online-count");
  if (roomIcon) roomIcon.textContent = `#${roomId}`;
  if (onlineCount) onlineCount.textContent = "Joining...";

  // Clear and set welcome message
  chatMessages.innerHTML = `
    <div class="welcome-message">
      <div class="message-bubble ai">
        <div class="ai-avatar">🤖</div>
        <div class="message-content">
          <strong>CodeGuard AI:</strong> Welcome to <strong>#${roomId}</strong>! 
          Type <code>@ai bug</code> or <code>@ai fix</code> for debugging help.
        </div>
      </div>
    </div>
  `;
}

// === CHAT FUNCTIONALITY ===
function setupChat() {
  sendMessageBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
}

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !currentRoom) {
    chatInput.focus();
    return;
  }

  // Add user message immediately (optimistic update)
  addMessage(currentUsername, text, "user");
  chatInput.value = "";

  // Send to server
  socket.emit("chatMessage", {
    text,
    room: currentRoom,
    username: currentUsername,
  });
}

function addMessage(user, text, type = "user") {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message-bubble ${type}`;

  if (type === "ai") {
    messageDiv.innerHTML = `
      <div class="ai-avatar">🤖</div>
      <div class="message-content">
        <strong>${user}:</strong> ${text.replace(/@ai/gi, "").trim()}
      </div>
    `;
  } else if (type === "system") {
    messageDiv.innerHTML = `
      <div class="message-content system">
        ${text}
      </div>
    `;
    messageDiv.classList.add("system");
  } else {
    messageDiv.innerHTML = `
      <div class="message-content">
        <strong>${user}:</strong> ${text}
      </div>
    `;
  }

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatInput.focus();
}

// === SOCKET EVENT LISTENERS ===
socket.on("connect", () => {
  console.log("✅ Connected to server");
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
});

socket.on("userJoined", (data) => {
  addMessage("System", `${data.username} joined the room`, "system");
});

socket.on("userLeft", (data) => {
  addMessage("System", `${data.username} left the room`, "system");
});

socket.on("newMessage", (data) => {
  addMessage(data.username, data.text, data.type || "user");
});

socket.on("roomInfo", (data) => {
  const onlineCount = document.querySelector(".online-count");
  if (onlineCount) {
    onlineCount.textContent = `${data.online || 0} online`;
  }
});

// === NAVIGATION BACK TO ROOMS ===
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && currentRoom) {
    showTab("rooms");
    currentRoom = null;
  }
});

