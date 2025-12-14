// NEUES, SAUBERES TOAST-SYSTEM V2: STATE-BASIERT
console.log('🔧 NEW OVERLAY V2: Loading...');
const BROADCAST_USE_WEBAUDIO = false; // force HTMLAudio for broadcast reliability
let lastSoundEvent = { url: null, t: 0 };

// DOM-Elemente
const hamsterEl = document.getElementById("hamster");
const hamsterImg = document.getElementById("hamster-img");
const hamsterBadge = document.getElementById("hamster-badge");
const toastContainer = document.getElementById("toast");
const audioCache = new Map();

// Web Audio pipeline for near zero-latency playback
let audioCtx = null;
let gainNode = null;
const preloadedBuffers = new Map(); // url -> AudioBuffer
let defaultClickSoundUrl = null;
const soundIndicator = document.getElementById('sound-indicator');
const soundIndicatorImg = document.getElementById('sound-indicator-img');
const soundCancelBtn = document.getElementById('sound-cancel-btn');
const soundSenderEl = document.getElementById('sound-sender');
let currentSoundPlayback = null; // Tracks currently playing broadcast sound

function stopCurrentBroadcastSound() {
  try {
    if (!currentSoundPlayback) return;
    const p = currentSoundPlayback;
    if (p.hideTimer) { try { clearTimeout(p.hideTimer); } catch(_) {} }
    if (p.mode === 'webaudio' && p.node) {
      try { p.node.stop(0); } catch(_) {}
      try { p.node.disconnect(); } catch(_) {}
    } else if (p.mode === 'html' && p.el) {
      try { p.el.pause(); } catch(_) {}
      try { p.el.currentTime = 0; } catch(_) {}
      if (p._onEnded) { try { p.el.removeEventListener('ended', p._onEnded); } catch(_) {} }
    }
  } catch(_) {}
  try { if (soundIndicator) soundIndicator.classList.add('hidden'); } catch(_) {}
  try { if (soundSenderEl) { soundSenderEl.textContent=''; soundSenderEl.classList.add('hidden'); } } catch(_) {}
  currentSoundPlayback = null;
  // Re-enable click-through when no toast requires interaction
  try {
    if (window.shoutout && window.shoutout.disableMouseEvents) {
      window.shoutout.disableMouseEvents();
    }
  } catch(_) {}
}

function ensureAudioContext() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx({ latencyHint: 'interactive' });
      gainNode = audioCtx.createGain();
      gainNode.connect(audioCtx.destination);
    }
    return audioCtx;
  } catch (_) {
    return null;
  }
}

async function preloadWebAudio(url) {
  try {
    const ctx = ensureAudioContext();
    if (!ctx || !url) return;
    const res = await fetch(url, { cache: 'force-cache' });
    const ab = await res.arrayBuffer();
    // decodeAudioData accepts Promise in modern browsers/Electron
    const buf = await ctx.decodeAudioData(ab);
    preloadedBuffers.set(url, buf);
  } catch (_) {
    // keep silent, fallback will handle
  }
}

function getOrCreateAudio(url) {
  if (!url) return null;
  let a = audioCache.get(url);
  if (!a) {
    try {
      a = new Audio(url);
      a.preload = 'auto';
      try { a.autoplay = false; } catch(_) {}
      try { a.muted = false; } catch(_) {}
      try { a.crossOrigin = 'anonymous'; } catch(_) {}
      try { a.setAttribute('playsinline', 'true'); } catch(_) {}
      a.load();
      audioCache.set(url, a);
    } catch (_) { return null; }
  }
  return a;
}

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
  const { variant, durationMs, sender, url, soundUrl, defaultSoundUrl, sound } = hamsterQueue.shift();

  // Strict: only use provided data URL from main process to avoid cross-origin issues
  const imageUrl = url || null;

  // Install a one-shot error fallback to generic icon
  hamsterImg.onerror = () => {
    hamsterImg.onerror = null; // prevent loops if icon missing
    hamsterImg.src = "../assets/icon/hamster.png";
  };

  if (imageUrl) {
    hamsterImg.src = imageUrl;
  } else {
    // Final fallback: generic icon if no URL/variant
    hamsterImg.src = "../assets/icon/hamster.png";
  }

  if (sender) {
    hamsterBadge.textContent = sender;
    hamsterBadge.classList.remove("hidden");
  } else {
    hamsterBadge.classList.add("hidden");
  }

  hamsterEl.classList.remove("hidden");

  // Play hamster sound if provided
  try {
    if (sound && sound.enabled) {
      const vol = typeof sound.volume === 'number' ? Math.max(0, Math.min(1, sound.volume)) : 1.0;
      const ctx = ensureAudioContext();
      let buf = preloadedBuffers.get(soundUrl);
      if (!buf && defaultSoundUrl) buf = preloadedBuffers.get(defaultSoundUrl);
      if (ctx && buf) {
        try { if (ctx.state === 'suspended') ctx.resume().catch(()=>{}); } catch(_) {}
        const src = ctx.createBufferSource();
        src.buffer = buf;
        try { gainNode.gain.value = vol; } catch(_) {}
        src.connect(gainNode);
        src.start(0);
      } else {
        let base = getOrCreateAudio(soundUrl);
        if (!base && defaultSoundUrl) base = getOrCreateAudio(defaultSoundUrl);
        if (base) {
          if (!base.paused && !base.ended) {
            const clone = base.cloneNode(true);
            clone.volume = vol;
            clone.play().catch(() => {});
          } else {
            base.volume = vol;
            try { base.currentTime = 0; } catch (_) {}
            base.play().catch(() => {});
          }
        }
      }
    }
  } catch (_) {}

  setTimeout(() => {
    hideHamster();
    hamsterActive = false;
    processHamsterQueue();
  }, durationMs || 5000);
}

