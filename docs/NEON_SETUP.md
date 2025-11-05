# Neon Setup Guide

## Why Neon?

Neon provides:
- ✅ Serverless PostgreSQL (no auto-pause on free tier!)
- ✅ Instant branching and database cloning
- ✅ Free tier with generous limits
- ✅ Better connection reliability than pooled connections
- ✅ Built-in connection pooling
- ✅ Easy CI/CD integration
- ✅ Automatic backups and point-in-time recovery

## Quick Setup (5 minutes)

### 1. Create Neon Account

1. Go to [https://neon.tech](https://neon.tech)
2. Sign up for free (GitHub/Google/Email)
3. Create a new project
   - Choose a project name: `spendsense`
   - Choose a region (closest to you)
   - Choose PostgreSQL version (14+ recommended)
   - Generate a strong database password (save it!)

### 2. Get Connection String

1. In your Neon project dashboard
2. Click on your project
3. Go to **Connection Details** (or **Dashboard** → **Connection string**)
4. Copy the connection string (looks like):
   ```
   postgresql://[USER]:[PASSWORD]@[ENDPOINT]/[DATABASE]?sslmode=require
   ```
   Or use the connection pooler:
   ```
   postgresql://[USER]:[PASSWORD]@[ENDPOINT]/[DATABASE]?sslmode=require&pool_timeout=0
   ```
5. Replace `[PASSWORD]` with your actual password

**Note:** Neon provides two connection strings:
- **Direct connection** - For serverless functions and local development
- **Connection pooler** - For serverless/edge functions (recommended for Next.js)

Use the **pooler connection string** for Next.js applications.

### 3. Update Local Environment

Create/update your `.env` file:

```bash
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[ENDPOINT]/[DATABASE]?sslmode=require"
SEED_USERS=75
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY="your-openai-key-optional"
```

### 4. Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Create tables in Neon
npx prisma db push

# Seed with synthetic data
npm run seed
```

### 5. Verify in Neon

1. Go to **SQL Editor** in Neon dashboard
2. Run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
3. You should see all 8 tables: User, Consent, Account, Transaction, Liability, Profile, ReviewItem, AmlLabel

## GitHub Actions Setup

### Add Database URL as Secret

1. Go to your GitHub repo: https://github.com/mdayku/spendsense
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `DATABASE_URL`
5. Value: Your Neon connection string (use pooler for CI)
6. Click **Add secret**

The CI workflow will automatically use this for all jobs!

## Connection Pooling

Neon automatically handles connection pooling. For Next.js, use the **pooler connection string** which is provided in the dashboard.

**Direct connection** format:
```
postgresql://[USER]:[PASSWORD]@[ENDPOINT]/[DATABASE]?sslmode=require
```

**Pooler connection** format (recommended):
```
postgresql://[USER]:[PASSWORD]@[ENDPOINT]/[DATABASE]?sslmode=require&pool_timeout=0
```

## Local vs Production Databases

### Option 1: Same Database (Simple)
- Use Neon for both local development and production
- Easiest setup
- Just be careful not to delete production data!

### Option 2: Separate Databases (Recommended)
- Create 2 Neon projects:
  - `spendsense-dev` for local development
  - `spendsense-prod` for production
- Use different `.env` files
- More professional separation

### Option 3: Branching (Advanced)
- Neon supports database branching
- Create a branch for development
- Merge changes back to main branch
- Great for testing migrations

## Migration Workflow

### Development
```bash
# Make schema changes in prisma/schema.prisma
# Push to Neon (no migration files needed)
npx prisma db push

# Or create migration files (recommended for production)
npx prisma migrate dev --name your_change_name
```

### Production
```bash
# Apply migrations
npx prisma migrate deploy
```

## Troubleshooting

### "Password authentication failed"
- Double-check your password in the connection string
- Make sure to URL-encode special characters in password
- Verify you're using the correct user (usually `neondb` or your project name)

### "Connection timed out"
- Check your internet connection
- Verify the endpoint in the connection string
- Try using the connection pooler instead of direct connection

### "SSL connection required"
- Make sure your connection string includes `?sslmode=require`
- Neon requires SSL for all connections

### "Table already exists"
- Neon has tables from previous runs
- Go to SQL Editor in Neon and run:
  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```
- Then run `npx prisma db push` again

### CI fails with connection error
- Make sure `DATABASE_URL` secret is set in GitHub
- Use the pooler connection string for CI
- Check that the connection string includes SSL parameters

## Security Notes

- ✅ Never commit `.env` files
- ✅ Use GitHub Secrets for CI database URLs
- ✅ SSL is required for all Neon connections
- ✅ Consider separate dev/prod databases
- ✅ Neon automatically backs up your database

## Cost

Neon Free Tier includes:
- 0.5 GB storage
- 1 compute unit (shared)
- No auto-pause (stays active!)
- Unlimited API requests
- Automatic backups

**No auto-pause means your database stays active 24/7!** 🎉

## Advantages Over Other Providers

- ✅ **No auto-pause** - Database stays active on free tier
- ✅ **Better connection reliability** - Built-in connection pooling
- ✅ **Instant branching** - Clone databases for testing
- ✅ **Point-in-time recovery** - Restore to any previous state
- ✅ **Serverless compute** - Scale to zero when not in use

## Next Steps

1. Set up Neon account
2. Get connection string (use pooler for Next.js)
3. Update `.env` file
4. Push schema to Neon
5. Add GitHub secret for CI
6. Start developing! 🚀



