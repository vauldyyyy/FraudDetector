-- SQL Script for UPI Fraud Shield Transactions Table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.transactions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    merchant TEXT NOT NULL,
    fraud_score DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'CLEARED', -- 'CLEARED', 'FLAGGED', 'BLOCKED'
    device TEXT,
    hour INTEGER,
    indicators TEXT[], -- Array of strings for risk factors
    explanation TEXT,
    is_fraud BOOLEAN DEFAULT false
);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- Add some initial sample data (optional)
-- INSERT INTO transactions (amount, merchant, fraud_score, status, device, hour, indicators, explanation)
-- VALUES (12500, 'Premium Electronics', 0.85, 'BLOCKED', 'New Device', 14, ARRAY['NEW_DEVICE', 'HIGH_AMOUNT'], 'Security alert: Transaction blocked due to high amount on an unrecognized device.');
