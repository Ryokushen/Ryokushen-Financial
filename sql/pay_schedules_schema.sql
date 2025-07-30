-- Pay Schedules Table Schema for Supabase
-- This table stores user pay schedule configurations for the calendar

-- Create the pay_schedules table
CREATE TABLE IF NOT EXISTS pay_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'bi-weekly', 'semi-monthly', 'monthly')),
  start_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  -- For semi-monthly, store the two days of month (e.g., 1 and 15)
  day_of_month_1 INTEGER CHECK (day_of_month_1 >= 1 AND day_of_month_1 <= 31),
  day_of_month_2 INTEGER CHECK (day_of_month_2 >= 1 AND day_of_month_2 <= 31),
  -- For weekly, store the day of week (0-6, where 0 is Sunday)
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_pay_schedules_user_active ON pay_schedules(user_id, is_active);

-- Enable Row Level Security
ALTER TABLE pay_schedules ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only see their own pay schedules
CREATE POLICY "Users can view own pay schedules" ON pay_schedules
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can only insert pay schedules for themselves
CREATE POLICY "Users can insert own pay schedules" ON pay_schedules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can only update their own pay schedules
CREATE POLICY "Users can update own pay schedules" ON pay_schedules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can only delete their own pay schedules
CREATE POLICY "Users can delete own pay schedules" ON pay_schedules
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_pay_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_pay_schedules_updated_at 
  BEFORE UPDATE ON pay_schedules 
  FOR EACH ROW 
  EXECUTE FUNCTION update_pay_schedules_updated_at();

-- Grant permissions to authenticated users
GRANT ALL ON pay_schedules TO authenticated;