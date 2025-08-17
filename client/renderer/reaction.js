// Reaction Overlay JavaScript
const reactionContainer = document.getElementById("reaction-container");
let reactionCounter = 0;
const MAX_REACTION_STACK = 5; // Maximum number of reactions to show at once

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
function showReactionFeedback(fromUser, reaction, durationMs = 3000) {
  const reactionId = `reaction-${++reactionCounter}`;
  const config = REACTION_CONFIG[reaction];

  if (!config) {
    console.error(`❌ Unknown reaction: ${reaction}`);
    return;
  }

  // STACKING SYSTEM: Manage reaction stack
  console.log(`📚 Adding new reaction to stack: ${reaction} from ${fromUser}`);

  // Remove oldest reaction if we exceed max stack size
  const existingReactions =
    reactionContainer.querySelectorAll(".reaction-feedback");
  if (existingReactions.length >= MAX_REACTION_STACK) {
    const oldest = existingReactions[0]; // First = oldest
    console.log(`🗑️ Removing oldest reaction to make space`);
    oldest.classList.add("fade-out");
    setTimeout(() => {
      if (oldest.parentElement) {
        oldest.remove();
      }
    }, 200);
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

  // Add to the END of the container (newest at bottom)
  reactionContainer.appendChild(wrapper);

  // Starte die Emoji-Animation sofort
  startEmojiAnimation(reactionId, config.emoji);

  console.log(`💖 Reaction feedback displayed: ${fromUser} ${reaction}`);

  // Nach der angegebenen Zeit ausblenden (individual timer for each reaction)
  setTimeout(() => {
    if (wrapper.parentElement) {
      wrapper.classList.add("fade-out");
      setTimeout(() => {
        if (wrapper.parentElement) {
          wrapper.remove();
          console.log(`✅ Reaction removed: ${fromUser} ${reaction}`);
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
    console.log(`✅ reaction.js: Valid payload, showing reaction!`);
    showReactionFeedback(
      payload.fromUser,
      payload.reaction,
      payload.durationMs
    );
  } else {
    console.error(`❌ reaction.js: Invalid payload:`, payload);
  }
});

// Debug: Teste die Reaction-Funktionalität sofort (disabled)
// setTimeout(() => {
//   console.log(`🔧 DEBUG: Testing reaction display...`);
//   showReactionFeedback("DEBUG USER", "love", 5000);
// }, 3000);

// Reaction overlay loaded successfully
