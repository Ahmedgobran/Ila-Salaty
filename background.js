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
  let method = 'MWL';

  if (tzOffsetHours === 8) {
    lat = 3.1390; lng = 101.6869; locName = 'Kuala Lumpur / Singapore (UTC+8)'; method = 'MWL';
  } else if (tzOffsetHours === 7) {
    lat = -6.2088; lng = 106.8456; locName = 'Jakarta (UTC+7)'; method = 'MWL';
  } else if (tzOffsetHours === 5.5) {
    lat = 28.6139; lng = 77.2090; locName = 'New Delhi (UTC+5:30)'; method = 'Karachi';
  } else if (tzOffsetHours === 5) {
    lat = 24.8607; lng = 67.0011; locName = 'Karachi (UTC+5)'; method = 'Karachi';
  } else if (tzOffsetHours === 6) {
    lat = 23.8103; lng = 90.4125; locName = 'Dhaka (UTC+6)'; method = 'Karachi';
  } else if (tzOffsetHours === 4) {
    lat = 25.2048; lng = 55.2708; locName = 'Dubai (UTC+4)'; method = 'MWL';
  } else if (tzOffsetHours === 3) {
    lat = 21.4225; lng = 39.8262; locName = 'Mecca (UTC+3)'; method = 'Makkah';
  } else if (tzOffsetHours === 2) {
    lat = 30.0444; lng = 31.2357; locName = 'Cairo (UTC+2)'; method = 'Egypt';
  } else if (tzOffsetHours === 1) {
    lat = 48.8566; lng = 2.3522; locName = 'Paris (UTC+1)'; method = 'MWL';
  } else if (tzOffsetHours === 0) {
    lat = 51.5074; lng = -0.1278; locName = 'London / Casablanca (UTC+0)'; method = 'MWL';
  } else if (tzOffsetHours === -5) {
    lat = 40.7128; lng = -74.0060; locName = 'New York (UTC-5)'; method = 'ISNA';
  } else if (tzOffsetHours === -8) {
    lat = 34.0522; lng = -118.2437; locName = 'Los Angeles (UTC-8)'; method = 'ISNA';
  }

  return {
    latitude: lat,
    longitude: lng,
    calculationMethod: method,
    enabled: true,
    locationName: locName,
    lockDurationMinutes: 5,
    setupComplete: false
  };
}

const DEFAULT_SETTINGS = getDefaultSettings();

// Prayer names for alarm IDs
const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

// ─── Initialization ─────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Ila Salaty] Extension installed/updated:', details.reason);

  // Initialize settings if first install or missing
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({ settings: getDefaultSettings() });
    console.log('[Ila Salaty] Default settings saved');
  }

  // Calculate and schedule prayer times
  await schedulePrayerAlarms();
  // Set up daily recalculation
  setupDailyRecalc();
});

// Also run on service worker startup (handles browser restart)
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Ila Salaty] Service worker started');
  await schedulePrayerAlarms();
  setupDailyRecalc();
});

// ─── Alarm Scheduling ───────────────────────────────────────────────

/**
 * Calculate today's prayer times and set alarms for each one
 */
