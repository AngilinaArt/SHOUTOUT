const { contextBridge } = require("electron");
const path = require("path");
const fs = require("fs");

function readJsonSafe(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (_) {
    return null;
  }
}

// Prefer the client package.json
const clientPkgPath = path.join(__dirname, "package.json");
// Fallback to repo root if needed
const rootPkgPath = path.join(__dirname, "..", "package.json");

let pkg = readJsonSafe(clientPkgPath) ||
  readJsonSafe(rootPkgPath) || {
    name: "Shoutout",
    version: "Unknown",
  };

contextBridge.exposeInMainWorld("about", {
  getAppInfo: () => ({
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
  }),
});
