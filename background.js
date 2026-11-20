/**
 * Ila Salaty — Background Service Worker
 * 
 * The brain of the extension. Manages prayer time calculation,
 * alarm scheduling, and coordination between all extension components.
 */

// Import the prayer times calculation engine
importScripts('prayer-times.js');

// ─── Default Settings ────────────────────────────────────────────────
function getDefaultSettings() {
  const tzOffsetHours = -new Date().getTimezoneOffset() / 60;
  let lat = 21.4225;
  let lng = 39.8262;
  let locName = 'Mecca';
  let method = 'Makkah';
  let tz = 3;

  if (tzOffsetHours === 8) {
    lat = 3.0738; lng = 101.5183; locName = 'Shah Alam / Kuala Lumpur (UTC+8)'; method = 'JAKIM'; tz = 8;
  } else if (tzOffsetHours === 7) {
    lat = -6.2088; lng = 106.8456; locName = 'Jakarta (UTC+7)'; method = 'MWL'; tz = 7;
  } else if (tzOffsetHours === 5.5) {
    lat = 28.6139; lng = 77.2090; locName = 'New Delhi (UTC+5:30)'; method = 'Karachi'; tz = 5.5;
  } else if (tzOffsetHours === 5) {
    lat = 24.8607; lng = 67.0011; locName = 'Karachi (UTC+5)'; method = 'Karachi'; tz = 5;
  } else if (tzOffsetHours === 6) {
    lat = 23.8103; lng = 90.4125; locName = 'Dhaka (UTC+6)'; method = 'Karachi'; tz = 6;
  } else if (tzOffsetHours === 4) {
    lat = 25.2048; lng = 55.2708; locName = 'Dubai (UTC+4)'; method = 'Dubai'; tz = 4;
  } else if (tzOffsetHours === 3) {
    lat = 21.4225; lng = 39.8262; locName = 'Mecca (UTC+3)'; method = 'Makkah'; tz = 3;
  } else if (tzOffsetHours === 2) {
    lat = 30.0444; lng = 31.2357; locName = 'Cairo (UTC+2)'; method = 'Egypt'; tz = 2;
  } else if (tzOffsetHours === 1) {
    lat = 48.8566; lng = 2.3522; locName = 'Paris (UTC+1)'; method = 'MWL'; tz = 1;
  } else if (tzOffsetHours === 0) {
    lat = 51.5074; lng = -0.1278; locName = 'London / Casablanca (UTC+0)'; method = 'MWL'; tz = 0;
  } else if (tzOffsetHours === -5) {
    lat = 40.7128; lng = -74.0060; locName = 'New York (UTC-5)'; method = 'ISNA'; tz = -5;
  } else if (tzOffsetHours === -8) {
    lat = 34.0522; lng = -118.2437; locName = 'Los Angeles (UTC-8)'; method = 'ISNA'; tz = -8;
  }

  return {
    latitude: lat,
    longitude: lng,
    calculationMethod: method,
    timezoneOffset: tz,
    enabled: true,
    locationName: locName,
    lockDurationMinutes: 5,
    setupComplete: false
  };
}

const DEFAULT_SETTINGS = getDefaultSettings();

// Prayer names for alarm IDs
const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const NOTIFICATION_ID = 'ila-salaty-prayer-reminder';
const PRAYERS = {
  fajr: { en: 'Fajr', ar: 'الفجر' },
  dhuhr: { en: 'Dhuhr', ar: 'الظهر' },
  asr: { en: 'Asr', ar: 'العصر' },
  maghrib: { en: 'Maghrib', ar: 'المغرب' },
  isha: { en: 'Isha', ar: 'العشاء' }
};

// Alarm callbacks, startup, settings changes and dismissals can arrive together.
let pending = Promise.resolve();
function inOrder(work) {
  const result = pending.then(work);
  pending = result.catch(error => console.error('[Ila Salaty]', error));
  return result;
}

function scheduleFor(day, config) {
  const times = calculatePrayerTimes(day, config.latitude, config.longitude, config.calculationMethod, config.timezoneOffset);
  const events = [];
  for (const name of PRAYER_NAMES) {
    if (!times[name].valid) continue;
    const date = new Date(day);
    date.setHours(times[name].hour, times[name].minute, 0, 0);
    events.push({ name, when: date.getTime(), key: name + '-' + date.toDateString() });
  }
  return { times, events };
}

function onDay(today, offset) {
  const day = new Date(today);
  day.setDate(day.getDate() + offset);
  return day;
}