async function schedulePrayerAlarms() {
  const { settings } = await chrome.storage.local.get('settings');
  const config = settings || DEFAULT_SETTINGS;

  if (!config.enabled) {
    console.log('[Ila Salaty] Extension disabled, skipping alarm scheduling');
    await chrome.alarms.clearAll();
    setupDailyRecalc(); // Keep recalc alive
    return;
  }

  const now = new Date();
  const prayerTimes = calculatePrayerTimes(
    now,
    config.latitude,
    config.longitude,
    config.calculationMethod
  );

  // Store calculated times for quick access by popup/content scripts
  await chrome.storage.local.set({
    todaysPrayerTimes: prayerTimes,
    lastCalculated: now.toISOString()
  });

  console.log('[Ila Salaty] Prayer times calculated:', prayerTimes);

  // Clear existing prayer alarms (not the recalc alarm)
  for (const name of PRAYER_NAMES) {
    await chrome.alarms.clear(`prayer-${name}`);
  }

  // Set alarms for prayers that haven't passed yet
  const currentDecimal = now.getHours() + now.getMinutes() / 60;

  for (const name of PRAYER_NAMES) {
    const rawTime = prayerTimes._raw[name];
    if (!isNaN(rawTime) && rawTime > currentDecimal) {
      // Calculate milliseconds until this prayer
      const prayerDate = new Date(now);
      const hours = Math.floor(rawTime);
      const minutes = Math.round((rawTime - hours) * 60);
      prayerDate.setHours(hours, minutes, 0, 0);

      const delayMs = prayerDate.getTime() - now.getTime();
      if (delayMs > 0) {
        chrome.alarms.create(`prayer-${name}`, {
          when: prayerDate.getTime()
        });
        console.log(`[Ila Salaty] Alarm set for ${name} at ${prayerTimes[name].formatted} (in ${Math.round(delayMs / 60000)} min)`);
      }
    }
  }
}

/**
 * Set up the daily midnight recalculation alarm and 15-min health check
 */
function setupDailyRecalc() {
  // Calculate time until next midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 1, 0, 0); // 00:01 to be safe

  chrome.alarms.create('daily-recalc', {
    when: midnight.getTime(),
    periodInMinutes: 24 * 60 // Repeat every 24 hours
  });

  // Health check every 15 minutes to recover missed alarms on system wake/un-idle
  chrome.alarms.create('health-check', {
    periodInMinutes: 15
  });

  console.log('[Ila Salaty] Alarms initialized: daily-recalc and health-check');
}

// ─── Alarm Handler ──────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[Ila Salaty] Alarm fired:', alarm.name);

  if (alarm.name === 'daily-recalc') {
    await schedulePrayerAlarms();
    return;
  }

  if (alarm.name === 'health-check') {
    await verifyAndCatchMissedPrayers();
    return;
  }

  if (alarm.name.startsWith('snooze-')) {
    const prayerKey = alarm.name.replace('snooze-', '');
    console.log(`[Ila Salaty] Snooze alarm triggered for ${prayerKey}`);
    await chrome.storage.local.remove('snoozeState');
    await triggerPrayerReminder(prayerKey, true);
    return;
  }

  if (alarm.name.startsWith('prayer-')) {
    const prayerKey = alarm.name.replace('prayer-', '');
    await triggerPrayerReminder(prayerKey);
  }
});

/**
 * Health check: verify prayer times and catch missed prayers if laptop was asleep during Azan
 */
async function verifyAndCatchMissedPrayers() {
  try {
    // Check if a snooze has elapsed and needs to trigger
    const { snoozeState } = await chrome.storage.local.get('snoozeState');
    if (snoozeState && Date.now() >= snoozeState.snoozeUntil) {
      console.log('[Ila Salaty] Snooze time elapsed on health check. Triggering reminder.');
      await chrome.storage.local.remove('snoozeState');
      await triggerPrayerReminder(snoozeState.prayerKey || 'dhuhr', true);
      return;
    }

    const { settings, todaysPrayerTimes, activeReminder } = await chrome.storage.local.get(['settings', 'todaysPrayerTimes', 'activeReminder']);
    const config = settings || DEFAULT_SETTINGS;
    if (!config.enabled) return;

    // Do not interfere if user currently has an active snooze alarm
    const allAlarms = await chrome.alarms.getAll();
    const isSnoozed = allAlarms.some(a => a.name.startsWith('snooze-'));
    if (isSnoozed) return;

    const now = new Date();
    // Recalculate if missing
    if (!todaysPrayerTimes || !todaysPrayerTimes.fajr) {
      await schedulePrayerAlarms();
      return;
    }

    // Check if a prayer occurred in the last 15 minutes that wasn't displayed
    const currentDecimal = now.getHours() + now.getMinutes() / 60;
    for (const name of PRAYER_NAMES) {
      const rawTime = todaysPrayerTimes._raw?.[name];
      if (rawTime) {
        const diffMinutes = (currentDecimal - rawTime) * 60;
        if (diffMinutes >= 0 && diffMinutes <= 15) {
          const { lastTriggeredKey } = await chrome.storage.local.get('lastTriggeredKey');
          const triggerKey = `${name}-${now.toDateString()}`;
          if (lastTriggeredKey !== triggerKey && !activeReminder) {
            console.log(`[Ila Salaty] Catching missed prayer ${name} on system wake`);
            await chrome.storage.local.set({ lastTriggeredKey: triggerKey });
            await triggerPrayerReminder(name);
            break;
          }
        }
      }
    }
  } catch (e) {
    console.error('[Ila Salaty] Error in health check:', e);
  }
}

