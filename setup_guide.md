# Setup & Deployment Guide

This guide walks through configuring Supabase, provisioning API keys, running the application locally, and setting up GitHub Pages deployment.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Git](https://git-scm.com/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)
- A free account at [Supabase](https://supabase.com)
- A free API key from [Google AI Studio](https://aistudio.google.com/)

---

## Step 1: Initialize Supabase

1. Create a new organization and project at [Supabase](https://supabase.com).
2. Choose a database password and select the region closest to you.
3. Once provisioned, navigate to **SQL Editor** and execute all statements in [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).
4. Go to **Project Settings > API** and copy:
   - **Project URL**
   - **anon / public key**
   - **service_role secret** *(store securely for GitHub Actions only; never expose in frontend code)*.

---

## Step 2: Configure Environment Variables

Create a `.env` file in the project root:

```env
# Frontend variables (Vite exposes variables prefixed with VITE_)
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

---

## Step 3: Deploy the AI Parser Edge Function

1. Authenticate the Supabase CLI:
   ```bash
   supabase login
   ```
2. Link your local directory to your remote project:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
3. Set your LLM API secret in Supabase:
   ```bash
   supabase secrets set GEMINI_API_KEY="your-gemini-api-key"
   ```
4. Deploy the function:
   ```bash
   supabase functions deploy parse-transaction --no-verify-jwt
   ```

---

## Step 4: Run Locally

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev
```

Visit `http://localhost:5173` to test registration, account creation, and transaction entry.

---

## Step 5: Configure GitHub Actions & Pages

1. Push your repository to GitHub.
2. In your GitHub repository, navigate to **Settings > Secrets and variables > Actions** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Required for scheduled cron reports)
   - `GEMINI_API_KEY`
3. Navigate to **Settings > Pages**:
   - Under **Build and deployment > Source**, select **GitHub Actions**.
4. Push a commit to `main` to trigger the deployment workflow.