# Apex LifeOS: Personal Finance & Operations ERP

<p align="center">
  <img src="src/assets/hero.png" alt="Apex LifeOS Banner" width="100%" style="border-radius: 16px;" />
</p>

<p align="center">
  <strong>The unified Life Operating System connecting your money, your physical movement, and your daily operations.</strong>
</p>

<p align="center">
  <a href="#key-features">Features</a> •
  <a href="#location-timeline--mobility">Location & Mobility</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#database-schema">Database Schema</a> •
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

---

## 🚀 Key Modules & Capabilities

### 1. ⚡ AI Natural Language Transaction Ledger
* Powered by Google Gemini 2.0 / 2.5 Flash with multi-currency parsing.
* Type or paste natural language purchases:
  > *"Spent Rs 4,500 on groceries at Keells"* or *"Paid €65 for train ticket yesterday"*
* Automatically identifies category, transaction type, date, and deducts the corresponding account balance.
* **100% Dynamic Currency Support**: Works seamlessly across 40+ currencies (USD `$`, LKR `Rs`, EUR `€`, GBP `£`, INR `₹`, CAD `CA$`, etc.) with zero hardcoded currency symbols.

### 2. 📍 Location Timeline & Geofence Payment Reminders *(NEW)*
* **Geofence Sentinel**: Save places (Supermarkets, Landlord's Office, Corporate HQ) with adjustable radii ($100\text{m} - 1500\text{m}$).
* **Proximity Triggers**:
  * **Budget Category Alert**: Entering a grocery store alerts you to your remaining monthly grocery budget allowance.
  * **Task Completion Prompt**: Approaching your landlord prompts 1-click settlement of your pending rent task.
  * **Social IOU Split**: Meeting a friend triggers a reminder to settle shared expenses.
* **Global Proximity Banner**: Dismissible top banner notifies you across any module.

### 3. 🚗 Traffic-Resilient Speed & Commute Intelligence *(NEW)*
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
* **Daily "No-Spend" Streak Challenge**: Gamified habit tracker to reinforce mindful spending.

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

### 8. 🛡️ Privacy-Preserving Admin Portal
* Oversee active platform users, aggregate event telemetry, and system health without exposing any private monetary sums or personal notes.

### 9. 🎨 Dual Themes & Complete Localization
* High-contrast OLED **Dark Mode** and clean **Light Mode**.
* Adjustable primary currency, home country, and local timezone.

---

## 🛠️ Architecture & Tech Stack

```text
       [ User Browser / PWA Mobile View ]
                      │
          (Vite + React + Tailwind CSS)
                      │
     ┌────────────────┴────────────────────────┐
     │                                         │
     ▼ (REST & Row-Level Security)             ▼ (AI & Telemetry)
[ Supabase PostgreSQL & Auth ]        [ Supabase Edge Functions ]
  • accounts      • saved_places               │
  • transactions  • mobility_events            ▼
  • tasks         • daily_mobility       [ Google Gemini AI ]
  • assets        • subscriptions
  • budgets       • contacts_ledger
```

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Tailwind CSS, Lucide Icons | Responsive SPA & PWA UI |
| **State & Context** | React Context (`PreferencesContext`) | Theme, Currency, Timezone state |
| **Geolocation Engine** | HTML5 Geolocation API + Haversine Formula | Speed tracking & Geofencing |
| **Database & Auth** | Supabase (PostgreSQL, GoTrue, RLS) | Secure multi-tenant cloud storage |
| **AI Parsing** | Supabase Edge Function + Gemini Flash | Natural language expense parsing |

---

## 📂 Project Directory Structure

```text
ai-finance-tracker/
├── src/
│   ├── components/
│   │   ├── AccountManager.tsx           # Multi-account balance sheets
│   │   ├── AiTransactionInput.tsx       # Natural language expense logger
│   │   ├── AssetManager.tsx             # Asset inventory & warranty vault
│   │   ├── BudgetManager.tsx            # Category limits & progress
│   │   ├── ContactsLedgerManager.tsx    # Peer-to-peer IOU tracker
│   │   ├── CurrencyLogo.tsx             # Dynamic multi-currency badge & prefix
│   │   ├── HelpGuide.tsx                # User-facing step-by-step documentation
│   │   ├── LocationTimelineManager.tsx  # Telemetry, commute stats & simulator
│   │   ├── MetricCards.tsx              # Executive Net Worth & burn rate cards
│   │   ├── Navbar.tsx                   # Top navigation with alert badges
│   │   ├── ProximityAlertBanner.tsx     # Global geofence payment alert banner
│   │   ├── SettingsModal.tsx            # Theme, currency, and timezone modal
│   │   ├── SubscriptionManager.tsx      # Recurring billing & cancellation links
│   │   ├── TaskManager.tsx              # Operations & financial task bridge
│   │   └── TransactionList.tsx          # Filterable ledger transactions
│   ├── context/
│   │   └── PreferencesContext.tsx       # Dynamic currency & theme context
│   ├── services/
│   │   ├── locationMobilityService.ts   # Haversine math, traffic classifier, simulator
│   │   └── adminTelemetry.ts           # Privacy-first audit logging
│   └── types/
│       └── index.ts                     # Core TypeScript schemas
└── supabase/
    └── migrations/                      # Database DDL & RLS security policies
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
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run Database Migrations
Execute the SQL files inside `supabase/migrations/` in your **Supabase SQL Editor** to initialize the database tables and Row-Level Security (RLS) policies.

### 4. Launch Development Server
```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 📄 License

Distributed under the **MIT License**. Free for personal and commercial adaptation.
