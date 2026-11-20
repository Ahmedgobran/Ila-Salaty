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
  const detectLocationBtn = document.getElementById("detectLocation");
  const calcMethodSelect = document.getElementById("calcMethod");
  const lockscreenToggle = document.getElementById("lockscreenToggle");
  const soundToggle = document.getElementById("soundToggle");
  const volumeSlider = document.getElementById("volumeSlider");
  const volumeLabel = document.getElementById("volumeLabel");
  const volumeGroup = document.getElementById("volumeGroup");
  const previewSoundBtn = document.getElementById("previewSound");
  const saveBtn = document.getElementById("saveSettings");
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

    // Approximate Hijri date
    dateHijriEl.textContent = formatHijriDate(now);
  }

  /**
   * Approximate Hijri date conversion.
   * Uses a simple algorithmic approximation — not perfectly accurate
   * but sufficient for display purposes.
   */
  function formatHijriDate(date) {
    try {
      // Use Intl if available (modern Chrome supports it)
      return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(date);
    } catch (e) {
      // Fallback: rough approximation
      return approximateHijri(date);
    }
  }

  function approximateHijri(date) {
    // Approximate algorithm: days since Islamic epoch
    var epoch = new Date(622, 6, 16); // July 16, 622 CE (approximate)
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

  // --- Display Prayer Times ---
  function displayPrayerTimes(times, nextPrayer) {
    // Update each prayer time
    var prayers = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    for (var i = 0; i < prayers.length; i++) {
      var key = prayers[i];
      if (times[key] && prayerTimeEls[key]) {
        prayerTimeEls[key].textContent = times[key].formatted || formatTimeObj(times[key]);
      }
      // Clear previous highlight
      if (prayerRows[key]) {
        prayerRows[key].classList.remove("is-next");
      }
    }

    // Highlight next prayer
    var nextKey = nextPrayer ? (nextPrayer.key || (nextPrayer.name && nextPrayer.name.toLowerCase())) : null;
    if (nextKey && prayerRows[nextKey]) {
      prayerRows[nextKey].classList.add("is-next");
    }

    // Start countdown to next prayer
    var remainingMinutes = nextPrayer ? (nextPrayer.timeRemaining !== undefined ? nextPrayer.timeRemaining : nextPrayer.minutesUntil) : null;
    if (remainingMinutes !== null && remainingMinutes !== undefined) {
      startNextPrayerCountdown(remainingMinutes);
    }
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
  function startNextPrayerCountdown(initialMinutes) {
    if (countdownInterval) clearInterval(countdownInterval);

    var remaining = initialMinutes;

    function updateCountdown() {
      if (remaining <= 0) {
        nextCountdownEl.textContent = "Now!";
        clearInterval(countdownInterval);
        return;
      }
      var hours = Math.floor(remaining / 60);
      var mins = Math.round(remaining % 60);
      if (hours > 0) {
        nextCountdownEl.textContent = hours + "h " + mins + "m";
      } else {
        nextCountdownEl.textContent = mins + "m";
      }
      remaining--;
    }

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 60000); // every minute
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

  function applySettings(settings) {
    if (settings.latitude !== undefined) inputLat.value = settings.latitude;
    if (settings.longitude !== undefined) inputLng.value = settings.longitude;
    if (settings.calculationMethod) calcMethodSelect.value = settings.calculationMethod;
    if (settings.enabled !== undefined) lockscreenToggle.checked = settings.enabled;

    // Sound settings
    var soundEnabled = settings.soundEnabled !== false; // default true
    var volume = settings.soundVolume !== undefined ? settings.soundVolume : 80;
    soundToggle.checked = soundEnabled;
    volumeSlider.value = volume;
    volumeLabel.textContent = volume + "%";
    updateVolumeSliderFill(volume);
    volumeGroup.hidden = !soundEnabled;
  }

  // --- Comprehensive Timezone Coordinates Map ---
  var TIMEZONE_LOCATIONS = {
    // Saudi Arabia & Gulf
    "Asia/Riyadh": { lat: 24.7136, lng: 46.6753, name: "Riyadh", method: "Makkah" },
    "Asia/Dubai": { lat: 25.2048, lng: 55.2708, name: "Dubai", method: "MWL" },
    "Asia/Kuwait": { lat: 29.3759, lng: 47.9774, name: "Kuwait City", method: "MWL" },
    "Asia/Doha": { lat: 25.2854, lng: 51.5310, name: "Doha", method: "MWL" },
    "Asia/Bahrain": { lat: 26.2285, lng: 50.5860, name: "Manama", method: "MWL" },
    "Asia/Muscat": { lat: 23.5880, lng: 58.3829, name: "Muscat", method: "MWL" },
    "Asia/Baghdad": { lat: 33.3152, lng: 44.3661, name: "Baghdad", method: "MWL" },

    // Levant & Egypt
    "Africa/Cairo": { lat: 30.0444, lng: 31.2357, name: "Cairo", method: "Egypt" },
    "Asia/Amman": { lat: 31.9454, lng: 35.9284, name: "Amman", method: "MWL" },
    "Asia/Jerusalem": { lat: 31.7683, lng: 35.2137, name: "Jerusalem", method: "MWL" },
    "Asia/Beirut": { lat: 33.8938, lng: 35.5018, name: "Beirut", method: "MWL" },
    "Asia/Damascus": { lat: 33.5138, lng: 36.2765, name: "Damascus", method: "MWL" },

    // North Africa
    "Africa/Casablanca": { lat: 33.5731, lng: -7.5898, name: "Casablanca", method: "MWL" },
    "Africa/Tunis": { lat: 36.8065, lng: 10.1815, name: "Tunis", method: "MWL" },
    "Africa/Algiers": { lat: 36.7538, lng: 3.0588, name: "Algiers", method: "MWL" },
    "Africa/Tripoli": { lat: 32.8872, lng: 13.1913, name: "Tripoli", method: "MWL" },
    "Africa/Khartoum": { lat: 15.5007, lng: 32.5599, name: "Khartoum", method: "Egypt" },

    // South & Southeast Asia
    "Asia/Kuala_Lumpur": { lat: 3.1390, lng: 101.6869, name: "Kuala Lumpur", method: "MWL" },
    "Asia/Singapore": { lat: 1.3521, lng: 103.8198, name: "Singapore", method: "MWL" },
    "Asia/Jakarta": { lat: -6.2088, lng: 106.8456, name: "Jakarta", method: "MWL" },
    "Asia/Makassar": { lat: -5.1477, lng: 119.4327, name: "Makassar", method: "MWL" },
    "Asia/Karachi": { lat: 24.8607, lng: 67.0011, name: "Karachi", method: "Karachi" },
    "Asia/Dhaka": { lat: 23.8103, lng: 90.4125, name: "Dhaka", method: "Karachi" },
    "Asia/Kolkata": { lat: 28.6139, lng: 77.2090, name: "New Delhi", method: "Karachi" },
    "Asia/Colombo": { lat: 6.9271, lng: 79.8612, name: "Colombo", method: "Karachi" },
    "Asia/Tashkent": { lat: 41.2995, lng: 69.2401, name: "Tashkent", method: "MWL" },
    "Asia/Baku": { lat: 40.4093, lng: 49.8671, name: "Baku", method: "MWL" },

    // Turkey & Europe
    "Europe/Istanbul": { lat: 41.0082, lng: 28.9784, name: "Istanbul", method: "MWL" },
    "Europe/London": { lat: 51.5074, lng: -0.1278, name: "London", method: "MWL" },
    "Europe/Paris": { lat: 48.8566, lng: 2.3522, name: "Paris", method: "MWL" },
    "Europe/Berlin": { lat: 52.5200, lng: 13.4050, name: "Berlin", method: "MWL" },
    "Europe/Madrid": { lat: 40.4168, lng: -3.7038, name: "Madrid", method: "MWL" },
    "Europe/Rome": { lat: 41.9028, lng: 12.4964, name: "Rome", method: "MWL" },
    "Europe/Amsterdam": { lat: 52.3676, lng: 4.9041, name: "Amsterdam", method: "MWL" },
    "Europe/Brussels": { lat: 50.8503, lng: 4.3517, name: "Brussels", method: "MWL" },
    "Europe/Vienna": { lat: 48.2082, lng: 16.3738, name: "Vienna", method: "MWL" },
    "Europe/Stockholm": { lat: 59.3293, lng: 18.0686, name: "Stockholm", method: "MWL" },
    "Europe/Oslo": { lat: 59.9139, lng: 10.7522, name: "Oslo", method: "MWL" },
    "Europe/Moscow": { lat: 55.7558, lng: 37.6173, name: "Moscow", method: "MWL" },

    // Americas
    "America/New_York": { lat: 40.7128, lng: -74.0060, name: "New York", method: "ISNA" },
    "America/Detroit": { lat: 42.3314, lng: -83.0458, name: "Detroit", method: "ISNA" },
    "America/Chicago": { lat: 41.8781, lng: -87.6298, name: "Chicago", method: "ISNA" },
    "America/Toronto": { lat: 43.6532, lng: -79.3832, name: "Toronto", method: "ISNA" },
    "America/Montreal": { lat: 45.5017, lng: -73.5673, name: "Montreal", method: "ISNA" },
    "America/Los_Angeles": { lat: 34.0522, lng: -118.2437, name: "Los Angeles", method: "ISNA" },
    "America/Denver": { lat: 39.7392, lng: -104.9903, name: "Denver", method: "ISNA" },
    "America/Phoenix": { lat: 33.4484, lng: -112.0740, name: "Phoenix", method: "ISNA" },
    "America/Houston": { lat: 29.7604, lng: -95.3698, name: "Houston", method: "ISNA" },
    "America/Vancouver": { lat: 49.2827, lng: -123.1207, name: "Vancouver", method: "ISNA" },

    // Australia & NZ
    "Australia/Sydney": { lat: -33.8688, lng: 151.2093, name: "Sydney", method: "MWL" },
    "Australia/Melbourne": { lat: -37.8136, lng: 144.9631, name: "Melbourne", method: "MWL" },
    "Pacific/Auckland": { lat: -36.8485, lng: 174.7633, name: "Auckland", method: "MWL" }
  };

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

    // Sound toggle
    soundToggle.addEventListener("change", function () {
      volumeGroup.hidden = !soundToggle.checked;
      if (!soundToggle.checked && previewAudio) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
      }
    });

    // Volume slider live feedback
    volumeSlider.addEventListener("input", function () {
      var val = parseInt(volumeSlider.value, 10);
      volumeLabel.textContent = val + "%";
      updateVolumeSliderFill(val);
    });

    // Preview button
    previewSoundBtn.addEventListener("click", function () {
      playPreview(parseInt(volumeSlider.value, 10));
    });

    // Detect location seamlessly without permission blocks
    detectLocationBtn.addEventListener("click", async function () {
      detectLocationBtn.disabled = true;
      detectLocationBtn.textContent = "Detecting...";

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
            name: match.name,
            method: match.method
          };
        } else {
          // Approximate by timezone offset
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
      if (detected.method && calcMethodSelect) {
        calcMethodSelect.value = detected.method;
      }

      detectLocationBtn.disabled = false;
      detectLocationBtn.textContent = "Detect Location";
      showStatus("Detected: " + (detected.name || "Coordinates set") + " ✓");
    });

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

        // Safety fallback: ensure popup closes even if background takes time
        setTimeout(closePopupSafely, 2000);

        function sendTest(tabId) {
          try {
            chrome.runtime.sendMessage({
              type: "testLockscreen",
              prayerKey: "dhuhr",
              tabId: tabId,
              soundEnabled: soundToggle.checked,
              soundVolume: parseInt(volumeSlider.value, 10)
            }, function (response) {
              // Wait briefly for content script injection/DOM attachment to complete
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

    // Save settings
    saveBtn.addEventListener("click", function () {
      var settings = {
        latitude: parseFloat(inputLat.value) || 21.4225,
        longitude: parseFloat(inputLng.value) || 39.8262,
        calculationMethod: calcMethodSelect.value,
        enabled: lockscreenToggle.checked,
        soundEnabled: soundToggle.checked,
        soundVolume: parseInt(volumeSlider.value, 10)
      };

      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      chrome.runtime.sendMessage({
        type: "updateSettings",
        settings: settings
      }, function (response) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Settings";

        if (chrome.runtime.lastError) {
          showStatus("Error saving settings", true);
          return;
        }

        showStatus("Settings saved ✓");

        // Reload prayer times after settings change
        loadPrayerTimes();
      });
    });
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
