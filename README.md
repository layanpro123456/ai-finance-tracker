# Apex LifeOS: Personal Finance & Operations ERP

<p align="center">
  <img src="src/assets/hero.png" alt="Apex LifeOS Banner" width="100%" style="border-radius: 16px;" />
</p>

<p align="center">
  <strong>The unified Life Operating System connecting your money, your physical movement, and your daily operations.</strong>
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
* **Daily "No-Spend" Streak Challenge**: Gamified habit tracker to reinforce mindful spending, synced directly with Supabase.

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
* **1-Click Platform & Workspace Refresh**: Full database purge capability that wipes all 11 operational tables, clears stale browser `localStorage`, and guarantees primary accounts start at strictly `0.00` balance with zero artificial sample data.

### 9. 🎨 Dual Themes & Complete Localization
* High-contrast OLED **Dark Mode** and clean **Light Mode**.
* Adjustable primary currency, home country, and local timezone.

### 10. 🔒 Hardware-Bound Location Uniqueness & Single-Device Lock
* **Hardware-Partitioned Location Data**: GPS fixes, velocity timeline events, and transit statistics are strictly partitioned by unique physical `device_id`, preventing GPS crosstalk or route contamination across devices.
* **1 Active Device Enforcement**: Users cannot be actively logged in from multiple devices simultaneously (`user_device_sessions`). Attempting to log in on a second device displays an active session transfer prompt.
* **Continuous Heartbeat Sentinel**: Background heartbeat monitors session ownership; if a remote device claims the account, the local device is immediately logged out safely.

### 11. 🔄 Independent Module-by-Module Reset Controls
* Each subsystem possesses its own dedicated **Reset Button** directly inside its header toolbar:
  * **Reset Transactions**: Deletes all recorded transactions and resets ledger history.
  * **Reset Accounts**: Resets all balances to zero and restores a clean default Checking Account (`0.00`).
  * **Reset Budgets**: Clears all monthly category limits for the active period.
  * **Reset Tasks**: Clears to-dos/bills and resets your daily no-spend check-in streak.
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
* All saved places, mobility timeline events, daily statistics, tasks, and streaks are persisted directly in Supabase PostgreSQL tables.
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