// Render-Funktion: Zeichnet alle Toasts basierend auf dem State neu
function renderToasts() {
  console.log('🎨 Rendering all toasts...', toasts);
  const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  // Robusteres Leeren des Containers
  while (toastContainer.firstChild) {
    toastContainer.removeChild(toastContainer.firstChild);
  }

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

    if (toast.spoiler) {
      toastDiv.classList.add('is-spoiler');
      if (toast.revealed) toastDiv.classList.add('revealed');
    }

    let senderHtml = '';
    if (toast.sender) {
      if (toast.recipientInfo) {
        senderHtml = `<div class="sender">${escapeHtml(toast.sender)} <span class="recipient-info">(${escapeHtml(toast.recipientInfo)})</span></div>`;
      } else {
        senderHtml = `<div class="sender">${escapeHtml(toast.sender)}</div>`;
      }
    }

    const safeMsg = escapeHtml(toast.message);
    const textHtml = toast.spoiler && !toast.revealed
      ? `<div class="text"><div class="text-content spoiler-content">${safeMsg}</div><div class="spoiler-cover" role="button" tabindex="0" aria-label="Spoiler anzeigen" title="Zum Anzeigen klicken">✨ Zum Anzeigen klicken</div></div>`
      : `<div class="text"><div class="text-content">${safeMsg}</div></div>`;

    toastDiv.innerHTML = `
      <div class="bubble">
        <button class="toast-close" aria-label="Schließen" title="Schließen">✕</button>
        ${senderHtml}
        ${textHtml}
        <div class="toast-actions">
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

  // Spoiler reveal by clicking cover
  if (target.closest && target.closest('.spoiler-cover')) {
    const idx = toasts.findIndex(t => t.id === toastId);
    if (idx !== -1) {
      toasts[idx] = { ...toasts[idx], revealed: true };
      renderToasts();
      return; // stop further handling
    }
  }

  if (action.contains('toast-close') || action.contains('toast-ok')) {
    console.log(`✅ OK clicked for toast: ${toastId}`);
    // Sanft ausblenden, um sauberes Repaint zu erzwingen
    toastItem.classList.add('removing');
    // Force reflow, damit Transition sicher startet
    void toastItem.offsetWidth;
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== toastId);
      renderToasts();
    }, 140);
  } else if (action.contains('toast-reply')) {
    console.log(`💬 Reply to toast: ${toastId}`);
    const senderId = toastItem.dataset.senderId;
    if (window.shoutout && window.shoutout.openToastPrompt) {
      window.shoutout.openToastPrompt(senderId);
    }
    toastItem.classList.add('removing');
    void toastItem.offsetWidth;
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== toastId);
      renderToasts();
    }, 140);
  } else if (action.contains('reaction-btn')) {
    console.log(`💖 Reaction to toast: ${toastId}`);
    const senderId = toastItem.dataset.senderId;
    const reaction = target.dataset.reaction;
    if (window.shoutout && window.shoutout.sendReaction && senderId) {
      window.shoutout.sendReaction(senderId, reaction);
    }
    toastItem.classList.add('removing');
    void toastItem.offsetWidth;
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== toastId);
      renderToasts();
    }, 140);
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
    senderId,
    spoiler: false,
    revealed: false
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
        message: `<div class="success-bubble"><div class="success-icon">✅</div><div class="success-text">${String(message ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;')}</div></div>`,
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
  // Accept preload signal from main to fetch+decode early
  if (window.shoutout.onPreloadSound) {
    window.shoutout.onPreloadSound((url) => {
      try { preloadWebAudio(url); } catch (_) {}
      try { getOrCreateAudio(url); } catch (_) {}
    });
  }
  window.shoutout.onHamster(function(data) {
    console.log('🐹 NEW OVERLAY V2: Hamster event:', data);
    hamsterQueue.push(data);
    processHamsterQueue();
  });

  // React to overlay position mode (top-right vs center)
  if (window.shoutout.onOverlayPosition) {
    window.shoutout.onOverlayPosition((mode) => {
      try {
        const center = String(mode) === 'center';
        document.body.classList.toggle('pos-center', center);
      } catch (_) {}
    });
  }

  window.shoutout.onToast(function(data) {
    console.log('🍞 NEW OVERLAY V2: Toast event:', data);
    const { message, severity = 'blue', sender, recipientInfo, senderId, spoiler, soundUrl, sound } = data;
    try {
      if (sound && sound.enabled) {
        const vol = typeof sound.volume === 'number' ? Math.max(0, Math.min(1, sound.volume)) : 1.0;
        // Prefer WebAudio if buffer is ready for this URL
        // We won't use WebAudio for broadcast; rely on HTMLAudio for reliability
        if (BROADCAST_USE_WEBAUDIO && ctx && buf) {
          try { if (ctx.state === 'suspended') ctx.resume().catch(()=>{}); } catch(_) {}
          const src = ctx.createBufferSource();
          src.buffer = buf;
          try { gainNode.gain.value = vol; } catch(_) {}
          src.connect(gainNode);
          src.start(0);
        } else {
          // Fallback: HTMLAudio (cached)
          const base = getOrCreateAudio(soundUrl);
          if (base) {
            if (!base.paused && !base.ended) {
              const clone = base.cloneNode(true);
              clone.volume = vol;
              clone.play().catch(() => {});
            } else {
              base.volume = vol;
              try { base.currentTime = 0; } catch (_) {}
              base.play().catch(() => {});
            }
          }
        }
      }
    } catch (_) {}
    const toastId = `toast-${++toastCounter}-${Date.now()}`;
    const newToast = {
      id: toastId,
      message,
      severity,
      sender,
      recipientInfo,
      senderId,
      spoiler: Boolean(spoiler),
      revealed: false,
    };
    toasts.unshift(newToast);
    if (toasts.length > MAX_TOASTS) toasts.pop();
    renderToasts();
  });

  // Generic sound playback with visual indicator and cancel support
  if (window.shoutout.onSound) {
    window.shoutout.onSound(function(data) {
      try {
        const { soundUrl, volume, iconUrl, sender } = data || {};
        console.log('🔊 onSound event received:', data);
        if (!soundUrl) return;
        // Deduplicate fast duplicates (local echo + WS echo)
        const now = Date.now();
        if (lastSoundEvent.url === soundUrl && now - lastSoundEvent.t < 600) {
          console.log('⏭️ Skipping duplicate sound event for', soundUrl);
          return;
        }
        lastSoundEvent = { url: soundUrl, t: now };
        const vol = typeof volume === 'number' ? Math.max(0, Math.min(1, volume)) : 1.0;

        // Stop previous broadcast sound if still running
        stopCurrentBroadcastSound();

        // Show small speaker indicator while playing (hide only on end/stop)
        try {
          if (iconUrl && soundIndicator && soundIndicatorImg) {
            soundIndicatorImg.src = iconUrl;
            soundIndicator.classList.remove('hidden');
          }
          if (soundSenderEl) {
            if (sender && String(sender).trim()) {
              soundSenderEl.textContent = `von ${String(sender).trim()}`;
              soundSenderEl.classList.remove('hidden');
            } else {
              soundSenderEl.textContent = '';
              soundSenderEl.classList.add('hidden');
            }
          }
        } catch(_) {}
        // Ensure overlay receives clicks for the stop button
        try { if (window.shoutout && window.shoutout.enableMouseEvents) window.shoutout.enableMouseEvents(); } catch(_) {}

        {
          console.log('🎵 Playing via HTMLAudio element');
          const el = getOrCreateAudio(soundUrl) || new Audio(soundUrl);
          if (el) {
            try { el.volume = vol; } catch(_) {}
            try { el.currentTime = 0; } catch(_) {}
            try { el.muted = false; } catch(_) {}
            try { el.autoplay = true; } catch(_) {}
            try { el.crossOrigin = 'anonymous'; } catch(_) {}
            try { el.setAttribute('playsinline','true'); } catch(_) {}
            const onEnded = () => { stopCurrentBroadcastSound(); };
            const onError = () => { stopCurrentBroadcastSound(); };
            try { el.addEventListener('ended', onEnded, { once: true }); } catch(_) {}
            try { el.addEventListener('error', onError, { once: true }); } catch(_) {}
            try { el.addEventListener('loadedmetadata', () => console.log('ℹ️ loadedmetadata', { duration: el.duration })); } catch(_) {}
            try { el.addEventListener('canplay', () => console.log('ℹ️ canplay')); } catch(_) {}
            try { el.addEventListener('canplaythrough', () => console.log('ℹ️ canplaythrough')); } catch(_) {}
            try { el.addEventListener('stalled', () => console.log('⚠️ stalled')); } catch(_) {}
            try { el.addEventListener('suspend', () => console.log('ℹ️ suspend')); } catch(_) {}
            // Keep indicator until 'ended' or manual stop — no duration-based timer
            currentSoundPlayback = { mode: 'html', el, _onEnded: onEnded };
            el.play().then(() => { console.log('▶️ HTMLAudio playback started'); }).catch((err) => { console.warn('⚠️ HTMLAudio play() rejected:', err); });
          }
        }
      } catch (_) {}
    });
  }
  
  if (window.shoutout.onDefaultClickSound) {
    window.shoutout.onDefaultClickSound((url) => {
      defaultClickSoundUrl = url;
      try { preloadWebAudio(url); } catch (_) {}
      try { getOrCreateAudio(url); } catch (_) {}
    });
  }
  if (window.shoutout.onPreloadImage) {
    window.shoutout.onPreloadImage((url) => {
      try {
        const img = new Image();
        img.src = url;
      } catch (_) {}
    });
  }

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

// Prime/resume audio context on first user gesture to avoid initial lag
try {
  window.addEventListener('pointerdown', function primeCtxOnce() {
    try { const ctx = ensureAudioContext(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{}); } catch(_) {}
    try { window.removeEventListener('pointerdown', primeCtxOnce, { capture: true }); } catch(_) {}
  }, { capture: true, once: true });
} catch (_) {}

// Click the indicator to cancel current sound
try {
  if (soundIndicator) {
    soundIndicator.addEventListener('click', (e) => {
      e.preventDefault();
      stopCurrentBroadcastSound();
    });
  }
  if (soundCancelBtn) {
    soundCancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stopCurrentBroadcastSound();
    });
  }
} catch (_) {}

// Utility: play click feedback with override if provided
function playClickFeedback(customUrl) {
  const url = customUrl || defaultClickSoundUrl;
  if (!url) return;
  try {
    const ctx = ensureAudioContext();
    const buf = preloadedBuffers.get(url);
    if (ctx && buf) {
      try { if (ctx.state === 'suspended') ctx.resume().catch(()=>{}); } catch(_) {}
      const src = ctx.createBufferSource();
      src.buffer = buf;
      try { gainNode.gain.value = 1.0; } catch(_) {}
      src.connect(gainNode);
      src.start(0);
    } else {
      const base = getOrCreateAudio(url);
      if (base) {
        if (!base.paused && !base.ended) {
          const clone = base.cloneNode(true);
          clone.volume = 1.0;
          clone.play().catch(() => {});
        } else {
          base.volume = 1.0;
          try { base.currentTime = 0; } catch (_) {}
          base.play().catch(() => {});
        }
      }
    }
  } catch (_) {}
}

// Low-latency click feedback on pointerdown (earlier than 'click')
toastContainer.addEventListener('pointerdown', function(event) {
  try {
    // Make sure context is resumed ASAP to minimize latency
    try { const ctx = ensureAudioContext(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{}); } catch(_) {}
    const el = event.target;
    const holder = el && el.closest ? el.closest('[data-sound-url]') : null;
    const custom = holder ? holder.getAttribute('data-sound-url') : null;
    playClickFeedback(custom || null);
  } catch (_) {}
}, { capture: true });

console.log('🔧 NEW OVERLAY V2: Loaded successfully');

// Quick beep fallback to confirm audio path works
function quickBeep(vol) {
  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume().catch(()=>{}); } catch(_) {} }
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    try { g.gain.value = Math.max(0.05, Math.min(0.3, Number(vol)||0.2)); } catch(_) {}
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    setTimeout(() => { try { osc.stop(); } catch(_) {} try { osc.disconnect(); g.disconnect(); } catch(_) {} }, 150);
  } catch (_) {}
}
