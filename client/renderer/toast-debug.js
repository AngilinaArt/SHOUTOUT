// Toast Debug Test Script
// Füge dieses Script in die Console ein oder lade es separat

console.log("🔍 Starting Toast Debug Analysis...");

// 1. DOM Analyse Funktionen
function analyzeDOM() {
  console.log("\n=== DOM ANALYSIS ===");
  
  const toastEl = document.getElementById("toast");
  const toastsContainer = document.getElementById("toast"); // Beide zeigen auf dasselbe Element
  
  console.log("📋 Toast Container Info:");
  console.log("- toastEl:", toastEl);
  console.log("- toastsContainer:", toastsContainer);
  console.log("- Are they the same?", toastEl === toastsContainer);
  
  if (toastEl) {
    console.log("- Container classList:", Array.from(toastEl.classList));
    console.log("- Container children count:", toastEl.children.length);
    console.log("- Container innerHTML length:", toastEl.innerHTML.length);
    
    // Alle Child-Elemente analysieren
    Array.from(toastEl.children).forEach((child, index) => {
      console.log(`  Child ${index}:`, {
        tagName: child.tagName,
        className: child.className,
        id: child.id,
        dataset: child.dataset
      });
    });
  }
}

// 2. Toast Tracking
let toastHistory = [];
let toastEventCounter = 0;

function trackToast(action, toastId, element) {
  const timestamp = new Date().toISOString();
  const entry = {
    counter: ++toastEventCounter,
    timestamp,
    action,
    toastId,
    elementExists: !!element,
    elementInDOM: element ? document.contains(element) : false,
    totalToastsInDOM: document.querySelectorAll('.toast-item, .success-message').length
  };
  
  toastHistory.push(entry);
  console.log(`📊 Toast Event #${entry.counter}: ${action} - ${toastId}`, entry);
  
  // Keep only last 50 entries
  if (toastHistory.length > 50) {
    toastHistory = toastHistory.slice(-50);
  }
}

// 3. Override der Original-Funktionen für Tracking
const originalCreateElement = document.createElement;
document.createElement = function(tagName) {
  const element = originalCreateElement.call(this, tagName);
  
  if (tagName.toLowerCase() === 'div') {
    // Monitor wenn Toast-Elemente erstellt werden
    const originalSetClassName = element.className;
    Object.defineProperty(element, 'className', {
      get() { return originalSetClassName; },
      set(value) {
        if (value.includes('toast-item') || value.includes('success-message')) {
          trackToast('CREATED', element.id || 'no-id', element);
        }
        originalSetClassName = value;
        element.setAttribute('class', value);
      }
    });
  }
  
  return element;
};

// 4. Monitor appendChild und removeChild
const toastContainer = document.getElementById("toast");
if (toastContainer) {
  const originalAppendChild = toastContainer.appendChild;
  toastContainer.appendChild = function(child) {
    if (child.className && (child.className.includes('toast-item') || child.className.includes('success-message'))) {
      trackToast('APPENDED', child.id || 'no-id', child);
    }
    return originalAppendChild.call(this, child);
  };
  
  const originalRemoveChild = toastContainer.removeChild;
  toastContainer.removeChild = function(child) {
    if (child.className && (child.className.includes('toast-item') || child.className.includes('success-message'))) {
      trackToast('REMOVED_VIA_REMOVECHILD', child.id || 'no-id', child);
    }
    return originalRemoveChild.call(this, child);
  };
}

// 5. Monitor element.remove() calls
const originalRemove = Element.prototype.remove;
Element.prototype.remove = function() {
  if (this.className && (this.className.includes('toast-item') || this.className.includes('success-message'))) {
    trackToast('REMOVED_VIA_REMOVE', this.id || 'no-id', this);
  }
  return originalRemove.call(this);
};

// 6. Test Funktionen
function simulateToast() {
  console.log("\n🧪 Simulating Toast Creation...");
  
  if (window.shoutout && window.shoutout.onToast) {
    // Simuliere einen Toast
    const testToast = {
      message: `Test Message ${Date.now()}`,
      severity: 'blue',
      durationMs: 5000,
      sender: 'TestUser',
      recipientInfo: 'Test Recipient',
      senderId: 'test-user-id'
    };
    
    console.log("📤 Sending test toast:", testToast);
    
    // Trigger the onToast handler
    if (typeof window.shoutout.onToast === 'function') {
      window.shoutout.onToast(testToast);
    } else {
      console.error("❌ onToast is not a function");
    }
  } else {
    console.error("❌ window.shoutout.onToast not available");
  }
}

function simulateSuccess() {
  console.log("\n🧪 Simulating Success Message...");
  
  if (window.shoutout && window.shoutout.onSuccess) {
    const testSuccess = {
      message: `Test Success ${Date.now()}`,
      durationMs: 3000
    };
    
    console.log("📤 Sending test success:", testSuccess);
    window.shoutout.onSuccess(testSuccess);
  } else {
    console.error("❌ window.shoutout.onSuccess not available");
  }
}

function clickOKButton() {
  console.log("\n🖱️ Simulating OK Button Click...");
  
  const okButtons = document.querySelectorAll('.toast-ok');
  console.log(`Found ${okButtons.length} OK buttons`);
  
  if (okButtons.length > 0) {
    const firstOK = okButtons[0];
    const toastElement = firstOK.closest('.toast-item');
    console.log("Clicking OK on toast:", toastElement?.id);
    firstOK.click();
    
    // Check DOM after click
    setTimeout(() => {
      console.log("DOM after OK click:");
      analyzeDOM();
    }, 100);
  } else {
    console.log("No OK buttons found");
  }
}

// 7. Kontinuierliche Überwachung
let monitoringInterval;

function startMonitoring() {
  console.log("\n🔍 Starting continuous monitoring...");
  
  monitoringInterval = setInterval(() => {
    const currentToasts = document.querySelectorAll('.toast-item, .success-message');
    if (currentToasts.length > 0) {
      console.log(`⏰ Monitoring: ${currentToasts.length} toasts in DOM`);
      currentToasts.forEach((toast, index) => {
        console.log(`  Toast ${index}: ${toast.id} - ${toast.className}`);
      });
    }
  }, 5000);
}

function stopMonitoring() {
  console.log("⏹️ Stopping monitoring...");
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

// 8. Öffentliche Test-API
window.toastDebug = {
  analyzeDOM,
  simulateToast,
  simulateSuccess,
  clickOKButton,
  startMonitoring,
  stopMonitoring,
  getHistory: () => toastHistory,
  clearHistory: () => { toastHistory = []; toastEventCounter = 0; }
};

// 9. Initial Analysis
console.log("\n🚀 Toast Debug Script loaded!");
console.log("Available commands:");
console.log("- toastDebug.analyzeDOM() - Analyze current DOM state");
console.log("- toastDebug.simulateToast() - Create a test toast");
console.log("- toastDebug.simulateSuccess() - Create a test success message");
console.log("- toastDebug.clickOKButton() - Click the first OK button");
console.log("- toastDebug.startMonitoring() - Start continuous monitoring");
console.log("- toastDebug.stopMonitoring() - Stop monitoring");
console.log("- toastDebug.getHistory() - Get all tracked events");
console.log("- toastDebug.clearHistory() - Clear event history");

// Initial DOM analysis
analyzeDOM();