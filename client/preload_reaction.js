const { contextBridge, ipcRenderer } = require("electron");

console.log(`🔧 preload_reaction.js: Loading...`);

// Expose reactionAPI direkt an das Window
contextBridge.exposeInMainWorld("reactionAPI", {
  // Diese werden vom reaction.js überschrieben, aber wir brauchen sie als Fallback
  showReaction: (fromUser, reaction, durationMs) =>
    console.log("Reaction:", fromUser, reaction),
});

// IPC-Handler für Reaction-Nachrichten - ruft direkt die reaction.js Funktionen auf
ipcRenderer.on("show-reaction", (_, payload) => {
  console.log(`📨 preload_reaction.js: show-reaction IPC received:`, payload);

  // Dispatch ein Custom Event ans DOM
  window.dispatchEvent(
    new CustomEvent("reaction-message", {
      detail: payload,
    })
  );
});

console.log(`🔧 preload_reaction.js: Loaded successfully`);
