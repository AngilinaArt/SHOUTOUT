const { contextBridge, ipcRenderer } = require("electron");

const DEBUG_ABOUT = !!process.env.DEBUG_ABOUT;

function dlog(...args) {
  if (DEBUG_ABOUT) {
    try { console.log(...args); } catch (_) {}
  }
}

// Avoid requiring Node core modules in preload to support sandboxed environments
// Description can be refined by main via IPC if needed.

const aboutData = {
  // Name and version are refined via IPC from main (app metadata)
  name: "Shoutout",
  version: "Unknown",
  // Static description; may be overridden in the future via IPC if desired
  description: "Desktop app for fun, real-time shoutouts with hamsters and messages",
  authors: [
    "Angilina - Main Developer & UI/UX Designer",
    "Claude Sonnet 4 - AI Assistant & Code Contributor",
    "OpenAI GPT - AI Assistant & Code Contributor",
  ],
  features: [
    "🐹 Interactive Hamster Animations",
    "💬 Real-time Toast Messages",
    "👥 Online Users List",
    "🌐 Built-in Translation (server-powered)",
    "🎨 Polished Glassmorphism UI",
    "🚀 Cross-platform Desktop App",
  ],
  technologies: [
    "Electron - Desktop Framework",
    "Node.js - Runtime",
    "WebSockets (ws) - Real-time",
    "HTML/CSS/JavaScript - Renderer UI",
  ],
  attributions: [
    "Translation (server): MarianMT OPUS-MT models — Helsinki-NLP/opus-mt-de-en, opus-mt-en-de",
    "Libraries: HuggingFace Transformers (Apache-2.0), SentencePiece (Apache-2.0), PyTorch (BSD-style)",
    "Optional: CTranslate2 runtime (Apache-2.0) if enabled on server",
  ],
};

// Expose both an object and a function for robustness
try { dlog("[about] preload: exposing aboutInfo initial version=", aboutData.version); } catch (_) {}
contextBridge.exposeInMainWorld("aboutInfo", aboutData);
contextBridge.exposeInMainWorld("about", {
  getAppInfo: () => aboutData,
});

// Also emit a DOM event so the renderer can react immediately
try {
  window.dispatchEvent(
    new CustomEvent("about-ready", { detail: aboutData })
  );
  dlog("[about] preload: dispatched about-ready with initial data");
} catch (e) { try { console.warn("[about] preload: failed to dispatch about-ready", e); } catch(_) {} }

// Ask main process for authoritative version via IPC (works in dev/prod)
try {
  dlog("[about] preload: requesting get-about-info via IPC");
  ipcRenderer
    .invoke("get-about-info")
    .then((info) => {
      try { dlog("[about] preload: received about info:", info); } catch (_) {}
      if (info && info.version) {
        aboutData.version = String(info.version);
        if (info.name) aboutData.name = String(info.name);
        try {
          window.dispatchEvent(
            new CustomEvent("about-ready", { detail: aboutData })
          );
          dlog("[about] preload: dispatched about-ready with updated version=", aboutData.version);
        } catch (e) { try { console.warn("[about] preload: failed to dispatch updated about-ready", e); } catch(_) {} }
      } else {
        try { console.warn("[about] preload: invalid about info received"); } catch (_) {}
      }
    })
    .catch((e) => { try { console.error("[about] preload: IPC get-about-info failed:", e); } catch(_) {} });
} catch (e) { try { console.error("[about] preload: exception while invoking IPC:", e); } catch(_) {} }
