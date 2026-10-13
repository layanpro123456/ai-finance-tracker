# Contributing Guidelines

Contributions, issues, and feature requests are welcome!

## Development Workflow

1. **Fork the Repository:** Create a fork under your personal GitHub account.
2. **Branch Naming:** Create a feature branch with a descriptive name:
   ```bash
   git checkout -b feat/voice-input-parser
   # or
   git checkout -b fix/auth-redirect-bug
   ```
3. **Local Linting and Checks:** Run TypeScript verification and code formatting before opening a pull request:
   ```bash
   npm run build
   ```
4. **Security Check:**
   - **Never commit API keys or service role secrets.**
   - Ensure all Supabase database queries respect Row-Level Security rules.
5. **Submit a Pull Request:** Open a PR against the `main` branch with a summary of changes and test steps.