# Apex LifeOS: Personal ERP & AI Finance Engine

A modern, serverless Personal ERP platform bridging personal wealth, physical movement telemetry, and daily life operations with zero monthly hosting costs. Built with **React 19**, **TypeScript**, **Vite 8**, **Tailwind CSS v4**, **Supabase** (PostgreSQL, Auth, Edge Functions), and **Google Gemini Flash** for natural language ledger automation and multi-currency intelligence.

---

## 🌟 What Makes Apex LifeOS Different?

Most finance apps operate in isolation—they only track historical debits and credits after money has already left your pocket.

**Apex LifeOS connects every dimension of your life into one balance sheet:**
* **Finance**: Multi-currency accounts (starting strictly at `0.00` balance), category budgets, real-time net worth calculations, and Gemini AI prompt parsing.
* **Mobility & Commute**: Real-time velocity tracking, traffic-resilient transit detection (crawling in heavy traffic is recognized as a vehicle rather than walking), and 1-click commute fuel/fare logging.
* **Geofence Reminders**: Proximity payment alerts when you arrive at supermarkets (grocery budget), landlords (rent task), or offices (receipt filing).
* **Daily Operations**: Tasks directly bridge to accounts (Payable bills deduct balances; Receivable milestones deposit income).
* **Assets & Warranties**: Track fixed assets, current depreciated valuations, and expiring warranties.
* **Subscriptions & IOUs**: Track recurring monthly burn rates with direct cancel links, and settle peer-to-peer debts with 1 click.
* **Clean State Policy**: Zero-hallucination data governance. No mock commute trips, fake sample places, or artificial starting balances.

---

## 🚀 Key Modules & Capabilities

| Module | Purpose | Key Integrations & Safeguards |
| :--- | :--- | :--- |
| **Overview Dashboard** | Real-time Net Worth, liquid cash, monthly burn rate, pending bills, and recent ledger feed | Aggregates all ERP subsystems into an executive command center |
| **Predictive Cash Flow** | 30/60/90-day day-by-day cash forecast, overdraft radar alerts, liquid runway calculation, and What-If stress-testing sandbox | Dynamic SVG trajectory chart combining subscriptions, bill tasks & historical burn rate |
| **AI Ledger Logger & Voice** | Natural language voice & text expense entry across 40+ global currencies (`$`, `Rs`, `€`, `£`, `₹`, etc.) | Google Gemini 2.0 / 2.5 Flash + Web Speech API (17+ languages, live waveforms, auto-parse) with Multi-Layered Prompt Guard (adversarial regex scan, inert XML wrapping, schema validation) |
| **Daily Tasks & Bills** | Operational to-dos with financial bridges and daily "No-Spend" streak challenge | Checking off tasks logs ledger entries; cloud-synced with Supabase |
| **Location & Timeline** | GPS velocity gauge, commute legs, dwell stops, and traffic-resilient transit detection | Haversine formula + traffic hysteresis + Route Simulator |
| **Android Tracker APK** | Dedicated native Android background location beacon with Fused Location Provider, Room offline queue, and direct Supabase streaming | Eliminates mobile browser background sleep/Doze throttling; Zero-Exposure QR pairing, 1-tap encrypted token exchange, Keystore AES-256 storage, and zero manual parameter exposure |
| **Geofenced Places** | Saved waypoints with proximity radii triggering contextual payment alerts on arrival | Integrated with Budgets, Tasks & IOUs; responsive top proximity banner |
| **Financial Accounts** | Multi-account balance sheets (Checking, Savings, Cash, Credit Card) | Strict `0.00` starting balance policy; zero hallucinated funds |
| **Cash & ATM Vault** | In-hand physical cash wallet tracking, 1-click ATM withdrawals with bank auto-transfer, voice cash logging, and bill audits | Dedicated cash wallet balance, voice dictation, petty cash logging, and physical wallet reconciliation |
| **Category Budgets** | Monthly category caps with interactive visual spending gauges | Progress tracking and over-budget warnings |
| **Asset Vault** | Fixed assets (electronics, vehicles, tools) feeding into Net Worth | Purchase price, current value, and warranty expiration countdowns |
| **Subscriptions** | Monthly & annual recurring commitments with renewal countdown | Active account links, direct cancellation URLs to prevent subscription creep |
| **Social Ledger & Split** | P2P debt tracking and group bill splitter with equal/exact/% modes and instant payment links (UPI, Venmo, PayPal, CashApp) | 1-Click settlement and direct ledger sync without requiring friends to install the app |
| **Two-Row Navigation** | Row 1 (Identity & System Controls) + Row 2 (10-Module Tab Ribbon) | Auto-scroll centering, gradient overflow fade masks, and mobile slide-over drawer |
| **Strict Admin Portal** | Platform telemetry, audit logs, and 1-click database refresh | Restricted strictly to `layanmoyura@proton.me`; discrete `Ctrl+Shift+A` / `#admin` access |
| **Zero-Data DB Purge** | 1-Click platform/workspace database purge across all 13 tables | Resets accounts to `0.00`, wipes stale `localStorage`, and preserves user auth accounts |
| **Device Sentinel** | Single active device login enforcement & device-bound location telemetry isolation | Hardware UUID, session takeover guard, and continuous heartbeat sentinel |
| **Help & Guide** | Comprehensive user-facing tutorial with step-by-step interactive instructions | Mobile swipeable chapter navigator, non-technical instructions |
| **Module Reset Controls**| Independent 1-click Reset button per subsystem with confirmation dialogs | In-place deletion and calibration for all individual modules |

---

## 🏗️ Architecture & Technology Stack

```text
       [ User Browser / Mobile Touch View / Capacitor App ]
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
  • tasks             • device_location_pings           (Gemini Flash 2.0 / 2.5)
  • personal_assets   • user_device_sessions                 │
  • subscriptions     • categories                           │
  • contacts_ledger                                          │
     │                                                       │
     └──────────────────────(Direct Cloud Sync)──────────────┘
```

---

## 📚 Documentation Index

For in-depth technical specifications, setup workflows, and schema definitions:

* 📖 **[Main Project README](README.md)**: Comprehensive user manual, feature details, and design philosophy.
* 🗄️ **[Database Schema Documentation](database_schema.md)**: Full PostgreSQL table definitions, RLS access control policies, indexes, and RPC functions.
* ⚙️ **[Setup & Deployment Guide](setup_guide.md)**: Step-by-step Supabase configuration, environment variables, Edge Function deployment, and admin access.
* 🤝 **[Contributing Guidelines](contributing_guidelines.md)**: Development workflow, build checks (`tsc -b && vite build`), linting, and security constraints.
* 📱 **[Mobile App Development Plan](mobile_app_development_plan.md)**: Technical roadmap for native Android & iOS deployment using Capacitor.

---

## 📝 Continuous Documentation Synchronization Invariant

> [!IMPORTANT]
> **Mandatory Post-Commit Markdown Update Rule:**
> Every commit or feature implementation **must** update the corresponding Markdown documentation (`README.md`, `project_readme.md`, `contributing_guidelines.md`, `database_schema.md`, `setup_guide.md`) in lockstep within that exact same commit.
> - Any newly created component or service must be cataloged in the project file tree and module table.
> - Any schema, invariant, or workflow changes must be updated immediately.
> - Code and documentation must never drift apart.

---

## ⚡ Quick Start

1. Follow the [Setup Guide](setup_guide.md) to provision your Supabase instance.
2. Review the [Database Schema](database_schema.md) and execute migrations in the Supabase SQL editor.
3. Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 📄 License

MIT License. Free for personal customization and community deployment.