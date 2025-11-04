# Data Model & Windows

## Database Design

### SQLite Limitations
SQLite does not support native enum types. All enum-like fields use `String` type with valid values documented in comments:

- **ConsentStatus**: `OPTED_IN` | `OPTED_OUT`
- **AccountType**: `checking` | `savings` | `credit` | `money_market` | `hsa`
- **Channel**: `online` | `in_store` | `atm` | `other`
- **PFCPrimary**: `income` | `transfer` | `subscription` | `groceries` | `dining` | `bills` | `entertainment` | `travel` | `other`
- **LiabilityType**: `credit_card` | `mortgage` | `student_loan`
- **ReviewStatus**: `pending` | `approved` | `overridden`

### Data Conventions
- **Transactions**: Sign convention - positive=inflow, negative=outflow
- **Emergency fund coverage**: savings balance / avg monthly expenses
- **Utilization**: current balance / limit per credit card, max taken across cards
- **Income stability**: median days between income transactions (PFC primary = income)

### Alternative: PostgreSQL
If you need native enum support, switch to PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ConsentStatus {
  OPTED_IN
  OPTED_OUT
}
// ... etc
```

Then restore the enum definitions in the schema.

