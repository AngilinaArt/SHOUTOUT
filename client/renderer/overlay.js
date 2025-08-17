// Prevent multiple script executions
if (window.overlayScriptLoaded) {
  console.log(`⚠️ Overlay script already loaded, skipping...`);
} else {
  window.overlayScriptLoaded = true;
  console.log(`🔧 Loading overlay script...`);

  const hamsterEl = document.getElementById("hamster");
const hamsterImg = document.getElementById("hamster-img");
const hamsterBadge = document.getElementById("hamster-badge");
const toastEl = document.getElementById("toast");
const toastsContainer = toastEl; // Use toast element directly as container

function hideHamster() {
  hamsterEl.classList.add("hidden");
  hamsterImg.src = "";
  hamsterBadge.textContent = "";
  hamsterBadge.classList.add("hidden");
}

function hideToast() {
  // If no more items, hide wrapper
  if (!toastsContainer.children.length) {
    toastEl.classList.add("hidden");

    // Deaktiviere Mouse-Events wenn keine Toasts mehr da sind
    checkAndDisableMouseEvents();
  }
}

function checkAndDisableMouseEvents() {
  // Prüfe ob noch Toasts da sind
  if (toastsContainer.children.length === 0) {
    console.log(`🖱️ No more toasts - disabling mouse events`);
    if (window.shoutout && window.shoutout.disableMouseEvents) {
      window.shoutout.disableMouseEvents();
    }
  }
}

let hamsterTimer = null;
let toastTimer = null; // legacy - not used per-item; kept for safety
const MAX_STACK = 6;
const HAMSTER_QUEUE_LIMIT = 20;
const hamsterQueue = [];
let hamsterActive = false;

function buildPlaceholderHamsterDataUrl() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'>
    <defs>
      <radialGradient id='g' cx='70%' cy='30%'>
        <stop offset='0%' stop-color='#fff'/>
        <stop offset='100%' stop-color='#f59e0b'/>
      </radialGradient>
    </defs>
    <circle cx='110' cy='110' r='100' fill='url(#g)'/>
    <circle cx='80' cy='95' r='12' fill='#000' opacity='0.8'/>
    <circle cx='140' cy='95' r='12' fill='#000' opacity='0.8'/>
    <path d='M70 140 Q110 170 150 140' stroke='#000' stroke-width='6' fill='none' opacity='0.9'/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function showHamsterQueued({ variant, durationMs, url, sender }) {
  const candidate = url || `../assets/hamsters/${variant}.png`;

  // Clear previous event handlers to prevent race conditions
  hamsterImg.onerror = null;
  hamsterImg.onload = null;

  hamsterImg.onload = () => {
    console.log("✅ Image loaded successfully");
  };

  hamsterImg.onerror = (error) => {
    console.error("❌ Image load failed, using placeholder:", error);
    hamsterImg.src = buildPlaceholderHamsterDataUrl();
  };

  hamsterImg.src = candidate;
  if (sender) {
    hamsterBadge.textContent = sender;
    hamsterBadge.classList.remove("hidden");
  } else {
    hamsterBadge.textContent = "";
    hamsterBadge.classList.add("hidden");
  }
  hamsterEl.classList.remove("hidden");
  hamsterTimer = setTimeout(() => {
    hideHamster();
    hamsterActive = false;
    processHamsterQueue();
  }, Math.max(300, durationMs || 3000));
}

function processHamsterQueue() {
  if (hamsterActive) return;
  const next = hamsterQueue.shift();
  if (!next) return;
  hamsterActive = true;
  showHamsterQueued(next);
}

window.shoutout.onHamster((evt) => {
  if (hamsterQueue.length >= HAMSTER_QUEUE_LIMIT) return; // drop overflow
  hamsterQueue.push(evt);
  processHamsterQueue();
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Erfolgsmeldung Handler
window.shoutout.onSuccess = ({ message, durationMs }) => {
  console.log(
    `🎯 onSuccess handler called with: durationMs=${durationMs}, messageLength=${
      message ? message.length : 0
    }`
  );

  const wrapper = document.createElement("div");
  wrapper.className = "success-message";

  wrapper.innerHTML = `
    <div class="success-bubble">
      <div class="success-icon">✅</div>
      <div class="success-text">${message}</div>
    </div>
  `;

  console.log(`📝 Adding success message to DOM`);
  toastsContainer.appendChild(wrapper);

  // Nach der angegebenen Zeit ausblenden
  setTimeout(() => {
    if (wrapper.parentElement) {
      wrapper.remove();
    }
  }, durationMs || 4000);

  console.log(
    `✅ Success message displayed: length=${message ? message.length : 0}`
  );
};

// Debug: Teste ob der Handler registriert ist
console.log(
  `🔧 overlay.js: onSuccess handler registered:`,
  typeof window.shoutout.onSuccess
);

// Debug: Teste ob der IPC-Handler funktioniert
if (window.shoutout.onSuccess) {
  console.log(`🔧 overlay.js: onSuccess is available`);

  // Teste den Handler direkt
  try {
    window.shoutout.onSuccess({ message: "TEST", durationMs: 1000 });
    console.log(`🔧 overlay.js: onSuccess test call successful`);
  } catch (error) {
    console.error(`❌ overlay.js: onSuccess test call failed:`, error);
  }
} else {
  console.error(`❌ overlay.js: onSuccess is NOT available`);
}

// Debug: Teste ob der Handler registriert ist
console.log(
  `🔧 onSuccess handler registered:`,
  typeof window.shoutout.onSuccess
);

// Prevent multiple registrations
if (window.toastHandlerRegistered) {
  console.log(`⚠️ Toast handler already registered, skipping...`);
} else {
  window.toastHandlerRegistered = true;
  console.log(`🔧 Registering toast handler...`);
}

window.shoutout.onToast(
  ({ message, severity, durationMs, sender, recipientInfo, senderId }) => {
    console.log(
      `🚨 DEBUG: onToast called with message: "${message}" from ${sender}`
    );
    console.log(
      `🚨 DEBUG: Current toasts in DOM:`,
      toastsContainer.children.length
    );
    const sev = [
      "blue",
      "green",
      "pink",
      "red",
      "info",
      "success",
      "warn",
      "critical",
    ].includes(severity)
      ? severity
      : "blue";
    const safeMsg = escapeHtml(message || "");
    const safeSender = sender ? escapeHtml(sender) : "";
    const safeRecipientInfo = recipientInfo ? escapeHtml(recipientInfo) : "";

    // Sender mit Empfänger-Info kombinieren
    let senderHtml = "";
    if (safeSender) {
      if (safeRecipientInfo) {
        senderHtml = `<div class="sender">${safeSender} <span class="recipient-info">(${safeRecipientInfo})</span></div>`;
      } else {
        senderHtml = `<div class="sender">${safeSender}</div>`;
      }
    }

    console.log(`🚨 DEBUG: Creating toast wrapper for message: "${safeMsg}"`);

    const wrapper = document.createElement("div");
    wrapper.className = `toast-item severity-${sev}`;

    // Eindeutige ID für jeden Toast
    const toastId = `toast-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    wrapper.id = toastId;
    wrapper.dataset.message = safeMsg;
    wrapper.dataset.sender = safeSender;

    console.log(`🚨 DEBUG: Toast wrapper created with ID: ${toastId}`);

    // Toast mit Buttons erstellen
    wrapper.innerHTML = `
      <div class="bubble">
        ${senderHtml}
        <div class="text">${safeMsg}</div>
        <div class="toast-actions hidden">
          <button class="toast-btn toast-ok">OK</button>
          <button class="toast-btn toast-reply">REPLY</button>
        </div>
        <div class="toast-reactions">
          <button class="reaction-btn" data-reaction="love" title="Großartig!">💖</button>
          <button class="reaction-btn" data-reaction="like" title="Gut!">👍</button>
          <button class="reaction-btn" data-reaction="dislike" title="Nicht so gut">👎</button>
          <button class="reaction-btn" data-reaction="party" title="Feiern!">🎉</button>
        </div>
      </div>
    `;

    // Keep all existing toasts - show them stacked
    const existingToasts = toastsContainer.querySelectorAll(".toast-item");
    console.log(
      `📚 Toast ${existingToasts.length + 1} added to stack (total: ${
        existingToasts.length + 1
      }) - Message: "${safeMsg}" from ${safeSender}`
    );

    console.log(
      `🚨 DEBUG: Adding toast to DOM, current count: ${toastsContainer.children.length}`
    );
    toastsContainer.appendChild(wrapper);
    console.log(
      `🚨 DEBUG: Toast added to DOM, new count: ${toastsContainer.children.length}`
    );

    // Auto-scroll to bottom to show newest toast (AFTER adding to DOM)
    setTimeout(() => {
      toastsContainer.scrollTop = toastsContainer.scrollHeight;
    }, 100);
    toastEl.classList.remove("hidden");

    // NO AUTO-REMOVE - Toasts stay until user clicks OK/REPLY
    console.log(`📚 Toast added to stack - stays until user action`);

    // Buttons sofort anzeigen
    const actionsEl = wrapper.querySelector(".toast-actions");
    if (actionsEl) actionsEl.classList.remove("hidden");

    // NO FADE - Toasts stay visible until user action

    // Event-Listener für Buttons
    const okBtn = wrapper.querySelector(".toast-ok");
    const replyBtn = wrapper.querySelector(".toast-reply");

    if (okBtn) {
      okBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        
        // Finde den Toast über die Button-Position im DOM
        const toastElement = okBtn.closest(".toast-item");
        
        // WICHTIG: Prüfe ob dieser Toast noch im DOM ist
        if (toastElement && toastElement.parentElement && toastsContainer.contains(toastElement)) {
          const messageForLog = toastElement.dataset.message;
          
          toastElement.remove();
          console.log(`✅ Toast removed via OK button: ${messageForLog}`);

          // Check immediately after removal
          const remainingCount = toastsContainer.children.length;
          console.log(`🔍 DEBUG: Remaining toasts after removal: ${remainingCount}`);

          // Only hide container if no toasts left
          if (remainingCount === 0) {
            hideToast();
          }
          
          checkAndDisableMouseEvents();
        } else {
          console.log(`⚠️ OK button clicked but toast already removed`);
        }
      });
    }

    if (replyBtn) {
      replyBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        console.log(
          `🖱️ REPLY button clicked for sender: ${safeSender}, senderId: ${senderId}`
        );
        // Toast-Fenster öffnen mit vorausgewähltem Empfänger (verwende senderId statt safeSender)
        if (senderId) {
          console.log(
            `📤 Calling openToastPrompt with targetUser: ${senderId}`
          );
          window.shoutout.openToastPrompt(senderId);
        } else if (safeSender) {
          console.log(
            `📤 Fallback: Calling openToastPrompt with targetUser: ${safeSender}`
          );
          window.shoutout.openToastPrompt(safeSender);
        } else {
          console.log(`📤 Calling openToastPrompt without targetUser`);
          window.shoutout.openToastPrompt();
        }
        // Toast ausblenden
        const toastElement = replyBtn.closest(".toast-item");
        if (toastElement && toastElement.parentElement) {

          toastElement.remove();
        }
        hideToast();
      });
    }

    // Event-Listener für Reaction-Buttons
    const reactionBtns = wrapper.querySelectorAll(".reaction-btn");
    reactionBtns.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        const reaction = btn.getAttribute("data-reaction");
        console.log(
          `💖 Reaction clicked: ${reaction} for senderId: ${senderId}`
        );

        // Sende Reaction zurück zum Absender (with debounce to prevent double-clicks)
        if (window.shoutout.sendReaction && !btn.disabled) {
          btn.disabled = true; // Prevent double-clicks
          window.shoutout.sendReaction(senderId, reaction);

          // Re-enable after short delay
          setTimeout(() => {
            btn.disabled = false;
          }, 1000);
        }

        // Toast nach Reaction entfernen
        const toastElement = btn.closest(".toast-item");
        if (toastElement && toastElement.parentElement) {

          toastElement.remove();
        }
        hideToast();
        checkAndDisableMouseEvents();
      });
    });
  }
);

} // Ende des Script-Load-Guards
