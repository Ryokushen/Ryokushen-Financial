-- Fix smart_rules ID generation issue
-- Run this entire script in your Supabase SQL Editor

-- Step 1: Enable the uuid-ossp extension (required for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Check if the extension is properly enabled
SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';

-- Step 3: Alter the smart_rules table to ensure ID has proper default
-- First, check current table structure
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'smart_rules' AND column_name = 'id';

-- Step 4: If the default is not set, update it
ALTER TABLE smart_rules 
ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Step 5: Verify the change
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'smart_rules' AND column_name = 'id';

-- Step 6: Test UUID generation
SELECT uuid_generate_v4() as test_uuid;

-- Step 7: Test inserting a rule without specifying ID
-- This should work if everything is configured correctly
/*
INSERT INTO smart_rules (user_id, name, description, enabled, priority, conditions, actions, stats)
VALUES (
    auth.uid(), 
    'Test Rule', 
    'Testing ID generation', 
    true, 
    0, 
    '{"field": "amount", "operator": ">", "value": 100}'::jsonb,
    '{"type": "categorize", "category": "Large Purchase"}'::jsonb,
    '{"matches": 0, "last_matched": null}'::jsonb
);
*/