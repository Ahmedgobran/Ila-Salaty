# Ela Salaty — إلا صلاتي 🕌

> **Prioritize your prayers.** A focused Chrome extension that gently interrupts distracting browsing activity when prayer time arrives, reminding you to pause and answer the call to prayer.

---

## ✨ Features

- **🛡️ Full-Screen Prayer Lock Screen**: When prayer time arrives, a dedicated, reverent lock screen takes over the active browsing experience across all tabs.
- **⏸️ Media Autopause**: Automatically pauses playing video and audio (YouTube, Netflix, podcasts, etc.) so you are not distracted.
- **⏳ 5-Minute Countdown Timer**: Displays a clear visual countdown with an animated circular progress ring, giving you dedicated time to disconnect and pray.
- **🤝 Friction Against Immediate Dismissal**:
  - The exit button remains hidden for the first 30 seconds to prevent reflex dismissal.
  - Exiting early prompts a sincere confirmation dialog:
    - *"هل صليت؟ / Have you prayed?"*
    - **"نعم، صليت" (Yes, I have prayed)** or **"لا، سأبقى" (No, stay)**.
  - Automatically dismisses once the 5-minute countdown finishes.
- **🌍 Accurate Astronomical Prayer Calculations**:
  - Pure JavaScript astronomical engine supporting major global standards:
    - **Muslim World League (MWL)**
    - **Umm Al-Qura University, Makkah**
    - **Egyptian General Authority of Survey**
    - **Islamic Society of North America (ISNA)**
    - **University of Islamic Sciences, Karachi**
- **📍 Smart Permissionless Location Detection**:
  - Uses IP geolocation and system IANA timezone mappings.
  - **Zero browser permission prompts** — never triggers blocked location warnings or permission denial dialogs.
- **🕌 Reverent Islamic Design System**:
  - Thoughtfully designed following anti-vibecoded UI principles.
  - Built with authentic Islamic geometric patterns, deep teal and midnight tones, warm gold accents, and elegant Arabic calligraphy (Amiri font).
  - Rotates through authentic Quranic verses and Hadith regarding prayer.
- **⚡ Manifest V3 Compatible**: Built using modern Chrome Extension standards with efficient background alarms and dynamic tab injection.

---

## 🚀 Installation Guide

Since this is an open-source extension, you can easily load it into any Chromium-based browser (Google Chrome, Brave, Microsoft Edge, Opera):

1. **Clone or Download the Repository**:
   ```bash
   git clone https://github.com/<your-username>/ela-salaty.git
   ```
   *(Or download and extract the ZIP file)*

2. **Open Extensions Page**:
   - In Google Chrome, navigate to `chrome://extensions/`
   - In Brave, navigate to `brave://extensions/`
   - In Microsoft Edge, navigate to `edge://extensions/`

3. **Enable Developer Mode**:
   - Toggle on the **Developer mode** switch (usually located in the top-right corner).

4. **Load the Extension**:
   - Click the **Load unpacked** button in the top-left corner.
   - Select the `Ila-salaty` folder containing `manifest.json`.

5. **Pin and Configure**:
   - Click the Extensions puzzle icon in the browser toolbar and pin **إلا صلاتي**.
   - Open the popup, click **Settings (الإعدادات)** → **Detect Location** to set your location coordinates, and select your preferred calculation method.

---

## 🧪 Testing the Lock Screen

You can test the interruption experience at any time without waiting for prayer time:
1. Click the **إلا صلاتي** icon in your toolbar.
2. Click **Settings** (الإعدادات).
3. Click **▶ Test Lock Screen Now (تجربة شاشة التذكير)**.
4. The lock screen will immediately take over your active tab, pause media, and begin the countdown.

---

## 📁 Project Structure

```text
├── manifest.json         # Manifest V3 extension configuration
├── background.js         # Service worker: alarms, scheduler & messaging
├── prayer-times.js       # Astronomical prayer calculation engine
├── content.js            # Page script: overlay injection & media pause
├── content.css           # Overlay styling & animations
├── lockscreen.html       # Full-screen lock screen layout
├── lockscreen.css        # Calming Islamic aesthetic & modal styles
├── lockscreen.js         # Countdown timer & early dismissal confirmation flow
├── popup/
│   ├── popup.html        # Toolbar popup UI
│   ├── popup.css         # Popup styles & responsive layout
│   └── popup.js          # Popup logic, date display & settings management
├── icons/                # Extension icons (SVG, 16px, 48px, 128px PNGs)
└── README.md
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
