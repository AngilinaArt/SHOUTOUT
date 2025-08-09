const hamsterEl = document.getElementById("hamster");
const hamsterImg = document.getElementById("hamster-img");
const hamsterBadge = document.getElementById("hamster-badge");
const toastEl = document.getElementById("toast");
const toastContent = document.getElementById("toast-content");

function hideHamster() {
  hamsterEl.classList.add("hidden");
  hamsterImg.src = "";
  hamsterBadge.textContent = "";
  hamsterBadge.classList.add("hidden");
}

function hideToast() {
  toastEl.classList.add("hidden");
  toastContent.textContent = "";
  toastContent.className = "";
}

let hamsterTimer = null;
let toastTimer = null;

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

window.shoutout.onHamster(({ variant, durationMs, url, sender }) => {
  if (hamsterTimer) {
    clearTimeout(hamsterTimer);
    hamsterTimer = null;
  }
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
  hamsterTimer = setTimeout(hideHamster, Math.max(300, durationMs || 3000));
});

window.shoutout.onToast(({ message, severity, durationMs }) => {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toastContent.textContent = message || "";
  const sev = ["info", "success", "warn", "critical"].includes(severity)
    ? severity
    : "info";
  toastContent.className = `severity-${sev}`;
  toastEl.classList.remove("hidden");
  toastTimer = setTimeout(hideToast, Math.max(500, durationMs || 4000));
});
