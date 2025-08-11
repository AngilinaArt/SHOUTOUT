const { contextBridge, ipcRenderer } = require("electron");

console.log(`🔧 preload.js: Loading...`);

contextBridge.exposeInMainWorld("shoutout", {
  onHamster: (handler) => {
    console.log(`🔧 preload.js: onHamster handler registered`);
    ipcRenderer.on("show-hamster", (_, payload) => {
      console.log(`📨 preload.js: show-hamster IPC received:`, payload);
      handler(payload);
    });
  },
  onToast: (handler) => {
    console.log(`🔧 preload.js: onToast handler registered`);
    ipcRenderer.on("show-toast", (_, payload) => {
      console.log(`📨 preload.js: show-toast IPC received:`, payload);
      handler(payload);
    });
  },
  onSuccess: (handler) => {
    console.log(
      `🔧 preload.js: onSuccess handler registered with:`,
      typeof handler,
      handler
    );

    // Speichere den Handler in einer globalen Variable
    window.successHandler = handler;

    ipcRenderer.on("show-success", (_, payload) => {
      console.log(`📨 preload.js: show-success IPC received:`, payload);
      console.log(
        `🔧 preload.js: Current handler:`,
        typeof window.successHandler,
        window.successHandler
      );

      if (typeof window.successHandler === "function") {
        window.successHandler(payload);
      } else {
        console.error(
          `❌ preload.js: handler is not a function:`,
          typeof window.successHandler
        );
      }
    });
  },
  openToastPrompt: (targetUser) =>
    ipcRenderer.invoke("open-toast-prompt", targetUser),
});

console.log(`🔧 preload.js: Loaded successfully`);
