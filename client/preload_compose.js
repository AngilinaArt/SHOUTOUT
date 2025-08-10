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
    // Toast-Fenster öffnen (optional mit vorausgewähltem Empfänger)
    openToastPrompt: (targetUser) =>
      ipcRenderer.invoke("open-toast-prompt", targetUser),
    // Empfänger setzen (wird vom Main-Prozess gesendet)
    setTargetUser: (callback) => ipcRenderer.on("set-target-user", callback),
  });
} catch (_e) {
  // noop
}
