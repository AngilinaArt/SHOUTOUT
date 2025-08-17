// NEUES, SAUBERES TOAST-SYSTEM V2: STATE-BASIERT
console.log('🔧 NEW OVERLAY V2: Loading...');

// DOM-Elemente
const hamsterEl = document.getElementById("hamster");
const hamsterImg = document.getElementById("hamster-img");
const hamsterBadge = document.getElementById("hamster-badge");
const toastContainer = document.getElementById("toast");

// State Management
let toasts = [];
let toastCounter = 0;
const MAX_TOASTS = 6;

// Hamster System (simplified)
let hamsterQueue = [];
let hamsterActive = false;

function hideHamster() {
  hamsterEl.classList.add("hidden");
  hamsterImg.src = "";
  hamsterBadge.textContent = "";
  hamsterBadge.classList.add("hidden");
}

function processHamsterQueue() {
  if (hamsterActive || hamsterQueue.length === 0) return;

  hamsterActive = true;
  const { variant, durationMs, sender } = hamsterQueue.shift();

  const imageUrl = variant ? `../assets/hamsters/${variant}.png` : null;

  if (imageUrl) {
    hamsterImg.src = imageUrl;
  }

  if (sender) {
    hamsterBadge.textContent = sender;
    hamsterBadge.classList.remove("hidden");
  } else {
    hamsterBadge.classList.add("hidden");
  }

  hamsterEl.classList.remove("hidden");

  setTimeout(() => {
    hideHamster();
    hamsterActive = false;
    processHamsterQueue();
  }, durationMs || 3000);
}

// Render-Funktion: Zeichnet alle Toasts basierend auf dem State neu
function renderToasts() {
  console.log('🎨 Rendering all toasts...', toasts);
  toastContainer.innerHTML = ''; // Leere den Container

  if (toasts.length === 0) {
    toastContainer.classList.add('hidden');
    if (window.shoutout && window.shoutout.disableMouseEvents) {
      window.shoutout.disableMouseEvents();
    }
    return;
  }

  toasts.forEach(toast => {
    const toastDiv = document.createElement('div');
    toastDiv.className = `toast-item severity-${toast.severity}`;
    toastDiv.id = toast.id;
    toastDiv.dataset.senderId = toast.senderId || '';
    toastDiv.dataset.sender = toast.sender || '';

    let senderHtml = '';
    if (toast.sender) {
      if (toast.recipientInfo) {
        senderHtml = `<div class="sender">${toast.sender} <span class="recipient-info">(${toast.recipientInfo})</span></div>`;
      } else {
        senderHtml = `<div class="sender">${toast.sender}</div>`;
      }
    }

    toastDiv.innerHTML = `
      <div class="bubble">
        ${senderHtml}
        <div class="text">${toast.message}</div>
        <div class="toast-actions">
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
    toastContainer.appendChild(toastDiv);
  });

  toastContainer.classList.remove('hidden');
}

// Event-Listener für alle Aktionen
toastContainer.addEventListener('click', function(event) {
  const target = event.target;
  const toastItem = target.closest('.toast-item');
  if (!toastItem) return;

  const toastId = toastItem.id;
  const action = target.classList;

  if (action.contains('toast-ok')) {
    console.log(`✅ OK clicked for toast: ${toastId}`);
    toasts = toasts.filter(t => t.id !== toastId);
    renderToasts();
  } else if (action.contains('toast-reply')) {
    console.log(`💬 Reply to toast: ${toastId}`);
    const senderId = toastItem.dataset.senderId;
    if (window.shoutout && window.shoutout.openToastPrompt) {
      window.shoutout.openToastPrompt(senderId);
    }
    toasts = toasts.filter(t => t.id !== toastId);
    renderToasts();
  } else if (action.contains('reaction-btn')) {
    console.log(`💖 Reaction to toast: ${toastId}`);
    const senderId = toastItem.dataset.senderId;
    const reaction = target.dataset.reaction;
    if (window.shoutout && window.shoutout.sendReaction && senderId) {
      window.shoutout.sendReaction(senderId, reaction);
    }
    toasts = toasts.filter(t => t.id !== toastId);
    renderToasts();
  }
});

function createToast(message, severity, sender, recipientInfo, senderId) {
  const toastId = `toast-${++toastCounter}-${Date.now()}`;

  const newToast = {
    id: toastId,
    message,
    severity,
    sender,
    recipientInfo,
    senderId
  };

  // Füge neuen Toast am ANFANG des Arrays hinzu
  toasts.unshift(newToast);

  // Wenn die maximale Anzahl überschritten ist, entferne den ÄLTESTEN (am Ende des Arrays)
  if (toasts.length > MAX_TOASTS) {
    toasts.pop();
  }

  console.log(`🍞 Toast created and added to state: ${toastId}`);
  renderToasts();
}

function createSuccessMessage(message, durationMs) {
    const successId = `success-${Date.now()}`;

    const newSuccessToast = {
        id: successId,
        message: `<div class="success-bubble"><div class="success-icon">✅</div><div class="success-text">${message}</div></div>`,
        severity: 'success-message', // Spezielle Klasse für das Styling
    };

    toasts.unshift(newSuccessToast);

    if (toasts.length > MAX_TOASTS) {
        toasts.pop();
    }

    renderToasts();

    setTimeout(() => {
        toasts = toasts.filter(t => t.id !== successId);
        renderToasts();
    }, durationMs || 4000);

    console.log(`✅ Success message created: ${successId}`);
}


// Event-Handler Registrierung
if (window.shoutout) {
  window.shoutout.onHamster(function(data) {
    console.log('🐹 NEW OVERLAY V2: Hamster event:', data);
    hamsterQueue.push(data);
    processHamsterQueue();
  });

  window.shoutout.onToast(function(data) {
    console.log('🍞 NEW OVERLAY V2: Toast event:', data);
    const { message, severity = 'blue', sender, recipientInfo, senderId } = data;
    createToast(message, severity, sender, recipientInfo, senderId);
  });

  window.shoutout.onSuccess(function(data) {
      console.log('✅ NEW OVERLAY V2: Success event:', data);
      const { message, durationMs } = data;
      createSuccessMessage(message, durationMs);
  });

  console.log('🔧 NEW OVERLAY V2: All handlers registered');
} else {
  console.error('❌ NEW OVERLAY V2: window.shoutout not available');
}

// Initialer Render
document.addEventListener('DOMContentLoaded', function() {
  renderToasts();
  console.log('🧹 NEW OVERLAY V2: Initial cleanup and render done');
});

console.log('🔧 NEW OVERLAY V2: Loaded successfully');
