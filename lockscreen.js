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

  // ─── Timer State ───────────────────────────────────────────────────
  const TOTAL_SECONDS = lockDuration * 60;
  const CIRCUMFERENCE = 2 * Math.PI * 54; // radius = 54 from SVG
  let remainingSeconds = TOTAL_SECONDS;
  let timerInterval = null;
  let canDismissEarly = false;

  // Show dismiss button after 30 seconds (create friction, not punishment)
  const EARLY_DISMISS_DELAY = 30; // seconds

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

      // Enable early dismiss after delay
      const elapsed = TOTAL_SECONDS - remainingSeconds;
      if (elapsed >= EARLY_DISMISS_DELAY && !canDismissEarly) {
        canDismissEarly = true;
        dismissSection.classList.add('visible');
      }
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

  dismissBtn.addEventListener('click', () => {
    // Show confirmation dialog
    confirmDialog.classList.add('visible');
  });

  confirmYes.addEventListener('click', () => {
    dismissLockscreen();
  });

  confirmCancel.addEventListener('click', () => {
    confirmDialog.classList.remove('visible');
  });

  function dismissLockscreen() {
    clearInterval(timerInterval);
    // Send message to background to clear active reminder and notification
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'dismissLockscreen' });
      }
    } catch (e) {}

    // If embedded inside a web page iframe:
    if (window !== window.parent) {
      window.parent.postMessage({ type: 'DISMISS_LOCKSCREEN' }, '*');
    } else {
      // If opened as a standalone tab (fallback for restricted URLs / edge://):
      window.close();
    }
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