// ─── Prayer Reminder Execution ──────────────────────────────────────

const NOTIFICATION_ID = 'ila-salaty-prayer-reminder';
let lastTriggerTime = 0;

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
    // In Edge, lastFocusedWindow gets the actual browser window (not the popup bubble)
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

/**
 * Send message to a tab or dynamically inject content script if not yet loaded
 */
async function ensureTabLocked(tabId, message) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, message);
    if (res && res.success) return true;
  } catch (e) {
    // Content script not loaded on this tab yet (e.g. tab opened before extension loaded)
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      const res2 = await chrome.tabs.sendMessage(tabId, message);
      return Boolean(res2 && res2.success);
    } catch (err) {
      console.log(`[Ila Salaty] Tab ${tabId} could not host overlay:`, err.message);
      return false;
    }
  }
  return true;
}

/**
 * Trigger the prayer reminder across tabs with standalone fallback
 */
async function triggerPrayerReminder(prayerKey, isManualTest = false, preferredTabId = null) {
  const now = Date.now();
  // Debounce: prevent frantic multi-clicks within 1 second
  if (now - lastTriggerTime < 1000) {
    console.log('[Ila Salaty] Reminder trigger debounced');
    return;
  }
  lastTriggerTime = now;

  const { settings } = await chrome.storage.local.get('settings');
  const config = settings || DEFAULT_SETTINGS;

  if (!config.enabled && !isManualTest) return;

  const prayerNames = {
    fajr: { en: 'Fajr', ar: 'الفجر' },
    dhuhr: { en: 'Dhuhr', ar: 'الظهر' },
    asr: { en: 'Asr', ar: 'العصر' },
    maghrib: { en: 'Maghrib', ar: 'المغرب' },
    isha: { en: 'Isha', ar: 'العشاء' }
  };

  const prayer = prayerNames[prayerKey] || { en: prayerKey, ar: '' };
  const lockDuration = config.lockDurationMinutes || 5;

  // 1. Store active reminder state
  await chrome.storage.local.set({
    activeReminder: {
      prayerKey,
      prayer,
      lockDuration,
      triggeredAt: now
    }
  });

  // 2. Show or update single system notification (Reuses NOTIFICATION_ID to prevent spamming)
  try {
    chrome.notifications.create(NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `🕌 ${prayer.en} Prayer Time — حان وقت صلاة ${prayer.ar}`,
      message: 'It is time to pray. Leave what you are doing and respond to the call.',
      priority: 2,
      requireInteraction: true
    });
  } catch (e) {
    console.log('[Ila Salaty] Notification error:', e.message);
  }

  const message = {
    type: 'SHOW_LOCKSCREEN',
    prayer: prayer,
    prayerKey: prayerKey,
    lockDuration: lockDuration
  };

  // 3. TARGET ACTIVE TAB FIRST (prioritize preferredTabId from popup if available)
  let activeTab = null;
  if (preferredTabId) {
    try {
      activeTab = await chrome.tabs.get(preferredTabId);
    } catch (e) {}
  }
  if (!activeTab || !activeTab.id) {
    activeTab = await getActiveTabSafe();
  }

  let activeTabSucceeded = false;
  try {
    if (activeTab && activeTab.id) {
      if (!activeTab.url || isRestrictedUrl(activeTab.url) || activeTab.discarded) {
        // Active tab is restricted (edge://, chrome://, new tab, discarded)
        console.log('[Ila Salaty] Active tab is restricted. Opening standalone tab.');
        await openStandaloneLockscreenTab(prayer, prayerKey, lockDuration);
        activeTabSucceeded = true;
      } else {
        const ok = await ensureTabLocked(activeTab.id, message);
        if (ok) {
          activeTabSucceeded = true;
        } else {
          console.log('[Ila Salaty] Overlay could not be injected on active tab. Opening standalone tab.');
          await openStandaloneLockscreenTab(prayer, prayerKey, lockDuration);
          activeTabSucceeded = true;
        }
      }
    } else {
      await openStandaloneLockscreenTab(prayer, prayerKey, lockDuration);
      activeTabSucceeded = true;
    }
  } catch (err) {
    console.error('[Ila Salaty] Error handling active tab:', err);
    await openStandaloneLockscreenTab(prayer, prayerKey, lockDuration);
  }

  // 4. Notify all other open tabs in parallel
  chrome.tabs.query({}).then((tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id || tab.id === activeTab?.id || !tab.url || isRestrictedUrl(tab.url) || tab.discarded) return;
      ensureTabLocked(tab.id, message).catch(() => {});
    });
  }).catch(() => {});
}

