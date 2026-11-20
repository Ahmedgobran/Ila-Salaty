/**
 * Ila Salaty — Prayer Times Calculation Engine
 * 
 * Implements the standard astronomical algorithms for Islamic prayer time
 * calculation. Supports multiple calculation methods used worldwide.
 * 
 * Based on the well-established formulas from:
 * - PrayTimes.org algorithms
 * - ISNA, Muslim World League, Egyptian General Authority standards
 */

// ─── Calculation Methods ─────────────────────────────────────────────
const CALCULATION_METHODS = {
  MWL: {
    name: 'Muslim World League',
    fajrAngle: 18,
    ishaAngle: 17,
    ishaMinutes: null
  },
  JAKIM: {
    name: 'Jabatan Kemajuan Islam Malaysia (JAKIM)',
    fajrAngle: 18,
    ishaAngle: 18,
    ishaMinutes: null
  },
  Singapore: {
    name: 'Majlis Ugama Islam Singapura (MUIS)',
    fajrAngle: 20,
    ishaAngle: 18,
    ishaMinutes: null
  },
  ISNA: {
    name: 'Islamic Society of North America',
    fajrAngle: 15,
    ishaAngle: 15,
    ishaMinutes: null
  },
  Egypt: {
    name: 'Egyptian General Authority of Survey',
    fajrAngle: 19.5,
    ishaAngle: 17.5,
    ishaMinutes: null
  },
  Makkah: {
    name: 'Umm Al-Qura University, Makkah',
    fajrAngle: 18.5,
    ishaAngle: null,
    ishaMinutes: 90  // 90 minutes after Maghrib
  },
  Karachi: {
    name: 'University of Islamic Sciences, Karachi',
    fajrAngle: 18,
    ishaAngle: 18,
    ishaMinutes: null
  },
  Dubai: {
    name: 'Dubai (UAE)',
    fajrAngle: 18.2,
    ishaAngle: 18.2,
    ishaMinutes: null
  },
  Diyanet: {
    name: 'Presidency of Religious Affairs, Turkey',
    fajrAngle: 18,
    ishaAngle: 17,
    ishaMinutes: null
  }
};

// ─── Math Helpers ────────────────────────────────────────────────────

function degToRad(deg) {
  return deg * Math.PI / 180;
}

function radToDeg(rad) {
  return rad * 180 / Math.PI;
}

function sinDeg(deg) {
  return Math.sin(degToRad(deg));
}

function cosDeg(deg) {
  return Math.cos(degToRad(deg));
}

function tanDeg(deg) {
  return Math.tan(degToRad(deg));
}

function arcsinDeg(x) {
  return radToDeg(Math.asin(x));
}

function arccosDeg(x) {
  return radToDeg(Math.acos(x));
}

function arctanDeg(x) {
  return radToDeg(Math.atan(x));
}

function arctan2Deg(y, x) {
  return radToDeg(Math.atan2(y, x));
}

function fixAngle(angle) {
  return angle - 360 * Math.floor(angle / 360);
}

function fixHour(hour) {
  return hour - 24 * Math.floor(hour / 24);
}

// ─── Solar Calculations ─────────────────────────────────────────────

/**
 * Calculate Julian Date from a calendar date
 */
function julianDate(year, month, day) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) +
         Math.floor(30.6001 * (month + 1)) +
         day + B - 1524.5;
}

/**
 * Calculate the Sun's position for a given Julian date
 * Returns { declination, equationOfTime }
 */
function sunPosition(jd) {
  const D = jd - 2451545.0; // Days since J2000.0
  const g = fixAngle(357.529 + 0.98560028 * D); // Mean anomaly of the Sun
  const q = fixAngle(280.459 + 0.98564736 * D); // Mean longitude of the Sun
  const L = fixAngle(q + 1.915 * sinDeg(g) + 0.020 * sinDeg(2 * g)); // Ecliptic longitude

  const e = 23.439 - 0.00000036 * D; // Obliquity of the ecliptic
  const RA = arctan2Deg(cosDeg(e) * sinDeg(L), cosDeg(L)) / 15; // Right ascension in hours

  const declination = arcsinDeg(sinDeg(e) * sinDeg(L));
  let equationOfTime = q / 15 - fixHour(RA);
  while (equationOfTime > 12) equationOfTime -= 24;
  while (equationOfTime < -12) equationOfTime += 24;

  return { declination, equationOfTime };
}

/**
 * Compute the hour angle for a given sun altitude angle
 */
function hourAngle(latitude, declination, angle) {
  const cosHA = (sinDeg(angle) - sinDeg(latitude) * sinDeg(declination)) /
                (cosDeg(latitude) * cosDeg(declination));
  // Clamp to [-1, 1] for extreme latitudes
  if (cosHA < -1) return NaN; // Sun never reaches this angle (e.g. midnight sun)
  if (cosHA > 1) return NaN;  // Sun never rises high enough
  return arccosDeg(cosHA);
}

// ─── Core Calculation ───────────────────────────────────────────────

/**
 * Calculate prayer times for a given date and location.
 * 
 * @param {Date} date - The date to calculate for
 * @param {number} latitude - Geographic latitude
 * @param {number} longitude - Geographic longitude
 * @param {string} method - Calculation method key (MWL, JAKIM, Singapore, ISNA, Egypt, Makkah, Karachi, Dubai, Diyanet)
 * @param {number} [timezone] - Optional timezone offset in hours (e.g. 8 for UTC+8, 3 for UTC+3)
 * @returns {object} Prayer times object
 */
