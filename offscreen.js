/**
 * Ila Salaty — Offscreen Keep-Alive Document
 * 
 * 1. Sends periodic heartbeat pings to the background service worker,
 *    preventing Chrome & Edge from terminating it due to idle timeout.
 * 2. Maintains an active port connection for continuous wakefulness.
 * 3. Monitors prayer times directly as a failsafe so prayer alerts never miss,
 *    even if browser alarm timers are throttled or delayed.
 */

const HEARTBEAT_INTERVAL_MS = 20000; // Ping every 20s (well below the 30s MV3 idle limit)
const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

// ─── 1. Persistent Port Connection ─────────────────────────────────
let keepAlivePort = null;

function connectPort() {
  try {
    keepAlivePort = chrome.runtime.connect({ name: 'offscreen-keepalive' });
    keepAlivePort.onDisconnect.addListener(() => {
      keepAlivePort = null;
      setTimeout(connectPort, 1500);
    });
  } catch (e) {
    setTimeout(connectPort, 3000);
  }
}

connectPort();

// ─── 2. Heartbeat Ping & Prayer Check Loop ───────────────────────────
async function heartbeatAndCheckPrayers() {
  // A. Ping service worker to keep it awake
  try {
    chrome.runtime.sendMessage({ type: 'keepAlive' }, () => {
      if (chrome.runtime.lastError) {
        // Ignored — the ping itself wakes up the service worker if it was dormant
      }
    });
  } catch (e) {}

  // B. Failsafe prayer check
  try {
    const data = await chrome.storage.local.get([
      'settings',
      'todaysPrayerTimes',
      'lastTriggeredKey',
      'activeReminder'
    ]);

    const settings = data.settings;
    if (settings && settings.enabled === false) return;

    const todaysPrayerTimes = data.todaysPrayerTimes;
    if (!todaysPrayerTimes || !todaysPrayerTimes._raw) return;

    const now = new Date();
    const currentDecimal = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

    for (const name of PRAYER_NAMES) {
      const rawTime = todaysPrayerTimes._raw[name];
      if (rawTime !== undefined && rawTime !== null) {
        const diffMinutes = (currentDecimal - rawTime) * 60;
        // If prayer time arrived in the last 2 minutes
        if (diffMinutes >= 0 && diffMinutes <= 2) {
          const triggerKey = `${name}-${now.toDateString()}`;
          if (data.lastTriggeredKey !== triggerKey && !data.activeReminder) {
            console.log(`[Ila Salaty Offscreen] Prayer time arrived for ${name}, triggering reminder`);
            chrome.runtime.sendMessage({
              type: 'triggerPrayer',
              prayerKey: name
            }, () => {
              if (chrome.runtime.lastError) {}
            });
            break;
          }
        }
      }
    }
  } catch (err) {
    // Storage read error
  }
}

// Start periodic heartbeat
setInterval(heartbeatAndCheckPrayers, HEARTBEAT_INTERVAL_MS);

// Run immediately on load
heartbeatAndCheckPrayers();

console.log('[Ila Salaty] Offscreen keep-alive & prayer monitor initialized');
