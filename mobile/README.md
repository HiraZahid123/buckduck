# BuckDuck Driver Mobile App 🚚

Native React Native / Expo mobile application for Saturday delivery drivers with real-time fleet dispatch and auto-online availability.

---

## ⚡ Features
- **Auto-Online on App Launch:** The moment a driver signs in or opens the app with saved credentials, the app triggers `/api/driver/toggle-online` and emits `driver:toggle_online` through **Socket.IO**, immediately displaying the driver as **Live Online** across Admin Dispatch.
- **1-Tap Fast Test Driver Login:** Instant testing credentials (Kwame Asante · Toyota Sienna) with zero typing.
- **Real-Time Fleet Sync:** Two-way WebSockets connect directly to `http://localhost:4000` (or your local IP `http://192.168.x.x:4000`). If Admin changes status or assigns orders, the app updates instantly without polling.
- **Available Saturday Jobs:** Browse unassigned store orders, view pickup zones and destination ZIPs, and claim delivery batches.
- **Active Route Sequence:** Turn-by-turn stop order, customer delivery address, pickup confirmation, and dropoff proof note with photo capture.
- **Saturday Earnings:** Net base pay, 100% customer tips, and delivery metrics.

---

## 🚀 How to Run the Mobile App

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Start the Expo Development Server
```bash
npx expo start
```

### 3. Choose How to View & Test:
- **On Web Browser (Fastest):** Press `w` in the terminal to open the mobile web simulator in your browser.
- **On Physical Phone (iOS / Android):** Scan the QR code using the **Expo Go** app (downloadable from Apple App Store or Google Play Store).
  > **Note for Physical Phone:** Tap *"⚙️ Server Connection Settings"* on the login screen and enter your computer's local Wi-Fi IP address (e.g. `http://192.168.1.50:4000`).
- **On Android Emulator:** Press `a` in the terminal (automatically maps `http://10.0.2.2:4000` to your host computer).
- **On iOS Simulator (macOS):** Press `i` in the terminal.
