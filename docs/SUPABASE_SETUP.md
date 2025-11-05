# Supabase Setup Guide

## Why Supabase?

Supabase provides:
- ✅ PostgreSQL database (supports native enums!)
- ✅ Free tier with generous limits
- ✅ Built-in authentication (optional)
- ✅ Real-time subscriptions (optional)
- ✅ Easy CI/CD integration
- ✅ Database backups and migrations

## Quick Setup (5 minutes)

### 1. Create Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for free
3. Create a new project
   - Choose a project name: `spendsense`
   - Choose a region (closest to you)
   - Generate a strong database password (save it!)

### 2. Get Connection String

**Important:** For better reliability (especially with multiple projects on free tier), use the **direct connection** (Session mode) instead of the pooler.

1. In your Supabase project dashboard
2. Click **Settings** (gear icon) → **Database**
3. Scroll to **Connection string** → **URI**
4. **Make sure "Session" mode is selected** (not "Transaction" mode)
5. Copy the connection string (looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
   Note: Port **5432** = direct connection (more reliable). Port **6543** = pooler (can be intermittent on free tier).
6. Replace `[YOUR-PASSWORD]` with your actual password

### 3. Update Local Environment

Create/update your `.env` file:

```bash
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
SEED_USERS=75
```

### 4. Update Prisma Schema

The schema needs to use PostgreSQL provider (we'll do this next).

### 5. Run Migrations

```bash
# Generate Prisma client
npx prisma generate

# Create tables in Supabase
npx prisma db push

# Seed with synthetic data
npm run seed
```

### 6. Verify in Supabase

1. Go to **Database** → **Tables** in Supabase dashboard
2. You should see all 8 tables: User, Consent, Account, Transaction, Liability, Profile, ReviewItem, AmlLabel

## GitHub Actions Setup

### Add Database URL as Secret

1. Go to your GitHub repo: https://github.com/mdayku/spendsense
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `DATABASE_URL`
5. Value: Your Supabase connection string
6. Click **Add secret**

The CI workflow will automatically use this for all jobs!

## Connection Pooling (Optional)

**For Free Tier:** Use **direct connection** (Session mode, port 5432) for better reliability. The pooler (port 6543) can be intermittent when you have multiple projects.

**For Production/Paid Plans:** You can use the connection pooler for better performance:

1. In Supabase dashboard → **Database** → **Connection string**
2. Change mode from **Session** to **Transaction**
3. Use the pooler connection string (port 6543 instead of 5432)

Example:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true
```

**Note:** If you're experiencing connection issues with multiple Supabase projects on free tier, stick with the direct connection (port 5432) for more consistent access.

## Local vs Production Databases

### Option 1: Same Database (Simple)
- Use Supabase for both local development and production
- Easiest setup
- Just be careful not to delete production data!

### Option 2: Separate Databases (Recommended)
- Create 2 Supabase projects:
  - `spendsense-dev` for local development
  - `spendsense-prod` for production
- Use different `.env` files
- More professional separation

### Option 3: Local SQLite + Production Supabase
- Keep `DATABASE_URL="file:./spendsense.db"` locally
- Use Supabase only for CI/production
- Requires maintaining compatibility with both databases

## Migration Workflow

### Development
```bash
# Make schema changes in prisma/schema.prisma
# Push to Supabase (no migration files needed)
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

### "Connection timed out"
- Check your internet connection
- Verify the project reference in the URL
- Try using the connection pooler (port 6543)

### "Table already exists"
- Supabase has tables from previous runs
- Go to SQL Editor in Supabase and run:
  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```
- Then run `npx prisma db push` again

### CI fails with connection error
- Make sure `DATABASE_URL` secret is set in GitHub
- Check that the connection string includes `?pgbouncer=true` for pooler

## Security Notes

- ✅ Never commit `.env` files
- ✅ Use GitHub Secrets for CI database URLs
- ✅ Use connection pooler in CI to avoid connection limits
- ✅ Consider separate dev/prod databases
- ✅ Regularly backup your database (Supabase does this automatically)

## Cost

Supabase Free Tier includes:
- 500 MB database space
- Unlimited API requests
- 50,000 monthly active users
- 2 GB file storage

This is more than enough for SpendSense! 🎉

## Next Steps

1. Set up Supabase account
2. Get connection string
3. Update schema to use PostgreSQL (next step)
4. Push schema to Supabase
5. Add GitHub secret for CI

