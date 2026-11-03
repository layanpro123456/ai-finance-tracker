# Setup & Deployment Guide

This guide walks through configuring Supabase, provisioning API keys, running Apex LifeOS locally, accessing the hidden administrator console, and deploying to GitHub Pages or cloud hosting.

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v18.0.0 or later (v20+ recommended)
- [Git](https://git-scm.com/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)
- A free cloud account at [Supabase](https://supabase.com)
- A free API key from [Google AI Studio](https://aistudio.google.com/) for Gemini Flash

---

## Step 1: Initialize Supabase Database

1. Create a new organization and project at [Supabase](https://supabase.com).
2. Choose a strong database password and select your preferred region.
3. Once the database is ready, navigate to the **SQL Editor** in your Supabase dashboard.
4. Copy and execute the complete SQL statements from [database_schema.md](database_schema.md). This establishes:
   - All 11 core tables (`accounts`, `categories`, `transactions`, `budgets`, `tasks`, `personal_assets`, `subscriptions`, `contacts_ledger`, `saved_places`, `mobility_timeline_events`, `daily_mobility_stats`)
   - The `user_device_sessions` table for single-device hardware isolation
   - Row-Level Security (RLS) policies protecting each user's private data
   - The `admin_purge_user_data` RPC procedure for clean zero-hallucination database resets
5. Go to **Project Settings > API** and copy:
   - **Project URL**
   - **anon / public key**
   - **service_role secret** *(store securely for GitHub Actions or Edge Functions only; never expose in frontend code)*.
6. Go to **Authentication > URL Configuration** to prevent 404s on email verification:
   - **Site URL**: `https://layanmoyura.github.io/ai-finance-tracker/` (or `http://localhost:5173` for local development)
   - **Redirect URLs**:
     - `https://layanmoyura.github.io/ai-finance-tracker/**`
     - `http://localhost:5173/**`
     - `http://127.0.0.1:5173/**`
     - `http://localhost:3000/**`
   *(This ensures verification links redirect directly into the SPA without hitting a 404 page).*

---

## Step 2: Configure Environment Variables

Copy the provided environment template:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
# Frontend variables (Vite requires the VITE_ prefix)
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

> [!NOTE]
> Apex LifeOS includes a built-in backend sentinel. If credentials are not yet supplied, the application loads cleanly with safe fallbacks and renders a configuration alert directing users to `.env.example` instead of throwing a fatal runtime crash.

> [!TIP]
> If you wish to use direct Gemini AI transaction parsing from the client or edge function, you can also configure `VITE_GEMINI_API_KEY=<your-gemini-api-key>`.

---

## Step 3: Deploy the AI Parser Edge Function

1. Authenticate the Supabase CLI:
   ```bash
   supabase login
   ```
2. Link your local directory to your remote Supabase project:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
3. Set your Google Gemini API secret in Supabase:
   ```bash
   supabase secrets set GEMINI_API_KEY="your-gemini-api-key"
   ```
4. Deploy the edge function:
   ```bash
   supabase functions deploy parse-transaction --no-verify-jwt
   ```

---

## Step 4: Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Start local Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser. Register a new account or log in.

---

### 🔧 Troubleshooting: "Could not find the 'transport_mode' column" (HTTP 400)
If your Android Companion app reports `Transmitted Pings: 0 (HTTP 400 (Could not find the 'transport_mode'))`, your remote Supabase database was created before `transport_mode` was added to the schema.

To resolve this instantly:
1. Open the **SQL Editor** in your Supabase dashboard.
2. Execute the migration from [`supabase/migrations/20261024_add_transport_mode_to_pings.sql`](supabase/migrations/20261024_add_transport_mode_to_pings.sql):
```sql
ALTER TABLE public.device_location_pings 
ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT 'unknown';

UPDATE public.device_location_pings 
SET transport_mode = 'unknown' 
WHERE transport_mode IS NULL;

NOTIFY pgrst, 'reload schema';
```
3. In the Android app, tap **⚙️ Settings > Test Connection**. Pings will resume transmitting immediately.

---

## Step 5: Administrator Setup & Discrete Access

Apex LifeOS enforces strict role-based access control (RBAC):
* **Single Authorized Administrator**: Only `layanmoyura@proton.me` is authorized as an administrator.
* **Hidden Public Interface**: There is no public "Admin" button in the navigation bar.

### How to Access the Admin Portal:
1. Register or log in with the email `layanmoyura@proton.me`.
2. Access the administrative controls using any of these three methods:
   - **Keyboard Shortcut**: Press `Ctrl + Shift + A` (or `Cmd + Shift + A` on macOS) anywhere on the page.
   - **URL Hash**: Append `#admin` to the URL (e.g. `http://localhost:5173/#admin`).
   - **System Settings**: Click the **Settings** gear icon in the top header. When authenticated as `layanmoyura@proton.me`, an **Admin Portal** button will appear at the bottom.

### Performing a Clean Database Refresh (Zero-Hallucination Reset):
In the Admin Portal:
1. View live record counts across all 13 tables under **Database Diagnostics**.
2. Click **Execute Global Database Refresh**.
3. All mock/stale records will be purged, all `localStorage` caches will be flushed, and user accounts will be re-initialized to strictly `0.00` balance.

### Disabling Device Lock (Multi-Device Login Override):
1. In the Admin Portal, click the **Device Lock** badge in the header or visit the **Security & RLS Sentinel** tab.
2. Toggle the switch to **Disable Device Lock**.
3. Multi-device concurrent logins are now permitted across all platform accounts without triggering collision warnings or session kickouts.
4. To manage an individual user, open **Available Users Directory > Inspect > Hardware Device Lock** to release their session or toggle lock exemption per-user.

### Undoing User Account Transactions Transaction-Wise:
1. Open **Available Users Directory** in the Admin Portal and click **Inspect** on any user.
2. Navigate to the **Ledger & Undo Txs** tab.
3. Review their live financial accounts and transaction ledger.
4. Click **Undo** on any transaction to preview the balance reversal calculation and confirm the adjustment.
5. The transaction is removed and the user's account balance is updated automatically with full audit trail logging.

---

## Step 6: Code Verification & Production Build

Verify test suites, TypeScript types, and production bundles:

```bash
# Run the complete automated unit test suite (32 tests across 5 test suites)
npm test

# Verify TypeScript compilation and compile production bundle
npm run build

# Run fast Oxlint static analysis
npm run lint

# Preview production build locally
npm run preview
```

---

## Step 7: Configure GitHub Actions & GitHub Pages Deployment

1. Push your repository to GitHub.
2. In your GitHub repository, navigate to **Settings > Secrets and variables > Actions** and add the following repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Required for scheduled cron reports)
   - `GEMINI_API_KEY`
3. Navigate to **Settings > Pages**:
   - Under **Build and deployment > Source**, select **GitHub Actions**.
4. Push a commit to the `main` branch to trigger automated testing and deployment.

---

## Step 8: Android Companion APK: Cloud Build & Auto-Release CI/CD

Apex LifeOS provides an automated GitHub Actions pipeline ([`.github/workflows/build-tracker-apk.yml`](.github/workflows/build-tracker-apk.yml)) that compiles and auto-releases the native Android companion APK after every build:

### 1. Automatic Triggers & Version Resolution
* **Automatic Push Trigger:** Pushing any commit touching `android-companion/**` or `.github/workflows/build-tracker-apk.yml` on the `main` branch initiates the build.
* **Tag Trigger:** Pushing a Git tag (e.g. `git tag v1.1.0 && git push origin v1.1.0`) creates a release pinned to that version.
* **Manual Trigger (`workflow_dispatch`):**
  1. Open repository **Actions > Build and Auto-Release Apex Location Tracker APK**.
  2. Click **Run workflow** (leave tag empty for automatic versioning `v1.0.<run_number>`, or specify a custom tag).
  3. The workflow compiles the APK and automatically publishes a new release.

### 2. In-Place APK Updates on Android Devices
* The workflow dynamically injects strictly incrementing project properties into Gradle:
  `-PversionCode=${{ github.run_number }} -PversionName=1.0.${{ github.run_number }}`
* Because `versionCode` increases monotonically with every GitHub Actions run, Android OS allows users to sideload updates directly over previous installations without uninstalling first or losing paired tokens.

### 3. Downloading Pre-Compiled APKs
* **GitHub Releases Latest Permalinks:**
  * Releases Overview: [`https://github.com/layanmoyura/ai-finance-tracker/releases/latest`](https://github.com/layanmoyura/ai-finance-tracker/releases/latest)
  * Direct Debug Sideload: [`ApexLocationTracker-debug.apk`](https://github.com/layanmoyura/ai-finance-tracker/releases/latest/download/ApexLocationTracker-debug.apk)
  * Direct Release Sideload: [`ApexLocationTracker-release.apk`](https://github.com/layanmoyura/ai-finance-tracker/releases/latest/download/ApexLocationTracker-release.apk)
* **Required GitHub Permission:**
  * Ensure **Repository Settings > Actions > General > Workflow permissions** is set to **"Read and write permissions"** so the automated job can create release tags and upload `.apk` assets via `GITHUB_TOKEN`.

