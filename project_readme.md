# Apex LifeOS: Personal ERP & AI Finance Engine

A modern, serverless Personal ERP platform bridging personal wealth, physical movement telemetry, and daily life operations with zero monthly hosting costs. Built with React + TypeScript, Supabase (PostgreSQL, Auth, Edge Functions), and Google Gemini Flash for natural language ledger automation and multi-currency intelligence.

---

## 🌟 What Makes Apex LifeOS Different?

Most finance apps operate in isolation—they only track historical debits and credits after money has already left your pocket.

**Apex LifeOS connects every dimension of your life into one balance sheet:**
* **Finance**: Multi-currency accounts, category budgets, net worth calculations, and Gemini AI receipt/prompt parsing.
* **Mobility & Commute**: Real-time velocity tracking, traffic-resilient transit detection (crawling in traffic is recognized as a vehicle, not walking), and 1-click commute fuel/fare logging.
* **Geofence Reminders**: Proximity payment alerts when you arrive at supermarkets (grocery budget), landlords (rent task), or offices (receipt filing).
* **Daily Operations**: Tasks directly bridge to accounts (Payable bills deduct balances; Receivable milestones deposit income).
* **Assets & Warranties**: Track fixed assets, current depreciated valuations, and expiring warranties.
* **Subscriptions & IOUs**: Track recurring monthly burn rates with direct cancel links, and settle peer-to-peer debts with 1 click.

---

## 🚀 Key Modules

| Module | Purpose | Key Integrations |
| :--- | :--- | :--- |
| **Overview Dashboard** | Real-time Net Worth, liquid cash, monthly burn, pending tasks, and recent ledger feed | Aggregates all 7 ERP sub-systems |
| **AI Ledger Logger** | Natural language expense entry across 40+ global currencies (`$`, `Rs`, `€`, `£`, `₹`, etc.) | Google Gemini 2.0 / 2.5 Flash |
| **Location & Timeline** | GPS velocity gauge, commute legs, dwell stops, and traffic-resilient transit detection | Haversine formula + Route Simulator |
| **Geofenced Places** | Saved waypoints with proximity radii triggering contextual payment alerts on arrival | Integrated with Budgets, Tasks & IOUs |
| **Daily Tasks & Bills** | Operational to-dos with financial bridges and daily "No-Spend" streak challenge | Checking off tasks logs ledger entries |
| **Asset Vault** | Fixed assets (electronics, vehicles, tools) feeding into Net Worth | Purchase price, current value, warranty |
| **Subscriptions** | Monthly & annual recurring commitments with renewal countdown | Active account link, direct cancel URLs |
| **Social Ledger** | P2P debt tracking (*"They Owe Me"* vs *"I Owe Them"*) | 1-Click settlement modal |
| **Admin Portal** | Privacy-preserving telemetry, audit logs, and user analytics | Masked IDs, 0 private financial leaks |
| **Help & Guide** | Comprehensive user-facing tutorial with step-by-step interactive instructions | Mobile swipeable chapter navigator, non-technical |
| **Device Sentinel** | Single active device login enforcement & device-bound location telemetry isolation | Hardware UUID, session takeover guard |
| **Module Reset Sentinel** | Independent 1-click Reset button per module with confirmation modals | In-place deletion and calibration for all 8 subsystems |

---


## 🏗️ Architecture & Technology Stack

```text
       [ User Browser / Mobile View ]
                      │
          (SPA via GitHub Pages / Vercel)
                      │
     ┌────────────────┴────────────────────────┐
     │                                         │
     ▼ (Direct REST / Auth / RLS)              ▼ (AI Parsing Request)
[ Supabase Auth & Postgres ]          [ Supabase Edge Function ]
     │ (Row-Level Security)                    │
     │                                         ▼
     │                               [ Gemini Flash API ]
     │                                         │
     └─────────────(DB Insert)─────────────────┘
                      ▲
                      │ (Weekly Scheduled Cron)
           [ GitHub Actions Workflow ]
```

---

## ⚡ Quick Start

1. Follow the [Setup Guide](setup_guide.md) to initialize your Supabase project.
2. Review the [Database Schema](database_schema.md) and execute migrations in the Supabase SQL editor.
3. Start development server:

```bash
npm install
npm run dev
```

---

## 📄 License

MIT License. Free for personal customization and community deployment.