### 17. 🚗 Commute Mileage Tax Deduction & Reimbursement Engine
* **Business vs. Personal Classification**: Categorize mobility transit legs with single-click ease.
* **Standard Mileage Write-Offs**: Automatically calculates allowable tax write-offs using configurable rates (IRS \$0.67/mi, CRA \$0.70/km, HMRC £0.45/mi).
* **Strict Public Transit Exemption**: Public transport (trains, buses, subways, ferries) is strictly excluded from vehicle mileage formulas to ensure tax compliance.
* **Exportable Reports**: Generate itemized CSV files and printable, audit-ready reimbursement forms.

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
| **Frontend Framework** | [React](https://react.dev/) | `^19.3.0` | Declarative UI & Component Architecture |
| **Type Safety** | [TypeScript](https://www.typescriptlang.org/) | `^7.0.2` | Strict compile-time validation & interfaces |
| **Build Tooling** | [Vite](https://vite.dev/) | `^8.3.4` | Ultra-fast HMR, bundling, and asset pipeline |
| **Styling Engine** | [Tailwind CSS v4](https://tailwindcss.com/) | `^4.3.3` (`@tailwindcss/vite`) | Utility-first responsive design & dark mode |
| **Iconography** | [Lucide React](https://lucide.dev/) | `^1.57.0` | Accessible fintech and operational icon library |
| **Backend & Database** | [Supabase](https://supabase.com/) | `@supabase/supabase-js: ^2.117.3` | PostgreSQL, Auth, Row-Level Security (RLS) |
| **AI Intelligence** | [Google Gemini](https://ai.google.dev/) | 2.0 / 2.5 Flash | Natural language expense parsing & categorization |
| **Hardware Sentinel** | Web Crypto UUID | Hardware Fingerprint | 1-Active-Device lock & telemetry isolation |
| **Geolocation Engine** | HTML5 Geolocation + Haversine | $O(1)$ Math Calculations | Speed tracking, traffic hysteresis, geofences |

---

## 📱 Mobile App Roadmap (Capacitor)

Apex LifeOS is engineered with a mobile-first PWA responsive foundation that smoothly translates into native Android (`.apk` / `.aab`) and iOS (`.ipa`) applications using **Capacitor**:

* **Runtime Wrapper**: [`@capacitor/core`](https://capacitorjs.com/) and `@capacitor/cli`
* **Native Geolocation**: [`@capacitor/geolocation`](https://capacitorjs.com/docs/apis/geolocation) for background location telemetry and fine-grained GPS fixes
* **Hardware Device ID**: [`@capacitor/device`](https://capacitorjs.com/docs/apis/device) for physical device fingerprinting
* **Native Storage**: [`@capacitor/preferences`](https://capacitorjs.com/docs/apis/preferences) for encrypted token storage
* **Haptics & Feedback**: [`@capacitor/haptics`](https://capacitorjs.com/docs/apis/haptics) for vibration feedback on geofence arrival and ledger inputs

> [!NOTE]
> Review the detailed implementation guide in [mobile_app_development_plan.md](mobile_app_development_plan.md) for full phase-by-phase mobile packaging steps, Gradle configurations, and app store deployment.

---

## 📂 Project Directory Structure

```text
ai-finance-tracker/
├── public/
│   ├── favicon.svg                  # High-resolution Apex LifeOS SVG luxury fintech favicon
│   └── poster.html                  # Marketing poster and feature showcase
├── src/
│   ├── components/
│   │   ├── AccountManager.tsx           # Multi-account balance sheets & reset (starts at 0.00)
│   │   ├── AdminAuthModal.tsx           # Strict admin authorization modal (layanmoyura@proton.me)
│   │   ├── AdminPortal.tsx              # Platform user telemetry, audit logs & 1-click DB purge
│   │   ├── AiTransactionInput.tsx       # Natural language expense logger with Gemini Flash
│   │   ├── AssetManager.tsx             # Asset inventory, warranty vault & reset
│   │   ├── AuthModal.tsx                # Single-device session login & registration
│   │   ├── BudgetManager.tsx            # Category limits, progress & reset
│   │   ├── CashManager.tsx              # In-hand cash wallet, ATM withdrawals & bill audit
│   │   ├── ContactsLedgerManager.tsx    # Peer-to-peer IOU tracker & reset
│   │   ├── CurrencyLogo.tsx             # Dynamic multi-currency badge & prefix
│   │   ├── HelpGuide.tsx                # User-facing step-by-step documentation
│   │   ├── LocationTimelineManager.tsx  # Telemetry, commute stats, simulator & reset
│   │   ├── MetricCards.tsx              # Executive Net Worth & burn rate cards
│   │   ├── MileageTaxReportModal.tsx    # Mileage tax write-off audit & printable report
│   │   ├── Navbar.tsx                   # Two-Row Navigation bar with module ribbon & mobile drawer
│   │   ├── PredictiveCashFlow.tsx       # 30/60/90-day cash projection & What-If stress sandbox
│   │   ├── ProximityAlertBanner.tsx     # Global geofence payment alert banner
│   │   ├── SettingsModal.tsx            # Theme, currency, timezone modal & discrete admin entry
│   │   ├── SplitBillModal.tsx           # Group bill splitter with UPI/Venmo/PayPal deep links
│   │   ├── SubscriptionManager.tsx      # Recurring billing, cancellation links & reset
│   │   ├── TaskManager.tsx              # Operations, financial task bridge & reset
│   │   └── TransactionList.tsx          # Filterable ledger transactions & reset
│   ├── context/
│   │   └── PreferencesContext.tsx       # Dynamic currency & theme context
│   ├── hooks/
│   │   └── useSpeechRecognition.ts      # Web Speech API voice typing & multi-language dictation
│   ├── services/
│   │   ├── adminTelemetry.ts           # Privacy-first audit logging & admin email verification
│   │   ├── databaseAdminService.ts     # 1-Click database purge & clean 0.00 balance reset
│   │   ├── deviceSessionService.ts     # Single-device session lock & hardware UUID
│   │   └── locationMobilityService.ts   # Haversine math, traffic classifier, simulator
│   ├── types/
│   │   └── index.ts                     # Core TypeScript schemas
│   ├── App.tsx                          # Root coordinator & global shortcut handler (Ctrl+Shift+A)
│   └── supabaseClient.ts               # Authenticated Supabase client instance
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
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Initialize Database Tables
Execute the complete SQL definitions from [database_schema.md](database_schema.md) in your **Supabase SQL Editor** to initialize all 11 tables and Row-Level Security (RLS) policies.

### 4. Launch Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

### 5. Access Administrator Portal
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
