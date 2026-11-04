-- Migration 015: Email Queue, Campaigns, Dead Letter Queue & Core Seed Fixtures

-- 1. email_campaigns table
CREATE TABLE IF NOT EXISTS email_campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    sent_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
    id SERIAL PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'transactional',
    campaign_id INTEGER REFERENCES email_campaigns(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    retry_timestamp TIMESTAMP WITH TIME ZONE,
    idempotency_key VARCHAR(255) UNIQUE,
    last_error TEXT,
    smtp_response TEXT,
    attachments JSONB,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. dead_letter_queue table
CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id SERIAL PRIMARY KEY,
    original_queue_id INTEGER,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    payload TEXT,
    final_error TEXT,
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexes for fast queue polling and idempotency
CREATE INDEX IF NOT EXISTS idx_email_queue_status_retry ON email_queue(status, retry_count, retry_timestamp);
CREATE INDEX IF NOT EXISTS idx_email_queue_idempotency ON email_queue(idempotency_key);

-- 5. Canonical franchises table
CREATE TABLE IF NOT EXISTS franchises (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    owner_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Canonical baseline franchise & branch seed fixtures
INSERT INTO franchises (id, name, status)
VALUES ('fra_rajnandgaon', 'Olive Pizza Rajnandgaon (Primary)', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO restaurant_branches (id, franchise_id, name, address, phone, is_open)
VALUES (
    'main_branch', 
    'fra_rajnandgaon', 
    'Rajnandgaon Main Branch', 
    'Station Road, Rajnandgaon, Chhattisgarh 491441', 
    '9179944445', 
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    franchise_id = EXCLUDED.franchise_id,
    is_open = TRUE;
