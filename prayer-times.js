/**
 * Ila Salaty — Prayer Times API & Scheduling Service
 * 
 * Integrates with the industry-standard Aladhan REST API to fetch accurate
 * prayer timings worldwide, automatically resolving local prayer authority methods
 * based on geographic coordinates.
 * 
 * Provides caching in chrome.storage.local, timezone-aware timestamp conversion,
 * and next-prayer determination.
 */

/**
 * Validates and returns a safe IANA timezone name.
 * @param {string} timeZone
 * @returns {string}
 */
function getValidTimeZone(timeZone) {
  if (!timeZone) return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
}

/**
 * Parses raw prayer time strings like "05:51" or "05:51 (+08)" or "13:08 (EST)".
 * @param {string} raw
 * @returns {{ hour: number, minute: number, timeStr: string, formatted: string, valid: boolean }}
 */
function parseTimeString(raw) {
  if (!raw) return { hour: 0, minute: 0, timeStr: '00:00', formatted: '--:--', valid: false };
  const clean = String(raw).split(' ')[0].trim();
  const parts = clean.split(':');
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) {
    return { hour: 0, minute: 0, timeStr: '00:00', formatted: '--:--', valid: false };
  }
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
  const formatted = `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
  return {
    hour,
    minute,
    timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    formatted,
    valid: true
  };
}

/**
 * Formats a time object { hour, minute } into 12-hour AM/PM string.
 * @param {{ hour?: number, minute?: number }} t
 * @returns {string}
 */
function formatTimeObj(t) {
  if (!t || t.hour === undefined || t.minute === undefined) return '--:--';
  const h = t.hour;
  const m = t.minute;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Converts a prayer time string (HH:mm) into a Unix epoch timestamp (ms),
 * accurately accounting for the target location's timezone and daylight saving time.
 * 
 * @param {string} timeStr - "HH:mm" time string
 * @param {string} timeZone - Target location IANA timezone (e.g. "Asia/Kuala_Lumpur")
 * @param {Date} [targetDate] - Target date
 * @returns {number} UTC epoch timestamp in milliseconds
 */
function getPrayerTimestamp(timeStr, timeZone, targetDate = new Date()) {
  const cleanTime = String(timeStr).split(' ')[0].trim();
  const [hours, minutes] = cleanTime.split(':').map(Number);
  const targetTz = getValidTimeZone(timeZone);

  // Format targetDate in target timezone to obtain YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: targetTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const dateParts = formatter.format(targetDate);
  const isoStr = `${dateParts}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`;
  const approxUtc = new Date(isoStr).getTime();

  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: targetTz,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hourCycle: 'h23'
  });

  const parts = tzFormatter.formatToParts(new Date(approxUtc));
  const p = {};
  for (const part of parts) p[part.type] = part.value;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  const offsetMs = asUtc - approxUtc;

  return approxUtc - offsetMs;
}

/**
 * Normalizes Aladhan API JSON response into standard extension prayerTimes object.
 * @param {object} json - Aladhan API JSON response
 * @returns {object} Normalized prayer times object
 */
function parseAladhanResponse(json) {
  if (!json || !json.data || !json.data.timings) {
    throw new Error('Invalid Aladhan API response structure');
  }

  const rawTimings = json.data.timings;
  const meta = json.data.meta || {};
  const dateInfo = json.data.date || {};

  const fajr = parseTimeString(rawTimings.Fajr);
  const sunrise = parseTimeString(rawTimings.Sunrise);
  const dhuhr = parseTimeString(rawTimings.Dhuhr);
  const asr = parseTimeString(rawTimings.Asr);
  const maghrib = parseTimeString(rawTimings.Maghrib);
  const isha = parseTimeString(rawTimings.Isha);

  let hijriFormatted = '';
  if (dateInfo.hijri) {
    const h = dateInfo.hijri;
    const day = h.day || '';
    const month = (h.month && (h.month.ar || h.month.en)) || '';
    const year = h.year || '';
    hijriFormatted = `${day} ${month} ${year} هـ`.trim();
  }

  return {
    fajr,
    sunrise,
    dhuhr,
    asr,
    maghrib,
    isha,
    timezone: meta.timezone || 'UTC',
    dateReadable: dateInfo.readable || '',
    hijri: {
      formatted: hijriFormatted,
      day: dateInfo.hijri?.day,
      month: dateInfo.hijri?.month,
      year: dateInfo.hijri?.year,
      designation: dateInfo.hijri?.designation
    },
    meta: {
      timezone: meta.timezone,
      methodName: meta.method?.name || '',
      methodId: meta.method?.id,
      dateReadable: dateInfo.readable
    },
    _raw: {
      fajr: fajr.hour + fajr.minute / 60,
      sunrise: sunrise.hour + sunrise.minute / 60,
      dhuhr: dhuhr.hour + dhuhr.minute / 60,
      asr: asr.hour + asr.minute / 60,
      maghrib: maghrib.hour + maghrib.minute / 60,
      isha: isha.hour + isha.minute / 60
    }
  };
}

/**
 * Fetches prayer times from Aladhan API or chrome.storage.local cache.
 * Automatically lets the Aladhan API select the official regional calculation
 * method based on the supplied coordinates.
 * 
 * @param {number} latitude
 * @param {number} longitude
 * @param {Date} [targetDate]
 * @returns {Promise<object>}
 */
async function getPrayerTimes(latitude, longitude, targetDate = new Date()) {
  const numLat = parseFloat(latitude);
  const numLng = parseFloat(longitude);
  if (isNaN(numLat) || isNaN(numLng)) {
    throw new Error('Valid latitude and longitude are required');
  }

  const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
  const cacheKey = `prayer_times_${numLat.toFixed(2)}_${numLng.toFixed(2)}_${dateStr}`;

  // 1. Check local cache first
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const cached = await chrome.storage.local.get([cacheKey]);
      if (cached && cached[cacheKey]) {
        return cached[cacheKey];
      }
    } catch (e) {
      console.warn('[Ila Salaty] Cache read error:', e);
    }
  }

  // 2. Fetch from Aladhan API (omitting method parameter so Aladhan auto-selects the official regional method)
  const timestamp = Math.floor(targetDate.getTime() / 1000);
  const apiUrl = `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${numLat}&longitude=${numLng}`;

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
    const response = await fetch(apiUrl, {
      signal: controller ? controller.signal : undefined
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Aladhan API returned HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json.code !== 200 || !json.data) {
      throw new Error('Failed to retrieve prayer timings from Aladhan API');
    }

    const resultData = parseAladhanResponse(json);

    // 3. Cache in chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({ [cacheKey]: resultData });
      } catch (e) {
        console.warn('[Ila Salaty] Cache write error:', e);
      }
    }

    return resultData;
  } catch (networkError) {
    console.warn('[Ila Salaty] Network fetch failed, checking offline fallback:', networkError.message);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const fallback = await chrome.storage.local.get(['todaysPrayerTimes']);
      if (fallback && fallback.todaysPrayerTimes) {
        return fallback.todaysPrayerTimes;
      }
    }
    throw networkError;
  }
}

/**
 * Determines which prayer is next and calculates remaining minutes accurately
 * against the user's reference clock time.
 * 
 * @param {object} prayerTimes - Normalized prayer times object
 * @param {Date} [referenceDate] - Reference date (defaults to now)
 * @returns {object|null}
 */
function getNextPrayer(prayerTimes, referenceDate = new Date()) {
  if (!prayerTimes) return null;

  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();

  const prayers = [
    { key: 'fajr',    name: 'Fajr',    nameArabic: 'الفجر' },
    { key: 'dhuhr',   name: 'Dhuhr',   nameArabic: 'الظهر' },
    { key: 'asr',     name: 'Asr',     nameArabic: 'العصر' },
    { key: 'maghrib', name: 'Maghrib', nameArabic: 'المغرب' },
    { key: 'isha',    name: 'Isha',    nameArabic: 'العشاء' }
  ];

  for (const prayer of prayers) {
    const timeObj = prayerTimes[prayer.key];
    if (!timeObj || !timeObj.valid) continue;
    const prayerMinutes = timeObj.hour * 60 + timeObj.minute;
    if (prayerMinutes > currentMinutes) {
      const minutesUntil = prayerMinutes - currentMinutes;
      const targetTime = new Date(referenceDate);
      targetTime.setHours(timeObj.hour, timeObj.minute, 0, 0);
      return {
        ...prayer,
        time: timeObj,
        timestamp: targetTime.getTime(),
        minutesUntil,
        timeRemaining: minutesUntil
      };
    }
  }

  // All prayers today have passed — next is Fajr tomorrow
  const fajrObj = prayerTimes.fajr;
  const fajrMinutes = fajrObj ? (fajrObj.hour * 60 + fajrObj.minute) : (5 * 60);
  const minutesUntil = (24 * 60 - currentMinutes) + fajrMinutes;
  const tomorrow = new Date(referenceDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (fajrObj) tomorrow.setHours(fajrObj.hour, fajrObj.minute, 0, 0);

  return {
    ...prayers[0],
    time: fajrObj,
    timestamp: tomorrow.getTime(),
    minutesUntil,
    timeRemaining: minutesUntil,
    tomorrow: true
  };
}

// ─── Exports (for Service Worker importScripts & Window) ─────────────
if (typeof self !== 'undefined') {
  self.getPrayerTimes = getPrayerTimes;
  self.getPrayerTimestamp = getPrayerTimestamp;
  self.getNextPrayer = getNextPrayer;
  self.parseTimeString = parseTimeString;
  self.formatTimeObj = formatTimeObj;
  self.parseAladhanResponse = parseAladhanResponse;
  self.getValidTimeZone = getValidTimeZone;
}
