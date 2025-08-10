const { contextBridge, ipcRenderer } = require("electron");

try {
  contextBridge.exposeInMainWorld("compose", {
    submit: (payload) => ipcRenderer.send("compose-toast-submit", payload),
    cancel: () => ipcRenderer.send("compose-toast-cancel"),
    // Neue User-Management Funktionen
    loadUsers: () => ipcRenderer.invoke("load-users"),
    refreshUsers: () => ipcRenderer.invoke("refresh-users"),
    // Aktueller User-Name
    getCurrentUser: () => ipcRenderer.invoke("get-current-user"),
    // Neue Funktion zum Leeren des Eingabefelds
    clearInput: (callback) => ipcRenderer.on("clear-input", callback),
  });
} catch (_e) {
  // noop
}
