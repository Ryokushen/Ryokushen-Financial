-- Enable UUID extension in Supabase
-- Run this in the Supabase SQL Editor if you get "null value in column 'id'" errors

-- Enable the uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify the extension is enabled
SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';

-- Test UUID generation
SELECT uuid_generate_v4();

-- If you still have issues, you can also try recreating the table with explicit default
-- But first check if the extension is properly enabled