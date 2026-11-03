# Apex LifeOS: Personal Finance & Operations ERP

<p align="center">
  <img src="src/assets/hero.png" alt="Apex LifeOS Banner" width="100%" style="border-radius: 16px;" />
</p>

<p align="center">
  <strong>The unified Life Operating System connecting your money, your physical movement, and your daily operations.</strong>
</p>

<p align="center">
  <a href="https://github.com/layanmoyura/ai-finance-tracker/actions/workflows/build-tracker-apk.yml">
    <img src="https://github.com/layanmoyura/ai-finance-tracker/actions/workflows/build-tracker-apk.yml/badge.svg" alt="Build Android APK" />
  </a>
  <a href="https://github.com/layanmoyura/ai-finance-tracker/releases/latest">
    <img src="https://img.shields.io/github/v/release/layanmoyura/ai-finance-tracker?label=APK%20Release&color=10b981&logo=android" alt="Latest Android APK Release" />
  </a>
  <a href="https://github.com/layanmoyura/ai-finance-tracker/actions/workflows/deploy.yml">
    <img src="https://github.com/layanmoyura/ai-finance-tracker/actions/workflows/deploy.yml/badge.svg" alt="Deploy to GitHub Pages" />
  </a>
</p>

<p align="center">
  <a href="docs/Apex_LifeOS_Technical_Documentation.pdf"><strong>📄 Technical Documentation (PDF)</strong></a> •
  <a href="docs/FEATURES_UPDATE.md"><strong>✨ New Features & Map Guide</strong></a> •
  <a href="https://layanmoyura.github.io/ai-finance-tracker/tutorial.html"><strong>🎬 Beginner Video Tutorial</strong></a> •
  <a href="docs/TUTORIAL_VIDEO_SCRIPT.md"><strong>📝 Video Production Script</strong></a>
</p>

<p align="center">
  <a href="#key-features">Features</a> •
  <a href="#navigation--ui-architecture">Navigation & UI</a> •
  <a href="#security--administrative-governance">Admin & Security</a> •
  <a href="#location-timeline--mobility">Location & Mobility</a> •
  <a href="#architecture--tech-stack">Architecture</a> •
  <a href="#database-schema">Database Schema</a> •
  <a href="#mobile-app-roadmap">Mobile App</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#license">License</a>
</p>

---

## 🌟 Vision & Overview

Traditional personal finance apps only track what you spent *after* you've already spent it, completely blind to where you are, how you travel, or what you need to accomplish today.

**Apex LifeOS** is a comprehensive **Personal ERP** that bridges:
1. **Financial Operations** (Multi-currency balance sheets, budgets, accounts, Gemini AI ledger logging)
2. **Physical Mobility & Telemetry** (Real-time GPS velocity, traffic-resilient transit detection, commute fuel/fare costs)
3. **Location-Aware Geofence Reminders** (Contextual payment alerts upon arrival at supermarkets, landlords, or offices)
4. **Daily Life Operations** (Payable/receivable bills, personal asset vault, subscription burn rate, and peer IOUs)
5. **Zero-Hallucination Cloud Sync** (Direct Supabase database synchronization with strictly verified starting balances)

---

## 🚀 Key Modules & Capabilities

### 1. ⚡ AI Natural Language Transaction Ledger & Voice Typing
* Powered by Google Gemini 2.0 / 2.5 Flash with multi-currency parsing.
* Type or paste natural language purchases:
  > *"Spent Rs 4,500 on groceries at Keells"* or *"Paid €65 for train ticket yesterday"*
* **🛡️ Defense-in-Depth Prompt Injection Protection**:
  * **Adversarial Pattern Scanning**: Pre-execution regex detection halts jailbreaks, instruction overrides (`"ignore previous instructions"`), persona hijacking (`"you are now DAN"`), and system prompt / API secret exfiltration.
  * **First-Class System Instruction Isolation**: System prompt is passed via Gemini's dedicated `systemInstruction` field, isolating untrusted user input wrapped within inert `<untrusted_user_note>` delimiters.
  * **Zero-Trust Post-Execution Schema Validation**: Output is validated against strict numerical caps ($100,000,000), canonical 10-category taxonomy, and HTML/script tag stripping.
  * **Client-Side Real-Time Prompt Guard**: Real-time input monitoring alerts users with a security badge and disables execution if adversarial keywords are detected.
