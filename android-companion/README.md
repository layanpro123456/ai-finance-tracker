# 🛰️ Apex Location Tracker (Android Companion APK)

[![Build Android APK](https://github.com/layanpro123456/ai-finance-tracker/actions/workflows/build-tracker-apk.yml/badge.svg)](https://github.com/layanpro123456/ai-finance-tracker/actions/workflows/build-tracker-apk.yml)

An ultra-lightweight, dedicated Android companion application built with **Kotlin**, **Jetpack Compose**, and **Google Play Services Fused Location Provider** for **Apex LifeOS**.

---

## 🎯 Purpose & Why an APK is Necessary

When you open Apex LifeOS in a mobile web browser (Chrome, Samsung Internet, Firefox), the operating system places the browser into **Doze Mode / App Standby** as soon as:
- You lock your phone screen,
- The phone is in your pocket, or
- You switch to another application.

This halts browser JavaScript execution, causing missed commute trips, broken speed tracking, and missed geofenced payment reminders.

### What This APK Does:
* **Native Foreground Service**: Runs with a low-priority ongoing notification (`FOREGROUND_SERVICE_LOCATION`), preventing Android from terminating the process.
* **Fused Location Provider**: High-precision GPS, Wi-Fi, and cellular trilateration with hardware power optimization.
* **Dynamic Velocity Rate Shifting**: Polling every 10–15s when traveling in a vehicle, dynamically scaling down to 90s–3m when stationary to conserve battery (<2% per 8 hours).
* **Offline SQLite Queue**: Queues location pings in an embedded Room database when driving through tunnels or dead zones, automatically flushing to Supabase on reconnection.
* **Direct Supabase Ingestion**: Streams real-time telemetry straight to your `device_location_pings` table, which broadcasts via Supabase Realtime to your desktop/web dashboard.

---

## 🚀 How to Build the APK in GitHub

### Method 1: Automatic Cloud Build via GitHub Actions (Recommended)
You do not need to install Android Studio or Java locally. The GitHub Actions workflow compiles the APK in the cloud:

1. **Triggering the Build in GitHub**:
   - Go to the **Actions** tab on your GitHub repository: [`ai-finance-tracker/actions`](https://github.com/layanpro123456/ai-finance-tracker/actions).
   - In the left sidebar, click **"Build Apex Location Tracker APK"**.
   - Click the **Run workflow** dropdown button on the right.
   - Choose:
     - **Build Type**: `both` (default), `debug`, or `release`.
     - **Publish APK to GitHub Releases**: check this if you want direct `.apk` downloads published under GitHub Releases.
   - Click **Run workflow**.

2. **Automatic Triggers**:
   - The build automatically runs on any `git push` modifying files in `android-companion/**`.
   - Pushing a release tag (e.g. `v1.0.0`) automatically builds the APK and creates an official GitHub Release with downloadable `.apk` binaries.

3. **Downloading the APK**:
   - **From Actions Artifacts**: Once the workflow completes (~2 minutes), click on the completed run. Scroll down to **Artifacts** and download `apex-location-tracker-apk`.
   - **From GitHub Releases**: If release creation was enabled, open the **Releases** tab on GitHub and download `ApexLocationTracker-debug.apk` directly on your phone with no unzipping required!

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

