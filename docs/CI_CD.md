# GitHub Actions CI/CD Documentation

## Overview

The SpendSense project uses GitHub Actions for continuous integration. The workflow automatically runs on every push and pull request to the `main` and `develop` branches.

## Workflow Jobs

### 1. Test & Build 🧪

**Runs on:** Node.js 18.x and 20.x (matrix strategy)

**Steps:**
- Checkout code
- Install dependencies with `npm ci` (faster, more reliable than `npm install`)
- Generate Prisma client
- Run TypeScript type checking (`tsc --noEmit`)
- Run unit tests with Vitest
- Build Next.js production bundle
- Run database migrations

**Purpose:** Ensures code compiles, tests pass, and app builds successfully on multiple Node versions.

### 2. Lint 🎨

**Runs on:** Node.js 20.x

**Steps:**
- Checkout code
- Install dependencies
- Check code formatting with Prettier

**Purpose:** Maintains consistent code style across the project.

**Note:** Set to `continue-on-error: true` so it won't fail the build, but you'll see warnings.

### 3. Evaluate 📊

**Runs on:** Node.js 20.x  
**Depends on:** Test job must pass first

**Steps:**
- Checkout code
- Install dependencies
- Generate Prisma client
- Setup database and run migrations
- Seed with 10 synthetic users
- Run evaluation harness
- Upload metrics.json as artifact (30-day retention)

**Purpose:** Validates that the recommendation engine meets quality thresholds:
- Coverage: % of personas with ≥3 behaviors
- Explainability: % of recommendations with rationales
- Latency: P95 response time
- Auditability: % with decision traces

**Artifacts:** Evaluation results are saved and can be downloaded from the Actions tab.

### 4. Security 🔒

**Runs on:** Node.js 20.x

**Steps:**
- Checkout code
- Install dependencies
- Run `npm audit` at moderate level
- Check for outdated dependencies

**Purpose:** Identifies known vulnerabilities and outdated packages.

**Note:** Set to `continue-on-error: true` for informational purposes.

## Viewing Results

1. Go to your repository: https://github.com/mdayku/spendsense
2. Click **Actions** tab
3. Click on any workflow run to see detailed logs
4. Download evaluation artifacts from the completed runs

## Badges (Optional)

Add this to your README.md to show build status:

```markdown
[![CI](https://github.com/mdayku/spendsense/actions/workflows/ci.yml/badge.svg)](https://github.com/mdayku/spendsense/actions/workflows/ci.yml)
```

## Local Development

To run the same checks locally before pushing:

```bash
# Type check
npx tsc --noEmit

# Run tests
npm test

# Build
npm run build

# Format check
npx prettier --check "**/*.{ts,tsx,js,jsx,json,md}"

# Format fix
npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}"

# Security audit
npm audit

# Run evaluation
npm run eval
```

## Prettier Configuration

The project uses Prettier for consistent code formatting:

**`.prettierrc`** settings:
- Semi-colons: `true`
- Single quotes: `false` (use double quotes)
- Tab width: 2 spaces
- Print width: 100 characters
- Arrow parens: `avoid` (e.g., `x => x` not `(x) => x`)

**`.prettierignore`** excludes:
- Node modules
- Build artifacts (.next, dist, out)
- Database files
- Environment files
- Generated files (package-lock.json)

## Customization

### Add More Node Versions

Edit `.github/workflows/ci.yml`:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]  # Add more versions
```

### Add Deployment Job

To deploy on successful builds:

```yaml
deploy:
  name: Deploy to Production
  runs-on: ubuntu-latest
  needs: [test, lint, evaluate, security]
  if: github.ref == 'refs/heads/main'
  steps:
    - name: Deploy
      run: |
        # Add your deployment commands here
```

### Enable Required Checks

In GitHub repo settings:
1. Go to **Settings** → **Branches**
2. Add branch protection rule for `main`
3. Enable "Require status checks to pass before merging"
4. Select: `Test & Build`, `Lint`, `Evaluate`, `Security`

## Troubleshooting

### CI Fails on Type Check

Run locally: `npx tsc --noEmit` to see type errors

### CI Fails on Tests

Run locally: `npm test` to debug failing tests

### CI Fails on Build

Run locally: `npm run build` to see build errors

### Evaluation Artifacts Not Uploading

Check that `eval/out/metrics.json` is being created. The directory is created automatically by the evaluation script.

## Performance Considerations

**Speed Optimizations:**
- Using `npm ci` instead of `npm install` (faster, more reliable)
- Caching Node modules with `actions/setup-node@v4` cache option
- Running jobs in parallel where possible
- Seeding only 10 users for evaluation (faster than 75)

**Cost Optimizations:**
- Using `ubuntu-latest` (fastest runner)
- Matrix strategy only for critical test job
- Artifact retention limited to 30 days

## Further Reading

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Node.js with GitHub Actions](https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs)
- [Prettier Documentation](https://prettier.io/docs/en/)

