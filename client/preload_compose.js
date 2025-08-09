const { contextBridge, ipcRenderer } = require("electron");

try {
  contextBridge.exposeInMainWorld("compose", {
    submit: (payload) => ipcRenderer.send("compose-toast-submit", payload),
    cancel: () => ipcRenderer.send("compose-toast-cancel"),
  });
} catch (_e) {
  // noop
}
