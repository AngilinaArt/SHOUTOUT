const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("invite", {
  submit: (payload) => ipcRenderer.send("invite-submit", payload),
  cancel: () => ipcRenderer.send("invite-cancel"),
  onError: (cb) => ipcRenderer.on("invite-error", (_e, data) => cb(data)),
});

