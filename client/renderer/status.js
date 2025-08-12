// Status Overlay JavaScript
const statusContainer = document.getElementById("status-container");
let messageCounter = 0;

// Funktion zum Anzeigen von Status-Nachrichten
function showStatusMessage(message, type = "success", durationMs = 4000) {
  const messageId = `status-${++messageCounter}`;

  // Icon basierend auf Typ
  let icon = "✅";
  if (type === "info") icon = "ℹ️";
  else if (type === "warning") icon = "⚠️";
  else if (type === "error") icon = "❌";

  // CSS-Klasse basierend auf Typ
  let cssClass = "status-message";
  if (type !== "success") cssClass += ` ${type}`;

  const wrapper = document.createElement("div");
  wrapper.id = messageId;
  wrapper.className = cssClass;

  wrapper.innerHTML = `
    <div class="status-icon">${icon}</div>
    <div class="status-text">${message}</div>
  `;

  statusContainer.appendChild(wrapper);

  console.log(
    `📊 Status message displayed: type=${type}, length=${
      message ? message.length : 0
    }`
  );

  // Nach der angegebenen Zeit ausblenden
  setTimeout(() => {
    if (wrapper.parentElement) {
      wrapper.classList.add("fade-out");
      setTimeout(() => {
        if (wrapper.parentElement) {
          wrapper.remove();
        }
      }, 300);
    }
  }, durationMs);

  return messageId;
}

// IPC-Handler für Status-Nachrichten
window.statusAPI = {
  showSuccess: (message, durationMs) => {
    return showStatusMessage(message, "success", durationMs);
  },

  showInfo: (message, durationMs) => {
    return showStatusMessage(message, "info", durationMs);
  },

  showWarning: (message, durationMs) => {
    return showStatusMessage(message, "warning", durationMs);
  },

  showError: (message, durationMs) => {
    return showStatusMessage(message, "error", durationMs);
  },
};

// Debug: Teste ob der Status-API funktioniert
console.log(`🔧 Status overlay loaded successfully`);
console.log(`🔧 Status API available:`, typeof window.statusAPI);

// Höre auf Custom Events vom preload script
window.addEventListener("status-message", (event) => {
  const payload = event.detail;
  console.log(`📨 status.js: Custom event received:`, payload);

  if (payload && payload.type && payload.message) {
    showStatusMessage(payload.message, payload.type, payload.durationMs);
  } else {
    console.error(`❌ status.js: Invalid payload:`, payload);
  }
});

// Status-Overlay ist bereit - keine permanenten Debug-Nachrichten mehr
console.log("✅ Status-Overlay bereit für normale Nutzung");