* **🎙️ Real-Time Voice Typing (Speech-to-Text)**:
  * Hands-free dictation powered by the browser Web Speech API with live audio waveform pulses and real-time interim transcript streaming.
  * **17+ Spoken Languages**: Dictate in English (US/UK/IN/AU/CA), Spanish, French, German, Italian, Portuguese, Hindi, Japanese, Mandarin, Sinhala, Tamil, Arabic, and more with instant language switching and browser auto-detection.
  * **Auto-Parse on Speech End**: Speak naturally, pause, and the engine automatically parses and pre-fills your transaction without requiring a single mouse click or keyboard tap.
  * Also embedded directly inside the **Quick Cash Spend** modal for ultra-fast on-the-street cash logging.
* Automatically identifies category, transaction type, date, and deducts the corresponding account balance.
* **100% Dynamic Currency Support**: Works seamlessly across 40+ currencies (USD `$`, LKR `Rs`, EUR `€`, GBP `£`, INR `₹`, CAD `CA$`, etc.) with zero hardcoded currency symbols.

### 2. 📍 Location Timeline & Geofence Payment Reminders
* **Geofence Sentinel**: Save places (Supermarkets, Landlord's Office, Corporate HQ) with adjustable radii ($100\text{m} - 1500\text{m}$).
* **Proximity Triggers**:
  * **Budget Category Alert**: Entering a grocery store alerts you to your remaining monthly grocery budget allowance.
  * **Task Completion Prompt**: Approaching your landlord prompts 1-click settlement of your pending rent task.
  * **Social IOU Split**: Meeting a friend triggers a reminder to settle shared expenses.
* **Global Proximity Banner**: Dismissible responsive top banner (`relative xl:sticky xl:top-16`) alerts you across any module without obscuring navigation controls.

### 3. 🚗 Traffic-Resilient Speed & Commute Intelligence

### 3.1 🇱🇰 Sri Lanka GPS Mobility Map & Historical Travel Inquiry
* **📅 Historical Date-by-Date Travelling Inquiry**: Inspect movement logs, distance covered, transit time, and modal split across past calendar dates directly in the **Daily Commute & Movement Summary** section.
* **🇱🇰 Interactive Sri Lanka Route Explorer**: Built-in dark-mode geospatial tracking map (`SriLankaMobilityMap`) rendering day-by-day companion GPS breadcrumbs with:
  * **Dynamic Dark-Mode Leaflet Tiles**: CartoDB Dark Matter tiles via CDN with auto-fitting route bounds.
  * **Standalone SVG Vector Map Fallback**: Mathematical Mercator projection mapping Sri Lanka coastline, provinces, and major urban hubs (Colombo, Kandy, Galle, Jaffna, Negombo, Kalutara, etc.).
  * **Interactive Scrubber & HUD**: Step-by-step slider and 1x/2x/5x speed playback displaying real-time speed, battery level %, charging status, and coordinates.
  * **Waypoint & Dwell Stop Badges**: Departure point (🟢), arrival destination (🏁), and dwell stop markers (🛑) for stationary periods $\ge 4\text{ minutes}$.
* **📄 Detailed Documentation**: See [docs/FEATURES_UPDATE.md](docs/FEATURES_UPDATE.md) for full architecture, data flow diagrams, and component specifications.

* **Haversine Velocity Engine**: Evaluates movement speed from browser GPS or desktop simulator:
  * 🚶 **Walking**: $1.5 - 8$ km/h
  * 🚲 **Cycling**: $8 - 25$ km/h
  * 🚗 **Vehicle / Commute**: $\ge 25$ km/h
  * 🚄 **High-Speed Express Transit**: $\ge 80$ km/h
* **Traffic Jam & Congestion Handling (Hysteresis)**:
  * Remembers motorized speed history during city gridlock. Crawling at $0 - 15$ km/h or stopping at red lights locks into **`Vehicle (Traffic Congestion)`** rather than misclassifying your drive as walking.
* **1-Click Commute Ledger**: Automatically estimates fuel and transit expenditure and lets you log commute expenses directly into your ledger with one click.
* **Interactive Desktop Route Simulator**: Test walking, heavy city traffic jams, highway driving, and arrival stops directly on your computer without leaving your desk.

### 4. 📋 Operations & The Financial Task Bridge
* Connect daily checklists directly to your balance sheet:
  * **Payables (Bills to Pay)**: Checking off *"Pay WiFi Bill"* deducts the bill from checking.
  * **Receivables (Income Expected)**: Completing *"Deliver Freelance Milestone"* logs the deposit.

### 5. 📦 Personal Asset & Inventory Vault
* Catalog high-value possessions (electronics, vehicles, tools, collectibles).
* Tracks initial purchase price vs. current market valuation to feed your real-time **Net Worth Calculation**.
* Warranty expiration countdown alerts.

### 6. 🔄 Subscriptions & Recurring Commitments
* Monthly and annual burn rate calculations.
* Renewal countdown timers and active bank account links.
* Direct cancellation links to prevent subscription creep.

### 7. 🤝 Social Ledger (P2P Debts & IOUs)
* Record debts (*"They Owe Me"* vs. *"I Owe Them"*).
* 1-Click settlement modal that updates contact balances and records settled payments into your ledger.

### 8. 🛡️ Strict Admin Governance & Zero-Hallucination Policy
* **Strict Admin Authorization**: Platform administrative operations and telemetry are strictly restricted to `layanmoyura@proton.me`. Generic email pattern matching and demo passkeys have been completely removed.
* **Discrete & Hidden Controls**: No public admin button is rendered in the public navigation header. Authorized access is granted exclusively via:
  * Keyboard shortcut: `Ctrl + Shift + A` (or `Cmd + Shift + A` on macOS)
  * URL hash: `#admin`
  * System Settings: Admin Portal link rendered strictly when logged in as `layanmoyura@proton.me`
* **1-Click Platform & Workspace Refresh**: Full database purge capability that wipes all 13 operational tables, clears stale browser `localStorage`, and guarantees primary accounts start at strictly `0.00` balance with zero artificial sample data.

### 9. 🎨 Dual Themes & Complete Localization
* High-contrast OLED **Dark Mode** and clean **Light Mode**.
* Adjustable primary currency, home country, and local timezone.

### 10. 🔒 Hardware-Bound Location Uniqueness & Single-Device Lock
* **Hardware-Partitioned Location Data**: GPS fixes, velocity timeline events, and transit statistics are strictly partitioned by unique physical `device_id`, preventing GPS crosstalk or route contamination across devices.
* **1 Active Device Enforcement**: Users cannot be actively logged in from multiple devices simultaneously (`user_device_sessions`). Attempting to log in on a second device displays an active session transfer prompt.
* **Continuous Heartbeat Sentinel**: Background heartbeat monitors session ownership; if a remote device claims the account, the local device is immediately logged out safely.
* **Admin Device Lock Override**: Authorized administrators can toggle Device Lock enforcement globally or on a per-user basis directly from the Executive Admin Console (`AdminPortal`). When disabled, users and administrators can log into multiple physical phones, desktops, and browsers concurrently without encountering collision warnings or receiving session kickouts.
* **1-Click Session Release**: Administrators can release and clear active device bindings directly from the User Inspector, resolving terminal lockouts instantly.

### 11. 🔄 Transaction-Wise Account Undo & Ledger Rollback Engine
* **Precision Ledger Reversal**: Revert financial entries directly from the `TransactionList`, `AccountManager`, or the Executive Admin Console on a granular, transaction-by-transaction basis.
* **Atomic Balance Synchronization**: Undoing an expense refunds the funds back to the designated account balance ($+\text{amount}$), while undoing an income deducts the funds ($-\text{amount}$), keeping double-entry ledger math 100% synchronized in real time.
* **Dependent Reference Cleanup**: Reverting a transaction automatically cleans and resets referencing foreign keys across `tasks` (`related_transaction_id`), `personal_assets` (`linked_transaction_id`), and `contacts_ledger` (`settled_transaction_id`).
* **Interactive Balance Preview**: Displays prior balance, reversal delta, and projected balance before confirming execution.
* **Administrative Ledger Intervention**: Authorized administrators can inspect any user's accounts and undo transactions transaction-wise on their behalf with complete audit logging.

### 12. 🔄 Independent Module-by-Module Reset Controls
* Each subsystem possesses its own dedicated **Reset Button** directly inside its header toolbar:
  * **Reset Transactions**: Deletes all recorded transactions and resets ledger history.
  * **Reset Accounts**: Resets all balances to zero and restores a clean default Checking Account (`0.00`).
  * **Reset Budgets**: Clears all monthly category limits for the active period.
  * **Reset Tasks**: Clears to-dos/bills and restores a clean operations board.
  * **Reset Timeline**: Clears recorded transit trips, timeline events, and resets device telemetry.
  * **Reset Assets**: Clears all registered fixed assets and warranty logs in the vault.
  * **Reset Subscriptions**: Clears all recurring subscription monitors and burn calculations.
  * **Reset Social Ledger**: Clears all peer debts, splits, and informal IOUs.
  * **Reset Preferences**: Restores system theme, base currency, and timezone defaults.
* **Accidental Click Protection**: Every reset button is gated with a clear confirmation dialog and active spinning indicator during execution.

### 12. 🧭 Two-Row Enterprise Navigation & Responsive Touch Engineering
* **Two-Row Decoupled Architecture**:
  * **Row 1 (Header Control Bar)**: Contains the unconstrained brand identity (`shrink-0` to eliminate text truncation or logo overlap), Live Platform Status indicator, Quick Currency Switcher, Dark/Light Theme toggle, Device Session status, User Identity pill, Mobile Drawer Toggle, and Logout.
  * **Row 2 (Module Ribbon)**: Dedicated, full-width secondary navigation ribbon for all core operational tabs (`Overview`, `Daily Tasks`, `Timeline & Mobility`, `Cash & ATM`, `Ledger`, `Accounts`, `Budgets`, `Assets`, `Subscriptions`, `Social IOU`, `Help & Guide`).
* **Active Tab Auto-Centering**: Smooth automatic scroll centering keeps your active module centered when switching views or resizing.
* **Gradient Edge Fade Masks**: Dynamic left and right fade masks indicate scrollability without displaying bulky scrollbars.
* **Slide-Over Touch Drawer**: On mobile screens (`< 768px`), a slide-over mobile drawer presents vertical module navigation with badge indicators, full touch targets, and instant module jumping.
* **Soft-Keyboard Overflow Defense**: All modals implement `max-h-[90vh] overflow-y-auto` to prevent buttons from being clipped by virtual keyboards on iOS and Android.

### 13. ☁️ Cloud-First Direct Supabase Synchronization
* All saved places, mobility timeline events, daily statistics, and tasks are persisted directly in Supabase PostgreSQL tables.
* Stale `localStorage` caching has been eliminated in favor of real-time database queries, ensuring consistent state across reloads and multi-device session migrations.

### 14. 💵 In-Hand Cash & ATM Vault
* **Physical Wallet Tracking**: Dedicated cash balance sheet itemizing physical bills in hand versus liquid digital bank accounts.
* **1-Click ATM Cash Withdrawal**: Automatically transfers funds from checking to physical cash without double-counting expenses, with optional ATM operator surcharge logging.
* **Cash Spend & Deposit Logging**: Fast logger for cash transactions and 1-click cash deposits back into checking.
* **Physical Wallet Count & Denomination Audit**: Bill counter utility with 1-click auto-reconciliation of physical cash discrepancies.

### 15. 📈 Predictive 30/60/90-Day Cash Flow & Stress Sandbox
* **Dynamic Cash Projection**: Day-by-day cash balance trajectory combining historical burn rate, active recurring subscriptions, and pending bill tasks.
* **What-If Stress Testing Sandbox**: Interactive burn rate multiplier slider and simulated sudden capital expense tester.
* **Overdraft Radar & Liquid Runway**: Real-time runway countdown alerts users to projected cash deficits before they occur.

### 16. 🧾 Group Bill Splitter & Payment Links
* **Frictionless Bill Splitting**: Split bills equally, by exact custom amount, or by percentage.
* **Instant Payment Links**: Generates direct deep links (UPI, Venmo, PayPal, CashApp) and Web Share API / WhatsApp formatted text.
* **1-Click Social Ledger Sync**: Seamlessly logs individual shares into the peer-to-peer `contacts_ledger` without requiring companions to download the app.

### 17. 🛡️ Type-Safe Form Validation & Sonner Toast Notifications
* **React Hook Form + Zod**: Enterprise-grade form state management and strict runtime schema validation via `react-hook-form` and `zod` with `@hookform/resolvers/zod`.
* **Centralized Schema Architecture**: Canonical schemas in `src/services/validationSchemas.ts` enforce boundary constraints across user inputs:
  * `authSchema`: Format-verified email and $\ge 6$ character password length.
  * `accountSchema`: Non-empty account names and finite numerical starting balances.
  * `budgetSchema`: Category validation and strictly positive monthly spending limits.
  * `taskSchema`: Title length bounds, priority enums, and non-negative financial values.
  * `transactionReviewSchema`, `cashAuditSchema`, `savedPlaceSchema`.
* **Glassmorphic Toast Alerts**: Powered by **Sonner** and unified through `AlertContext` (`useAlert()`), replacing legacy blocking browser `alert()` dialogues with rich-colored, accessible toasts (`toast.success`, `toast.error`, `toast.warning`, `toast.info`).
* **Inline Form Validation Alerts**: Form modals across budgets, transactions, assets, subscriptions, tasks, and contacts feature `<UiAlert />` banners and inline field error hints for immediate feedback on invalid inputs.
* **Global Interception Fallback**: Protects against unexpected or legacy `window.alert()` calls by automatically redirecting them into the non-blocking UI toast system.
* **Zero-Crash Backend Sentinel**: Checks `isSupabaseConfigured` on startup; if `VITE_SUPABASE_URL` is unconfigured, displays an interactive guidance banner pointing to `.env.example` instead of throwing fatal unhandled runtime exceptions.

### 18. 🧪 Automated Vitest & Happy-DOM Test Suite
* **Unit Test Engine**: Configured with **Vitest** and **Happy-DOM** for lightning-fast DOM and logic unit testing without browser overhead.
* **100% Pass Rate Across Specifications**:
  * `validationSchemas.test.ts`: Validates all Zod schemas, boundary conditions, and type coercions.
  * `aiSecurityGuard.test.ts`: Tests prompt injection defenses, zero-width space stripping, secret exfiltration halts, and output schema caps.
  * `authRedirectService.test.ts`: Tests URL token extraction, expired OTP link detection, and SPA base URL resolution.
  * `locationMobilityService.test.ts`: Tests Haversine geodesic distance calculations and velocity-based vehicle/transit mode classification.
  * `transactionUndoService.test.ts`: Tests expense refund and income deduction balance rollback projections.

---

## 🛠️ Architecture & Tech Stack

```text
       [ User Browser / Mobile View / Capacitor Native App ]
                                 │
                 (React 19 + TypeScript + Tailwind CSS v4)
                                 │
     ┌───────────────────────────┴───────────────────────────┐
     │                                                       │
     ▼ (Direct REST & Row-Level Security)                    ▼ (AI Parsing Request)
[ Supabase PostgreSQL 15+ & Auth ]                  [ Supabase Edge Functions ]
  • accounts          • saved_places                         │
  • transactions      • mobility_timeline_events             ▼
  • budgets           • daily_mobility_stats            [ Google Gemini AI ]
  • tasks             • user_device_sessions            (Gemini 2.0 / 2.5 Flash)
  • personal_assets   • categories
  • subscriptions     • contacts_ledger
```

| Component | Technology | Version / Specification | Role |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | [React](https://react.dev/) | `^19.3.1` | Declarative UI & Component Architecture |
| **Type Safety** | [TypeScript](https://www.typescriptlang.org/) | `^7.0.2` | Strict compile-time validation & interfaces |
| **Build Tooling** | [Vite](https://vite.dev/) | `^8.3.4` | Ultra-fast HMR, bundling, and asset pipeline |
| **Styling Engine** | [Tailwind CSS v4](https://tailwindcss.com/) | `^4.3.3` (`@tailwindcss/vite`) | Utility-first responsive design & dark mode |
| **Form Management** | [React Hook Form](https://react-hook-form.com/) | `^7.90.0` | Performant, flexible forms with easy validation |
| **Schema Validation** | [Zod](https://zod.dev/) | `^4.6.7` (`@hookform/resolvers`) | TypeScript-first schema declaration & validation |
| **Toast Notifications**| [Sonner](https://sonner.emilkowal.ski/) | `^2.0.8` | Luxury, non-blocking glassmorphic toast notification alerts |
| **Unit Testing** | [Vitest](https://vitest.dev/) + [Happy-DOM](https://github.com/capricorn86/happy-dom) | `^5.0.5` / `^21.0.4` | Vite-native unit test runner & lightweight DOM environment |
| **Iconography** | [Lucide React](https://lucide.dev/) | `^1.59.0` | Accessible fintech and operational icon library |
| **Backend & Database** | [Supabase](https://supabase.com/) | `@supabase/supabase-js: ^2.118.0` | PostgreSQL, Auth, Row-Level Security (RLS) |
| **AI Intelligence** | [Google Gemini](https://ai.google.dev/) | 2.0 / 2.5 Flash | Natural language expense parsing & categorization |
| **Hardware Sentinel** | Web Crypto UUID | Hardware Fingerprint | 1-Active-Device lock & telemetry isolation |
| **Geolocation Engine** | HTML5 Geolocation + Haversine | $O(1)$ Math Calculations | Speed tracking, traffic hysteresis, geofences |

---

## 📱 Android Companion APK & Background Telemetry (`android-companion/`)

To solve mobile browser background tab throttling and Doze mode process freezing when your phone screen locks or rests in your pocket, Apex LifeOS includes a dedicated, lightweight native Android companion application:

* **High-Precision Fused Location & Instant Fix**: Google Play Services **Fused Location Provider** with immediate cached fix broadcasting upon foreground service launch.
* **Pure Kinetic Sensor Velocity Engine (Zero GPS Doppler Reliance)**:
  * Completely removes unreliable GNSS Doppler velocity calculations that cause zero-speed lockouts and phase dropouts.
  * Uses hardware `TYPE_LINEAR_ACCELERATION` / `TYPE_ACCELEROMETER` (excluding gravity bias). When kinetic acceleration energy is $< 0.22\text{ m/s}^2$, velocity is strictly clamped to $0.0\text{ km/h}$, eliminating GPS drift, jitter, and desk wandering.
  * Calculates real-time pedestrian walking speed ($3.0 - 7.5\text{ km/h}$) from biometric kinetic step cadence via hardware `TYPE_STEP_DETECTOR`.
  * Computes motorized transit velocity via kinetic-gated displacement over monotonic elapsed time.
* **Native Foreground Service**: Runs an ongoing status bar notification (`FOREGROUND_SERVICE_LOCATION`), preventing Android from terminating telemetry acquisition.
* **Offline SQLite Queue**: Embedded **Room** database ensures zero lost points during cellular dead-zones or tunnels, auto-flushing to Supabase upon reconnection.
* **Direct Supabase Sync**: Streams live telemetry directly into `device_location_pings` and broadcasts via Supabase Realtime to the web dashboard.
* **🔒 Zero-Exposure Mobile Pairing**:
  * **Zero Connection Parameter Exposure**: Raw Project URLs, Anon Keys, and User UUIDs are completely removed from the pairing UI, eliminating screen recording leaks and shoulder-surfing risks.
  * **Visual QR Code & 1-Tap Token**: Point your phone camera at the screen or paste the single-string opaque pairing token (`apex_pair_v1_...`). No manual typing or raw keys required.
  * **Android Keystore AES-256 Storage**: The companion APK decrypts the token and persists connection credentials into hardware-backed `EncryptedSharedPreferences`.
* **Automated Cloud Builds & Auto-Release After Every Build**: The GitHub Actions workflow ([`.github/workflows/build-tracker-apk.yml`](.github/workflows/build-tracker-apk.yml)) automatically compiles and publishes an official GitHub Release after every build on `main` or manual workflow dispatch.
  * **Dynamic CI/CD Versioning**: Dynamically resolves unique, strictly increasing release tags (`v1.0.<run_number>`), preventing release collisions and ensuring every build produces a fresh release.
  * **Seamless In-Place Android Updates**: Injects `versionCode` (`github.run_number`) and `versionName` (`1.0.<run_number>`) directly into Gradle at compile-time, allowing Android users to update installed APKs in-place without uninstalling.
  * **Direct Sideload Downloads via `/releases/latest`**: GitHub Releases permalinks guarantee instant access to the newest binaries:
    * 📥 **[Latest Release Page](https://github.com/layanmoyura/ai-finance-tracker/releases/latest)**
    * 📲 **Direct Debug APK**: [`ApexLocationTracker-debug.apk`](https://github.com/layanmoyura/ai-finance-tracker/releases/latest/download/ApexLocationTracker-debug.apk)
    * ⚡ **Direct Release APK**: [`ApexLocationTracker-release.apk`](https://github.com/layanmoyura/ai-finance-tracker/releases/latest/download/ApexLocationTracker-release.apk)

---

## 📂 Project Directory Structure

```text
ai-finance-tracker/
├── .github/
│   └── workflows/
│       └── build-tracker-apk.yml        # Automated GitHub Actions APK build & auto-release workflow
├── android-companion/                   # Native Android Kotlin/Compose background location daemon
│   ├── app/                             # Native Android app module (Service, Room, Supabase)
│   ├── gradle/                          # Gradle wrapper configuration
│   ├── gradle.properties                # AndroidX, JVM memory & build flags
│   └── README.md                        # APK compilation, sideloading & pairing instructions
├── public/
│   ├── favicon.svg                      # High-resolution Apex LifeOS SVG luxury fintech favicon
│   └── poster.html                      # Marketing poster and feature showcase
├── src/
│   ├── components/
│   │   ├── AccountManager.tsx           # Multi-account balance sheets, account ledger & transaction-wise undo
│   │   ├── AdminAuthModal.tsx           # Strict admin authorization modal (layanmoyura@proton.me)
│   │   ├── AdminPortal.tsx              # Platform user telemetry, audit logs, device lock toggle & user transaction undo
│   │   ├── AiTransactionInput.tsx       # Natural language expense logger with Gemini Flash & Prompt Guard
│   │   ├── AssetManager.tsx             # Asset inventory, warranty vault & reset
│   │   ├── AuthModal.tsx                # Single-device session login & registration
│   │   ├── BudgetManager.tsx            # Category limits, progress & reset
│   │   ├── CashManager.tsx              # In-hand cash wallet, ATM withdrawals & bill audit
│   │   ├── ContactsLedgerManager.tsx    # Peer-to-peer IOU tracker & reset
│   │   ├── CurrencyLogo.tsx             # Dynamic multi-currency badge & prefix
│   │   ├── HelpGuide.tsx                # User-facing step-by-step documentation
│   │   ├── LocationTimelineManager.tsx  # Telemetry, commute stats, simulator & masked pairing
│   │   ├── MetricCards.tsx              # Executive Net Worth & burn rate cards
│   │   ├── Navbar.tsx                   # Two-Row Navigation bar with module ribbon & mobile drawer
│   │   ├── PredictiveCashFlow.tsx       # 30/60/90-day cash projection & What-If stress sandbox
│   │   ├── ProximityAlertBanner.tsx     # Global geofence payment alert banner
│   │   ├── SettingsModal.tsx            # Theme, currency, timezone modal & discrete admin entry
│   │   ├── SriLankaMobilityMap.tsx      # Dark-mode geospatial map of Sri Lanka, route scrubber & SVG fallback
│   │   ├── SplitBillModal.tsx           # Group bill splitter with UPI/Venmo/PayPal deep links
│   │   ├── SubscriptionManager.tsx      # Recurring billing, cancellation links & reset
│   │   ├── TaskManager.tsx              # Operations, financial task bridge & reset
│   │   ├── TransactionList.tsx          # Filterable ledger transactions, reset & transaction-wise undo
│   │   └── UiAlert.tsx                  # Accessible inline validation alert component (Lucide + Tailwind)
│   ├── context/
│   │   ├── AlertContext.tsx             # Universal validation alerts & toast notification provider
│   │   └── PreferencesContext.tsx       # Dynamic currency & theme context
│   ├── hooks/
│   │   └── useSpeechRecognition.ts      # Web Speech API voice typing & multi-language dictation
│   ├── services/
│   │   ├── adminTelemetry.ts           # Privacy-first audit logging & admin email verification
│   │   ├── aiSecurityGuard.ts          # Prompt injection scanner, adversarial pattern detector & schema validator
│   │   ├── aiSecurityGuard.test.ts     # Unit tests for prompt injection & adversarial pattern defenses
│   │   ├── authRedirectService.ts      # Auth redirect normalizer, URL feedback parser & parameter cleaner
│   │   ├── authRedirectService.test.ts # Unit tests for auth redirect parameters & OTP errors
│   │   ├── databaseAdminService.ts     # 1-Click database purge & clean 0.00 balance reset
│   │   ├── deviceSessionService.ts     # Single-device session lock, admin lock disable override & hardware UUID
│   │   ├── locationMobilityService.ts   # Haversine math, traffic classifier, simulator
│   │   ├── locationMobilityService.test.ts # Unit tests for geodesic distance & speed classifier
│   │   ├── mobilePairingService.ts     # Zero-exposure mobile pairing token, visual QR code & secret masking
│   │   ├── transactionUndoService.ts   # Transaction-wise account rollback engine & balance synchronization
│   │   ├── transactionUndoService.test.ts # Unit tests for transaction balance rollback math
│   │   ├── validationSchemas.ts        # Centralized Zod validation schemas (Auth, Account, Budget, Task)
│   │   └── validationSchemas.test.ts   # Comprehensive unit test suite for Zod validation schemas
│   ├── types/
│   │   └── index.ts                     # Core TypeScript schemas
│   ├── App.tsx                          # Root coordinator & global shortcut handler (Ctrl+Shift+A)
│   └── supabaseClient.ts               # Authenticated Supabase client instance with AI guard
├── public/
│   └── 404.html                         # SPA fallback router for GitHub Pages (preserves tokens & callbacks)
├── .env.example                         # Template environment variables for local & production deployment
├── vitest.config.ts                     # Vitest test suite configuration with Happy-DOM
├── database_schema.md                   # Complete PostgreSQL DDL, RLS policies & indexes
├── setup_guide.md                       # Installation, environment setup & deployment guide
├── contributing_guidelines.md           # Development workflow, linting & security guidelines
└── project_readme.md                    # Project architectural summary
```

---

## ⚡ Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/ai-finance-tracker.git
cd ai-finance-tracker
npm install
```

### 2. Configure Environment Variables
Copy the template configuration and supply your credentials:
```bash
cp .env.example .env
```
Edit `.env` with your Supabase endpoint and anon public key:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Initialize Database Tables
Execute the complete SQL definitions from [database_schema.md](database_schema.md) in your **Supabase SQL Editor** to initialize all 13 tables and Row-Level Security (RLS) policies.

### 4. Configure Authentication Redirect URLs (Prevent 404s)
In **Supabase Dashboard > Authentication > URL Configuration**:
* **Site URL**: `https://layanmoyura.github.io/ai-finance-tracker/` (or `http://localhost:5173` locally)
* **Redirect URLs** (Allow-list):
  * `https://layanmoyura.github.io/ai-finance-tracker/**`
  * `http://localhost:5173/**`
  * `http://127.0.0.1:5173/**`
  * `http://localhost:3000/**`

### 5. Run Automated Test Suite
Run the 32-test unit test suite verifying security, schemas, and math:
```bash
npm test
```

### 6. Launch Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

### 7. Access Administrator Portal
To access the administrative portal when logged in as `layanmoyura@proton.me`:
* Press `Ctrl + Shift + A` (or `Cmd + Shift + A` on macOS)
* Or append `#admin` to your browser URL
* Or open **System Settings** (gear icon) and click **Admin Portal**

---

## 📝 Continuous Documentation Synchronization Invariant

> [!IMPORTANT]
> **Mandatory Post-Commit Markdown Update Rule:**
> Every commit or feature implementation **must** update the corresponding Markdown documentation (`README.md`, `project_readme.md`, `contributing_guidelines.md`, `database_schema.md`, `setup_guide.md`) in lockstep within that exact same commit.
> - Any newly created component or service must be cataloged in the project file tree and module documentation.
> - Any schema, invariant, or workflow changes must be documented immediately.
> - Code and documentation must never drift apart.

---

## 📄 License

Distributed under the **MIT License**. Free for personal and commercial adaptation.
