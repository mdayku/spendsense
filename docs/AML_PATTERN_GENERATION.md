# AML Pattern Generation Feature

## Overview

SpendSense now includes a **unique feature** that learns from the IBM AML dataset to generate realistic AML-like patterns in synthetic user data. This allows you to test your AML detection systems with realistic patterns without exposing real user data.

## How It Works

1. **Pattern Learning**: When you import the IBM AML dataset, SpendSense analyzes the transaction patterns to learn:
   - High-volume transfers to single counterparties
   - Rapid in/out flows (smurfing-like patterns)
   - Structuring (amounts just under reporting thresholds)
   - Frequent small transfers

2. **Synthetic Generation**: When generating synthetic data with AML patterns enabled, the system:
   - Uses learned patterns from IBM AML data (if available)
   - Falls back to realistic AML patterns even without imported data
   - Generates transactions that trigger AML educational alerts

## Setup Instructions

### Step 1: Download IBM AML Dataset

1. Go to [Kaggle IBM AML Dataset](https://www.kaggle.com/datasets/ealtman2019/ibm-transaction-fraud-ml-dataset)
2. Download the files (CSV or TXT format - both work!)
3. Place them in the `data/ibm_aml/` directory in your project root
   - Example: `data/ibm_aml/HI-Small_Trans.txt` or `data/ibm_aml/HI-Small_Trans.csv`

### Step 2: Analyze Patterns (Recommended)

**Option A: Pattern Analysis Only (No Import)** ⭐ Recommended

Run the analysis script to learn patterns WITHOUT importing transactions:

```bash
npm run analyze:aml
```

Or with a limit (for faster testing):

```bash
IMPORT_LIMIT=10000 npm run analyze:aml
```

This will:
- Read the IBM AML data file
- Analyze transaction patterns (amounts, frequencies, timing, etc.)
- Save patterns to `data/aml-patterns.json`
- **NOT import any transactions** - keeps your database clean
- Use these patterns to generate NEW synthetic transactions

**Option B: Full Import (Optional)**

If you want to import the actual transactions for comparison/testing:

```bash
npm run import:ibm
```

This will:
- Create users with emails like `ENTITYID@aml.local`
- Import transactions as transfers
- Store AML labels in the `AmlLabel` table
- Also enables pattern learning from imported data

### Step 3: Generate Synthetic Data with AML Patterns

**Important**: After running `npm run analyze:aml`, the patterns are saved to `data/aml-patterns.json`. The synthetic generator will automatically use these patterns.

1. Go to your dashboard (`/dashboard`)
2. Check the **"Include AML-like patterns"** checkbox
3. Click **"Generate Synthetic Data"**

The system will:
- Analyze patterns from imported IBM AML data
- Generate synthetic users with realistic AML-like transaction patterns
- These users will trigger AML educational alerts
- They'll appear in the operator review queue

## What Patterns Are Generated?

### Pattern 1: High-Volume Transfers
- 10+ transfers to a single counterparty within 30 days
- Uses counterparty names learned from IBM dataset (if available)
- Amounts based on learned ranges

### Pattern 2: Rapid In/Out (Smurfing-like)
- 8+ days with same-day inflows and outflows
- Money comes in during morning, goes out same afternoon
- Creates the "smurfing" pattern of rapid movement

### Pattern 3: Structuring
- Multiple transfers just under reporting thresholds ($10k, $5k, etc.)
- Amounts between 90-99% of threshold
- Avoids triggering mandatory reporting

### Pattern 4: Frequent Small Transfers
- Multiple small transfers per day
- Spread across many counterparties
- Creates high transaction volume without large amounts

## Benefits

✅ **Realistic Testing**: Test your AML detection with patterns learned from real datasets  
✅ **Privacy Safe**: No real user data exposed  
✅ **Automatic Learning**: System learns from imported data automatically  
✅ **Fallback Support**: Works even without IBM dataset (uses realistic defaults)  
✅ **Unique Feature**: No other financial app has this capability  

## Technical Details

- Pattern analysis happens automatically when AML data is imported
- Patterns are stored in memory (not persisted) and recalculated on each generation
- The system checks for `@aml.local` users to detect if IBM data is available
- Falls back to realistic defaults if no IBM data is found

## API Usage

You can also generate AML patterns programmatically:

```typescript
// Include AML patterns
POST /api/user/generate-synthetic
{
  "includeAmlPatterns": true
}

// Or via query parameter
POST /api/user/generate-synthetic?includeAml=true
```

## Notes

- AML patterns are educational only - not legal determinations
- Generated users will show AML warnings in the operator dashboard
- Patterns are randomized to create variety
- Multiple patterns can be combined in a single user

