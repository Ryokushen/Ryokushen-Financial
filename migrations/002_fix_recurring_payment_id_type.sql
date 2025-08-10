-- Migration: Fix recurring payment function to accept integer IDs
-- Date: 2025-08-10
-- Description: Updates process_recurring_payment to accept INTEGER instead of UUID for bill_id
-- Issue: Recurring bills table uses integer IDs, not UUIDs

-- Drop the existing function first
DROP FUNCTION IF EXISTS process_recurring_payment(UUID, UUID);

-- Recreate with correct parameter type
CREATE OR REPLACE FUNCTION process_recurring_payment(
    p_bill_id INTEGER,  -- Changed from UUID to INTEGER
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_recurring_payment(INTEGER, UUID) TO authenticated;

-- Update comment
COMMENT ON FUNCTION process_recurring_payment(INTEGER, UUID) IS 'Processes a recurring bill payment atomically, updating balances and next due date. Accepts integer bill ID.';