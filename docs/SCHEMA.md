# Data Model & Windows

## Database Design

### PostgreSQL via Supabase

SpendSense uses **PostgreSQL** provided by Supabase, which supports:
- ✅ Native enum types for type safety
- ✅ Advanced indexing for better performance
- ✅ Full-text search capabilities
- ✅ JSON/JSONB for flexible data
- ✅ Connection pooling for scalability

### Enum Types

All categorical fields use proper PostgreSQL enums:

- **ConsentStatus**: `OPTED_IN` | `OPTED_OUT`
- **AccountType**: `checking` | `savings` | `credit` | `money_market` | `hsa`
- **Channel**: `online` | `in_store` | `atm` | `other`
- **PFCPrimary**: `income` | `transfer` | `subscription` | `groceries` | `dining` | `bills` | `entertainment` | `travel` | `other`
- **LiabilityType**: `credit_card` | `mortgage` | `student_loan`
- **ReviewStatus**: `pending` | `approved` | `overridden`

These provide:
- Type safety at the database level
- Better query performance
- Clearer schema documentation
- IDE autocomplete in TypeScript

### Data Conventions

- **Transactions**: Sign convention - positive=inflow, negative=outflow
- **Emergency fund coverage**: savings balance / avg monthly expenses
- **Utilization**: current balance / limit per credit card, max taken across cards
- **Income stability**: median days between income transactions (PFC primary = income)

### Indexes

Strategic indexes for performance:
- `ReviewItem.status + createdAt` - Fast operator queue queries
- `ReviewItem.userId` - User-specific reviews
- `AmlLabel.userId` - AML label lookups

### Search Capabilities

PostgreSQL provides case-insensitive search with `mode: "insensitive"`:
```typescript
prisma.user.findMany({
  where: {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } }
    ]
  }
})
```

## Migrations

### Development Workflow

```bash
# Make schema changes in prisma/schema.prisma

# Push to Supabase (quick iteration)
npx prisma db push

# Or create migration files (production-ready)
npx prisma migrate dev --name your_change_name
```

### Production Workflow

```bash
# Apply pending migrations
npx prisma migrate deploy
```

## Why Not SQLite?

SQLite was initially considered but has limitations:
- ❌ No native enum support
- ❌ Limited concurrent write performance
- ❌ No connection pooling
- ❌ Difficult to use in CI/CD
- ❌ Not suitable for production

PostgreSQL (via Supabase) provides a production-ready database with:
- ✅ Native enums
- ✅ Excellent performance
- ✅ Free tier for development
- ✅ Easy CI/CD integration
- ✅ Automatic backups

## Schema Visualization

```
User
├─ Consent (1:1)
├─ Account[] (1:N)
│  ├─ Transaction[] (1:N)
│  └─ Liability[] (1:N)
├─ Transaction[] (1:N)
├─ Liability[] (1:N)
├─ Profile[] (1:N)
│  └─ ReviewItem[] (1:N)
├─ ReviewItem[] (1:N)
└─ AmlLabel[] (1:N)
```

## Data Volume Estimates

For 75 synthetic users over 180 days:
- ~75 Users
- ~75 Consents
- ~225 Accounts (checking, savings, credit)
- ~8,000-10,000 Transactions
- ~75 Liabilities
- ~150 Profiles (30d + 180d per user)
- Variable ReviewItems (based on alerts)
- Variable AmlLabels (if imported)

Total database size: **< 50 MB** (well within Supabase free tier)

## See Also

- [Supabase Setup Guide](SUPABASE_SETUP.md) - How to set up your database
- [PRD.md](../PRD.md) - Product requirements
- [DECISIONS.md](DECISIONS.md) - Architecture decisions
