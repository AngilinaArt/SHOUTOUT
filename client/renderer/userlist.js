// User List Overlay JavaScript
const userlistContainer = document.getElementById("userlist-container");
let userListOverlay = null;
let hideTimeout = null;

// Funktion zum Anzeigen der User-Liste
function showUserList(users, durationMs = 15000) {
  console.log(`👥 showUserList called with:`, users);

  // Entferne vorhandene Overlay SOFORT und warte auf Animation
  if (userListOverlay) {
    console.log(`🔄 Removing existing overlay`);
    userListOverlay.remove();
    userListOverlay = null;
  }

  // Stoppe vorhandenen Timeout
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  // Warte kurz damit die DOM-Bereinigung abgeschlossen ist
  setTimeout(() => {
    // Erstelle neues Overlay
    const wrapper = document.createElement("div");
    wrapper.className = "userlist-overlay";

    // Force reflow to ensure clean animation start
    wrapper.offsetHeight;

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
    console.log(`🔧 Found ${messageButtons.length} message buttons`);

    messageButtons.forEach((btn, index) => {
      console.log(`🔧 Setting up button ${index}:`, btn);

      btn.addEventListener("click", (e) => {
        console.log(`🖱️ BUTTON CLICKED! Event:`, e);
        e.preventDefault();
        e.stopPropagation();

        const userId = btn.getAttribute("data-user-id");
        const userName = btn.getAttribute("data-user-name");

        console.log(
          `💬 Message button clicked for user: ${userName} (${userId})`
        );

        // Rufe die openToastPrompt Funktion auf
        console.log(`🔧 Checking window.userlistAPI:`, window.userlistAPI);
        if (window.userlistAPI && window.userlistAPI.openToastPrompt) {
          console.log(`✅ Calling openToastPrompt with: ${userId}`);
          window.userlistAPI.openToastPrompt(userId);
        } else {
          console.error(`❌ openToastPrompt not available`, window.userlistAPI);
          console.error(
            `❌ Available keys:`,
            Object.keys(window.userlistAPI || {})
          );
        }

        // Schließe die User-Liste nach dem Klick
        hideUserList();
      });

      // Test: Auch mousedown event hinzufügen
      btn.addEventListener("mousedown", (e) => {
        console.log(`🖱️ MOUSEDOWN on button!`, e);
      });
    });

    console.log(`✅ User list displayed with ${userCount} online users`);

    // Nach der angegebenen Zeit ausblenden
    hideTimeout = setTimeout(() => {
      hideUserList();
    }, durationMs);
  }, 50); // 50ms Delay für DOM-Bereinigung
}

// Funktion zum Ausblenden der User-Liste
function hideUserList() {
  if (!userListOverlay) return;

  // Force reflow to ensure transition reliably starts
  void userListOverlay.offsetWidth;
  userListOverlay.classList.add("fade-out");

  // Notify main process that overlay is hiding
  if (window.userlistAPI && window.userlistAPI.notifyHidden) {
    window.userlistAPI.notifyHidden();
  }

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

// TODO: Funktion zum Updaten der User-Liste (auskommentiert - für Auto-Update, war überflüssig)
/*
function updateUserList(users) {
  if (!userListOverlay) {
    console.log(`🔄 No overlay to update - skipping`);
    return;
  }

  console.log(`🔄 Updating user list with ${users.length} users`);
  
  const userListContent = userListOverlay.querySelector(".userlist-content");
  if (!userListContent) {
    console.error(`❌ Could not find userlist-content to update`);
    return;
  }

  const onlineUsers = users.filter((user) => user.status === "online");
  const userCount = onlineUsers.length;

  // Update nur den Content, nicht das ganze Overlay
  userListContent.innerHTML =
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
          .join("");

  // Event-Listener für neue Message-Buttons hinzufügen
  const messageButtons = userListContent.querySelectorAll(".user-message-btn");
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

  console.log(`✅ User list updated with ${userCount} online users`);
}
*/

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

// TODO: Update Events für Auto-Update (auskommentiert - war überflüssig)
/*
window.addEventListener("userlist-update", (event) => {
  const payload = event.detail;
  console.log(`🔄 userlist.js: Update event received:`, payload);

  if (payload && payload.users) {
    updateUserList(payload.users);
  } else {
    console.error(`❌ userlist.js: Invalid update payload:`, payload);
  }
});
*/

// Erweitere das bestehende userlistAPI um unsere lokalen Funktionen
// (Das preload script hat bereits openToastPrompt definiert)
if (window.userlistAPI) {
  console.log(
    `🔧 Extending existing userlistAPI:`,
    Object.keys(window.userlistAPI)
  );

  // Füge unsere lokalen Funktionen hinzu, aber überschreibe nicht openToastPrompt
  window.userlistAPI.showUserList = (users, durationMs) => {
    return showUserList(users, durationMs);
  };
  window.userlistAPI.hideUserList = () => {
    return hideUserList();
  };
} else {
  console.error(`❌ window.userlistAPI not available from preload!`);
}

// User list overlay loaded successfully
console.log(`🔧 User list overlay loaded successfully`);
