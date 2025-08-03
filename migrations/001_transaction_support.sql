-- Migration: Add transaction support for atomic operations
-- Date: 2025-08-03
-- Description: Implements RPC functions for atomic financial operations

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Atomic Transfer Between Accounts
-- This ensures money is never lost during transfers
CREATE OR REPLACE FUNCTION transfer_funds(
    p_from_account_id UUID,
    p_to_account_id UUID,
    p_amount DECIMAL,
    p_description TEXT,
    p_user_id UUID
) RETURNS TABLE(
    from_transaction_id UUID,
    to_transaction_id UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_from_transaction_id UUID;
    v_to_transaction_id UUID;
    v_from_account_type TEXT;
    v_to_account_type TEXT;
    v_from_balance DECIMAL;
BEGIN
    -- Start transaction implicitly
    
    -- Verify accounts belong to user and get types
    SELECT 'cash' INTO v_from_account_type 
    FROM cash_accounts 
    WHERE id = p_from_account_id AND user_id = p_user_id;
    
    IF v_from_account_type IS NULL THEN
        SELECT 'debt' INTO v_from_account_type 
        FROM debt_accounts 
        WHERE id = p_from_account_id AND user_id = p_user_id;
    END IF;
    
    IF v_from_account_type IS NULL THEN
        SELECT 'investment' INTO v_from_account_type 
        FROM investment_accounts 
        WHERE id = p_from_account_id AND user_id = p_user_id;
    END IF;
    
    IF v_from_account_type IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::UUID, FALSE, 'Source account not found or unauthorized';
        RETURN;
    END IF;
    
    -- Similar check for destination account
    SELECT 'cash' INTO v_to_account_type 
    FROM cash_accounts 
    WHERE id = p_to_account_id AND user_id = p_user_id;
    
    IF v_to_account_type IS NULL THEN
        SELECT 'debt' INTO v_to_account_type 
        FROM debt_accounts 
        WHERE id = p_to_account_id AND user_id = p_user_id;
    END IF;
    
    IF v_to_account_type IS NULL THEN
        SELECT 'investment' INTO v_to_account_type 
        FROM investment_accounts 
        WHERE id = p_to_account_id AND user_id = p_user_id;
    END IF;
    
    IF v_to_account_type IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::UUID, FALSE, 'Destination account not found or unauthorized';
        RETURN;
    END IF;
    
    -- For cash accounts, check calculated balance
    IF v_from_account_type = 'cash' THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_from_balance
        FROM transactions
        WHERE account_id = p_from_account_id;
        
        IF v_from_balance < p_amount THEN
            RETURN QUERY SELECT NULL::UUID, NULL::UUID, FALSE, 'Insufficient funds';
            RETURN;
        END IF;
    END IF;
    
    -- Create withdrawal transaction
    INSERT INTO transactions (
        user_id, account_id, date, description, amount, category, cleared
    ) VALUES (
        p_user_id, 
        p_from_account_id, 
        CURRENT_DATE, 
        p_description || ' (Transfer Out)', 
        -p_amount, 
        'Transfer', 
        TRUE
    ) RETURNING id INTO v_from_transaction_id;
    
    -- Create deposit transaction
    INSERT INTO transactions (
        user_id, account_id, date, description, amount, category, cleared
    ) VALUES (
        p_user_id, 
        p_to_account_id, 
        CURRENT_DATE, 
        p_description || ' (Transfer In)', 
        p_amount, 
        'Transfer', 
        TRUE
    ) RETURNING id INTO v_to_transaction_id;
    
    -- Update debt account balances if applicable
    IF v_from_account_type = 'debt' THEN
        UPDATE debt_accounts 
        SET balance = balance + p_amount
        WHERE id = p_from_account_id;
    END IF;
    
    IF v_to_account_type = 'debt' THEN
        UPDATE debt_accounts 
        SET balance = balance - p_amount
        WHERE id = p_to_account_id;
    END IF;
    
    -- If we get here, everything succeeded
    RETURN QUERY SELECT v_from_transaction_id, v_to_transaction_id, TRUE, 'Transfer completed successfully';
    
EXCEPTION
    WHEN OTHERS THEN
        -- Any error will automatically rollback the transaction
        RETURN QUERY SELECT NULL::UUID, NULL::UUID, FALSE, 'Transfer failed: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Process Recurring Payment Atomically
CREATE OR REPLACE FUNCTION process_recurring_payment(
    p_bill_id UUID,
    p_user_id UUID
) RETURNS TABLE(
    transaction_id UUID,
    next_due_date DATE,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_bill RECORD;
    v_transaction_id UUID;
    v_next_due DATE;
    v_account_balance DECIMAL;
BEGIN
    -- Get bill details with lock
    SELECT * INTO v_bill
    FROM recurring_bills
    WHERE id = p_bill_id AND user_id = p_user_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, NULL::DATE, FALSE, 'Recurring bill not found';
        RETURN;
    END IF;
    
    IF NOT v_bill.active THEN
        RETURN QUERY SELECT NULL::UUID, NULL::DATE, FALSE, 'Recurring bill is not active';
        RETURN;
    END IF;
    
    -- Handle cash payment
    IF v_bill.payment_method = 'cash' THEN
        -- Check balance
        SELECT COALESCE(SUM(amount), 0) INTO v_account_balance
        FROM transactions
        WHERE account_id = v_bill.account_id;
        
        IF v_account_balance < v_bill.amount THEN
            RETURN QUERY SELECT NULL::UUID, NULL::DATE, FALSE, 'Insufficient funds in cash account';
            RETURN;
        END IF;
        
        -- Create payment transaction
        INSERT INTO transactions (
            user_id, account_id, date, description, amount, category, cleared
        ) VALUES (
            p_user_id,
            v_bill.account_id,
            CURRENT_DATE,
            v_bill.name || ' (Recurring)',
            -v_bill.amount,
            v_bill.category,
            TRUE
        ) RETURNING id INTO v_transaction_id;
        
    -- Handle credit card payment
    ELSIF v_bill.payment_method = 'credit' THEN
        -- Create charge transaction
        INSERT INTO transactions (
            user_id, account_id, date, description, amount, category, cleared
        ) VALUES (
            p_user_id,
            v_bill.debt_account_id,
            CURRENT_DATE,
            v_bill.name || ' (Recurring)',
            -v_bill.amount,
            'Debt',
            TRUE
        ) RETURNING id INTO v_transaction_id;
        
        -- Update debt balance
        UPDATE debt_accounts
        SET balance = balance + v_bill.amount
        WHERE id = v_bill.debt_account_id;
    END IF;
    
    -- Calculate next due date based on frequency
    CASE v_bill.frequency
        WHEN 'weekly' THEN
            v_next_due := v_bill.next_due + INTERVAL '1 week';
        WHEN 'biweekly' THEN
            v_next_due := v_bill.next_due + INTERVAL '2 weeks';
        WHEN 'monthly' THEN
            v_next_due := v_bill.next_due + INTERVAL '1 month';
        WHEN 'quarterly' THEN
            v_next_due := v_bill.next_due + INTERVAL '3 months';
        WHEN 'annually' THEN
            v_next_due := v_bill.next_due + INTERVAL '1 year';
        ELSE
            v_next_due := v_bill.next_due + INTERVAL '1 month';
    END CASE;
    
    -- Update next due date
    UPDATE recurring_bills
    SET next_due = v_next_due
    WHERE id = p_bill_id;
    
    RETURN QUERY SELECT v_transaction_id, v_next_due, TRUE, 'Payment processed successfully';
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT NULL::UUID, NULL::DATE, FALSE, 'Payment failed: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bulk Import Transactions Atomically
CREATE OR REPLACE FUNCTION bulk_import_transactions(
    p_transactions JSONB,
    p_user_id UUID
) RETURNS TABLE(
    imported_count INTEGER,
    failed_count INTEGER,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transaction JSONB;
    v_imported_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_account_id UUID;
    v_existing_count INTEGER;
BEGIN
    -- Validate input
    IF p_transactions IS NULL OR jsonb_array_length(p_transactions) = 0 THEN
        RETURN QUERY SELECT 0, 0, FALSE, 'No transactions provided';
        RETURN;
    END IF;
    
    -- Process each transaction
    FOR v_transaction IN SELECT * FROM jsonb_array_elements(p_transactions)
    LOOP
        BEGIN
            -- Validate account exists and belongs to user
            v_account_id := (v_transaction->>'account_id')::UUID;
            
            SELECT COUNT(*) INTO v_existing_count
            FROM cash_accounts
            WHERE id = v_account_id AND user_id = p_user_id;
            
            IF v_existing_count = 0 THEN
                -- Check debt accounts
                SELECT COUNT(*) INTO v_existing_count
                FROM debt_accounts
                WHERE id = v_account_id AND user_id = p_user_id;
            END IF;
            
            IF v_existing_count = 0 THEN
                v_failed_count := v_failed_count + 1;
                CONTINUE;
            END IF;
            
            -- Check for duplicate
            SELECT COUNT(*) INTO v_existing_count
            FROM transactions
            WHERE account_id = v_account_id
              AND date = (v_transaction->>'date')::DATE
              AND amount = (v_transaction->>'amount')::DECIMAL
              AND description = v_transaction->>'description';
            
            IF v_existing_count > 0 THEN
                v_failed_count := v_failed_count + 1;
                CONTINUE;
            END IF;
            
            -- Insert transaction
            INSERT INTO transactions (
                user_id, account_id, date, description, amount, 
                category, notes, cleared
            ) VALUES (
                p_user_id,
                v_account_id,
                (v_transaction->>'date')::DATE,
                v_transaction->>'description',
                (v_transaction->>'amount')::DECIMAL,
                COALESCE(v_transaction->>'category', 'Uncategorized'),
                v_transaction->>'notes',
                COALESCE((v_transaction->>'cleared')::BOOLEAN, FALSE)
            );
            
            v_imported_count := v_imported_count + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_failed_count := v_failed_count + 1;
        END;
    END LOOP;
    
    -- If all failed, rollback
    IF v_imported_count = 0 AND v_failed_count > 0 THEN
        RAISE EXCEPTION 'All transactions failed to import';
    END IF;
    
    RETURN QUERY SELECT 
        v_imported_count, 
        v_failed_count, 
        TRUE, 
        format('Imported %s transactions, %s failed', v_imported_count, v_failed_count);
        
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 0, v_failed_count, FALSE, 'Import failed: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION transfer_funds TO authenticated;
GRANT EXECUTE ON FUNCTION process_recurring_payment TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_import_transactions TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION transfer_funds IS 'Atomically transfers funds between accounts with automatic rollback on failure';
COMMENT ON FUNCTION process_recurring_payment IS 'Processes a recurring bill payment atomically, updating balances and next due date';
COMMENT ON FUNCTION bulk_import_transactions IS 'Imports multiple transactions atomically with duplicate detection';