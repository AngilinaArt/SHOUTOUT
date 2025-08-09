const { contextBridge, ipcRenderer } = require("electron");

try {
  contextBridge.exposeInMainWorld("namePrompt", {
    submit: (payload) => ipcRenderer.send("name-submit", payload),
    cancel: () => ipcRenderer.send("name-cancel"),
  });
} catch (_) {}


