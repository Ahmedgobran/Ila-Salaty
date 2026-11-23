# Privacy Policy — Ila Salaty (إلا صلاتي)

**Last updated:** November 24, 2026

Ila Salaty (إلا صلاتي) is committed to protecting your privacy. This extension is designed from the ground up to operate locally on your device with minimal data usage and zero telemetry.

## 1. Data Collection & Usage
- **Location Data (City, Latitude & Longitude):**
  - When you select a city, click "Detect Location," or manually enter your coordinates, your latitude and longitude are sent to the public **Aladhan API** (`api.aladhan.com`) solely to retrieve official local Islamic prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha), which are then cached locally on your device.
  - When you search for a city name, your search query is sent to **OpenStreetMap Nominatim** (`nominatim.openstreetmap.org`) solely to resolve the city's coordinates.
  - If you use the online "Detect Location" feature, a request is sent to public IP geolocation providers (`ipapi.co` / `freeipapi.com`) solely to estimate your approximate city coordinates. No personal identity is linked or stored.
  - Your geographic coordinates are never transmitted to any server owned or operated by Ila Salaty.
- **User Settings & Preferences:**
  - Your location preferences, lock duration, sound settings, and enabled/disabled states are stored purely in your browser's local extension storage (`chrome.storage.local`).

## 2. Data Sharing & Third Parties
- We do not sell, rent, trade, or share your data with third parties for advertising, profiling, or analytics.
- Location coordinates or city search terms are transmitted solely to the third-party prayer time and geocoding APIs listed in Section 1 to provide the extension's core functionality.
- There are no advertisements, no tracking cookies, and no third-party analytics SDKs embedded in the extension.

## 3. Permissions Justification (Browser Extension Store Compliance)
- **storage:** Used solely to persist your local prayer preferences and cached prayer times on your device.
- **alarms:** Used to wake the extension at scheduled prayer times (and 5-minute snoozes) to trigger the prayer reminder.
- **tabs & activeTab:** Used to detect the active tab when prayer time arrives, synchronize the reminder overlay across tabs, and open a standalone reminder tab on restricted browser pages.
- **notifications:** Used to display a desktop notification when prayer time arrives.
- **scripting:** Used to inject the lock screen overlay into open tabs if the content script is not yet loaded when prayer time arrives.
- **host_permissions (`<all_urls>`):** Required to display the prayer reminder overlay on active web pages, pause background HTML5 media during prayer time, and communicate with the prayer times and geocoding APIs.

## 4. Children's Online Privacy Protection
Ila Salaty does not knowingly collect or solicit any personal information from children or any users.

## 5. Contact & Questions
If you have any questions or feedback regarding this Privacy Policy, please open an issue on the official GitHub repository: https://github.com/Ahmedgobran/Ila-Salaty
