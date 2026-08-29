-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- 1. USERS TABLE
-- =========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'owner', 'delivery')),
    name VARCHAR(255),
    phone VARCHAR(20),
    
    -- Onboarding Flags
    email_verified BOOLEAN DEFAULT FALSE,
    phone_setup_completed BOOLEAN DEFAULT FALSE,
    location_setup_completed BOOLEAN DEFAULT FALSE,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    
    -- Location Data
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    full_address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 2. MENU ITEMS TABLE
-- =========================================
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) CHECK (category IN ('pizza', 'sides', 'beverage', 'dessert')),
    base_price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    is_vegetarian BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 3. ORDERS TABLE
-- =========================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    delivery_partner_id UUID REFERENCES users(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
    
    -- Snapshot of delivery address at time of order
    delivery_address_line TEXT NOT NULL,
    delivery_landmark VARCHAR(255),
    delivery_pincode VARCHAR(20),
    contact_phone VARCHAR(20) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 4. ORDER ITEMS TABLE (Many-to-One with Orders)
-- =========================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id),
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    size VARCHAR(50),
    crust VARCHAR(100),
    image_url TEXT
);

-- =========================================
-- 5. LIVE DELIVERIES TRACKING
-- =========================================
CREATE TABLE active_deliveries (
    order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    delivery_partner_id UUID REFERENCES users(id),
    current_lat DECIMAL(10, 8) NOT NULL,
    current_lng DECIMAL(11, 8) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 6. DEVICE HEARTBEATS
-- =========================================
CREATE TABLE device_heartbeats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255),
    browser VARCHAR(100),
    platform VARCHAR(100),
    app_version VARCHAR(50),
    is_online BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notification_ready BOOLEAN DEFAULT TRUE,
    battery_level DOUBLE PRECISION,
    connection_quality VARCHAR(50)
);

-- =========================================
-- 7. NOTIFICATION QUEUE (Ultra-lightweight)
-- =========================================
CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'opened', 'action_performed', 'failed')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'silent')),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- 8. NOTIFICATION HISTORY (Aggressive pruning)
-- =========================================
CREATE TABLE notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    body TEXT,
    category VARCHAR(50),
    status VARCHAR(50) DEFAULT 'delivered',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- =========================================
-- MOCK DATA (SEEDING)
-- =========================================

-- Insert Owner
INSERT INTO users (firebase_uid, email, role, name, onboarding_completed)
VALUES ('firebase-owner-id-123', 'olivepizzarjn@gmail.com', 'owner', 'Olive Pizza Admin', TRUE);

-- Insert Menu Items
INSERT INTO menu_items (name, description, category, base_price, image_url, is_vegetarian) VALUES
('Margherita Supreme', 'Classic delight with 100% real mozzarella cheese', 'pizza', 299.00, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80', TRUE),
('Pepperoni Feast', 'Double pepperoni with extra cheese', 'pizza', 449.00, 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80', FALSE),
('Farmhouse Special', 'Onion, crisp capsicum, mushroom & fresh tomato', 'pizza', 399.00, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80', TRUE),
('Spicy Paneer Tikka', 'Spicy paneer, crisp capsicum & red paprika', 'pizza', 429.00, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80', TRUE),
('Garlic Breadsticks', 'Freshly baked garlic bread with cheese dip', 'sides', 149.00, 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?auto=format&fit=crop&w=800&q=80', TRUE),
('Choco Lava Cake', 'Hot chocolate pudding with a gooey chocolate center', 'dessert', 129.00, 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&w=800&q=80', TRUE);
