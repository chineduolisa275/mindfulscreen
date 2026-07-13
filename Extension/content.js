// ===== MINDFULSCREEN - CONTENT SCRIPT =====
// Injected into every webpage. Shows warning popups when limits are hit.

let warningVisible = false;

// Listen for messages from background.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SHOW_WARNING") {
    showWarning(message);
  }
});

function showWarning(data) {
  // Don't stack multiple warnings
  if (warningVisible) return;
  warningVisible = true;

  const isCritical = data.warningType === "daily";

  // Create the popup element
  const overlay = document.createElement("div");
  overlay.id = "mindfulscreen-warning";
  overlay.innerHTML = `
    <div class="ms-popup ${isCritical ? 'ms-critical' : 'ms-caution'}">
      <div class="ms-popup-header">
        <div class="ms-popup-title">
          <span>${isCritical ? '🚨' : '⚠️'}</span>
          <span>${isCritical ? 'Daily Limit Exceeded' : 'Time Check — ' + data.domain}</span>
        </div>
        <button class="ms-close" id="ms-close">&times;</button>
      </div>
      <div class="ms-popup-body">
        ${isCritical
          ? `<p>You've spent <strong>${data.totalMinutes} minutes</strong> browsing today. That exceeds the recommended 7-hour daily limit.</p>
             <p class="ms-sub">Extended screen time is linked to eye strain, sleep disruption, and reduced wellbeing.</p>`
          : `<p>You've been on <strong>${data.domain}</strong> for <strong>${data.minutes} minutes</strong>. Consider taking a break.</p>
             <p class="ms-sub">Regular breaks help maintain focus and reduce digital fatigue.</p>`
        }
        <div class="ms-buttons">
          <button class="ms-btn ms-btn-snooze" id="ms-snooze">Snooze 10 min</button>
          <button class="ms-btn ms-btn-break" id="ms-break">Take a Break</button>
        </div>
        <p class="ms-footer">MindfulScreen — Digital Wellbeing Monitor</p>
      </div>
    </div>
  `;

  // Add it to the page
  document.body.appendChild(overlay);

  // If critical (over 7 hours), flash the border red
  if (isCritical) {
    const popup = overlay.querySelector(".ms-popup");
    let flash = true;
    const flashInterval = setInterval(() => {
      popup.style.borderColor = flash ? "#ef4444" : "#fca5a5";
      flash = !flash;
    }, 600);
    overlay.dataset.flashInterval = flashInterval;
  }

  // Button handlers
  document.getElementById("ms-snooze").addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "WARNING_RESPONSE",
      domain: data.domain,
      action: "continue"
    });
    removeWarning(overlay);
  });

  document.getElementById("ms-break").addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "WARNING_RESPONSE",
      domain: data.domain,
      action: "break"
    });
    removeWarning(overlay);
  });

  document.getElementById("ms-close").addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "WARNING_RESPONSE",
      domain: data.domain,
      action: "continue"
    });
    removeWarning(overlay);
  });
}

function removeWarning(overlay) {
  if (overlay.dataset.flashInterval) {
    clearInterval(parseInt(overlay.dataset.flashInterval));
  }
  overlay.remove();
  warningVisible = false;
}
