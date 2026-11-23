/* ============================================================
   Ila Salaty — Popup Logic
   Communicates with background.js via chrome.runtime.sendMessage
   Displays prayer times, next prayer countdown, and settings.
   ============================================================ */

(function () {
  "use strict";

  // --- DOM References ---
  const dateGregorianEl = document.getElementById("dateGregorian");
  const dateHijriEl = document.getElementById("dateHijri");
  const nextCountdownEl = document.getElementById("nextCountdown");
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsPanel = document.getElementById("settingsPanel");
  const inputLat = document.getElementById("inputLat");
  const inputLng = document.getElementById("inputLng");
  const locationCityName = document.getElementById("locationCityName");
  const detectLocationBtn = document.getElementById("detectLocation");
  const changeCityBtn = document.getElementById("changeCityBtn");
  const citySearchContainer = document.getElementById("citySearchContainer");
  const citySearchInput = document.getElementById("citySearchInput");
  const citySearchBtn = document.getElementById("citySearchBtn");
  const citySearchCancel = document.getElementById("citySearchCancel");
  const citySearchResults = document.getElementById("citySearchResults");
  const toggleCoordsBtn = document.getElementById("toggleCoordsBtn");
  const manualCoordsPanel = document.getElementById("manualCoordsPanel");
  const lockscreenToggle = document.getElementById("lockscreenToggle");
  const soundToggle = document.getElementById("soundToggle");
  const volumeSlider = document.getElementById("volumeSlider");
  const volumeLabel = document.getElementById("volumeLabel");
  const volumeGroup = document.getElementById("volumeGroup");
  const previewSoundBtn = document.getElementById("previewSound");
  const saveStatus = document.getElementById("saveStatus");

  const prayerTimeEls = {
    fajr:    document.getElementById("timeFajr"),
    dhuhr:   document.getElementById("timeDhuhr"),
    asr:     document.getElementById("timeAsr"),
    maghrib: document.getElementById("timeMaghrib"),
    isha:    document.getElementById("timeIsha")
  };

  const prayerRows = {
    fajr:    document.querySelector('[data-prayer="fajr"]'),
    dhuhr:   document.querySelector('[data-prayer="dhuhr"]'),
    asr:     document.querySelector('[data-prayer="asr"]'),
    maghrib: document.querySelector('[data-prayer="maghrib"]'),
    isha:    document.querySelector('[data-prayer="isha"]')
  };

  let countdownInterval = null;

  // --- Initialize ---
  function init() {
    displayDates();
    loadPrayerTimes();
    loadSettings();
    setupEventListeners();
  }

  // --- Display Dates ---
  function displayDates() {
    const now = new Date();

    // Gregorian
    dateGregorianEl.textContent = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    // Initial Hijri date estimation (overwritten with authentic API Hijri date when prayer times load)
    dateHijriEl.textContent = formatHijriDate(now);
  }

  /**
   * Approximate Hijri date fallback conversion when API Hijri date is not yet loaded.
   */
  function formatHijriDate(date) {
    try {
      return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(date);
    } catch (e) {
      return approximateHijri(date);
    }
  }

  function approximateHijri(date) {
    var epoch = new Date(622, 6, 16);
    var diff = date.getTime() - epoch.getTime();
    var days = Math.floor(diff / 86400000);
    var hijriYear = Math.floor((30 * days + 10646) / 10631);
    var daysInYear = days - Math.floor((10631 * hijriYear - 10617) / 30);
    var hijriMonth = Math.min(12, Math.ceil((daysInYear + 0.5) / 29.5));
    var hijriDay = Math.max(1, daysInYear - Math.floor(29.5001 * (hijriMonth - 1)) + 1);

    var months = [
      "محرم", "صفر", "ربيع الأول", "ربيع الآخر",
      "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
      "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
    ];

    return hijriDay + " " + months[hijriMonth - 1] + " " + hijriYear + " هـ";
  }

  // --- Load Prayer Times from background ---
  function loadPrayerTimes() {
    chrome.runtime.sendMessage({ type: "getPrayerTimes" }, function (response) {
      if (chrome.runtime.lastError) {
        console.error("Error getting prayer times:", chrome.runtime.lastError);
        return;
      }
      if (response && response.prayerTimes) {
        displayPrayerTimes(response.prayerTimes, response.nextPrayer);
      }
    });
  }

  function getNextPrayer(prayerTimes, referenceDate) {
    if (!prayerTimes) return null;
    var now = referenceDate || new Date();
    var currentMinutes = now.getHours() * 60 + now.getMinutes();

    var prayers = [
      { key: "fajr",    name: "Fajr",    nameArabic: "الفجر" },
      { key: "dhuhr",   name: "Dhuhr",   nameArabic: "الظهر" },
      { key: "asr",     name: "Asr",     nameArabic: "العصر" },
      { key: "maghrib", name: "Maghrib", nameArabic: "المغرب" },
      { key: "isha",    name: "Isha",    nameArabic: "العشاء" }
    ];

    for (var i = 0; i < prayers.length; i++) {
      var prayer = prayers[i];
      var timeObj = prayerTimes[prayer.key];
      if (!timeObj || timeObj.valid === false || timeObj.hour === undefined) continue;
      var prayerMinutes = timeObj.hour * 60 + timeObj.minute;
      if (prayerMinutes > currentMinutes) {
        var minutesUntil = prayerMinutes - currentMinutes;
        return {
          key: prayer.key,
          name: prayer.name,
          nameArabic: prayer.nameArabic,
          time: timeObj,
          minutesUntil: minutesUntil,
          timeRemaining: minutesUntil
        };
      }
    }

    // All prayers today have passed — next is Fajr tomorrow
    var fajrObj = prayerTimes.fajr;
    var fajrMinutes = fajrObj ? (fajrObj.hour * 60 + fajrObj.minute) : (5 * 60);
    var remainingUntilFajr = (24 * 60 - currentMinutes) + fajrMinutes;
    return {
      key: "fajr",
      name: "Fajr",
      nameArabic: "الفجر",
      time: fajrObj,
      minutesUntil: remainingUntilFajr,
      timeRemaining: remainingUntilFajr,
      tomorrow: true
    };
  }

  // --- Display Prayer Times ---
  function displayPrayerTimes(times, nextPrayer) {
    if (!times) return;

    // Display authentic Hijri date from Aladhan API if available
    if (times.hijri && times.hijri.formatted && dateHijriEl) {
      dateHijriEl.textContent = times.hijri.formatted;
    }

    // Update each prayer time
    var prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    for (var i = 0; i < prayers.length; i++) {
      var key = prayers[i];
      if (times[key] && prayerTimeEls[key]) {
        prayerTimeEls[key].textContent = times[key].formatted || formatTimeObj(times[key]);
      }
    }

    // Start live countdown to next prayer and highlight active row
    startNextPrayerCountdown(times);
  }

  function formatTimeObj(t) {
    if (!t || t.hour === undefined) return "--:--";
    var h = t.hour;
    var m = t.minute;
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return h + ":" + String(m).padStart(2, "0") + " " + ampm;
  }

  // --- Next Prayer Countdown ---
  function startNextPrayerCountdown(times) {
    if (countdownInterval) clearInterval(countdownInterval);

    function update() {
      var next = getNextPrayer(times);
      if (!next) {
        if (nextCountdownEl) nextCountdownEl.textContent = "--";
        return;
      }

      // Highlight next prayer row
      for (var k in prayerRows) {
        if (prayerRows[k]) prayerRows[k].classList.remove("is-next");
      }
      if (prayerRows[next.key]) {
        prayerRows[next.key].classList.add("is-next");
      }

      var mins = next.minutesUntil;
      if (mins <= 0) {
        if (nextCountdownEl) nextCountdownEl.textContent = "Now!";
        return;
      }
      var hours = Math.floor(mins / 60);
      var m = mins % 60;
      if (nextCountdownEl) {
        if (hours > 0) {
          nextCountdownEl.textContent = hours + "h " + m + "m";
        } else {
          nextCountdownEl.textContent = m + "m";
        }
      }
    }

    update();
    countdownInterval = setInterval(update, 30000);
  }

  // --- Load Settings from background ---
  function loadSettings() {
    chrome.runtime.sendMessage({ type: "getSettings" }, function (response) {
      if (chrome.runtime.lastError) {
        console.error("Error getting settings:", chrome.runtime.lastError);
        return;
      }
      if (response && response.settings) {
        applySettings(response.settings);
      }
    });
  }

  // --- Comprehensive Famous Cities Coordinates Database ---
  var FAMOUS_CITIES = [
    { name: "Shah Alam, Malaysia", lat: 3.0738, lng: 101.5183 },
    { name: "Kuala Lumpur, Malaysia", lat: 3.1390, lng: 101.6869 },
    { name: "Petaling Jaya, Malaysia", lat: 3.1073, lng: 101.6067 },
    { name: "Johor Bahru, Malaysia", lat: 1.4927, lng: 103.7414 },
    { name: "Penang, Malaysia", lat: 5.4164, lng: 100.3327 },
    { name: "Singapore", lat: 1.3521, lng: 103.8198 },
    { name: "Jakarta, Indonesia", lat: -6.2088, lng: 106.8456 },
    { name: "Surabaya, Indonesia", lat: -7.2575, lng: 112.7521 },
    { name: "Bandung, Indonesia", lat: -6.9175, lng: 107.6191 },
    { name: "Mecca, Saudi Arabia", lat: 21.4225, lng: 39.8262 },
    { name: "Medina, Saudi Arabia", lat: 24.5247, lng: 39.5692 },
    { name: "Riyadh, Saudi Arabia", lat: 24.7136, lng: 46.6753 },
    { name: "Jeddah, Saudi Arabia", lat: 21.5433, lng: 39.1728 },
    { name: "Cairo, Egypt", lat: 30.0444, lng: 31.2357 },
    { name: "Alexandria, Egypt", lat: 31.2001, lng: 29.9187 },
    { name: "Dubai, UAE", lat: 25.2048, lng: 55.2708 },
    { name: "Abu Dhabi, UAE", lat: 24.4539, lng: 54.3773 },
    { name: "Doha, Qatar", lat: 25.2854, lng: 51.5310 },
    { name: "Kuwait City, Kuwait", lat: 29.3759, lng: 47.9774 },
    { name: "Manama, Bahrain", lat: 26.2285, lng: 50.5860 },
    { name: "Muscat, Oman", lat: 23.5880, lng: 58.3829 },
    { name: "Amman, Jordan", lat: 31.9454, lng: 35.9284 },
    { name: "Jerusalem, Palestine", lat: 31.7683, lng: 35.2137 },
    { name: "Beirut, Lebanon", lat: 33.8938, lng: 35.5018 },
    { name: "Damascus, Syria", lat: 33.5138, lng: 36.2765 },
    { name: "Baghdad, Iraq", lat: 33.3152, lng: 44.3661 },
    { name: "Casablanca, Morocco", lat: 33.5731, lng: -7.5898 },
    { name: "Rabat, Morocco", lat: 34.0209, lng: -6.8416 },
    { name: "Tunis, Tunisia", lat: 36.8065, lng: 10.1815 },
    { name: "Algiers, Algeria", lat: 36.7538, lng: 3.0588 },
    { name: "Tripoli, Libya", lat: 32.8872, lng: 13.1913 },
    { name: "Khartoum, Sudan", lat: 15.5007, lng: 32.5599 },
    { name: "Istanbul, Turkey", lat: 41.0082, lng: 28.9784 },
    { name: "Ankara, Turkey", lat: 39.9334, lng: 32.8597 },
    { name: "Karachi, Pakistan", lat: 24.8607, lng: 67.0011 },
    { name: "Lahore, Pakistan", lat: 31.5204, lng: 74.3587 },
    { name: "Islamabad, Pakistan", lat: 33.6844, lng: 73.0479 },
    { name: "Dhaka, Bangladesh", lat: 23.8103, lng: 90.4125 },
    { name: "New Delhi, India", lat: 28.6139, lng: 77.2090 },
    { name: "Mumbai, India", lat: 19.0760, lng: 72.8777 },
    { name: "London, United Kingdom", lat: 51.5074, lng: -0.1278 },
    { name: "Paris, France", lat: 48.8566, lng: 2.3522 },
    { name: "Berlin, Germany", lat: 52.5200, lng: 13.4050 },
    { name: "New York, USA", lat: 40.7128, lng: -74.0060 },
    { name: "Chicago, USA", lat: 41.8781, lng: -87.6298 },
    { name: "Los Angeles, USA", lat: 34.0522, lng: -118.2437 },
    { name: "Toronto, Canada", lat: 43.6532, lng: -79.3832 },
    { name: "Tokyo, Japan", lat: 35.6762, lng: 139.6503 },
    { name: "Sydney, Australia", lat: -33.8688, lng: 151.2093 },
    { name: "Melbourne, Australia", lat: -37.8136, lng: 144.9631 }
  ];

  var TIMEZONE_LOCATIONS = {
    // Saudi Arabia & Gulf
    "Asia/Riyadh": { lat: 24.7136, lng: 46.6753, name: "Riyadh" },
    "Asia/Dubai": { lat: 25.2048, lng: 55.2708, name: "Dubai" },
    "Asia/Kuwait": { lat: 29.3759, lng: 47.9774, name: "Kuwait City" },
    "Asia/Doha": { lat: 25.2854, lng: 51.5310, name: "Doha" },
    "Asia/Bahrain": { lat: 26.2285, lng: 50.5860, name: "Manama" },
    "Asia/Muscat": { lat: 23.5880, lng: 58.3829, name: "Muscat" },
    "Asia/Baghdad": { lat: 33.3152, lng: 44.3661, name: "Baghdad" },

    // Levant & Egypt
    "Africa/Cairo": { lat: 30.0444, lng: 31.2357, name: "Cairo" },
    "Asia/Amman": { lat: 31.9454, lng: 35.9284, name: "Amman" },
    "Asia/Jerusalem": { lat: 31.7683, lng: 35.2137, name: "Jerusalem" },
    "Asia/Beirut": { lat: 33.8938, lng: 35.5018, name: "Beirut" },
    "Asia/Damascus": { lat: 33.5138, lng: 36.2765, name: "Damascus" },

    // North Africa
    "Africa/Casablanca": { lat: 33.5731, lng: -7.5898, name: "Casablanca" },
    "Africa/Tunis": { lat: 36.8065, lng: 10.1815, name: "Tunis" },
    "Africa/Algiers": { lat: 36.7538, lng: 3.0588, name: "Algiers" },
    "Africa/Tripoli": { lat: 32.8872, lng: 13.1913, name: "Tripoli" },
    "Africa/Khartoum": { lat: 15.5007, lng: 32.5599, name: "Khartoum" },

    // South & Southeast Asia
    "Asia/Kuala_Lumpur": { lat: 3.1390, lng: 101.6869, name: "Kuala Lumpur" },
    "Asia/Singapore": { lat: 1.3521, lng: 103.8198, name: "Singapore" },
    "Asia/Jakarta": { lat: -6.2088, lng: 106.8456, name: "Jakarta" },
    "Asia/Makassar": { lat: -5.1477, lng: 119.4327, name: "Makassar" },
    "Asia/Karachi": { lat: 24.8607, lng: 67.0011, name: "Karachi" },
    "Asia/Dhaka": { lat: 23.8103, lng: 90.4125, name: "Dhaka" },
    "Asia/Kolkata": { lat: 28.6139, lng: 77.2090, name: "New Delhi" },
    "Asia/Colombo": { lat: 6.9271, lng: 79.8612, name: "Colombo" },
    "Asia/Tashkent": { lat: 41.2995, lng: 69.2401, name: "Tashkent" },
    "Asia/Baku": { lat: 40.4093, lng: 49.8671, name: "Baku" },

    // Turkey & Europe
    "Europe/Istanbul": { lat: 41.0082, lng: 28.9784, name: "Istanbul" },
    "Europe/London": { lat: 51.5074, lng: -0.1278, name: "London" },
    "Europe/Paris": { lat: 48.8566, lng: 2.3522, name: "Paris" },
    "Europe/Berlin": { lat: 52.5200, lng: 13.4050, name: "Berlin" },
    "Europe/Madrid": { lat: 40.4168, lng: -3.7038, name: "Madrid" },
    "Europe/Rome": { lat: 41.9028, lng: 12.4964, name: "Rome" },
    "Europe/Amsterdam": { lat: 52.3676, lng: 4.9041, name: "Amsterdam" },
    "Europe/Brussels": { lat: 50.8503, lng: 4.3517, name: "Brussels" },
    "Europe/Vienna": { lat: 48.2082, lng: 16.3738, name: "Vienna" },
    "Europe/Stockholm": { lat: 59.3293, lng: 18.0686, name: "Stockholm" },
    "Europe/Oslo": { lat: 59.9139, lng: 10.7522, name: "Oslo" },
    "Europe/Moscow": { lat: 55.7558, lng: 37.6173, name: "Moscow" },

    // East Asia
    "Asia/Tokyo": { lat: 35.6762, lng: 139.6503, name: "Tokyo" },

    // Americas
    "America/New_York": { lat: 40.7128, lng: -74.0060, name: "New York" },
    "America/Detroit": { lat: 42.3314, lng: -83.0458, name: "Detroit" },
    "America/Chicago": { lat: 41.8781, lng: -87.6298, name: "Chicago" },
    "America/Toronto": { lat: 43.6532, lng: -79.3832, name: "Toronto" },
    "America/Montreal": { lat: 45.5017, lng: -73.5673, name: "Montreal" },
    "America/Los_Angeles": { lat: 34.0522, lng: -118.2437, name: "Los Angeles" },
    "America/Denver": { lat: 39.7392, lng: -104.9903, name: "Denver" },
    "America/Phoenix": { lat: 33.4484, lng: -112.0740, name: "Phoenix" },
    "America/Houston": { lat: 29.7604, lng: -95.3698, name: "Houston" },
    "America/Vancouver": { lat: 49.2827, lng: -123.1207, name: "Vancouver" },

    // Australia & NZ
    "Australia/Sydney": { lat: -33.8688, lng: 151.2093, name: "Sydney" },
    "Australia/Melbourne": { lat: -37.8136, lng: 144.9631, name: "Melbourne" },
    "Pacific/Auckland": { lat: -36.8485, lng: 174.7633, name: "Auckland" }
  };

  function findDefaultLocationForLocal() {
    var tz = "UTC";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (e) { /* ignore */ }

    if (TIMEZONE_LOCATIONS[tz]) {
      return TIMEZONE_LOCATIONS[tz];
    }
    return null;
  }

  // Find nearest friendly location name for coordinates
  function findLocationName(lat, lng) {
    var numLat = parseFloat(lat);
    var numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) return "Mecca";

    var closest = null;
    var minDistance = Infinity;

    for (var i = 0; i < FAMOUS_CITIES.length; i++) {
      var c = FAMOUS_CITIES[i];
      var dLat = c.lat - numLat;
      var dLng = c.lng - numLng;
      var dist = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = c;
      }
    }

    for (var tz in TIMEZONE_LOCATIONS) {
      var loc = TIMEZONE_LOCATIONS[tz];
      var dLat2 = loc.lat - numLat;
      var dLng2 = loc.lng - numLng;
      var dist2 = Math.sqrt(dLat2 * dLat2 + dLng2 * dLng2);
      if (dist2 < minDistance) {
        minDistance = dist2;
        closest = loc;
      }
    }

    if (closest && minDistance < 0.45) {
      return closest.name;
    }

    return numLat.toFixed(2) + "°, " + numLng.toFixed(2) + "°";
  }

  function applySettings(settings) {
    // If not completed setup and had old Mecca coordinates while not in Mecca timezone, adapt to local
    if (!settings.setupComplete && Math.abs(settings.latitude - 21.4225) < 0.01 && Math.abs(settings.longitude - 39.8262) < 0.01) {
      var localTz = -new Date().getTimezoneOffset() / 60;
      if (localTz !== 3) {
        var localMatch = findDefaultLocationForLocal();
        if (localMatch) {
          inputLat.value = localMatch.lat;
          inputLng.value = localMatch.lng;
          if (locationCityName) locationCityName.textContent = localMatch.name;
          autoSaveSettings("Location adapted to local area ✓");
          return;
        }
      }
    }

    if (settings.latitude !== undefined) inputLat.value = settings.latitude;
    if (settings.longitude !== undefined) inputLng.value = settings.longitude;
    if (settings.enabled !== undefined) lockscreenToggle.checked = settings.enabled;

    // Location display
    if (locationCityName) {
      if (settings.locationName) {
        locationCityName.textContent = settings.locationName;
      } else if (settings.latitude !== undefined && settings.longitude !== undefined) {
        locationCityName.textContent = findLocationName(settings.latitude, settings.longitude);
      } else {
        locationCityName.textContent = "Mecca";
      }
    }

    // Sound settings
    var soundEnabled = settings.soundEnabled !== false;
    var volume = settings.soundVolume !== undefined ? settings.soundVolume : 80;
    soundToggle.checked = soundEnabled;
    volumeSlider.value = volume;
    volumeLabel.textContent = volume + "%";
    updateVolumeSliderFill(volume);
    volumeGroup.hidden = !soundEnabled;
  }

  // --- Central Auto-Save Settings Function ---
  function autoSaveSettings(customStatus) {
    var lat = parseFloat(inputLat.value) || 21.4225;
    var lng = parseFloat(inputLng.value) || 39.8262;
    var locName = locationCityName ? locationCityName.textContent.trim() : "Mecca";

    var settings = {
      latitude: lat,
      longitude: lng,
      locationName: locName,
      enabled: lockscreenToggle.checked,
      soundEnabled: soundToggle.checked,
      soundVolume: parseInt(volumeSlider.value, 10),
      setupComplete: true
    };

    showStatus("Fetching prayer times...", false);

    chrome.runtime.sendMessage({
      type: "updateSettings",
      settings: settings
    }, function (response) {
      if (chrome.runtime.lastError || (response && response.error)) {
        showStatus("Error updating timings", true);
        return;
      }
      showStatus(customStatus || "Saved ✓", false);
      if (response && response.prayerTimes) {
        displayPrayerTimes(response.prayerTimes, response.nextPrayer);
      } else {
        loadPrayerTimes();
      }
    });
  }

  // --- City Search Functionality ---
  async function searchCity(query) {
    if (!query || !query.trim()) return;
    var q = query.trim().toLowerCase();

    if (citySearchResults) {
      citySearchResults.hidden = false;
      citySearchResults.innerHTML = '<div class="city-search__item" style="cursor: default; opacity: 0.7;">Searching...</div>';
    }

    var results = [];
    var seen = new Set();

    // 1. Search local famous cities
    for (var i = 0; i < FAMOUS_CITIES.length; i++) {
      var c = FAMOUS_CITIES[i];
      if (c.name.toLowerCase().includes(q)) {
        if (!seen.has(c.name)) {
          seen.add(c.name);
          results.push(c);
        }
      }
    }

    // 2. Search timezone locations
    for (var tz in TIMEZONE_LOCATIONS) {
      var loc = TIMEZONE_LOCATIONS[tz];
      if (loc.name.toLowerCase().includes(q) || tz.toLowerCase().includes(q)) {
        if (!seen.has(loc.name)) {
          seen.add(loc.name);
          results.push(loc);
        }
      }
    }

    // 3. Online geocoding with OpenStreetMap Nominatim
    try {
      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, 3500);
      var url = "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=" + encodeURIComponent(query.trim());
      var res = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept-Language": "en" }
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        var data = await res.json();
        for (var j = 0; j < data.length; j++) {
          var item = data[j];
          var addr = item.address || {};
          var cityName = addr.city || addr.town || addr.municipality || addr.village || addr.county || item.name;
          var countryName = (addr.country || "");
          var stateName = addr.state || "";
          var displayName = cityName;
          if (stateName && stateName !== cityName) displayName += ", " + stateName;
          if (countryName) displayName += ", " + countryName;

          var itemLat = parseFloat(item.lat);
          var itemLng = parseFloat(item.lon);

          if (!seen.has(displayName)) {
            seen.add(displayName);
            results.push({
              name: displayName,
              lat: itemLat,
              lng: itemLng
            });
          }
        }
      }
    } catch (e) {
      // Offline fallback: local results remain active
    }

    renderSearchResults(results);
  }

  function renderSearchResults(results) {
    if (!citySearchResults) return;
    citySearchResults.innerHTML = "";

    if (!results || results.length === 0) {
      citySearchResults.innerHTML = '<div class="city-search__item" style="cursor: default; opacity: 0.7;">No matching city found</div>';
      return;
    }

    for (var i = 0; i < results.length; i++) {
      var item = results[i];
      var div = document.createElement("div");
      div.className = "city-search__item";
      div.textContent = item.name;
      div.dataset.lat = item.lat;
      div.dataset.lng = item.lng;
      div.dataset.name = item.name;

      div.addEventListener("click", function () {
        selectCity({
          name: this.dataset.name,
          lat: parseFloat(this.dataset.lat),
          lng: parseFloat(this.dataset.lng)
        });
      });

      citySearchResults.appendChild(div);
    }
  }

  function selectCity(city) {
    if (locationCityName) locationCityName.textContent = city.name;
    inputLat.value = city.lat.toFixed(4);
    inputLng.value = city.lng.toFixed(4);
    if (citySearchContainer) citySearchContainer.hidden = true;
    if (citySearchResults) {
      citySearchResults.hidden = true;
      citySearchResults.innerHTML = "";
    }
    // Automatically save new location & immediately fetch fresh timings and reschedule alarms
    autoSaveSettings("Location changed: " + city.name + " ✓");
  }

  // --- Sound helpers ---
  function updateVolumeSliderFill(val) {
    volumeSlider.style.setProperty("--vol", val + "%");
  }

  var previewAudio = null;

  function playPreview(vol) {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    previewAudio = new Audio(chrome.runtime.getURL("adhan.mp3"));
    previewAudio.volume = vol / 100;
    previewAudio.play().catch(function () {});
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Toggle settings panel
    settingsToggle.addEventListener("click", function () {
      var expanded = settingsToggle.getAttribute("aria-expanded") === "true";
      settingsToggle.setAttribute("aria-expanded", String(!expanded));
      if (expanded) {
        settingsPanel.hidden = true;
      } else {
        settingsPanel.hidden = false;
      }
    });

    // Sound toggle - auto saves
    soundToggle.addEventListener("change", function () {
      volumeGroup.hidden = !soundToggle.checked;
      if (!soundToggle.checked && previewAudio) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
      }
      autoSaveSettings(soundToggle.checked ? "Adhan sound enabled ✓" : "Adhan sound disabled ✓");
    });

    // Volume slider live feedback + debounced auto save
    var volumeSaveTimeout = null;
    volumeSlider.addEventListener("input", function () {
      var val = parseInt(volumeSlider.value, 10);
      volumeLabel.textContent = val + "%";
      updateVolumeSliderFill(val);
      clearTimeout(volumeSaveTimeout);
      volumeSaveTimeout = setTimeout(function () {
        autoSaveSettings();
      }, 500);
    });

    // Preview button
    previewSoundBtn.addEventListener("click", function () {
      playPreview(parseInt(volumeSlider.value, 10));
    });

    // Lock screen toggle - auto saves
    if (lockscreenToggle) {
      lockscreenToggle.addEventListener("change", function () {
        autoSaveSettings(lockscreenToggle.checked ? "Lock screen enabled ✓" : "Lock screen disabled ✓");
      });
    }

    // Detect location seamlessly without permission blocks + auto saves immediately
    detectLocationBtn.addEventListener("click", async function () {
      detectLocationBtn.disabled = true;
      detectLocationBtn.innerHTML = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" style="animation: ilaSalatySpin 1s linear infinite;"><circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Detecting...';

      var detected = null;

      // 1. Try IP Geolocation (network)
      try {
        var controller = new AbortController();
        var timeoutId = setTimeout(function () { controller.abort(); }, 3500);
        var res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          var data = await res.json();
          if (data.latitude && data.longitude) {
            detected = {
              lat: parseFloat(data.latitude).toFixed(4),
              lng: parseFloat(data.longitude).toFixed(4),
              name: (data.city || "") + (data.city && data.country_name ? ", " : "") + (data.country_name || "")
            };
          }
        }
      } catch (e) {
        // Fallback to secondary IP service
        try {
          var controller2 = new AbortController();
          var timeoutId2 = setTimeout(function () { controller2.abort(); }, 3000);
          var res2 = await fetch("https://freeipapi.com/api/json", { signal: controller2.signal });
          clearTimeout(timeoutId2);
          if (res2.ok) {
            var data2 = await res2.json();
            if (data2.latitude && data2.longitude) {
              detected = {
                lat: parseFloat(data2.latitude).toFixed(4),
                lng: parseFloat(data2.longitude).toFixed(4),
                name: (data2.cityName || "") + (data2.cityName && data2.countryName ? ", " : "") + (data2.countryName || "")
              };
            }
          }
        } catch (err) {
          // Network unavailable
        }
      }

      // 2. Offline fallback: match system IANA timezone
      if (!detected) {
        var tz = "UTC";
        try {
          tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        } catch (e) { /* ignore */ }

        var match = TIMEZONE_LOCATIONS[tz];
        if (match) {
          detected = {
            lat: match.lat.toFixed(4),
            lng: match.lng.toFixed(4),
            name: match.name
          };
        } else {
          var offsetHours = -new Date().getTimezoneOffset() / 60;
          var approxLng = (offsetHours * 15).toFixed(4);
          detected = {
            lat: "21.4225",
            lng: approxLng,
            name: "Timezone (UTC" + (offsetHours >= 0 ? "+" : "") + offsetHours + ")"
          };
        }
      }

      // Populate input fields
      inputLat.value = detected.lat;
      inputLng.value = detected.lng;
      if (detected.name && locationCityName) {
        locationCityName.textContent = detected.name;
      }

      detectLocationBtn.disabled = false;
      detectLocationBtn.innerHTML = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Detect location';

      // Automatically save detected location, fetch fresh times from Aladhan API, and reschedule alarms!
      autoSaveSettings("Location detected: " + (detected.name || "Coordinates set") + " ✓");
    });

    // Toggle manual coordinates accordion
    if (toggleCoordsBtn && manualCoordsPanel) {
      toggleCoordsBtn.addEventListener("click", function () {
        var expanded = toggleCoordsBtn.getAttribute("aria-expanded") === "true";
        toggleCoordsBtn.setAttribute("aria-expanded", String(!expanded));
        manualCoordsPanel.hidden = expanded;
      });
    }

    // Change city search drawer
    if (changeCityBtn && citySearchContainer) {
      changeCityBtn.addEventListener("click", function () {
        var isHidden = citySearchContainer.hidden;
        citySearchContainer.hidden = !isHidden;
        if (!citySearchContainer.hidden && citySearchInput) {
          citySearchInput.value = "";
          citySearchInput.focus();
          if (citySearchResults) {
            citySearchResults.hidden = true;
            citySearchResults.innerHTML = "";
          }
        }
      });
    }

    if (citySearchCancel && citySearchContainer) {
      citySearchCancel.addEventListener("click", function () {
        citySearchContainer.hidden = true;
        if (citySearchResults) {
          citySearchResults.hidden = true;
          citySearchResults.innerHTML = "";
        }
      });
    }

    if (citySearchBtn && citySearchInput) {
      citySearchBtn.addEventListener("click", function () {
        searchCity(citySearchInput.value);
      });
    }

    if (citySearchInput) {
      citySearchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          searchCity(citySearchInput.value);
        } else if (e.key === "Escape") {
          if (citySearchContainer) citySearchContainer.hidden = true;
          if (citySearchResults) citySearchResults.hidden = true;
        }
      });
    }

    // Manual coordinates input change listeners + debounced auto-save
    var coordsSaveTimeout = null;
    function onManualCoordsChange() {
      var lat = parseFloat(inputLat.value);
      var lng = parseFloat(inputLng.value);
      if (!isNaN(lat) && !isNaN(lng)) {
        if (locationCityName) {
          locationCityName.textContent = findLocationName(lat, lng);
        }
        clearTimeout(coordsSaveTimeout);
        coordsSaveTimeout = setTimeout(function () {
          autoSaveSettings("Coordinates saved ✓");
        }, 600);
      }
    }
    inputLat.addEventListener("input", onManualCoordsChange);
    inputLng.addEventListener("input", onManualCoordsChange);

    // Test lockscreen immediately
    var testBtn = document.getElementById("testLockscreen");
    if (testBtn) {
      testBtn.addEventListener("click", function () {
        testBtn.disabled = true;
        testBtn.textContent = "Launching Lock Screen...";

        var hasClosed = false;
        function closePopupSafely() {
          if (!hasClosed) {
            hasClosed = true;
            window.close();
          }
        }

        setTimeout(closePopupSafely, 2000);

        function sendTest(tabId) {
          try {
            chrome.runtime.sendMessage({
              type: "testLockscreen",
              prayerKey: "dhuhr",
              tabId: tabId,
              soundEnabled: soundToggle.checked,
              soundVolume: parseInt(volumeSlider.value, 10)
            }, function () {
              setTimeout(closePopupSafely, 200);
            });
          } catch (e) {
            console.error("Error sending testLockscreen message:", e);
            setTimeout(closePopupSafely, 300);
          }
        }

        chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
          if (tabs && tabs[0]) {
            sendTest(tabs[0].id);
          } else {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs2) {
              sendTest((tabs2 && tabs2[0]) ? tabs2[0].id : null);
            });
          }
        });
      });
    }
  }

  // --- Status message ---
  function showStatus(msg, isError) {
    saveStatus.textContent = msg;
    saveStatus.style.color = isError ? "#E8766A" : "var(--teal-light)";
    setTimeout(function () {
      saveStatus.textContent = "";
    }, 3000);
  }

  // --- Start ---
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
