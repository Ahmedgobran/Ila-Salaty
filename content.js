/**
 * Ila Salaty — Content Script
 * 
 * Injected into every web page. Listens for prayer time alerts from the
 * background service worker and injects a full-viewport lock screen overlay.
 */

(() => {
  'use strict';

  // Prevent duplicate execution if script is reinjected into the same page
  if (window.__ilaSalatyReminderController) {
    return;
  }
  window.__ilaSalatyReminderController = true;

  let current = null;
  let isLockscreenActive = false;
  const extensionOrigin = new URL(chrome.runtime.getURL('lockscreen.html')).origin;

  function hideLockscreen() {
    if (!current) return;
    current.finish(false);
    current.dialog.remove();
    current = null;
    isLockscreenActive = false;
    document.removeEventListener('keydown', blockKeyboard, true);
  }

  function showLockscreen(reminder) {
    if (current?.id === reminder.triggeredAt && (current.mounting || current.dialog.isConnected)) {
      return current.ready.then(ok => ok && document.elementFromPoint(innerWidth / 2, innerHeight / 2) === current?.frame);
    }
    hideLockscreen();
    const dialog = document.createElement('dialog');
    dialog.id = 'ila-salaty-overlay';
    dialog.className = 'ila-salaty-overlay';
    dialog.setAttribute('aria-label', reminder.prayer.en + ' prayer reminder');
    dialog.addEventListener('cancel', event => event.preventDefault());

    const frame = document.createElement('iframe');
    frame.className = 'ila-salaty-iframe';
    frame.title = reminder.prayer.en + ' prayer reminder';
    frame.setAttribute('allow', 'autoplay');
    const params = new URLSearchParams({
      prayerKey: reminder.prayerKey,
      lockDuration: reminder.lockDuration,
      triggeredAt: reminder.triggeredAt,
      sound: reminder.soundEnabled !== false ? 'true' : 'false',
      volume: reminder.soundVolume !== undefined ? reminder.soundVolume : '80'
    });
    frame.src = chrome.runtime.getURL('lockscreen.html') + '?' + params;

    let finish;
    const ready = new Promise(resolve => { finish = resolve; });
    const entry = { id: reminder.triggeredAt, dialog, frame, ready, finish, mounting: true };
    current = entry;
    // A blocked or unloaded iframe must yield to the standalone reminder.
    const timeout = setTimeout(() => finish(false), 2000);
    ready.then(ok => {
      clearTimeout(timeout);
      if (!ok && current === entry) hideLockscreen();
    });
    async function mount() {
      // A fullscreen video may live in another origin's iframe.
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
      if (current !== entry) return;
      dialog.appendChild(frame);
      document.documentElement.appendChild(dialog);
      dialog.showModal();
      entry.mounting = false;
      isLockscreenActive = true;
      pauseAllMedia();
      document.addEventListener('keydown', blockKeyboard, true);
    }
    mount().catch(() => finish(false));
    return ready;
  }

  window.addEventListener('message', event => {
    if (!current || !current.frame || event.origin !== extensionOrigin || event.source !== current.frame.contentWindow) return;
    if (event.data?.type === 'LOCKSCREEN_READY') {
      const visible = document.elementFromPoint(innerWidth / 2, innerHeight / 2) === current.frame;
      current.finish(visible);
    } else if (event.data?.type === 'DISMISS_LOCKSCREEN') {
      chrome.runtime.sendMessage({ type: 'dismissLockscreen', triggeredAt: current.id }).catch(() => {});
      hideLockscreen();
    }
  });

  function sync(reminder) {
    if (!reminder || reminder.triggeredAt + reminder.lockDuration * 60000 <= Date.now()) {
      hideLockscreen();
      return false;
    }
    return showLockscreen(reminder);
  }

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.type !== 'SHOW_LOCKSCREEN') return;
    chrome.storage.local.get('activeReminder').then(async ({ activeReminder }) => {
      const success = activeReminder?.triggeredAt === message.triggeredAt && await sync(activeReminder);
      reply({ success });
    }).catch(() => reply({ success: false }));
    return true;
  });

  // The same stored session drives existing tabs, new pages, and dismissal.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.activeReminder) sync(changes.activeReminder.newValue);
  });
  chrome.storage.local.get('activeReminder').then(({ activeReminder }) => sync(activeReminder)).catch(() => {});

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

})();
