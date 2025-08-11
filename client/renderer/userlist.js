// User List Overlay JavaScript
const userlistContainer = document.getElementById("userlist-container");
let userListOverlay = null;
let hideTimeout = null;

// Funktion zum Anzeigen der User-Liste
function showUserList(users, durationMs = 15000) {
  console.log(`👥 showUserList called with:`, users);

  // Entferne vorhandene Overlay
  if (userListOverlay) {
    userListOverlay.remove();
    userListOverlay = null;
  }

  // Stoppe vorhandenen Timeout
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  // Erstelle neues Overlay
  const wrapper = document.createElement("div");
  wrapper.className = "userlist-overlay";

  const onlineUsers = users.filter((user) => user.status === "online");
  const userCount = onlineUsers.length;

  wrapper.innerHTML = `
    <div class="userlist-header">
      <span class="userlist-icon">👥</span>
      <span>Online Users</span>
      <span class="userlist-count">${userCount}</span>
    </div>
    <div class="userlist-content">
      ${
        userCount === 0
          ? '<div class="empty-state">Keine User online</div>'
          : onlineUsers
              .map(
                (user) => `
            <div class="user-item">
              <span class="user-status ${user.status}"></span>
              <span class="user-name">${user.name}</span>
              <button class="user-message-btn" data-user-id="${user.id}" data-user-name="${user.name}" title="Send Message to ${user.name}">💬</button>
            </div>
         `
              )
              .join("")
      }
    </div>
  `;

  userlistContainer.appendChild(wrapper);
  userListOverlay = wrapper;

  // Event-Listener für Message-Buttons hinzufügen
  const messageButtons = wrapper.querySelectorAll(".user-message-btn");
  messageButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const userId = btn.getAttribute("data-user-id");
      const userName = btn.getAttribute("data-user-name");

      console.log(
        `💬 Message button clicked for user: ${userName} (${userId})`
      );

      // Rufe die openToastPrompt Funktion auf
      if (window.userlistAPI && window.userlistAPI.openToastPrompt) {
        window.userlistAPI.openToastPrompt(userId);
      } else {
        console.error(`❌ openToastPrompt not available`);
      }

      // Schließe die User-Liste nach dem Klick
      hideUserList();
    });
  });

  console.log(`✅ User list displayed with ${userCount} online users`);

  // Nach der angegebenen Zeit ausblenden
  hideTimeout = setTimeout(() => {
    hideUserList();
  }, durationMs);
}

// Funktion zum Ausblenden der User-Liste
function hideUserList() {
  if (!userListOverlay) return;

  userListOverlay.classList.add("fade-out");
  setTimeout(() => {
    if (userListOverlay && userListOverlay.parentElement) {
      userListOverlay.remove();
      userListOverlay = null;
    }
  }, 300);

  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

// Höre auf Custom Events vom preload script
window.addEventListener("userlist-message", (event) => {
  const payload = event.detail;
  console.log(`📨 userlist.js: Custom event received:`, payload);

  if (payload && payload.users) {
    showUserList(payload.users, payload.durationMs);
  } else {
    console.error(`❌ userlist.js: Invalid payload:`, payload);
  }
});

// Globale API für das User-List-System
window.userlistAPI = {
  showUserList: (users, durationMs) => {
    return showUserList(users, durationMs);
  },
  hideUserList: () => {
    return hideUserList();
  },
  openToastPrompt: (targetUserId) => {
    console.log(`💬 userlistAPI.openToastPrompt called with: ${targetUserId}`);
    // Diese wird vom preload script gesetzt
    if (window.userlistAPI._openToastPrompt) {
      window.userlistAPI._openToastPrompt(targetUserId);
    } else {
      console.error(`❌ _openToastPrompt not available`);
    }
  },
};

// User list overlay loaded successfully
console.log(`🔧 User list overlay loaded successfully`);
