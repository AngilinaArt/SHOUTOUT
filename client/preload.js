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
  onSound: (handler) => {
    console.log(`🔧 preload.js: onSound handler registered`);
    ipcRenderer.on("play-sound", (_, payload) => {
      console.log(`📨 preload.js: play-sound IPC received:`, payload);
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
  onPreloadSound: (handler) => {
    try {
      ipcRenderer.on("preload-sound", (_, url) => {
        try { handler(url); } catch (_) {}
      });
    } catch (_) {}
  },
  onOverlayPosition: (handler) => {
    try {
      ipcRenderer.on("overlay-position", (_e, mode) => {
        try { handler(mode); } catch (_) {}
      });
    } catch (_) {}
  },
  onPreloadImage: (handler) => {
    try {
      ipcRenderer.on("preload-image", (_, url) => {
        try { handler(url); } catch (_) {}
      });
    } catch (_) {}
  },
  onDefaultClickSound: (handler) => {
    try {
      ipcRenderer.on("default-click-sound", (_, url) => {
        try { handler(url); } catch (_) {}
      });
    } catch (_) {}
  },
  openToastPrompt: (targetUser) =>
    ipcRenderer.invoke("open-toast-prompt", targetUser),

  sendReaction: (targetUserId, reaction) => {
    console.log(`💖 preload.js: sendReaction called:`, {
      targetUserId,
      reaction,
    });
    return ipcRenderer.invoke("send-reaction", { targetUserId, reaction });
  },

  disableMouseEvents: () => {
    console.log(`🖱️ preload.js: disableMouseEvents called`);
    return ipcRenderer.invoke("disable-overlay-mouse-events");
  },
  enableMouseEvents: () => {
    console.log(`🖱️ preload.js: enableMouseEvents called`);
    return ipcRenderer.invoke("enable-overlay-mouse-events");
  },
});

console.log(`🔧 preload.js: Loaded successfully`);
