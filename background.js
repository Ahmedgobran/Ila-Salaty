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
 * Set up the daily midnight recalculation alarm
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

  console.log('[Ila Salaty] Daily recalculation alarm set');
}

// ─── Alarm Handler ──────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[Ila Salaty] Alarm fired:', alarm.name);

  if (alarm.name === 'daily-recalc') {
    await schedulePrayerAlarms();
    return;
  }

  if (alarm.name.startsWith('prayer-')) {
    const prayerKey = alarm.name.replace('prayer-', '');
    await triggerPrayerReminder(prayerKey);
  }
});

/**
 * Trigger the prayer reminder across all tabs
 */
async function triggerPrayerReminder(prayerKey) {
  const { settings } = await chrome.storage.local.get('settings');
  const config = settings || DEFAULT_SETTINGS;

  if (!config.enabled) return;

  const prayerNames = {
    fajr: { en: 'Fajr', ar: 'الفجر' },
    dhuhr: { en: 'Dhuhr', ar: 'الظهر' },
    asr: { en: 'Asr', ar: 'العصر' },
    maghrib: { en: 'Maghrib', ar: 'المغرب' },
    isha: { en: 'Isha', ar: 'العشاء' }
  };

  const prayer = prayerNames[prayerKey] || { en: prayerKey, ar: '' };

  // Send lock screen command to all tabs
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    // Skip chrome:// and other restricted URLs
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
      continue;
    }
    const message = {
      type: 'SHOW_LOCKSCREEN',
      prayer: prayer,
      prayerKey: prayerKey,
      lockDuration: config.lockDurationMinutes || 5
    };
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (e) {
      // If tab was opened before extension install/reload, inject content script dynamically
      try {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (err) {
        console.log(`[Ila Salaty] Tab ${tab.id} skipped:`, err.message);
      }
    }
  }

  // Show a system notification as backup
  try {
    chrome.notifications.create(`prayer-${prayerKey}-${Date.now()}`, {
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

  // Store that we're currently in a prayer reminder
  await chrome.storage.local.set({
    activeReminder: {
      prayerKey,
      prayer,
      triggeredAt: Date.now()
    }
  });
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
      // Clear active reminder
      await chrome.storage.local.remove('activeReminder');
      // Tell all tabs to hide lockscreen
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'HIDE_LOCKSCREEN' });
        } catch (e) { /* ignore */ }
      }
      return { success: true };
    }

    case 'getActiveReminder': {
      const { activeReminder } = await chrome.storage.local.get('activeReminder');
      return { activeReminder: activeReminder || null };
    }

    case 'testLockscreen': {
      // For testing — trigger a lock screen immediately
      await triggerPrayerReminder(message.prayerKey || 'dhuhr');
      return { success: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

console.log('[Ila Salaty] Background service worker loaded');
