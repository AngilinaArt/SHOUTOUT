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

// Send reaction sound URLs to the renderer (for preload and playback)
ipcRenderer.on("reaction-sounds", (_evt, sounds) => {
  try {
    window.dispatchEvent(
      new CustomEvent("reaction-sounds", { detail: sounds || {} })
    );
  } catch (e) {
    console.error("❌ preload_reaction.js: failed to dispatch reaction-sounds:", e);
  }
});

console.log(`🔧 preload_reaction.js: Loaded successfully`);
