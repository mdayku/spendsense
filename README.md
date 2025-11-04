# SpendSense

Local-first, explainable financial education engine built on synthetic Plaid-style data. Generates behavioral signals, assigns personas, and produces guardrailed recommendations with plain-language rationales and operator oversight.

## Quickstart

```bash
# 1) Install
npm i

# 2) Env
cp .env.example .env
# (optional) edit DATABASE_URL; default is file:./spendsense.db

# 3) DB + seed synthetic users
npx prisma migrate dev --name init
npm run seed

# 4) Dev server (Next.js API + UI)
npm run dev

# 5) Eval harness
npm run eval

# 6) Tests
npm test
```

Open http://localhost:3000 for the end-user dashboard and http://localhost:3000/operator for the operator view.

## What's Included
- Synthetic data generator (50–100 users) with diverse situations
- Feature pipeline (subscriptions, savings, credit, income stability)
- 5 personas (4 specified + 1 custom) with prioritization
- Guardrails (consent, eligibility, tone + disclosures)
- Recommendation engine with explicit "because" rationales
- Operator view with approval/override stub and decision traces
- Evaluation harness with coverage/explainability/latency/audit metrics

## Tech Stack
- Next.js App Router + API Routes
- TypeScript + Zod + Prisma (SQLite)
- Tailwind (basic styles) + small UI kit components
- Vitest + tsx for tests and scripts

## Scripts
- `npm run seed` – generate synthetic data & load DB
- `npm run dev` – run web & API
- `npm run eval` – run evaluation and write JSON + summary to console
- `npm run import:ibm` – import IBM AML CSVs in `data/ibm_aml/`
- `npm test` – run unit tests

## Using the IBM AML Kaggle dataset
1. Download CSVs and place them under `data/ibm_aml/` (e.g., `HI-Small_Trans.csv`).
2. Run `npm run import:ibm` to stream‑import into SQLite. Use `IMPORT_LIMIT=100000 npm run import:ibm` to cap rows.
3. Hit `/api/profile/:userId` for any imported entity (email looks like `ENTITYID@aml.local`).
4. Run `npm run eval` to regenerate metrics after import.

**Notes**
- IBM AML is synthetic; we map originator→user and beneficiary→counterparty; transactions are `transfer`.
- Subscriptions/income signals may be sparse; keep the default synthetic seed for consumer-style A/B.

## Not Financial Advice
See `docs/DISCLAIMER.md`. All content is educational.

