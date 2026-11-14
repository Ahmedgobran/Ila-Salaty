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
    // Security: Only accept messages originating from this extension's pages
    const expectedOrigin = `chrome-extension://${chrome.runtime.id}`;
    if (event.origin !== expectedOrigin) return;

    if (event.data && event.data.type === 'DISMISS_LOCKSCREEN') {
      // Notify background to clear the reminder across all tabs
      chrome.runtime.sendMessage({ type: 'dismissLockscreen' });
      hideLockscreen();
    } else if (event.data && event.data.type === 'SNOOZE_LOCKSCREEN') {
      // Notify background to schedule snooze alarm and clear reminder across all tabs
      chrome.runtime.sendMessage({
        type: 'snoozeReminder',
        minutes: event.data.minutes,
        prayerKey: event.data.prayerKey
      });
      hideLockscreen();
    }
  });

  // ─── Show Lock Screen ─────────────────────────────────────────────

  function showLockscreen(data) {
    // Don't stack multiple lockscreens
    if (isLockscreenActive) return;

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
    if (!isLockscreenActive) return;

    const backdrop = document.getElementById('ila-salaty-backdrop');
    const overlay = document.getElementById('ila-salaty-overlay');

    // Add fade-out animation
    if (backdrop) backdrop.classList.add('ila-salaty-fade-out');
    if (overlay) overlay.classList.add('ila-salaty-fade-out');

    // Remove after animation
    setTimeout(() => {
      if (backdrop) backdrop.remove();
      if (overlay) overlay.remove();
    }, 400);

    // Remove keyboard blocker
    document.removeEventListener('keydown', blockKeyboard, true);

    lockscreenOverlay = null;
    lockscreenIframe = null;
    isLockscreenActive = false;

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