async function reconcile(resetBaseline = false) {
  const state = await chrome.storage.local.get([
    'settings', 'lastPrayerCheck', 'lastTriggeredKey', 'lastCalculated', 'activeReminder',
    'todaysPrayerTimes', 'scheduleTimezone'
  ]);
  const config = state.settings || DEFAULT_SETTINGS;
  if (!state.settings) await chrome.storage.local.set({ settings: config });

  const now = new Date();
  const nowMs = now.getTime();
  const today = scheduleFor(now, config);
  if (resetBaseline || !state.todaysPrayerTimes || state.scheduleTimezone !== now.getTimezoneOffset()
      || new Date(state.lastCalculated).toDateString() !== now.toDateString()) {
    await chrome.storage.local.set({
      todaysPrayerTimes: today.times, lastCalculated: now.toISOString(), scheduleTimezone: now.getTimezoneOffset()
    });
  }

  const alarms = new Map((await chrome.alarms.getAll()).map(alarm => [alarm.name, alarm]));
  if (!alarms.has('health-check')) {
    await chrome.alarms.create('health-check', { periodInMinutes: 1 });
  }
  if (alarms.has('daily-recalc')) await chrome.alarms.clear('daily-recalc');
  const upcoming = today.events.concat(scheduleFor(onDay(now, 1), config).events);
  for (const name of PRAYER_NAMES) {
    const id = 'prayer-' + name;
    const next = config.enabled && upcoming.find(event => event.name === name && event.when > nowMs);
    if (next && alarms.get(id)?.scheduledTime !== next.when) {
      await chrome.alarms.create(id, { when: next.when });
    } else if (!next && alarms.has(id)) {
      await chrome.alarms.clear(id);
    }
  }

  // A fresh installation or a new schedule starts tracking from now.
  let since = nowMs;
  if (!resetBaseline) {
    // v1.0.0 had no checkpoint. Preserve its short catch-up window on upgrade.
    const baseline = state.lastCalculated ? nowMs - 15 * 60000 : nowMs;
    since = state.lastPrayerCheck ?? baseline;
  }
  let events = today.events;
  if (new Date(since).toDateString() !== now.toDateString()) {
    events = events.concat(scheduleFor(onDay(now, -1), config).events);
  }
  const due = events.filter(event => event.when > since && event.when <= nowMs)
    .sort((a, b) => b.when - a.when)[0];

  if (config.enabled && due && due.key !== state.lastTriggeredKey) {
    await present(due.name, config, due.key);
  } else if (state.activeReminder && expiresAt(state.activeReminder) <= nowMs) {
    await dismiss();
  }
  await chrome.storage.local.set({ lastPrayerCheck: nowMs });
}

function expiresAt(reminder) {
  return reminder.triggeredAt + reminder.lockDuration * 60000;
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') ||
         url.startsWith('about:') ||
         url.startsWith('view-source:') ||
         url.startsWith('devtools://') ||
         url.includes('chrome.google.com/webstore') ||
         url.includes('chromewebstore.google.com') ||
         url.includes('microsoftedge.microsoft.com/addons');
}

/**
 * Safely query the user's active browsing tab across Chrome & Edge
 */
async function getActiveTabSafe() {
  try {
    // In Edge & Chrome, lastFocusedWindow gets the actual browser window the user was interacting with
    let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs || tabs.length === 0) {
      tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    }
    if (!tabs || tabs.length === 0) {
      tabs = await chrome.tabs.query({ active: true });
    }
    return tabs && tabs.length > 0 ? tabs[0] : null;
  } catch (e) {
    console.error('[Ila Salaty] Failed to query active tab:', e);
    return null;
  }
}

