-- Smart Rules Table Schema and RLS Policies for Supabase

-- Create the smart_rules table
CREATE TABLE IF NOT EXISTS smart_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  stats JSONB DEFAULT '{"matches": 0, "last_matched": null}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_smart_rules_user_enabled ON smart_rules(user_id, enabled);
CREATE INDEX idx_smart_rules_priority ON smart_rules(user_id, priority DESC);

-- Enable Row Level Security
ALTER TABLE smart_rules ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only see their own rules
CREATE POLICY "Users can view own rules" ON smart_rules
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can only insert rules for themselves
CREATE POLICY "Users can insert own rules" ON smart_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can only update their own rules
CREATE POLICY "Users can update own rules" ON smart_rules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can only delete their own rules
CREATE POLICY "Users can delete own rules" ON smart_rules
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_smart_rules_updated_at 
  BEFORE UPDATE ON smart_rules 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to authenticated users
GRANT ALL ON smart_rules TO authenticated;

-- Optional: Create a function to get rule statistics for the current user
CREATE OR REPLACE FUNCTION get_my_rule_statistics()
RETURNS TABLE (
  total_rules BIGINT,
  active_rules BIGINT,
  total_matches BIGINT,
  most_recent_match TEXT
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_rules,
    COUNT(*) FILTER (WHERE enabled = true)::BIGINT as active_rules,
    COALESCE(SUM((stats->>'matches')::INTEGER), 0)::BIGINT as total_matches,
    MAX(stats->>'last_matched')::TEXT as most_recent_match
  FROM smart_rules
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_my_rule_statistics TO authenticated;