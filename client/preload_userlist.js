const { contextBridge, ipcRenderer } = require("electron");

console.log(`🔧 preload_userlist.js: Loading...`);

// Expose userlistAPI direkt an das Window
contextBridge.exposeInMainWorld("userlistAPI", {
  // Diese werden vom userlist.js überschrieben, aber wir brauchen sie als Fallback
  showUserList: (users, durationMs) =>
    console.log("UserList:", users, durationMs),

  // openToastPrompt direkt hier definieren
  openToastPrompt: (targetUserId) => {
    console.log(
      `💬 preload_userlist.js: openToastPrompt called with: ${targetUserId}`
    );
    ipcRenderer.invoke("open-toast-prompt", targetUserId);
  },
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