function calculatePrayerTimes(date, latitude, longitude, method = 'MWL', timezone = null) {
  const methodParams = CALCULATION_METHODS[method] || CALCULATION_METHODS.MWL;

  // Determine timezone offset in hours
  let timezoneOffset;
  if (typeof timezone === 'number' && !isNaN(timezone)) {
    timezoneOffset = timezone;
  } else {
    const localOffset = -date.getTimezoneOffset() / 60;
    const approxGeoOffset = Math.round(longitude / 15);
    if (Math.abs(localOffset - approxGeoOffset) <= 2) {
      timezoneOffset = localOffset;
    } else {
      timezoneOffset = approxGeoOffset;
    }
  }

  // Julian date for the given date at noon
  const jd = julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate());

  // Sun position at noon
  const sun = sunPosition(jd + 0.5);
  const { declination, equationOfTime } = sun;

  // ── Dhuhr (Solar Noon) ──
  const dhuhrTime = 12 + timezoneOffset - longitude / 15 - equationOfTime;

  // ── Sunrise & Sunset (sun altitude = -0.8333° for atmospheric refraction) ──
  const sunriseAngle = hourAngle(latitude, declination, -0.8333);
  const sunriseTime = dhuhrTime - sunriseAngle / 15;
  const sunsetTime = dhuhrTime + sunriseAngle / 15;

  // ── Fajr (sun below horizon by fajrAngle degrees) ──
  const fajrHA = hourAngle(latitude, declination, -methodParams.fajrAngle);
  const fajrTime = dhuhrTime - fajrHA / 15;

  // ── Asr (Standard: shadow factor = 1) ──
  const asrAltitude = arctanDeg(1 / (1 + tanDeg(Math.abs(latitude - declination))));
  const asrHA = hourAngle(latitude, declination, asrAltitude);
  const asrTime = dhuhrTime + asrHA / 15;

  // ── Maghrib (at sunset) ──
  const maghribTime = sunsetTime;

  // ── Isha ──
  let ishaTime;
  if (methodParams.ishaMinutes) {
    // Fixed minutes after Maghrib (Umm Al-Qura method)
    ishaTime = maghribTime + methodParams.ishaMinutes / 60;
  } else {
    const ishaHA = hourAngle(latitude, declination, -methodParams.ishaAngle);
    ishaTime = dhuhrTime + ishaHA / 15;
  }

  // Format all times
  return {
    fajr: formatTime(fajrTime),
    sunrise: formatTime(sunriseTime),
    dhuhr: formatTime(dhuhrTime),
    asr: formatTime(asrTime),
    maghrib: formatTime(maghribTime),
    isha: formatTime(ishaTime),
    _raw: {
      fajr: fixHour(fajrTime),
      sunrise: fixHour(sunriseTime),
      dhuhr: fixHour(dhuhrTime),
      asr: fixHour(asrTime),
      maghrib: fixHour(maghribTime),
      isha: fixHour(ishaTime)
    }
  };
}

/**
 * Convert a decimal hour value to { hour, minute, formatted } 
 */
function formatTime(decimalHour) {
  if (isNaN(decimalHour)) {
    return { hour: 0, minute: 0, formatted: '--:--', valid: false };
  }

  let hours = fixHour(decimalHour);
  let minutes = Math.round((hours - Math.floor(hours)) * 60);
  hours = Math.floor(hours);

  if (minutes >= 60) {
    hours += 1;
    minutes -= 60;
  }
  if (hours >= 24) hours -= 24;

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
  const formatted = `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;

  return {
    hour: hours,
    minute: minutes,
    formatted,
    valid: true
  };
}

/**
 * Determine which prayer is next, given calculated prayer times.
 * 
 * @param {object} prayerTimes - Output from calculatePrayerTimes
 * @returns {object} { name, nameArabic, time, minutesUntil }
 */
function getNextPrayer(prayerTimes) {
  const now = new Date();
  const currentDecimal = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

  const prayers = [
    { key: 'fajr',    name: 'Fajr',    nameArabic: 'الفجر' },
    { key: 'dhuhr',   name: 'Dhuhr',   nameArabic: 'الظهر' },
    { key: 'asr',     name: 'Asr',     nameArabic: 'العصر' },
    { key: 'maghrib', name: 'Maghrib', nameArabic: 'المغرب' },
    { key: 'isha',    name: 'Isha',    nameArabic: 'العشاء' }
  ];

  const raw = prayerTimes._raw;

  for (const prayer of prayers) {
    const prayerDecimal = raw[prayer.key];
    if (prayerDecimal > currentDecimal) {
      const minutesUntil = Math.round((prayerDecimal - currentDecimal) * 60);
      return {
        ...prayer,
        time: prayerTimes[prayer.key],
        minutesUntil,
        timeRemaining: minutesUntil
      };
    }
  }

  // All prayers have passed — next is Fajr tomorrow
  const fajrDecimal = raw.fajr;
  const minutesUntil = Math.round((24 - currentDecimal + fajrDecimal) * 60);
  return {
    ...prayers[0],
    time: prayerTimes.fajr,
    minutesUntil,
    timeRemaining: minutesUntil,
    tomorrow: true
  };
}

// ─── Exports (for Service Worker importScripts) ─────────────────────
// In a service worker context, these become global
if (typeof self !== 'undefined') {
  self.calculatePrayerTimes = calculatePrayerTimes;
  self.getNextPrayer = getNextPrayer;
  self.CALCULATION_METHODS = CALCULATION_METHODS;
}
