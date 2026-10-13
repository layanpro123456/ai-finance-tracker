# AI-Powered Personal Finance Tracker

A lightweight, serverless personal financial management platform with zero monthly hosting costs. Built with Supabase (Database, Auth, Edge Functions), React + TypeScript (hosted on GitHub Pages), and free-tier LLM inference (Google Gemini Flash / Groq) for natural language transaction logging and financial analytics.

---

## Features

- **100% Free Tier Stack:** Fully operational within Supabase, GitHub Actions, and Google AI Studio free allowances.
- **Natural Language Parsing:** Input strings like *"Spent $14.50 on lunch at Chipotle today"* or paste receipt text; the AI parses amount, category, date, and description automatically.
- **Secure by Default:** Multi-tenant architecture isolated at the database engine level via PostgreSQL Row-Level Security (RLS).
- **Automated Operations:** GitHub Actions run weekly spending summaries and budget reports directly to your database.
- **Single Page App:** Built with Vite + React + Tailwind CSS and automatically deployed to GitHub Pages via CI/CD.

---

## Architecture Overview

```text
       [ User Browser / Mobile View ]
                     │
         (SPA via GitHub Pages)
                     │
    ┌────────────────┴────────────────┐
    │                                 │
    ▼ (Direct REST / Auth)            ▼ (AI Parsing Request)
[ Supabase Auth & Postgres ]     [ Supabase Edge Function ]
    │ (Row-Level Security)            │
    │                                 ▼
    │                           [ Gemini 2.5 Flash API ]
    │                                 │
    └──────────(DB Insert)────────────┘
                     ▲
                     │ (Weekly Cron Scheduled Report)
          [ GitHub Actions Workflow ]
```

---

## Tech Stack

| Layer | Technology | Cost |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Tailwind CSS, Lucide Icons | Free (GitHub Pages) |
| **Backend & DB** | Supabase (PostgreSQL, GoTrue Auth, Storage) | Free ($0/mo tier) |
| **Serverless API** | Supabase Edge Functions (Deno / TypeScript) | Free (500k invocations/mo) |
| **AI Inference** | Google Gemini 2.5 Flash / Groq Cloud | Free Tier |
| **Scheduled Jobs** | GitHub Actions Cron Workflows | Free (2,000 mins/mo) |

---

## Quick Start

1. Follow the [Setup Guide](SETUP_GUIDE.md) to initialize your Supabase instance and environment variables.
2. Review the [Database Schema](DATABASE_SCHEMA.md) and execute migrations in the Supabase SQL editor.
3. Run the development server locally:

```bash
npm install
npm run dev
```

---

## License

MIT License. Feel free to fork and customize for your personal financial workflow.