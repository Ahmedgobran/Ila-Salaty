# Privacy Policy — Ela Salaty (إلا صلاتي)

**Last updated:** November 14, 2026

**Ela Salaty (إلا صلاتي)** is committed to protecting your privacy. This extension is designed from the ground up to operate locally on your device with minimal data usage and zero telemetry.

---

## 1. Data Collection & Usage

- **Location Data (Latitude & Longitude)**:
  - When you click "Detect Location" or manually enter your coordinates, your latitude and longitude are used **exclusively on your device** by the internal astronomical algorithm to calculate local Islamic prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha).
  - Your geographic coordinates are **never** transmitted to any server owned or operated by Ela Salaty.
  - If you use the online "Detect Location" feature, a query is sent to standard public IP geolocation providers (`ipapi.co` / `freeipapi.com`) solely to determine your approximate city coordinates. No personal identity is linked or stored.
- **User Settings & Preferences**:
  - Your chosen calculation method, lock duration, and enabled/disabled states are stored purely in your browser's local extension storage (`chrome.storage.local`).

---

## 2. Data Sharing & Third Parties

- **We do not sell, rent, trade, or share your data.**
- There are **no advertisements**, **no tracking cookies**, and **no third-party analytics SDKs** embedded in the extension.
- We do not run external tracking scripts or collect usage statistics.

---

## 3. Permissions Justification (Chrome Web Store Compliance)

- **`storage`**: Used solely to persist your local prayer preferences and cached prayer times on your device.
- **`alarms`**: Used to wake the extension at calculated prayer times to trigger the prayer reminder.
- **`tabs`**: Used to send the prayer lock screen notification to your open tabs when prayer time arrives.
- **`notifications`**: Used to display a desktop notification when prayer time arrives as a backup.
- **`scripting`**: Used to display the lock screen overlay in open tabs if they were loaded prior to extension install.
- **`host_permissions` / `<all_urls>`**: Required to display the prayer reminder overlay on active web pages and pause background media during prayer time.

---

## 4. Children's Online Privacy Protection

Ela Salaty does not knowingly collect or solicit any personal information from children or any users.

---

## 5. Contact & Questions

If you have any questions or feedback regarding this Privacy Policy, please open an issue on the official GitHub repository:
https://github.com/AhmedGobran/ela-salaty
