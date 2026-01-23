-- Migration: Customer Master with Hierarchy
-- Phase 2.1: Customers and Locations
-- Created: 2026-01-23

-- Customers table (supports HO and Branch hierarchy)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  customer_code VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_type VARCHAR(50) DEFAULT 'Branch', -- HO, Branch, Partner
  parent_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Contact Information
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  
  -- Address
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  postal_code VARCHAR(20),
  
  -- Business Information
  industry VARCHAR(100),
  company_size VARCHAR(50), -- Small, Medium, Large, Enterprise
  tax_id VARCHAR(100),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

-- Customer locations/branches
CREATE TABLE IF NOT EXISTS customer_locations (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  location_code VARCHAR(50) NOT NULL,
  location_name VARCHAR(255) NOT NULL,
  location_type VARCHAR(50) DEFAULT 'Branch', -- HO, Branch, Data Center, Office, Remote Site
  
  -- Address
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  postal_code VARCHAR(20),
  
  -- Geographic Coordinates (for map view)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Contact
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(customer_id, location_code)
);

-- Customer contacts (multiple contacts per customer)
CREATE TABLE IF NOT EXISTS customer_contacts (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_type VARCHAR(50), -- Primary, Billing, Technical, Support
  name VARCHAR(255) NOT NULL,
  designation VARCHAR(100),
  department VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Service Level Agreements (SLA) for customers
CREATE TABLE IF NOT EXISTS customer_slas (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sla_name VARCHAR(255) NOT NULL,
  sla_type VARCHAR(50), -- Availability, Response Time, Resolution Time
  target_value DECIMAL(10, 2) NOT NULL,
  measurement_unit VARCHAR(50), -- percentage, minutes, hours
  measurement_period VARCHAR(50), -- monthly, quarterly, yearly
  penalty_per_breach DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'INR',
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_parent ON customers(parent_customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customer_locations_customer ON customer_locations(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_locations_active ON customer_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_primary ON customer_contacts(is_primary);
CREATE INDEX IF NOT EXISTS idx_customer_slas_customer ON customer_slas(customer_id);

-- Function to get customer hierarchy
CREATE OR REPLACE FUNCTION get_customer_hierarchy(p_customer_id INTEGER)
RETURNS TABLE(
  level INTEGER,
  customer_id INTEGER,
  customer_name VARCHAR,
  customer_type VARCHAR,
  parent_id INTEGER
) AS $$
WITH RECURSIVE hierarchy AS (
  -- Base case: start with the given customer
  SELECT 
    0 AS level,
    c.id AS customer_id,
    c.customer_name,
    c.customer_type,
    c.parent_customer_id AS parent_id
  FROM customers c
  WHERE c.id = p_customer_id
  
  UNION ALL
  
  -- Recursive case: get children
  SELECT 
    h.level + 1,
    c.id,
    c.customer_name,
    c.customer_type,
    c.parent_customer_id
  FROM customers c
  INNER JOIN hierarchy h ON c.parent_customer_id = h.customer_id
)
SELECT * FROM hierarchy ORDER BY level, customer_name;
$$ LANGUAGE SQL;

-- Function to get all locations for a customer and its children
CREATE OR REPLACE FUNCTION get_customer_all_locations(p_customer_id INTEGER)
RETURNS TABLE(
  location_id INTEGER,
  customer_name VARCHAR,
  location_name VARCHAR,
  location_type VARCHAR,
  city VARCHAR,
  state VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.id AS location_id,
    c.customer_name,
    cl.location_name,
    cl.location_type,
    cl.city,
    cl.state
  FROM customer_locations cl
  INNER JOIN customers c ON cl.customer_id = c.id
  WHERE cl.customer_id IN (
    SELECT customer_id FROM get_customer_hierarchy(p_customer_id)
  )
  AND cl.is_active = TRUE
  ORDER BY c.customer_name, cl.location_name;
END;
$$ LANGUAGE plpgsql;

-- View for customer hierarchy with counts
CREATE OR REPLACE VIEW v_customer_hierarchy AS
SELECT 
  c.id,
  c.customer_code,
  c.customer_name,
  c.customer_type,
  c.parent_customer_id,
  p.customer_name AS parent_customer_name,
  COUNT(DISTINCT child.id) AS child_count,
  COUNT(DISTINCT l.id) AS location_count,
  COUNT(DISTINCT ct.id) AS contact_count,
  c.is_active,
  c.created_at
FROM customers c
LEFT JOIN customers p ON c.parent_customer_id = p.id
LEFT JOIN customers child ON child.parent_customer_id = c.id
LEFT JOIN customer_locations l ON c.id = l.customer_id AND l.is_active = TRUE
LEFT JOIN customer_contacts ct ON c.id = ct.customer_id AND ct.is_active = TRUE
GROUP BY c.id, c.customer_code, c.customer_name, c.customer_type, 
         c.parent_customer_id, p.customer_name, c.is_active, c.created_at;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_locations_updated_at BEFORE UPDATE ON customer_locations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE customers IS 'Customer master with support for HO-Branch hierarchy';
COMMENT ON TABLE customer_locations IS 'Physical locations/branches for customers';
COMMENT ON TABLE customer_contacts IS 'Multiple contact persons per customer';
COMMENT ON TABLE customer_slas IS 'Service Level Agreements for customers';
COMMENT ON COLUMN customers.parent_customer_id IS 'NULL for HO, references parent for branches';
COMMENT ON COLUMN customer_locations.latitude IS 'For map-based topology view';
COMMENT ON COLUMN customer_locations.longitude IS 'For map-based topology view';

-- Sample data (optional - for testing)
-- INSERT INTO customers (customer_code, customer_name, customer_type, contact_person, email, phone, city, state, country)
-- VALUES 
-- ('CUST001', 'Acme Corporation', 'HO', 'John Doe', 'john@acme.com', '+91-123-4567890', 'Mumbai', 'Maharashtra', 'India'),
-- ('CUST002', 'Tech Solutions Pvt Ltd', 'HO', 'Jane Smith', 'jane@techsol.com', '+91-987-6543210', 'Bangalore', 'Karnataka', 'India');

-- Migration complete
-- Run: psql -U your_user -d ems_platform -f 003_add_customer_master.sql