// Bound the wait even for a frozen tab that accepts a message but never answers.
async function withTimeout(task, ms) {
  let timer;
  try {
    return await Promise.race([task, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Tab did not respond')), ms);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

async function ensureTabLocked(tab, reminder) {
  if (tab?.id == null || isRestrictedUrl(tab.url) || tab.discarded) return false;
  const message = { type: 'SHOW_LOCKSCREEN', triggeredAt: reminder.triggeredAt };
  const send = () => chrome.tabs.sendMessage(tab.id, message, { frameId: 0 });
  try {
    return (await withTimeout(send(), 3500))?.success === true;
  } catch (error) {
    if (!/receiving end does not exist/i.test(error.message)) return false;
  }
  try {
    await withTimeout((async () => {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    })(), 2500);
    return (await withTimeout(send(), 3500))?.success === true;
  } catch {
    return false;
  }
}

const lockPage = chrome.runtime.getURL('lockscreen.html');
async function openStandalone(tab, reminder) {
  const params = new URLSearchParams({
    prayerKey: reminder.prayerKey, lockDuration: reminder.lockDuration,
    triggeredAt: reminder.triggeredAt,
    sound: reminder.soundEnabled !== false ? 'true' : 'false',
    volume: reminder.soundVolume !== undefined ? reminder.soundVolume : '80',
    standalone: true
  });
  const url = lockPage + '?' + params;
  const existing = (await chrome.tabs.query({})).find(t =>
    t.url?.startsWith(lockPage + '?') && (!tab || tab.windowId === t.windowId));
  if (existing) {
    await chrome.tabs.update(existing.id, { url, active: true });
  } else {
    await chrome.tabs.create({ url, active: true, ...(tab && { windowId: tab.windowId }) });
  }
}

async function present(name, config, occurrence, tabId) {
  const reminder = {
    prayerKey: name, prayer: PRAYERS[name], lockDuration: config.lockDurationMinutes || 5,
    triggeredAt: Date.now(),
    soundEnabled: config.soundEnabled !== false,
    soundVolume: typeof config.soundVolume === 'number' ? config.soundVolume : 80
  };
  await chrome.storage.local.set({ activeReminder: reminder });
  // Desktop notification permissions and fullscreen presentation are independent.
  chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic', iconUrl: 'icons/icon128.png',
    title: `🕌 ${reminder.prayer.en} Prayer Time — حان وقت صلاة ${reminder.prayer.ar}`,
    message: 'It is time to pray. Leave what you are doing and respond to the call.',
    priority: 2, requireInteraction: true
  }).catch(error => console.warn('[Ila Salaty] Notification:', error.message));

  const tab = (tabId != null && await chrome.tabs.get(tabId).catch(() => null)) || await getActiveTabSafe();
  if (!await ensureTabLocked(tab, reminder)) await openStandalone(tab, reminder);
  if (occurrence) await chrome.storage.local.set({ lastTriggeredKey: occurrence });
}

async function dismiss() {
  await chrome.storage.local.remove(['activeReminder', 'snoozeState']);
  await chrome.notifications.clear(NOTIFICATION_ID).catch(() => {});
  // Content scripts remove their own overlays when the stored reminder clears.
  for (const tab of await chrome.tabs.query({})) {
    if (tab.url?.startsWith(lockPage + '?')) {
      await chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}

chrome.alarms.onAlarm.addListener(() => inOrder(() => reconcile()));
chrome.runtime.onStartup.addListener(() => inOrder(() => reconcile()));
chrome.runtime.onInstalled.addListener(() => inOrder(() => reconcile()));

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  inOrder(async () => {
    switch (message.type) {
      case 'getPrayerTimes': {
        await reconcile();
        const { todaysPrayerTimes } = await chrome.storage.local.get('todaysPrayerTimes');
        return { prayerTimes: todaysPrayerTimes, nextPrayer: getNextPrayer(todaysPrayerTimes) };
      }
      case 'getSettings': {
        const { settings } = await chrome.storage.local.get('settings');
        return { settings: settings || DEFAULT_SETTINGS };
      }
      case 'updateSettings': {
        await chrome.storage.local.set({ settings: message.settings });
        await reconcile(true);
        return { success: true };
      }
      case 'dismissLockscreen': {
        const { activeReminder } = await chrome.storage.local.get('activeReminder');
        if (activeReminder && activeReminder.triggeredAt === message.triggeredAt) await dismiss();
        return { success: true };
      }
      case 'testLockscreen': {
        const { settings } = await chrome.storage.local.get('settings');
        const activeConfig = Object.assign({}, settings || DEFAULT_SETTINGS);
        if (message.soundEnabled !== undefined) activeConfig.soundEnabled = message.soundEnabled;
        if (message.soundVolume !== undefined) activeConfig.soundVolume = message.soundVolume;
        await present(message.prayerKey in PRAYERS ? message.prayerKey : 'dhuhr',
          activeConfig, null, message.tabId);
        return { success: true };
      }
      default: return { error: 'Unknown message type' };
    }
  }).then(reply, error => reply({ error: error.message }));
  return true;
});

chrome.tabs.onActivated.addListener(({ tabId }) => inOrder(async () => {
  const { activeReminder } = await chrome.storage.local.get('activeReminder');
  if (!activeReminder || expiresAt(activeReminder) <= Date.now()) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.active) return;
  if (tab.url?.startsWith(lockPage + '?')) return;
  if (!await ensureTabLocked(tab, activeReminder)) {
    const current = await chrome.tabs.get(tabId).catch(() => null);
    if (current?.active) {
      await openStandalone(current, activeReminder);
    }
  }
}));

// Repair missing alarms whenever Chrome starts a fresh worker.
inOrder(() => reconcile());
