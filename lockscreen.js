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

  const triggeredAt = Number(params.get('triggeredAt')) || Date.now();
  const deadline = triggeredAt + lockDuration * 60000;

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
  let remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  let timerInterval = null;

  // ─── Start Timer ───────────────────────────────────────────────────

  function startTimer() {
    updateTimerDisplay();
    updateTimerRing();

    timerInterval = setInterval(() => {
      remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

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

  let activeAdhanAudio = null;

  function dismissLockscreen() {
    clearInterval(timerInterval);

    if (activeAdhanAudio) {
      try {
        activeAdhanAudio.pause();
        activeAdhanAudio.currentTime = 0;
      } catch (e) {}
      activeAdhanAudio = null;
    }

    if (dismissBtn) {
      dismissBtn.disabled = true;
      const txt = dismissBtn.querySelector('.dismiss-btn-text');
      if (txt) txt.textContent = 'Closing... — جارٍ الإغلاق';
    }

    if (window !== window.parent) {
      window.parent.postMessage({ type: 'DISMISS_LOCKSCREEN' }, '*');
    } else {
      chrome.runtime.sendMessage({ type: 'dismissLockscreen', triggeredAt }).catch(() => {});
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

  // A previous standalone reminder can still be open in another window after sleep.
  if (window === window.parent && params.get('standalone') === 'true') {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.activeReminder) return;
      const next = changes.activeReminder.newValue;
      if (next && next.triggeredAt !== triggeredAt) {
        params.set('prayerKey', next.prayerKey);
        params.set('triggeredAt', next.triggeredAt);
        params.set('lockDuration', next.lockDuration);
        location.replace('?' + params);
      }
    });
  }

  // ─── Start ─────────────────────────────────────────────────────────
  startTimer();
  if (window !== window.parent) {
    window.parent.postMessage({ type: 'LOCKSCREEN_READY' }, '*');
  }

  // ─── Adhan Sound ────────────────────────────────────────────────────
  (function initAdhanAudio() {
    const soundParam = params.get('sound');
    const volumeParam = params.get('volume');

    function playAudio(vol) {
      try {
        const audio = new Audio(chrome.runtime.getURL('adhan.mp3'));
        audio.volume = Math.min(1, Math.max(0, vol / 100));
        activeAdhanAudio = audio;

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function (err) {
            console.log('[Ila Salaty] Autoplay blocked, waiting for interaction:', err);
            // In case browser autoplay policy strictly requires user gesture on this tab,
            // play immediately on first interaction (click/touch/keypress) with the lockscreen
            const onInteract = function () {
              audio.play().catch(function () {});
              window.removeEventListener('pointerdown', onInteract, true);
              window.removeEventListener('click', onInteract, true);
              window.removeEventListener('keydown', onInteract, true);
            };
            window.addEventListener('pointerdown', onInteract, true);
            window.addEventListener('click', onInteract, true);
            window.addEventListener('keydown', onInteract, true);
          });
        }
      } catch (e) {
        console.error('[Ila Salaty] Failed to play adhan:', e);
      }
    }

    if (soundParam !== null) {
      if (soundParam === 'false') return;
      const vol = volumeParam !== null ? parseInt(volumeParam, 10) : 80;
      playAudio(isNaN(vol) ? 80 : vol);
    } else {
      try {
        chrome.storage.local.get('settings', function (data) {
          const settings = data.settings || {};
          if (settings.soundEnabled === false) return;
          const vol = typeof settings.soundVolume === 'number' ? settings.soundVolume : 80;
          playAudio(vol);
        });
      } catch (e) {}
    }
  })();

})();
