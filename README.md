# ⚡ Vauntico Scan

**Autonomous RLS defense, dependency auditing, and endpoint leak detection for Supabase projects.**

Vauntico Scan is the open-source core of Vauntico's "Phantom Maintainer" security engine. It scans your Supabase migrations, package dependencies, and live API endpoints — then outputs a scored audit report with a verifiable trust certificate.

---

## What It Does

| Check | Scope |
|---|---|
| **SQL Auditor** | Regex-based scan of `supabase/migrations/*.sql` — flags `auth.uid() = user_id` used at outer scope without a `(SELECT auth.uid())` cache subquery |
| **Dependency Auditor** | Parses `package.json` and reports packages older than 6 months via a static lookup table |
| **Live RLS Verifier** | Connects to your live Supabase project (via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) and queries `pg_policies` for misconfigured policies |
| **Endpoint Leak Prober** | Probes sensitive API endpoints without authentication and reports which ones return real data (indicating an anonymous access leak) |
| **Scorer** | Starts at 100 and subtracts 10 points per RLS auth leak / policy issue |
| **Trust Tier** | ≥80 → **ARCHITECT** · 50–79 → **BUILDER** · <50 → **SEEDLING** |

---

## Install

```bash
# Clone the repo
git clone https://github.com/vauntico/vauntico-scan.git
cd vauntico-scan

# Install dependencies
npm install

# Run the scan (from your project root)
npx tsx src/index.ts
```

Or run directly without cloning:

```bash
npx github:vauntico/vauntico-scan
```

---

## Usage

```bash
# Scan current directory
npx vauntico-scan

# Scan a specific project directory
npx vauntico-scan --path /path/to/your/project

# Output raw JSON (skip the terminal funnel)
npx vauntico-scan --json
```

### Environment Variables (optional)

Copy `.env.example` to `.env` for live verification features:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
VAUNTICO_BASE_URL=https://your-app.com
```

---

## Trust Certificate

Every scan produces a verifiable trust certificate URL:

```
https://vauntico.com/verify?s=100&t=ARCHITECT
```

This link validates your project's security tier on the Vauntico platform and can be shared publicly to demonstrate your commitment to security.

---

## Architecture

```
vauntico-scan-public/
├── bin/vauntico-scan.js       # CLI binary shim
├── src/
│   ├── index.ts               # CLI entry point (commander)
│   ├── sqlAuditor.ts          # SQL migration regex scanner
│   ├── depAuditor.ts          # package.json age checker
│   ├── leakProber.ts          # HTTP endpoint leak tester
│   ├── rlsVerifier.ts         # Live Supabase pg_policies verifier
│   ├── scorer.ts              # Scoring engine (0-100)
│   ├── handshake.ts           # POST audit report to Vauntico API
│   └── funnel.ts              # ANSI-colored terminal output
├── .env.example
├── LICENSE                    # MIT
├── package.json
└── tsconfig.json
```

---

## Security

- No production credentials are shipped in this repository.
- All environment variables are documented in `.env.example`.
- The handshake to `vauntico.com/api/audit/report` is optional and fails silently on network errors.
- No data leaves your machine except the score, leak count, and a non-reversible project hash (sent only if the network call succeeds).

---

## Roadmap

- [ ] Real npm registry age lookup (replaces static table)
- [ ] CI/CD integration (GitHub Action + Vercel integration)
- [ ] Multi-project batch scanning
- [ ] HTML/PDF report export
- [ ] Automated PR creation for found issues

---

## Links

- **Full Platform**: [https://vauntico.com](https://vauntico.com)
- **Trust Certificate Verification**: [https://vauntico.com/verify](https://vauntico.com/verify?s=100&t=ARCHITECT)
- **Phantom Maintainer SaaS**: Autonomous, headless PR-based security maintenance for Supabase projects.

---

## License

MIT — see [LICENSE](./LICENSE).