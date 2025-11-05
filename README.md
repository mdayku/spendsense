# SpendSense

Local-first, explainable financial education engine built on synthetic Plaid-style data. Generates behavioral signals, assigns personas, and produces guardrailed recommendations with plain-language rationales and operator oversight.

## Quickstart

```bash
# 1) Install
npm i

# 2) Set up Neon (or Supabase)
# Follow docs/NEON_SETUP.md to create a free Neon database
# Get your PostgreSQL connection string

# 3) Env
cp .env.example .env
# Edit .env and add:
#   - DATABASE_URL (your Neon connection string)
#   - OPENAI_API_KEY (optional - for AI-generated recommendations)

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

## Important: PostgreSQL Required

This project uses **PostgreSQL** (not SQLite). We recommend **Neon** for the best experience (no auto-pause, better reliability). Follow the [Neon Setup Guide](docs/NEON_SETUP.md) to get started - it takes ~5 minutes and is completely free!

Alternatively, you can use [Supabase](docs/SUPABASE_SETUP.md) if you prefer.

## What's Included
- Synthetic data generator (50–100 users) with diverse situations
- Feature pipeline (subscriptions, savings, credit, income stability)
- 5 personas (4 specified + 1 custom) with prioritization
- Guardrails (consent, eligibility, tone + disclosures)
- Recommendation engine with explicit "because" rationales
- **AI-Powered Recommendations** (optional) - Dynamic, personalized copy via OpenAI
- Operator view with approval/override stub and decision traces
- Evaluation harness with coverage/explainability/latency/audit metrics

## Tech Stack
- Next.js 14 App Router + API Routes
- TypeScript + Zod
- Prisma ORM + PostgreSQL (Neon recommended)
- Tailwind CSS for styling
- Vitest + tsx for tests and scripts

## Scripts
- `npm run seed` – generate synthetic data & load DB
- `npm run dev` – run web & API
- `npm run eval` – run evaluation and write JSON + summary to console
- `npm run import:ibm` – import IBM AML CSVs in `data/ibm_aml/`
- `npm test` – run unit tests

## AI-Powered Recommendations (Optional)

By default, recommendations use template-based copy. Add `OPENAI_API_KEY` to your `.env` to enable AI-generated personalized recommendations:

```bash
OPENAI_API_KEY="sk-..."
```

**What it does:**
- Generates dynamic titles and rationales based on user's actual financial data
- Makes recommendations feel more conversational and contextual
- Falls back to static templates if API key is missing or requests fail
- Uses GPT-4o-mini for fast, cost-effective generation (~$0.0001 per recommendation)

**Example difference:**
- **Static:** "Autopay to avoid interest & fees"
- **AI:** "Set up autopay to stop missing payments and save $84/month"

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

