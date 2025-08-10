# Database Migrations

This directory contains SQL migrations for the Ryokushen Financial application.

## Migration Files

- `001_transaction_support.sql` - Adds atomic transaction support via RPC functions
- `002_fix_recurring_payment_id_type.sql` - Fixes process_recurring_payment to accept INTEGER bill IDs

## How to Apply Migrations

### Option 1: Via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the migration content
4. Click "Run"

### Option 2: Via Supabase CLI
```bash
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

### Option 3: Via Application (Recommended)
Run the migration check on application startup (see database.js)

## Migration Naming Convention

Files are named with a sequential number prefix:
- `001_description.sql`
- `002_description.sql`
- etc.

## Important Notes

1. Always test migrations in a development environment first
2. Migrations should be idempotent (safe to run multiple times)
3. Include rollback procedures where applicable
4. Document any breaking changes

## Implemented RPC Functions

### transfer_funds
Atomically transfers money between accounts with automatic rollback on failure.

```sql
SELECT * FROM transfer_funds(
    p_from_account_id := 'uuid',
    p_to_account_id := 'uuid', 
    p_amount := 100.00,
    p_description := 'Transfer description',
    p_user_id := 'uuid'
);
```

### process_recurring_payment
Processes recurring bill payments atomically.

```sql
SELECT * FROM process_recurring_payment(
    p_bill_id := 123,  -- INTEGER (after migration 002)
    p_user_id := 'uuid'
);
```

### bulk_import_transactions
Imports multiple transactions as a single atomic operation.

```sql
SELECT * FROM bulk_import_transactions(
    p_transactions := '[{"account_id": "uuid", "date": "2024-01-01", ...}]'::jsonb,
    p_user_id := 'uuid'
);
```