-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, name)
);

-- Create RLS policies
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own categories
CREATE POLICY "Users can view own categories" ON categories
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own categories
CREATE POLICY "Users can insert own categories" ON categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own categories
CREATE POLICY "Users can update own categories" ON categories
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own categories
CREATE POLICY "Users can delete own categories" ON categories
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_name ON categories(name);

-- Insert default categories for new users (optional)
-- This would need to be called when a new user signs up
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO categories (user_id, name, icon, color) VALUES
        (NEW.id, 'Income', '💰', '#10b981'),
        (NEW.id, 'Housing', '🏠', '#3b82f6'),
        (NEW.id, 'Transportation', '🚗', '#8b5cf6'),
        (NEW.id, 'Food', '🍔', '#f59e0b'),
        (NEW.id, 'Utilities', '💡', '#06b6d4'),
        (NEW.id, 'Healthcare', '🏥', '#ef4444'),
        (NEW.id, 'Entertainment', '🎬', '#ec4899'),
        (NEW.id, 'Shopping', '🛍️', '#f97316'),
        (NEW.id, 'Education', '📚', '#6366f1'),
        (NEW.id, 'Travel', '✈️', '#14b8a6'),
        (NEW.id, 'Insurance', '🛡️', '#84cc16'),
        (NEW.id, 'Savings', '🏦', '#22c55e'),
        (NEW.id, 'Investment', '📈', '#0ea5e9'),
        (NEW.id, 'Debt Payment', '💳', '#dc2626'),
        (NEW.id, 'Other', '📌', '#64748b');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to add default categories for new users
-- NOTE: Commented out as it may conflict with existing user setup
-- Uncomment if you want automatic category creation for new users
-- CREATE TRIGGER create_user_default_categories
--     AFTER INSERT ON auth.users
--     FOR EACH ROW
--     EXECUTE FUNCTION create_default_categories();