/**
 * Open a dedicated standalone lockscreen tab when current tab is restricted
 */
async function openStandaloneLockscreenTab(prayer, prayerKey, lockDuration) {
  try {
    const lockscreenUrlPrefix = chrome.runtime.getURL('lockscreen.html');
    const existingTabs = await chrome.tabs.query({});
    const existingLockTab = existingTabs.find(t => t.url && t.url.startsWith(lockscreenUrlPrefix));
    if (existingLockTab && existingLockTab.id) {
      await chrome.tabs.update(existingLockTab.id, { active: true });
      return;
    }

    const url = `${lockscreenUrlPrefix}?prayer=${encodeURIComponent(prayer.en)}&prayerAr=${encodeURIComponent(prayer.ar)}&prayerKey=${prayerKey}&lockDuration=${lockDuration}&standalone=true`;
    await chrome.tabs.create({ url, active: true });
  } catch (e) {
    console.error('[Ila Salaty] Error opening standalone lockscreen tab:', e);
  }
}

// ─── Message Handler ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep the message channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'getPrayerTimes': {
      const { todaysPrayerTimes, lastCalculated } = await chrome.storage.local.get(['todaysPrayerTimes', 'lastCalculated']);
      
      // Recalculate if we don't have times or they're from a different day
      if (!todaysPrayerTimes || !lastCalculated || !isSameDay(new Date(lastCalculated), new Date())) {
        await schedulePrayerAlarms();
        const fresh = await chrome.storage.local.get('todaysPrayerTimes');
        const nextPrayer = getNextPrayer(fresh.todaysPrayerTimes);
        return { prayerTimes: fresh.todaysPrayerTimes, nextPrayer };
      }

      const nextPrayer = getNextPrayer(todaysPrayerTimes);
      return { prayerTimes: todaysPrayerTimes, nextPrayer };
    }

    case 'getSettings': {
      const { settings } = await chrome.storage.local.get('settings');
      return { settings: settings || DEFAULT_SETTINGS };
    }

    case 'updateSettings': {
      const newSettings = message.settings;
      await chrome.storage.local.set({ settings: newSettings });
      // Recalculate prayer times with new settings
      await schedulePrayerAlarms();
      return { success: true };
    }

    case 'dismissLockscreen': {
      // Clear active reminder and snooze state
      await chrome.storage.local.remove(['activeReminder', 'snoozeState']);

      // Clear the persistent system notification
      try {
        chrome.notifications.clear(NOTIFICATION_ID);
      } catch (e) {}

      // Clear any pending snooze alarms since the user has prayed
      try {
        const allAlarms = await chrome.alarms.getAll();
        for (const a of allAlarms) {
          if (a.name.startsWith('snooze-')) {
            await chrome.alarms.clear(a.name);
            console.log(`[Ila Salaty] Dismissed snooze alarm: ${a.name}`);
          }
        }
      } catch (e) {}

      // Tell all open tabs to hide lockscreen
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && !isRestrictedUrl(tab.url)) {
          chrome.tabs.sendMessage(tab.id, { type: 'HIDE_LOCKSCREEN' }).catch(() => {});
        }
      }
      return { success: true };
    }

    case 'snoozeReminder': {
      const minutes = parseInt(message.minutes, 10) || 5;
      const prayerKey = message.prayerKey || 'dhuhr';

      // 1. Clear active reminder state so tabs/popup know lock is released
      await chrome.storage.local.remove('activeReminder');

      // 2. Clear current notification from action center
      try {
        chrome.notifications.clear(NOTIFICATION_ID);
      } catch (e) {}

      // 3. Clear existing snooze alarms for this prayer and create new one
      const snoozeAlarmName = `snooze-${prayerKey}`;
      await chrome.alarms.clear(snoozeAlarmName);
      const snoozeWhen = Date.now() + (minutes * 60 * 1000);

      // Persist snoozeState to storage so it survives service worker dormancy
      await chrome.storage.local.set({
        snoozeState: {
          prayerKey: prayerKey,
          snoozeUntil: snoozeWhen,
          minutes: minutes
        }
      });

      // Manifest V3 standard relative alarm
      chrome.alarms.create(snoozeAlarmName, { delayInMinutes: minutes });

      console.log(`[Ila Salaty] Snooze set for ${prayerKey} in ${minutes} min (target: ${new Date(snoozeWhen).toLocaleTimeString()})`);

      // 4. Tell all open tabs to hide lockscreen
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && !isRestrictedUrl(tab.url)) {
          chrome.tabs.sendMessage(tab.id, { type: 'HIDE_LOCKSCREEN' }).catch(() => {});
        }
      }
      return { success: true, minutes: minutes };
    }

    case 'getActiveReminder': {
      const { activeReminder } = await chrome.storage.local.get('activeReminder');
      return { activeReminder: activeReminder || null };
    }

    case 'testLockscreen': {
      // Fire-and-forget: do not block response to popup, use message.tabId if available
      triggerPrayerReminder(message.prayerKey || 'dhuhr', true, message.tabId).catch((e) => {
        console.error('[Ila Salaty] Error in testLockscreen:', e);
      });
      return { success: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// ─── Active Tab Switching Handler ───────────────────────────────────
// When user switches tabs while reminder is active, immediately lock that tab too
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // 1. Check if an active snooze has elapsed and needs to trigger
    const { snoozeState } = await chrome.storage.local.get('snoozeState');
    if (snoozeState && Date.now() >= snoozeState.snoozeUntil) {
      console.log('[Ila Salaty] Snooze time elapsed on tab switch. Triggering reminder.');
      await chrome.storage.local.remove('snoozeState');
      await triggerPrayerReminder(snoozeState.prayerKey || 'dhuhr', true, activeInfo.tabId);
      return;
    }

    // 2. Check if a reminder is currently active
    const { activeReminder } = await chrome.storage.local.get('activeReminder');
    if (!activeReminder) return;

    const elapsed = (Date.now() - activeReminder.triggeredAt) / 1000 / 60;
    const remaining = (activeReminder.lockDuration || 5) - Math.floor(elapsed);
    if (remaining <= 0) return;

    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab || !tab.url || isRestrictedUrl(tab.url) || tab.discarded) return;

    const message = {
      type: 'SHOW_LOCKSCREEN',
      prayer: activeReminder.prayer,
      prayerKey: activeReminder.prayerKey,
      lockDuration: remaining
    };
    await ensureTabLocked(tab.id, message);
  } catch (e) {}
});

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

console.log('[Ila Salaty] Background service worker loaded');
