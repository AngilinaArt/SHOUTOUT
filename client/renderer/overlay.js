// Prevent multiple script executions
if (window.overlayScriptLoaded) {
  console.log(`⚠️ Overlay script already loaded, skipping...`);
} else {
  window.overlayScriptLoaded = true;
  console.log(`🔧 Loading overlay script...`);

  // Wrap everything in an IIFE (Immediately Invoked Function Expression)
  (function () {
    const hamsterEl = document.getElementById("hamster");
    const hamsterImg = document.getElementById("hamster-img");
    const hamsterBadge = document.getElementById("hamster-badge");
    const toastEl = document.getElementById("toast");
    const toastsContainer = document.getElementById("toast");

    function hideHamster() {
      hamsterEl.classList.add("hidden");
      hamsterImg.src = "";
      hamsterBadge.textContent = "";
      hamsterBadge.classList.add("hidden");
    }

    function hideToast() {
      // Prüfe ob noch Toast-Items vorhanden sind
      if (toastsContainer.children.length === 0) {
        toastEl.classList.add("hidden");
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

    // Neuer Toast-Counter für eindeutige IDs
    let toastIdCounter = 0;

    let hamsterTimer = null;
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

    // Hamster Handler - NUR EINMAL REGISTRIEREN
    if (!window.hamsterHandlerRegistered) {
      window.hamsterHandlerRegistered = true;
      console.log(`🔧 Registering hamster handler ONCE...`);
      
      window.shoutout.onHamster((evt) => {
        if (hamsterQueue.length >= HAMSTER_QUEUE_LIMIT) return; // drop overflow
        hamsterQueue.push(evt);
        processHamsterQueue();
      });
    } else {
      console.log(`⚠️ Hamster handler already registered, skipping...`);
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    // Erfolgsmeldung Handler - NUR EINMAL REGISTRIEREN
    if (!window.successHandlerRegistered) {
      window.successHandlerRegistered = true;
      console.log(`🔧 Registering success handler ONCE...`);
      
    window.shoutout.onSuccess = ({ message, durationMs }) => {
      console.log(`🎯 onSuccess handler called`);

      const wrapper = document.createElement("div");
      wrapper.className = "success-message";
      // Eindeutige ID für Success-Messages
      wrapper.id = `success-${Date.now()}-${Math.random()}`;

      wrapper.innerHTML = `
    <div class="success-bubble">
      <div class="success-icon">✅</div>
      <div class="success-text">${message}</div>
    </div>
  `;

      toastsContainer.appendChild(wrapper);

      // Nach der angegebenen Zeit ausblenden
      setTimeout(() => {
        const element = document.getElementById(wrapper.id);
        if (element && element.parentElement) {
          element.remove();
          hideToast(); // Prüfe ob Container versteckt werden soll
        }
      }, durationMs || 4000);
    };
    } else {
      console.log(`⚠️ Success handler already registered, skipping...`);
    }

    // Event-Delegation für Toast-Buttons - NUR EINMAL REGISTRIEREN
    if (!window.toastDelegationRegistered) {
      window.toastDelegationRegistered = true;
      console.log(`🔧 Registering toast button delegation ONCE...`);
      
      // Ein globaler Event-Listener für alle Toast-Buttons
      toastsContainer.addEventListener('click', (event) => {
        const target = event.target;
        const toastElement = target.closest('.toast-item');
        
        if (!toastElement) return;
        
        const toastId = toastElement.id;
        console.log(`🖱️ Click on toast: ${toastId}, button: ${target.className}`);
        
        if (target.classList.contains('toast-ok')) {
          console.log(`✅ OK clicked for toast ${toastId} via delegation`);
          
          // COMPLETE DOM ANALYSIS
          console.log(`🔍 BEFORE REMOVAL - DOM Analysis:`);
          const allToasts = toastsContainer.querySelectorAll('.toast-item');
          console.log(`📊 Total toasts in DOM: ${allToasts.length}`);
          allToasts.forEach((toast, index) => {
            console.log(`  Toast ${index}: ID=${toast.id}, InDOM=${document.contains(toast)}`);
          });
          
          const element = document.getElementById(toastId);
          console.log(`🎯 Target element found: ${!!element}`);
          console.log(`🎯 Target has parent: ${!!(element && element.parentElement)}`);
          console.log(`🎯 Target parent is container: ${element && element.parentElement === toastsContainer}`);
          
          if (element && element.parentElement) {
            element.remove();
            console.log(`🗑️ Toast ${toastId} removed via remove()`);
            
            // CHECK AFTER REMOVAL
            setTimeout(() => {
              console.log(`🔍 AFTER REMOVAL - DOM Analysis:`);
              const allToastsAfter = toastsContainer.querySelectorAll('.toast-item');
              console.log(`📊 Total toasts in DOM: ${allToastsAfter.length}`);
              allToastsAfter.forEach((toast, index) => {
                console.log(`  Toast ${index}: ID=${toast.id}, InDOM=${document.contains(toast)}`);
              });
              
              // Double-check if the specific toast is still there
              const stillThere = document.getElementById(toastId);
              console.log(`🔍 Removed toast still in DOM: ${!!stillThere}`);
              
              hideToast();
              checkAndDisableMouseEvents();
            }, 10);
          }
        } else if (target.classList.contains('toast-reply')) {
          console.log(`💬 REPLY clicked for toast ${toastId} via delegation`);
          // Get senderId from toast data
          const senderId = toastElement.dataset.senderId;
          const sender = toastElement.dataset.sender;
          
          if (senderId) {
            window.shoutout.openToastPrompt(senderId);
          } else if (sender) {
            window.shoutout.openToastPrompt(sender);
          } else {
            window.shoutout.openToastPrompt();
          }
          
          const element = document.getElementById(toastId);
          if (element && element.parentElement) {
            element.remove();
            hideToast();
            checkAndDisableMouseEvents();
          }
        } else if (target.classList.contains('reaction-btn')) {
          const reaction = target.getAttribute('data-reaction');
          console.log(`💖 Reaction clicked: ${reaction} for toast ${toastId} via delegation`);
          
          const senderId = toastElement.dataset.senderId;
          if (window.shoutout.sendReaction && senderId) {
            window.shoutout.sendReaction(senderId, reaction);
          }
          
          const element = document.getElementById(toastId);
          if (element && element.parentElement) {
            element.remove();
            hideToast();
            checkAndDisableMouseEvents();
          }
        }
      });
    }

    // WICHTIG: Überarbeiteter Toast-Handler - NUR EINMAL REGISTRIEREN
    if (!window.toastHandlerRegistered) {
      window.toastHandlerRegistered = true;
      console.log(`🔧 Registering toast handler ONCE...`);

    window.shoutout.onToast(
      ({ message, severity, durationMs, sender, recipientInfo, senderId }) => {
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
        const safeRecipientInfo = recipientInfo
          ? escapeHtml(recipientInfo)
          : "";

        // Generiere eindeutige ID für diesen Toast
        const toastId = `toast-${++toastIdCounter}-${Date.now()}`;

        // Sender mit Empfänger-Info kombinieren
        let senderHtml = "";
        if (safeSender) {
          if (safeRecipientInfo) {
            senderHtml = `<div class="sender">${safeSender} <span class="recipient-info">(${safeRecipientInfo})</span></div>`;
          } else {
            senderHtml = `<div class="sender">${safeSender}</div>`;
          }
        }

        const wrapper = document.createElement("div");
        wrapper.className = `toast-item severity-${sev}`;
        wrapper.id = toastId; // WICHTIG: Eindeutige ID setzen
        wrapper.dataset.senderId = senderId || '';
        wrapper.dataset.sender = safeSender || '';

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

        toastsContainer.appendChild(wrapper);
        toastEl.classList.remove("hidden");

        // Enforce max stack
        while (toastsContainer.children.length > MAX_STACK) {
          const firstChild = toastsContainer.firstElementChild;
          if (firstChild) {
            firstChild.remove();
          }
        }

        // Buttons sofort anzeigen
        const actionsEl = wrapper.querySelector(".toast-actions");
        if (actionsEl) actionsEl.classList.remove("hidden");
        
        // Event-Delegation übernimmt alle Button-Clicks - keine individuellen Listener mehr nötig!
      }
    );
    } else {
      console.log(`⚠️ Toast handler already registered, skipping...`);
    }

    // Beim Laden der Seite sicherstellen, dass der Container leer ist
    document.addEventListener("DOMContentLoaded", () => {
      // Warte bis der Container verfügbar ist
      if (toastsContainer) {
        // Clear any phantom toasts
        toastsContainer.innerHTML = "";
        hideToast();
      } else {
        console.warn(
          `⚠️ toastsContainer not found during DOMContentLoaded, waiting...`
        );
        // Warte bis der Container verfügbar ist
        const waitForContainer = setInterval(() => {
          if (toastsContainer) {
            clearInterval(waitForContainer);
            console.log(`✅ toastsContainer found, clearing...`);
            toastsContainer.innerHTML = "";
            hideToast();
          }
        }, 100);
      }
    });
  })(); // Ende der IIFE
} // Ende des Script-Load-Guards
