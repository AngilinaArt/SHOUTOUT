const { contextBridge, ipcRenderer } = require("electron");

console.log(`🔧 preload_status.js: Loading...`);

// Expose statusAPI direkt an das Window
contextBridge.exposeInMainWorld("statusAPI", {
  // Diese werden vom status.js überschrieben, aber wir brauchen sie als Fallback
  showSuccess: (message, durationMs) => console.log("Success:", message),
  showInfo: (message, durationMs) => console.log("Info:", message),
  showWarning: (message, durationMs) => console.log("Warning:", message),
  showError: (message, durationMs) => console.log("Error:", message),
});

// IPC-Handler für Status-Nachrichten - ruft direkt die status.js Funktionen auf
ipcRenderer.on("show-status", (_, payload) => {
  console.log(`📨 preload_status.js: show-status IPC received:`, payload);

  // Dispatch ein Custom Event ans DOM
  window.dispatchEvent(
    new CustomEvent("status-message", {
      detail: payload,
    })
  );
});

console.log(`🔧 preload_status.js: Loaded successfully`);
