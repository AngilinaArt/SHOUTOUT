const { contextBridge, ipcRenderer } = require("electron");

console.log(`🔧 preload_userlist.js: Loading...`);

// Expose userlistAPI direkt an das Window
contextBridge.exposeInMainWorld("userlistAPI", {
  // Diese werden vom userlist.js überschrieben, aber wir brauchen sie als Fallback
  showUserList: (users, durationMs) =>
    console.log("UserList:", users, durationMs),
});

// Setze die _openToastPrompt Funktion nach dem Laden
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (window.userlistAPI) {
      window.userlistAPI._openToastPrompt = (targetUserId) => {
        console.log(
          `💬 preload_userlist.js: _openToastPrompt called with: ${targetUserId}`
        );
        ipcRenderer.invoke("open-toast-prompt", targetUserId);
      };
      console.log(`✅ preload_userlist.js: _openToastPrompt function set`);
    }
  }, 100);
});

// IPC-Handler für User-List-Nachrichten - ruft direkt die userlist.js Funktionen auf
ipcRenderer.on("show-userlist", (_, payload) => {
  console.log(`📨 preload_userlist.js: show-userlist IPC received:`, payload);

  // Dispatch ein Custom Event ans DOM
  window.dispatchEvent(
    new CustomEvent("userlist-message", {
      detail: payload,
    })
  );
});

console.log(`🔧 preload_userlist.js: Loaded successfully`);
