# Migrating from Supabase to Neon

This guide will help you migrate your SpendSense database from Supabase to Neon.

## Why Migrate?

- ✅ **No auto-pause** - Database stays active 24/7 on free tier
- ✅ **Better connection reliability** - Fewer connection issues
- ✅ **Instant branching** - Clone databases for testing
- ✅ **Point-in-time recovery** - Restore to any previous state

## Step-by-Step Migration

### 1. Create Neon Account & Project

1. Go to [https://neon.tech](https://neon.tech)
2. Sign up for free (GitHub/Google/Email)
3. Create a new project: `spendsense`
4. Choose a region (preferably same as Supabase)
5. Save your database password

### 2. Get Neon Connection String

1. In Neon dashboard → **Connection Details**
2. Copy the **connection pooler** string (recommended for Next.js)
3. It should look like:
   ```
   postgresql://[USER]:[PASSWORD]@[ENDPOINT]/[DATABASE]?sslmode=require
   ```

### 3. Export Data from Supabase (Optional)

If you have existing data you want to keep:

```bash
# Using pg_dump (if you have PostgreSQL client installed)
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" > supabase_backup.sql

# Or use Supabase dashboard:
# 1. Go to SQL Editor
# 2. Export data manually (for small datasets)
```

### 4. Push Schema to Neon

```bash
# Update your .env file with Neon connection string
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[ENDPOINT]/[DATABASE]?sslmode=require"

# Generate Prisma client
npx prisma generate

# Push schema to Neon
npx prisma db push
```

### 5. Import Data (If Applicable)

If you exported data from Supabase:

```bash
# Using psql (if you have PostgreSQL client installed)
psql "postgresql://[USER]:[PASSWORD]@[ENDPOINT]/[DATABASE]?sslmode=require" < supabase_backup.sql

# Or use Neon dashboard SQL Editor:
# 1. Go to SQL Editor
# 2. Paste your SQL dump
# 3. Run the queries
```

**Note:** If you're starting fresh, just run `npm run seed` to generate new synthetic data.

### 6. Update GitHub Secrets

1. Go to your GitHub repo: https://github.com/mdayku/spendsense
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Edit the `DATABASE_URL` secret
4. Replace with your Neon connection string
5. Save the secret

### 7. Test the Migration

```bash
# Start your dev server
npm run dev

# Test database connection
npx prisma studio  # Opens Prisma Studio to view data

# Verify all tables exist
# Check that data is accessible
```

### 8. Update Local Environment

Make sure your local `.env` file has the Neon connection string:

```bash
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[ENDPOINT]/[DATABASE]?sslmode=require"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY="your-openai-key-optional"
SEED_USERS=75
```

### 9. Verify Everything Works

1. ✅ Can you log in?
2. ✅ Can you view profiles?
3. ✅ Can you generate synthetic data?
4. ✅ Do all API routes work?
5. ✅ Is CI passing on GitHub?

## Troubleshooting

### "Connection refused" or "Can't reach database server"

- Verify your connection string is correct
- Make sure you're using the pooler connection string for Next.js
- Check that SSL is enabled (`?sslmode=require`)

### "Relation does not exist"

- Run `npx prisma db push` to create tables
- Or run `npx prisma migrate deploy` if using migrations

### "Password authentication failed"

- Double-check your password in the connection string
- URL-encode special characters in password
- Verify you're using the correct user

### Data Migration Issues

- If tables exist but data is missing, check foreign key constraints
- You may need to import data in a specific order (users → consents → accounts → transactions)
- Consider using `npx prisma db seed` if you just want fresh synthetic data

## Clean Slate Option

If you don't need to preserve existing data:

```bash
# 1. Update .env with Neon connection string
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[ENDPOINT]/[DATABASE]?sslmode=require"

# 2. Push schema
npx prisma db push

# 3. Generate fresh data
npm run seed

# Done! 🎉
```

## Next Steps

1. ✅ Update your `.env` file
2. ✅ Update GitHub secrets
3. ✅ Test locally
4. ✅ Verify CI passes
5. ✅ (Optional) Delete Supabase project to avoid confusion

## Benefits You'll Notice

- **No more connection timeouts** - Database stays active
- **Faster queries** - Better connection pooling
- **More reliable** - Fewer intermittent issues
- **Better for development** - No need to wake up database

## Questions?

- Check [Neon Setup Guide](NEON_SETUP.md) for detailed setup
- Visit [Neon Documentation](https://neon.tech/docs)
- Check [Prisma PostgreSQL Guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql)

Happy migrating! 🚀



