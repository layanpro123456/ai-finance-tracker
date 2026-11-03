# 🛰️ Apex Location Tracker (Android Companion APK)

[![Build Android APK](https://github.com/layanmoyura/ai-finance-tracker/actions/workflows/build-tracker-apk.yml/badge.svg)](https://github.com/layanmoyura/ai-finance-tracker/actions/workflows/build-tracker-apk.yml)

An ultra-lightweight, dedicated Android companion application built with **Kotlin**, **Jetpack Compose**, and **Google Play Services Fused Location Provider** for **Apex LifeOS**.

---

### 📥 Direct Release Download
You can download the latest pre-compiled companion APK directly to your Android device from **GitHub Releases**:
* **[Download Latest Release Page](https://github.com/layanmoyura/ai-finance-tracker/releases/latest)**
* **Direct Sideload Debug APK**: [`ApexLocationTracker-debug.apk`](https://github.com/layanmoyura/ai-finance-tracker/releases/latest/download/ApexLocationTracker-debug.apk)
* **Direct Sideload Release APK**: [`ApexLocationTracker-release.apk`](https://github.com/layanmoyura/ai-finance-tracker/releases/latest/download/ApexLocationTracker-release.apk)

---

## 🎯 Purpose & Why an APK is Necessary

When you open Apex LifeOS in a mobile web browser (Chrome, Samsung Internet, Firefox), the operating system places the browser into **Doze Mode / App Standby** as soon as:
- You lock your phone screen,
- The phone is in your pocket, or
- You switch to another application.

This halts browser JavaScript execution, causing missed commute trips, broken speed tracking, and missed geofenced payment reminders.

### What This APK Does:
* **Native Foreground Service**: Runs with a low-priority ongoing notification (`FOREGROUND_SERVICE_LOCATION`), preventing Android from terminating the process.
* **Pure Kinetic Sensor Velocity Engine**:
  - Zero GPS Doppler reliance: completely eliminates unreliable GNSS Doppler velocity and phase lock dropouts.
  - Device Kinetic Stationary Lock: utilizes hardware `TYPE_LINEAR_ACCELERATION` / `TYPE_ACCELEROMETER` (excluding gravity bias). When kinetic acceleration energy is $< 0.22\text{ m/s}^2$, velocity is clamped to strictly $0.0\text{ km/h}$, eliminating GPS jitter, multipath noise, and desk drift completely.
  - Biometric Walking Velocity via Kinetic Cadence: detects footstep impulses using hardware `TYPE_STEP_DETECTOR` to calculate real-time cadence and analog-smooth pedestrian speed ($3.0 - 7.5\text{ km/h}$).
  - Kinetic-Gated Motorized Transit: validates active kinetic vibration ($> 0.22\text{ m/s}^2$) before integrating kinematic displacement over monotonic elapsed time ($\Delta d / \Delta t$) for vehicle and high-speed transit.
* **Continuous Low-Latency Telemetry**: 2.5-second active location polling interval with instant cached fix dispatch upon foreground service start.
* **Smart Telemetry Streaming & Immediate Heartbeat**: Emits database pings immediately on initial fix (first 5 pings every 2s), every 2.5–3 seconds during active motion, immediately upon transport mode transitions, and every 10 seconds during stationary lock.
* **Comprehensive Mode Classification**: Automatic classification across `stationary`, `walking`, `cycling`, `vehicle`, and `high_speed_transit` (expressway $\ge 80\text{ km/h}$).
* **Offline SQLite Queue**: Queues location pings in an embedded Room database when driving through tunnels or dead zones, automatically flushing to Supabase on reconnection.
* **Direct Supabase Ingestion & Dynamic Graceful Degradation**: Streams real-time telemetry straight to your `device_location_pings` table, which broadcasts via Supabase Realtime to your desktop/web dashboard. If a remote Supabase deployment lacks the `transport_mode` column, the APK automatically adapts payloads and degrades gracefully without stalling transmission.

---

## 🚀 How to Build and Auto-Release the APK

### Method 1: Automatic Cloud Build & Auto-Release via GitHub Actions (Recommended)
You do not need to install Android Studio or Java locally. The GitHub Actions workflow compiles the APK in the cloud and automatically publishes a GitHub Release with every build:

1. **Auto-Release After Every Build**:
   - **Automatic Git Push Trigger**: Any `git push` modifying files in `android-companion/**` automatically triggers the build, compiles the APKs, dynamically stamps the version (`v1.0.<run_number>`), and publishes an updated GitHub Release with downloadable APKs attached.
   - **Automatic Tag Trigger**: Pushing a tag (e.g. `v1.2.0`) automatically builds the APK and publishes an official GitHub Release for that tag.
   - **Manual 1-Click Trigger (`workflow_dispatch`)**:
     1. Go to the **Actions** tab on your GitHub repository: [`ai-finance-tracker/actions`](https://github.com/layanmoyura/ai-finance-tracker/actions).
     2. In the left sidebar, click **"Build and Auto-Release Apex Location Tracker APK"**.
     3. Click **Run workflow** (leave tag empty for automatic versioning `v1.0.<run_number>`, or type a custom tag).
     4. Click the green **Run workflow** button. The workflow compiles the APK and automatically publishes the release.

2. **Downloading the APK**:
   - **From GitHub Releases**: Open the **Releases** tab on GitHub (or use the link above) and download `ApexLocationTracker-debug.apk` directly to your phone with no unzipping required!
   - **From Actions Artifacts**: In the Actions run summary, download `apex-location-tracker-apk-*`.

### Method 2: Local Build via Android Studio or Terminal
1. Open the `android-companion` directory in **Android Studio** (Hedgehog, Iguana, or Koala).
2. Connect your Android phone via USB (or use an emulator).
3. Click **Run ▶** or build the APK via terminal:
   ```bash
   cd android-companion
   ./gradlew assembleDebug
   ```
4. The output APK will be located at:
   `android-companion/app/build/outputs/apk/debug/app-debug.apk`

---

## 📲 Secure Pairing with Apex LifeOS

The mobile companion features **Zero-Exposure Credential Pairing** and **Hardware-Backed AES-256 Encryption**:

1. Install and launch the **Apex Tracker** APK on your Android device.
2. Grant Location permissions (**"Allow all the time"** for background tracking) and Notification permission.
3. Tap **"Disable Battery Optimization"** so Android does not throttle background execution.
4. On your Apex LifeOS web dashboard, open **Location & Timeline** ➔ click **"Connect Phone APK"**.
5. Pair securely with zero plaintext credentials (manual URL, Key, and UUID inputs are completely removed):
   * **1-Tap Token Pairing (Fastest)**: Click **"Copy Encrypted Pairing Token"** in the web modal, open the Android app's ⚙️ Settings dialog, paste it into the **"1-Tap Pairing Token"** field, and tap **"Import & Connect"**.
   * **Visual QR Code Pairing**: Scan the pairing QR code directly using your phone's camera.
6. The app encrypts credentials into hardware-backed `EncryptedSharedPreferences` via Android Keystore (AES-256 GCM). Tap **"START BACKGROUND TRACKING"**.
7. In your Apex LifeOS web dashboard under **Location & Timeline**, select **"📱 Phone APK Daemon"** to view your live velocity, GPS coordinates, and commute trips streaming in real-time from your pocket!
