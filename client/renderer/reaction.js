// Reaction Overlay JavaScript
const reactionContainer = document.getElementById("reaction-container");
let reactionCounter = 0;

// Reaction-Konfiguration
const REACTION_CONFIG = {
  love: {
    emoji: "💖",
    text: "findet deine Nachricht großartig!",
    color: "#ec4899",
  },
  like: {
    emoji: "👍",
    text: "findet deine Nachricht gut!",
    color: "#10b981",
  },
  dislike: {
    emoji: "👎",
    text: "findet deine Nachricht nicht so gut",
    color: "#f59e0b",
  },
  party: {
    emoji: "🎉",
    text: "feiert deine Nachricht!",
    color: "#8b5cf6",
  },
};

// Funktion zum Anzeigen von Reaction-Feedback
function showReactionFeedback(fromUser, reaction, durationMs = 5000) {
  const reactionId = `reaction-${++reactionCounter}`;
  const config = REACTION_CONFIG[reaction];

  if (!config) {
    console.error(`❌ Unknown reaction: ${reaction}`);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.id = reactionId;
  wrapper.className = `reaction-feedback ${reaction}`;

  wrapper.innerHTML = `
    <div class="reaction-animation" id="animation-${reactionId}">
      <!-- Falling emojis will be added here -->
    </div>
    <div class="reaction-text">
      <strong>${fromUser}</strong> ${config.text}
    </div>
  `;

  reactionContainer.appendChild(wrapper);

  // Starte die Emoji-Animation
  startEmojiAnimation(reactionId, config.emoji);

  console.log(`💖 Reaction feedback displayed: ${fromUser} ${reaction}`);

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

  return reactionId;
}

// Funktion für fallende Emoji-Animation
function startEmojiAnimation(reactionId, emoji) {
  const animationContainer = document.getElementById(`animation-${reactionId}`);
  if (!animationContainer) return;

  // Erstelle mehrere fallende Emojis
  const emojiCount = 8;

  for (let i = 0; i < emojiCount; i++) {
    setTimeout(() => {
      createFallingEmoji(animationContainer, emoji);
    }, i * 200); // Verzögert für staggered effect
  }
}

function createFallingEmoji(container, emoji) {
  const emojiEl = document.createElement("div");
  emojiEl.className = "falling-emoji";
  emojiEl.textContent = emoji;

  // Zufällige horizontale Position
  const randomX = Math.random() * (container.offsetWidth - 30);
  emojiEl.style.left = `${randomX}px`;

  container.appendChild(emojiEl);

  // Entferne das Emoji nach der Animation
  setTimeout(() => {
    if (emojiEl.parentElement) {
      emojiEl.remove();
    }
  }, 3000);
}

// Globale API für das Reaction-System
window.reactionAPI = {
  showReaction: (fromUser, reaction, durationMs) => {
    return showReactionFeedback(fromUser, reaction, durationMs);
  },
};

// Höre auf Custom Events vom preload script
window.addEventListener("reaction-message", (event) => {
  const payload = event.detail;
  console.log(`📨 reaction.js: Custom event received:`, payload);

  if (payload && payload.fromUser && payload.reaction) {
    showReactionFeedback(
      payload.fromUser,
      payload.reaction,
      payload.durationMs
    );
  } else {
    console.error(`❌ reaction.js: Invalid payload:`, payload);
  }
});

// Debug: Teste ob die Reaction-API funktioniert
console.log(`🔧 Reaction overlay loaded successfully`);
console.log(`🔧 Reaction API available:`, typeof window.reactionAPI);
