# SpendSense

Local-first, explainable financial education engine built on synthetic Plaid-style data. Generates behavioral signals, assigns personas, and produces guardrailed recommendations with plain-language rationales and operator oversight.

## Quickstart

```bash
# 1) Install
npm i

# 2) Set up Supabase
# Follow docs/SUPABASE_SETUP.md to create a free Supabase project
# Get your PostgreSQL connection string

# 3) Env
cp .env.example .env
# Edit .env and add your Supabase DATABASE_URL

# 4) DB + seed synthetic users
npx prisma db push
npm run seed

# 5) Dev server (Next.js API + UI)
npm run dev

# 6) Eval harness
npm run eval

# 7) Tests
npm test
```

Open http://localhost:3000 for the end-user dashboard and http://localhost:3000/operator for the operator view.

## Important: Supabase Required

This project uses **PostgreSQL via Supabase** (not SQLite). Follow the [Supabase Setup Guide](docs/SUPABASE_SETUP.md) to get started - it takes ~5 minutes and is completely free!

## What's Included
- Synthetic data generator (50–100 users) with diverse situations
- Feature pipeline (subscriptions, savings, credit, income stability)
- 5 personas (4 specified + 1 custom) with prioritization
- Guardrails (consent, eligibility, tone + disclosures)
- Recommendation engine with explicit "because" rationales
- Operator view with approval/override stub and decision traces
- Evaluation harness with coverage/explainability/latency/audit metrics

## Tech Stack
- Next.js 14 App Router + API Routes
- TypeScript + Zod
- Prisma ORM + PostgreSQL (Supabase)
- Tailwind CSS for styling
- Vitest + tsx for tests and scripts

## Scripts
- `npm run seed` – generate synthetic data & load DB
- `npm run dev` – run web & API
- `npm run eval` – run evaluation and write JSON + summary to console
- `npm run import:ibm` – import IBM AML CSVs in `data/ibm_aml/`
- `npm test` – run unit tests

## Using the IBM AML Kaggle dataset
1. Download CSVs and place them under `data/ibm_aml/` (e.g., `HI-Small_Trans.csv`).
2. Run `npm run import:ibm` to stream‑import into Supabase. Use `IMPORT_LIMIT=100000 npm run import:ibm` to cap rows.
3. Hit `/api/profile/:userId` for any imported entity (email looks like `ENTITYID@aml.local`).
4. Run `npm run eval` to regenerate metrics after import.

**Notes**
- IBM AML is synthetic; we map originator→user and beneficiary→counterparty; transactions are `transfer`.
- Subscriptions/income signals may be sparse; keep the default synthetic seed for consumer-style A/B.
- Import may take a few minutes for large datasets due to database round-trips.

## Not Financial Advice
See `docs/DISCLAIMER.md`. All content is educational.

