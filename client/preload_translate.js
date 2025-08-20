const { contextBridge, ipcRenderer } = require("electron");

try {
  contextBridge.exposeInMainWorld("translator", {
    translate: (payload) => ipcRenderer.invoke("translate", payload),
    close: () => ipcRenderer.send("translate-close"),
  });
} catch (_) {}

