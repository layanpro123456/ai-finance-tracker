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
4. **Test, Lint & Type Check:**
   Verify unit tests, TypeScript compilation, and linting before committing:
   ```bash
   # Run automated unit test suite (Vitest + Happy-DOM)
   npm test

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
* All saved places, mobility timeline events, daily transit statistics, and tasks must be persisted directly to Supabase tables.
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

### 8. Transaction-Wise Undo & Balance Integrity
* **Atomic Balance Rollback:** Undoing a transaction must atomically restore the exact balance on the target account ($+\text{amount}$ for expenses, $-\text{amount}$ for income).
* **Foreign Key Cleanup:** Any transaction rollback must automatically nullify references in dependent subsystems (`tasks.related_transaction_id`, `personal_assets.linked_transaction_id`, and `contacts_ledger.settled_transaction_id`).
* **Audit Trail Telemetry:** All transaction undo actions—whether initiated by users or administrators—must record a non-personal audit event in the platform telemetry stream.

### 9. Type-Safe Form Validation, UI Alerts & Modern Toast Notifications
* **Strict Zod Validation:** All user inputs and form submissions must be validated using Zod schemas defined in `src/services/validationSchemas.ts`.
* **React Hook Form Integration:** Forms must use `react-hook-form` paired with `@hookform/resolvers/zod` (`useForm({ resolver: zodResolver(...) })`) to manage form state and render contextual inline field error messages.
* **Zero Browser alert() Calls:** Never use synchronous, blocking browser `alert()` dialogues. All operations, validation errors, and success confirmations must be surfaced using **Sonner** toasts (`toast.success`, `toast.error`, `toast.warning`, `toast.info`) and `AlertContext` (`useAlert()`).
* **Inline Modal Validation:** Form modals (budgets, transactions, assets, subscriptions, tasks, contacts) must render field validation errors inline with `<UiAlert />` banners or field hints (`AlertCircle`, `AlertTriangle`).
* **Global Interceptor Fallback:** `AlertProvider` intercepts any legacy or residual `window.alert` calls and routes them safely into the non-blocking UI alert stack.
* **Backend Connection Resilience:** The application must never throw fatal unhandled exceptions when backend credentials are not yet supplied. Verify endpoints with `isSupabaseConfigured` and display non-blocking configuration banners pointing to `.env.example`.

### 10. Android Companion & Pure Kinetic Telemetry Standards
* **Zero GPS Doppler Reliance:** The companion daemon must never rely on GPS Doppler speed (`location.speed` / `location.hasSpeed()`). Velocity, motion gating, and transport mode classification must be driven exclusively by device kinetic sensors (`TYPE_LINEAR_ACCELERATION`, `TYPE_STEP_DETECTOR`, `TYPE_ACCELEROMETER`).
* **Kinetic Stationary Lock:** When kinetic acceleration energy is $< 0.22\text{ m/s}^2$ and no footstep impulses occur, velocity must be strictly clamped to `0.0 km/h` to prevent false GPS drift and indoor jitter.
* **Biometric Pedestrian Velocity:** Walking speed ($3.0 - 7.5\text{ km/h}$) must be derived from biometric kinetic step cadence via hardware `TYPE_STEP_DETECTOR`.
* **Resilient Telemetry Ingestion:** `device_location_pings` RLS must allow background companion daemons to insert telemetry using the project anonymous key with a valid `user_id`. The web dashboard must maintain an active 3-second fallback polling cycle alongside Supabase Realtime subscriptions so that device telemetry reliably reaches the system even when WebSockets stall.
* **CI/CD Auto-Release & Version Dynamics:** The companion APK workflow (`.github/workflows/build-tracker-apk.yml`) must automatically publish an official GitHub Release after every successful build on `main`. Releases must dynamically generate incrementing tags (`v1.0.<run_number>`) and inject `versionCode` and `versionName` into Gradle via project properties (`-PversionCode`, `-PversionName`). Hardcoding static release tags (e.g. `v1.0.0`) is strictly prohibited as it triggers API collision errors and breaks Android in-place app updates.
* **Release Assets & Latest Permalink:** Builds must publish both stable permalink assets (`ApexLocationTracker-debug.apk`, `ApexLocationTracker-release.apk`) and version-stamped assets, updating `make_latest: true` so the web app's `/releases/latest` download button remains functional.

---

## 📋 Pre-Pull Request Checklist

- [ ] `npm test` passes all 32 unit tests with zero failures.
- [ ] `npm run build` succeeds with zero TypeScript or Vite errors.
- [ ] `npm run lint` reports zero linter errors.
- [ ] All user forms adhere to Zod schema validation and trigger Sonner toast alerts.
- [ ] Responsive UI verified on mobile (360px - 414px), tablet (768px), and desktop (1280px+).
- [ ] No regression in single-device session lock (including admin disable toggle) or geofence proximity alerts.
- [ ] Atomic balance rollback and foreign key cleanup verified across transaction undo flows.
- [ ] Zero native `alert()` calls: all notifications and form validations use `AlertContext` and `UiAlert`.
- [ ] All new database operations adhere to Row-Level Security (RLS).
- [ ] Markdown documentation (`README.md`, `project_readme.md`, `contributing_guidelines.md`, `database_schema.md`, `setup_guide.md`) updated to reflect all code and architectural changes.
- [ ] Directory tree and module lists in `README.md` and `project_readme.md` reflect all newly created or updated files.
- [ ] Android companion changes maintain dynamic Gradle versioning (`-PversionCode` / `-PversionName`) and auto-release CI/CD workflow integrity.