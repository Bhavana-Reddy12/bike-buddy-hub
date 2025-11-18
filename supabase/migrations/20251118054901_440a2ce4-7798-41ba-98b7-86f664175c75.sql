-- 1. Create Enum for Bike Status
CREATE TYPE bike_status_enum AS ENUM ('AVAILABLE', 'RENTED', 'IN_REPAIR');

-- 2. Create Bikes Table
CREATE TABLE bikes (
    bike_id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    hourly_rate NUMERIC(10, 2) NOT NULL,
    status bike_status_enum NOT NULL DEFAULT 'AVAILABLE',
    last_maintenance_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- 3. Create Customers Table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- 4. Create Rentals Table
CREATE TABLE rentals (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    bike_id TEXT REFERENCES bikes(bike_id),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_returned BOOLEAN DEFAULT FALSE,
    duration_hours INTEGER,
    final_cost NUMERIC(10, 2)
);

-- 5. Enable Row Level Security (for staff access only in this case)
ALTER TABLE bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

-- 6. Create public access policies (since this is a staff tool)
CREATE POLICY "Allow all operations on bikes" ON bikes FOR ALL USING (true);
CREATE POLICY "Allow all operations on customers" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all operations on rentals" ON rentals FOR ALL USING (true);

-- 7. Create indexes for better query performance
CREATE INDEX idx_bikes_status ON bikes(status);
CREATE INDEX idx_rentals_is_returned ON rentals(is_returned);
CREATE INDEX idx_rentals_customer_id ON rentals(customer_id);
CREATE INDEX idx_rentals_bike_id ON rentals(bike_id);