const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shoutout", {
  onHamster: (handler) =>
    ipcRenderer.on("show-hamster", (_, payload) => handler(payload)),
  onToast: (handler) =>
    ipcRenderer.on("show-toast", (_, payload) => handler(payload)),
  openToastPrompt: (targetUser) =>
    ipcRenderer.invoke("open-toast-prompt", targetUser),
});
