# SpendSense Setup Guide

## Initial Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
cp .env.example .env
```
Edit `.env` if you want to customize:
- `DATABASE_URL` (default: `file:./spendsense.db`)
- `SEED_USERS` (default: 75)

### 3. Initialize Database
```bash
# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Seed with Synthetic Data
```bash
npm run seed
```
This will create 75 users with:
- Bank accounts (checking, savings, credit)
- 180 days of transaction history
- Credit liabilities
- Diverse financial behaviors

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## Available Routes

### Web UI
- `/` - Home page with overview
- `/users` - Search and browse all users
- `/profiles/:userId` - Detailed profile view with 30d/180d windows
- `/operator` - Operator review queue

### API Endpoints
- `GET /api/users?q=search` - List/search users
- `POST /api/users` - Create user
- `POST /api/consent` - Update consent
- `GET /api/profile/:userId` - Generate profile (creates 30d & 180d)
- `GET /api/recommendations/:userId` - Get recommendations (requires consent)
- `GET /api/operator/review` - Get review queue
- `POST /api/operator/review` - Approve/override review item
- `GET /api/alerts/:userId` - Educational AML alerts
- `GET /api/aml/labels/:userId` - AML label count

## Running Tests
```bash
npm test
```

## Running Evaluation
```bash
npm run eval
```
Outputs metrics to `eval/out/metrics.json`

## Optional: Import IBM AML Dataset

1. Download IBM AML synthetic dataset from Kaggle
2. Place CSV files in `data/ibm_aml/`
3. Run importer:
```bash
npm run import:ibm
# Or with row limit:
IMPORT_LIMIT=10000 npm run import:ibm
```

## Project Structure
```
spendsense/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/               # API routes
│   │   ├── operator/          # Operator UI
│   │   ├── users/             # User list UI
│   │   ├── profiles/[userId]/ # Profile viewer UI
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── lib/                   # Core business logic
│   │   ├── zz_prisma.ts       # Prisma client
│   │   ├── types.ts           # TypeScript types
│   │   ├── time.ts            # Time utilities
│   │   ├── rules.ts           # Threshold constants
│   │   ├── signals.ts         # Signal computation
│   │   ├── personas.ts        # Persona assignment
│   │   ├── guardrails.ts      # Consent, eligibility, tone checks
│   │   ├── recommend.ts       # Recommendation engine
│   │   └── alerts.ts          # AML educational alerts
│   └── styles/
│       └── globals.css        # Tailwind styles
├── scripts/
│   ├── generateSynthetic.ts   # Synthetic data generator
│   ├── seed.ts               # Database seeder
│   └── import_ibm_aml.ts     # IBM AML CSV importer
├── eval/
│   ├── run.ts                # Evaluation harness
│   └── metrics.schema.ts     # Metrics validation schema
├── tests/
│   ├── signals.test.ts       # Signal tests
│   ├── personas.test.ts      # Persona tests
│   ├── recommend.test.ts     # Recommendation tests
│   └── guardrails.test.ts    # Guardrail tests
├── prisma/
│   └── schema.prisma         # Database schema
├── docs/
│   ├── DECISIONS.md          # Architecture decisions
│   ├── SCHEMA.md             # Data model docs
│   └── DISCLAIMER.md         # Legal disclaimer
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── vitest.config.ts
├── .gitignore
├── .env.example
├── README.md
├── PRD.md
└── SETUP.md                  # This file
```

## Troubleshooting

### Database locked
If you see "database is locked", make sure no other processes are using the DB:
```bash
npx prisma studio  # Close if running
```

### Prisma client not generated
```bash
npx prisma generate
```

### Port 3000 already in use
```bash
# Use different port
PORT=3001 npm run dev
```

## Next Steps

1. Browse users at `/users`
2. Click on a user to generate their profile
3. View recommendations (requires OPTED_IN consent)
4. Check operator queue at `/operator`
5. Run evaluation to see metrics: `npm run eval`
6. Run tests: `npm test`

Enjoy exploring SpendSense! 🎉

