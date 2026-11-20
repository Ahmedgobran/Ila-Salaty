# Ila Salaty — إلا صلاتي 🕌

**Prioritize your prayers.**

Ila Salaty is a Chrome extension designed to help you stay mindful of your prayers by gently interrupting distracting browsing activity when prayer time arrives.

Rather than displaying an ordinary notification, Ila Salaty provides a dedicated prayer reminder that encourages you to step away from your screen and focus on your salah.

---

## ✨ Features

- **Prayer Time Reminders:** Automatically detects when prayer time arrives based on your location.
- **Prayer Reminder Screen:** Displays a dedicated full-screen reminder to interrupt your browsing activity.
- **Media Autopause:** Automatically pauses supported audio and video playback when the reminder appears.
- **5-Minute Countdown:** Provides a visual countdown to encourage users to take a break and pray.
- **Thoughtful Dismissal:** The option to dismiss the reminder is initially delayed. Leaving early requires confirmation through a simple prompt asking whether you have prayed.
- **Accurate Worldwide Prayer Timings:** Powered by the industry-standard Aladhan Prayer Times API, automatically resolving official regional prayer authority timings based on your coordinates.
- **Local Storage Caching:** Prayer times are cached daily in local storage for fast performance and reliable offline operation.
- **Automatic Location Detection:** Estimates your location using IP-based geolocation without requiring a browser location permission prompt.
- **Islamic-Inspired Design:** Features a carefully designed interface with Arabic typography, subtle geometric patterns, and prayer-related Quranic verses and Hadith reminders.

---

## 🚀 Installation

Ila Salaty can be installed manually in Google Chrome or compatible Chromium-based browsers.

### 1. Download the Repository

Clone the repository:

```bash
git clone https://github.com/Ahmedgobran/Ila-Salaty.git
```

Alternatively, download the repository as a ZIP file and extract it.

### 2. Open the Extensions Page

Navigate to:

```text
chrome://extensions/
```

### 3. Enable Developer Mode

Enable the **Developer mode** toggle in the top-right corner.

### 4. Load the Extension

1. Click **Load unpacked**.
2. Select the extracted `Ila-salaty` project folder containing `manifest.json`.

### 5. Pin and Configure

1. Open the Extensions menu in your browser.
2. Pin **Ila Salaty (إلا صلاتي)** to your toolbar.
3. Open the extension and navigate to **Settings (الإعدادات)**.
4. Configure your location (search city, auto-detect, or enter coordinates).

---

## 🧪 Testing the Prayer Reminder

You can test the reminder screen without waiting for the next prayer time.

1. Click the Ila Salaty extension icon in your browser toolbar.
2. Open **Settings (الإعدادات)**.
3. Select **Test Lock Screen Now (تجربة شاشة التذكير)**.
4. The reminder screen will appear, allowing you to experience the countdown and dismissal flow.

---

## 🔒 Privacy & Store Compliance

- **Category:** **Well-being** (or Workflow & Planning)
- **Zero Telemetry:** All calculation and scheduling is performed 100% locally on your machine. No user data is stored on external servers or tracked.
- **Privacy Policy:** See [PRIVACY.md](PRIVACY.md) for the full policy and permission justifications.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
