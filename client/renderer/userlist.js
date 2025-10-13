// User List Overlay JavaScript
const userlistContainer = document.getElementById("userlist-container");
let userListOverlay = null;
let hideTimeout = null;
let defaultClickSoundUrl = null;
const audioCache = new Map();
let audioCtx = null;
let gainNode = null;
const preloadedBuffers = new Map();

function ensureAudioContext() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx({ latencyHint: 'interactive' });
      gainNode = audioCtx.createGain();
      gainNode.connect(audioCtx.destination);
    }
    return audioCtx;
  } catch (_) {
    return null;
  }
}

async function preloadWebAudio(url) {
  try {
    const ctx = ensureAudioContext();
    if (!ctx || !url) return;
    const res = await fetch(url, { cache: 'force-cache' });
    const ab = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab);
    preloadedBuffers.set(url, buf);
  } catch (_) { /* noop */ }
}

function getOrCreateAudio(url) {
  if (!url) return null;
  let a = audioCache.get(url);
  if (!a) {
    try {
      a = new Audio(url);
      a.preload = 'auto';
      a.load();
      audioCache.set(url, a);
    } catch (_) { return null; }
  }
  return a;
}

function playClickFeedback(customUrl) {
  const url = customUrl || defaultClickSoundUrl;
  if (!url) return;
  try {
    const ctx = ensureAudioContext();
    const buf = preloadedBuffers.get(url);
    if (ctx && buf) {
      try { if (ctx.state === 'suspended') ctx.resume().catch(()=>{}); } catch(_) {}
      const src = ctx.createBufferSource();
      src.buffer = buf;
      try { gainNode.gain.value = 1.0; } catch(_) {}
      src.connect(gainNode);
      src.start(0);
    } else {
      const base = getOrCreateAudio(url);
      if (base) {
        if (!base.paused && !base.ended) {
          const clone = base.cloneNode(true);
          clone.volume = 1.0;
          clone.play().catch(() => {});
        } else {
          base.volume = 1.0;
          try { base.currentTime = 0; } catch (_) {}
          base.play().catch(() => {});
        }
      }
    }
  } catch (_) {}
}

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

    const header = document.createElement("div");
    header.className = "userlist-header";
    const icon = document.createElement("span");
    icon.className = "userlist-icon";
    icon.textContent = "👥";
    const title = document.createElement("span");
    title.textContent = "Online Users";
    const count = document.createElement("span");
    count.className = "userlist-count";
    count.textContent = String(userCount);
    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(count);

    const content = document.createElement("div");
    content.className = "userlist-content";
    if (userCount === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Keine User online";
      content.appendChild(empty);
    } else {
      for (const u of onlineUsers) {
        const row = document.createElement("div");
        row.className = "user-item";
        const statusDot = document.createElement("span");
        statusDot.className = `user-status ${u.status}`;
        const nameEl = document.createElement("span");
        nameEl.className = "user-name";
        nameEl.textContent = String(u.name ?? "");
        const btn = document.createElement("button");
        btn.className = "user-message-btn";
        btn.setAttribute("data-user-id", String(u.id ?? ""));
        btn.setAttribute("data-user-name", String(u.name ?? ""));
        btn.title = `Send Message to ${String(u.name ?? "")}`;
        btn.textContent = "💬";
        row.appendChild(statusDot);
        row.appendChild(nameEl);
        row.appendChild(btn);
        content.appendChild(row);
      }
    }

    wrapper.appendChild(header);
    wrapper.appendChild(content);

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

      // Low-latency sound on pointerdown
      btn.addEventListener("pointerdown", (e) => {
        try {
          const ctx = ensureAudioContext();
          if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{});
        } catch(_) {}
        try {
          const holder = btn.closest('[data-sound-url]');
          const custom = holder ? holder.getAttribute('data-sound-url') : null;
          playClickFeedback(custom || null);
        } catch (_) {}
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

// Prime/resume audio context on first user gesture to avoid initial lag
try {
  window.addEventListener('pointerdown', function primeCtxOnce() {
    try { const ctx = ensureAudioContext(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{}); } catch(_) {}
  }, { capture: true, once: true });
} catch (_) {}

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
  if (window.userlistAPI.onDefaultClickSound) {
    window.userlistAPI.onDefaultClickSound((url) => {
      defaultClickSoundUrl = url;
      try { preloadWebAudio(url); } catch (_) {}
      try { getOrCreateAudio(url); } catch (_) {}
    });
  }
} else {
  console.error(`❌ window.userlistAPI not available from preload!`);
}

// User list overlay loaded successfully
console.log(`🔧 User list overlay loaded successfully`);
