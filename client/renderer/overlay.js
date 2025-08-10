const hamsterEl = document.getElementById("hamster");
const hamsterImg = document.getElementById("hamster-img");
const hamsterBadge = document.getElementById("hamster-badge");
const toastEl = document.getElementById("toast");
const toastsContainer = document.getElementById("toasts");

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
  hamsterImg.onerror = () => {
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

window.shoutout.onToast(
  ({ message, severity, durationMs, sender, recipientInfo }) => {
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

    const wrapper = document.createElement("div");
    wrapper.className = `toast-item severity-${sev}`;
    wrapper.innerHTML = `<div class="bubble">${senderHtml}<div class="text">${safeMsg}</div></div>`;
    toastsContainer.appendChild(wrapper);
    toastEl.classList.remove("hidden");

    // Enforce max stack
    while (toastsContainer.children.length > MAX_STACK) {
      toastsContainer.removeChild(toastsContainer.firstElementChild);
    }

    const ttl = Math.max(500, Math.min(10000, durationMs || 4000));
    setTimeout(() => {
      if (wrapper.parentElement) wrapper.remove();
      hideToast();
    }, ttl);
  }
);
