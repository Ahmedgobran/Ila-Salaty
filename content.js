/**
 * Ila Salaty — Content Script
 * 
 * Injected into every web page. Listens for prayer time alerts from the
 * background service worker and injects a full-viewport lock screen overlay.
 */

(() => {
  'use strict';

  let lockscreenOverlay = null;
  let lockscreenIframe = null;
  let isLockscreenActive = false;

  // ─── Listen for messages from background ────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHOW_LOCKSCREEN') {
      try {
        showLockscreen(message);
        sendResponse({ success: true });
      } catch (err) {
        console.error('[Ila Salaty] Content script failed to show lockscreen:', err);
        sendResponse({ success: false, error: err.message });
      }
      return false;
    }

    if (message.type === 'HIDE_LOCKSCREEN') {
      try {
        hideLockscreen();
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false });
      }
      return false;
    }
  });

  // ─── Listen for messages from the lockscreen iframe ─────────────────

  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'DISMISS_LOCKSCREEN' || event.data.type === 'SNOOZE_LOCKSCREEN') {
      if (event.data.action === 'snooze' || event.data.type === 'SNOOZE_LOCKSCREEN') {
        try {
          chrome.runtime.sendMessage({
            type: 'snoozeReminder',
            minutes: event.data.minutes || 5,
            prayerKey: event.data.prayerKey || 'dhuhr'
          });
        } catch (e) {}
      } else {
        try {
          chrome.runtime.sendMessage({ type: 'dismissLockscreen' });
        } catch (e) {}
      }
      hideLockscreen();
    }
  });

  // ─── Show Lock Screen ─────────────────────────────────────────────

  function showLockscreen(data) {
    // Check if already displayed
    if (document.getElementById('ila-salaty-overlay')) return;

    try {
      isLockscreenActive = true;

      // Create backdrop
      const backdrop = document.createElement('div');
      backdrop.id = 'ila-salaty-backdrop';
      backdrop.className = 'ila-salaty-backdrop';

      // Create iframe container
      const container = document.createElement('div');
      container.id = 'ila-salaty-overlay';
      container.className = 'ila-salaty-overlay';

      // Create iframe pointing to our lockscreen page
      const iframe = document.createElement('iframe');
      const lockscreenUrl = chrome.runtime.getURL('lockscreen.html');
      
      // Pass prayer data via URL params
      const params = new URLSearchParams({
        prayer: data.prayer.en,
        prayerAr: data.prayer.ar,
        prayerKey: data.prayerKey,
        lockDuration: data.lockDuration || 5
      });
      iframe.src = `${lockscreenUrl}?${params.toString()}`;
      iframe.className = 'ila-salaty-iframe';
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('frameborder', '0');

      container.appendChild(iframe);
      document.documentElement.appendChild(backdrop);
      document.documentElement.appendChild(container);

      lockscreenOverlay = container;
      lockscreenIframe = iframe;

      // Pause any playing media on the page
      pauseAllMedia();

      // Block keyboard shortcuts while lockscreen is active
      document.addEventListener('keydown', blockKeyboard, true);

      console.log('[Ila Salaty] Lock screen shown');
    } catch (err) {
      isLockscreenActive = false;
      throw err;
    }
  }

  // ─── Hide Lock Screen ─────────────────────────────────────────────

  function hideLockscreen() {
    isLockscreenActive = false;

    // Immediately hide and remove all lockscreen elements
    const elements = document.querySelectorAll('.ila-salaty-overlay, .ila-salaty-backdrop, #ila-salaty-overlay, #ila-salaty-backdrop');
    elements.forEach((el) => {
      try {
        el.style.display = 'none';
        el.remove();
      } catch (e) {}
    });

    document.removeEventListener('keydown', blockKeyboard, true);
    lockscreenOverlay = null;
    lockscreenIframe = null;

    console.log('[Ila Salaty] Lock screen hidden');
  }

  // ─── Keyboard Blocking ────────────────────────────────────────────

  function blockKeyboard(e) {
    if (!isLockscreenActive) return;

    // Block navigation / tab closing shortcuts
    const blocked = [
      'Escape',
      'F5',
      'F11',
      'F12'
    ];

    const ctrlBlocked = [
      'w', 'W',       // Close tab
      't', 'T',       // New tab
      'n', 'N',       // New window
      'Tab',          // Switch tab
      'r', 'R',       // Reload
      'l', 'L',       // Address bar
      'd', 'D',       // Bookmark
      'f', 'F',       // Find
    ];

    if (blocked.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    if ((e.ctrlKey || e.metaKey) && ctrlBlocked.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    // Block Alt+F4
    if (e.altKey && e.key === 'F4') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }

  // ─── Media Pause ──────────────────────────────────────────────────

  function pauseAllMedia() {
    // Pause HTML5 video and audio elements
    document.querySelectorAll('video, audio').forEach(media => {
      if (!media.paused) {
        media.pause();
        media.dataset.ilaSalatyPaused = 'true';
      }
    });
  }

  // ─── Check for active reminder on page load ──────────────────────
  // If the user opens a new tab during a prayer reminder, show it there too

  (async function checkActiveReminder() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getActiveReminder' });
      if (response && response.activeReminder) {
        const reminder = response.activeReminder;
        const elapsed = (Date.now() - reminder.triggeredAt) / 1000 / 60;
        
        const duration = reminder.lockDuration || 5;
        // Only show if the reminder is less than the lock duration old
        if (elapsed < duration) {
          showLockscreen({
            prayer: reminder.prayer,
            prayerKey: reminder.prayerKey,
            lockDuration: duration - Math.floor(elapsed) // Remaining time
          });
        }
      }
    } catch (e) {
      // Extension context may not be ready yet
    }
  })();

})();
