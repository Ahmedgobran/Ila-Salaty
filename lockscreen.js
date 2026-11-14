/**
 * Ila Salaty — Lock Screen Logic
 * 
 * Handles the 5-minute countdown timer, dismiss confirmation flow,
 * and communication back to the content script.
 */

(() => {
  'use strict';

  // ─── Parse URL Parameters ──────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const prayerName = params.get('prayer') || 'Prayer';
  const prayerNameAr = params.get('prayerAr') || 'صلاة';
  const prayerKey = params.get('prayerKey') || 'dhuhr';
  const lockDuration = parseInt(params.get('lockDuration') || '5', 10);

  // ─── Prayer name mapping ──────────────────────────────────────────
  const prayerData = {
    fajr:    { ar: 'الفجر',   en: 'Fajr Prayer' },
    dhuhr:   { ar: 'الظهر',   en: 'Dhuhr Prayer' },
    asr:     { ar: 'العصر',   en: 'Asr Prayer' },
    maghrib: { ar: 'المغرب',  en: 'Maghrib Prayer' },
    isha:    { ar: 'العشاء',  en: 'Isha Prayer' }
  };

  const currentPrayer = prayerData[prayerKey] || { ar: prayerNameAr, en: `${prayerName} Prayer` };

  // ─── Set prayer name in UI ─────────────────────────────────────────
  document.getElementById('prayerNameAr').textContent = currentPrayer.ar;
  document.getElementById('prayerNameEn').textContent = currentPrayer.en;

  // ─── Quran Verses and Hadith ────────────────────────────────────────
  const REMINDERS = [
    {
      ar: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا',
      en: '"Indeed, prayer has been decreed upon the believers at specified times."',
      ref: '— An-Nisa 4:103'
    },
    {
      ar: 'وَأَقِمِ الصَّلَاةَ لِذِكْرِي',
      en: '"And establish prayer for My remembrance."',
      ref: '— Ta-Ha 20:14'
    },
    {
      ar: 'وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ',
      en: '"And seek help through patience and prayer."',
      ref: '— Al-Baqarah 2:45'
    },
    {
      ar: 'أَحَبُّ الْأَعْمَالِ إِلَى اللهِ الصَّلَاةُ عَلَى وَقْتِهَا',
      en: '"The dearest of deeds to Allah is prayer at its proper time."',
      ref: '— Sahih al-Bukhari'
    },
    {
      ar: 'رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِن ذُرِّيَّتِي',
      en: '"My Lord, make me an establisher of prayer, and from my descendants."',
      ref: '— Ibrahim 14:40'
    },
    {
      ar: 'وَأَقِمِ الصَّلَاةَ إِنَّ الصَّلَاةَ تَنْهَىٰ عَنِ الْفَحْشَاءِ وَالْمُنكَرِ',
      en: '"And establish prayer. Indeed, prayer prohibits immorality and wrongdoing."',
      ref: '— Al-Ankabut 29:45'
    }
  ];

  const randomReminder = REMINDERS[Math.floor(Math.random() * REMINDERS.length)];
  const verseArEl = document.getElementById('verseArabic');
  const verseEnEl = document.getElementById('verseTranslation');
  const verseRefEl = document.getElementById('verseReference');
  if (verseArEl) verseArEl.textContent = randomReminder.ar;
  if (verseEnEl) verseEnEl.textContent = randomReminder.en;
  if (verseRefEl) verseRefEl.textContent = randomReminder.ref;

  // ─── Elements ──────────────────────────────────────────────────────
  const timerDisplay = document.getElementById('timerDisplay');
  const timerProgress = document.getElementById('timerProgress');
  const dismissSection = document.getElementById('dismissSection');
  const dismissBtn = document.getElementById('dismissBtn');
  const confirmDialog = document.getElementById('confirmDialog');
  const confirmYes = document.getElementById('confirmYes');
  const confirmCancel = document.getElementById('confirmCancel');

  const snoozeBtn = document.getElementById('snoozeBtn');
  const snoozeDropdownToggle = document.getElementById('snoozeDropdownToggle');
  const snoozeMenu = document.getElementById('snoozeMenu');
  const snoozeBtnText = document.getElementById('snoozeBtnText');
  const snoozeOptions = document.querySelectorAll('.snooze-option');

  // ─── Timer State ───────────────────────────────────────────────────
  const TOTAL_SECONDS = lockDuration * 60;
  const CIRCUMFERENCE = 2 * Math.PI * 54; // radius = 54 from SVG
  let remainingSeconds = TOTAL_SECONDS;
  let timerInterval = null;
  let currentSnoozeMinutes = 5;

  // ─── Start Timer ───────────────────────────────────────────────────

  function startTimer() {
    updateTimerDisplay();
    updateTimerRing();

    timerInterval = setInterval(() => {
      remainingSeconds--;

      if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        remainingSeconds = 0;
        updateTimerDisplay();
        updateTimerRing();
        // Auto-dismiss when timer expires
        dismissLockscreen();
        return;
      }

      updateTimerDisplay();
      updateTimerRing();
    }, 1000);
  }

  function updateTimerDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    timerDisplay.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function updateTimerRing() {
    const progress = remainingSeconds / TOTAL_SECONDS;
    const offset = CIRCUMFERENCE * (1 - progress);
    timerProgress.style.strokeDashoffset = offset;
  }

  // ─── Dismiss Flow ─────────────────────────────────────────────────

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      // Show confirmation dialog
      confirmDialog.classList.add('visible');
    });
  }

  if (confirmYes) {
    confirmYes.addEventListener('click', () => {
      dismissLockscreen();
    });
  }

  if (confirmCancel) {
    confirmCancel.addEventListener('click', () => {
      confirmDialog.classList.remove('visible');
    });
  }

  function dismissLockscreen() {
    clearInterval(timerInterval);
    // Send message to background to clear active reminder and notification
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'dismissLockscreen' });
      }
    } catch (e) {
      console.error('[Ila Salaty] Failed to send dismissLockscreen message:', e);
    }

    // If embedded inside a web page iframe:
    if (window !== window.parent) {
      window.parent.postMessage({ type: 'DISMISS_LOCKSCREEN' }, '*');
    } else {
      // If opened as a standalone tab (fallback for restricted URLs / edge://):
      window.close();
    }
  }

  // ─── Snooze Flow ──────────────────────────────────────────────────

  function executeSnooze(minutes) {
    const mins = parseInt(minutes, 10) || currentSnoozeMinutes || 5;
    clearInterval(timerInterval);

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'snoozeReminder',
          minutes: mins,
          prayerKey: prayerKey
        });
      }
    } catch (e) {
      console.error('[Ila Salaty] Failed to send snoozeReminder message:', e);
    }

    if (window !== window.parent) {
      window.parent.postMessage({
        type: 'SNOOZE_LOCKSCREEN',
        minutes: mins,
        prayerKey: prayerKey
      }, '*');
    } else {
      window.close();
    }
  }

  if (snoozeBtn) {
    snoozeBtn.addEventListener('click', () => {
      executeSnooze(currentSnoozeMinutes);
    });
  }

  if (snoozeDropdownToggle && snoozeMenu) {
    snoozeDropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      snoozeMenu.classList.toggle('visible');
    });

    document.addEventListener('click', (e) => {
      if (!snoozeMenu.contains(e.target) && e.target !== snoozeDropdownToggle) {
        snoozeMenu.classList.remove('visible');
      }
    });

    snoozeOptions.forEach((option) => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const mins = parseInt(option.getAttribute('data-minutes'), 10) || 5;
        currentSnoozeMinutes = mins;
        snoozeOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        if (snoozeBtnText) {
          snoozeBtnText.textContent = `Remind in ${mins} min — ذكّرني بعد ${mins} د`;
        }
        snoozeMenu.classList.remove('visible');
        executeSnooze(mins);
      });
    });
  }

  // ─── Block right-click in the lockscreen ───────────────────────────
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // ─── Block keyboard shortcuts within iframe ──────────────────────
  document.addEventListener('keydown', (e) => {
    // Allow Tab for accessibility within the dialog
    if (e.key === 'Tab') return;
    
    // Block most other shortcuts
    if (e.ctrlKey || e.metaKey || e.altKey || ['Escape', 'F5', 'F11', 'F12'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // ─── Start ─────────────────────────────────────────────────────────
  startTimer();

})();
