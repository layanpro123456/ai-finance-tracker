# Contributing Guidelines

Contributions, issues, and feature requests are welcome! Follow these guidelines to ensure code quality, platform security, and architectural consistency across Apex LifeOS.

---

## 🛠️ Development Workflow

1. **Fork & Branch:** Create a feature or bugfix branch with a descriptive name:
   ```bash
   git checkout -b feat/voice-input-parser
   # or
   git checkout -b fix/proximity-alert-mobile-layout
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Run Local Dev Server:**
   ```bash
   npm run dev
   ```
4. **Lint & Type Check:**
   Verify TypeScript compilation and linting before committing:
   ```bash
   # Run full TypeScript compiler and Vite production build
   npm run build

   # Run fast Oxlint static analysis
   npm run lint
   ```
5. **Mandatory Documentation Synchronization (Post-Commit MD Update Rule):**
   Every single commit or feature implementation **must** update the corresponding Markdown documentation in the repository (`README.md`, `project_readme.md`, `contributing_guidelines.md`, `database_schema.md`, etc.).
   - If a new component or service is created, add it to the directory tree and capabilities list in `README.md` and `project_readme.md`.
   - If database tables, columns, indexes, or policies change, update `database_schema.md`.
   - If new conventions, invariants, or workflows are established, update `contributing_guidelines.md`.
   - Never defer documentation or leave markdown out of sync with code changes.
6. **Submit a Pull Request:** Open a PR against the `main` branch with a clear summary of modifications, documentation updates, and manual test steps.

---

## 🛡️ Core Architectural Invariants & Rules

When contributing to Apex LifeOS, you must strictly follow these platform invariants:

### 1. Strict Administrator Authorization
* Platform administrative authority is restricted exclusively to `layanmoyura@proton.me`.
* Always use `isAuthorizedAdmin(userEmail)` from `src/services/adminTelemetry.ts`.
* **Never** use loose string matching (e.g. `email.includes('admin')`) and never introduce bypass passkeys or demo bypasses.
* **Never** render an admin button or link in the public navigation header. Administrative features must remain discrete (`Ctrl+Shift+A`, `#admin`, or inside System Settings for verified admins only).

### 2. Zero-Hallucination Data Policy
* **No Artificial Sample Data:** Never inject fake commute trips, synthetic geofences, dummy tasks, or fake transactions into production or demo accounts.
* **Account Balances Start at 0.00:** Default and newly initialized accounts must always start with a balance of strictly `0.00`.
* The administrative purge procedure must guarantee that user authentication accounts are preserved while all transactional, spatial, and telemetry data are wiped clean.

### 3. Cloud-First Supabase Synchronization
* All saved places, mobility timeline events, daily transit statistics, and streaks must be persisted directly to Supabase tables.
* Do not rely on browser `localStorage` as the authoritative source of truth. Use `localStorage` only for non-critical transient caching or device identification.

### 4. Two-Row Navigation Standards
* Preserve the decoupled two-row navigation architecture:
  * **Row 1:** Reserved for brand identity (must remain `shrink-0` to avoid text or logo truncation), system status, currency switcher, theme toggle, device session indicator, user profile badge, mobile drawer toggle, and logout.
  * **Row 2:** Reserved for operational module tabs (`Overview`, `Daily Tasks`, `Timeline & Mobility`, `Cash & ATM`, `Ledger`, `Accounts`, `Budgets`, `Assets`, `Subscriptions`, `Social IOU`, `Help & Guide`).
* Module tabs must support auto-scroll centering on selection, edge gradient overflow masks, and complete mobile touch drawer compatibility.

### 5. Multi-Currency & Localization
* **No Hardcoded Currency Symbols:** Never hardcode `$`, `€`, or `Rs`. Always retrieve the user's active currency from `usePreferences()` and format using `CurrencyLogo` or dynamic currency formatters.
* Support high-contrast OLED Dark Mode and clean Light Mode across all components.

### 6. Database & Row-Level Security (RLS)
* **Never commit secrets:** Never commit API keys, service role secrets, or `.env` files.
* **RLS Mandatory:** Any new database table must have Row-Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) with an explicit policy enforcing `auth.uid() = user_id`.

### 7. Mandatory Post-Commit Documentation Synchronization
* **Continuous Documentation Maintenance:** All Markdown files (`README.md`, `project_readme.md`, `contributing_guidelines.md`, `database_schema.md`, `setup_guide.md`) are treated as living, first-class source artifacts.
* **Commit Invariant:** Every code commit that introduces new features, refactors components, changes schemas, alters API signatures, or updates platform behaviors **must** update the relevant Markdown documentation within that same commit.
* **Component & Directory Inventory:** Any new component added to `src/components/` or service added to `src/services/` must be cataloged in the Project Directory Structure and Key Modules sections of `README.md` and `project_readme.md`.
* **Zero Documentation Drift:** Documentation must never lag behind code. Out-of-sync documentation is treated with the same severity as a failing test or broken build.

---

## 📋 Pre-Pull Request Checklist

- [ ] `npm run build` succeeds with zero TypeScript or Vite errors.
- [ ] `npm run lint` reports zero linter errors.
- [ ] Responsive UI verified on mobile (360px - 414px), tablet (768px), and desktop (1280px+).
- [ ] No regression in single-device session lock or geofence proximity alerts.
- [ ] All new database operations adhere to Row-Level Security (RLS).
- [ ] Markdown documentation (`README.md`, `project_readme.md`, `contributing_guidelines.md`, `database_schema.md`) updated to reflect all code and architectural changes.
- [ ] Directory tree and module lists in `README.md` and `project_readme.md` reflect all newly created or updated files.