const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

function requireJsonSafe(filePath) {
  try {
    // Use Node require to parse JSON and benefit from caching
    // This avoids potential encoding edge-cases with fs in dev
    return require(filePath);
  } catch (_) {
    return null;
  }
}

// Prefer the client package.json
const clientPkgPath = path.join(__dirname, "package.json");
// Fallback to repo root if needed
const rootPkgPath = path.join(__dirname, "..", "package.json");

let pkg = requireJsonSafe(clientPkgPath) ||
  requireJsonSafe(rootPkgPath) || {
    name: "Shoutout",
    version: "Unknown",
  };

try { console.log("preload_about: resolved pkg version=", pkg.version, "name=", pkg.name); } catch (_) {}

const aboutData = {
  name: pkg.name || "Shoutout",
  version: pkg.version || "Unknown",
  description:
    "A fun and interactive shoutout application for sending hamsters and messages",
  authors: [
    "Angilina - Main Developer & UI/UX Designer",
    "Claude Sonnet 4 - AI Assistant & Code Contributor",
    "OpenAI GPT - AI Assistant & Code Contributor",
  ],
  features: [
    "🐹 Interactive Hamster Animations",
    "💬 Real-time Toast Messages",
    "👥 Online User Management",
    "🌐 Local Translation (DE↔EN)",
    "🎨 Beautiful Cursor-style Theme",
    "🔧 Professional Logging System",
    "🚀 Cross-platform Desktop App",
  ],
  technologies: [
    "Electron - Desktop Framework",
    "Node.js - Backend Runtime",
    "WebSockets - Real-time Communication",
    "Winston - Professional Logging",
    "HuggingFace Transformers + MarianMT (OPUS-MT) - Local NMT",
    "PyTorch Runtime (CPU) + SentencePiece",
    "Glassmorphism - Modern UI Design",
  ],
  attributions: [
    "Helsinki-NLP/opus-mt-de-en, opus-mt-en-de (OPUS-MT) — CC-BY-4.0",
    "HuggingFace Transformers — Apache-2.0",
    "PyTorch — BSD-style license",
    "SentencePiece — Apache-2.0",
  ],
};

// Expose both an object and a function for robustness
try { console.log("[about] preload: exposing aboutInfo initial version=", aboutData.version); } catch (_) {}
contextBridge.exposeInMainWorld("aboutInfo", aboutData);
contextBridge.exposeInMainWorld("about", {
  getAppInfo: () => aboutData,
});

// Also emit a DOM event so the renderer can react immediately
try {
  window.dispatchEvent(
    new CustomEvent("about-ready", { detail: aboutData })
  );
  console.log("[about] preload: dispatched about-ready with initial data");
} catch (e) { try { console.warn("[about] preload: failed to dispatch about-ready", e); } catch(_) {} }

// Ask main process for authoritative version from package.json (works in dev/prod)
try {
  console.log("[about] preload: requesting get-about-info via IPC");
  ipcRenderer
    .invoke("get-about-info")
    .then((info) => {
      try { console.log("[about] preload: received about info:", info); } catch (_) {}
      if (info && info.version) {
        aboutData.version = String(info.version);
        try {
          window.dispatchEvent(
            new CustomEvent("about-ready", { detail: aboutData })
          );
          console.log("[about] preload: dispatched about-ready with updated version=", aboutData.version);
        } catch (e) { try { console.warn("[about] preload: failed to dispatch updated about-ready", e); } catch(_) {} }
      } else {
        try { console.warn("[about] preload: invalid about info received"); } catch (_) {}
      }
    })
    .catch((e) => { try { console.error("[about] preload: IPC get-about-info failed:", e); } catch(_) {} });
} catch (e) { try { console.error("[about] preload: exception while invoking IPC:", e); } catch(_) {} }
