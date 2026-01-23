-- Migration: Device/Node Management
-- Phase 2.2: Enhanced asset management with device-specific fields
-- Created: 2026-01-23

-- Device credentials (secured storage)
CREATE TABLE IF NOT EXISTS device_credentials (
  id SERIAL PRIMARY KEY,
  credential_name VARCHAR(255) NOT NULL,
  credential_type VARCHAR(50), -- SNMP, SSH, Telnet, WMI, API
  
  -- SNMP Credentials
  snmp_version VARCHAR(10), -- v1, v2c, v3
  snmp_community_encrypted TEXT,
  snmp_port INTEGER DEFAULT 161,
  
  -- SNMPv3 Specific
  snmp_auth_protocol VARCHAR(50), -- MD5, SHA
  snmp_auth_username VARCHAR(255),
  snmp_auth_password_encrypted TEXT,
  snmp_priv_protocol VARCHAR(50), -- DES, AES
  snmp_priv_password_encrypted TEXT,
  
  -- SSH/Telnet Credentials
  ssh_username VARCHAR(255),
  ssh_password_encrypted TEXT,
  ssh_port INTEGER DEFAULT 22,
  ssh_key_encrypted TEXT,
  
  -- WMI Credentials (Windows)
  wmi_username VARCHAR(255),
  wmi_password_encrypted TEXT,
  wmi_domain VARCHAR(255),
  
  -- API Credentials
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  api_endpoint VARCHAR(500),
  
  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id)
);

-- Enhance existing assets table with device-specific fields
-- Note: This assumes assets table already exists from Phase 0
ALTER TABLE assets ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES customer_locations(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS device_oem VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS device_model VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS device_serial VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS secondary_ip INET;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS mac_address MACADDR;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS hostname VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT FALSE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS criticality_level VARCHAR(50) DEFAULT 'normal'; -- critical, high, normal, low
ALTER TABLE assets ADD COLUMN IF NOT EXISTS monitoring_protocol VARCHAR(50); -- SNMP, WMI, SSH, API, ICMP
ALTER TABLE assets ADD COLUMN IF NOT EXISTS credentials_id INTEGER REFERENCES device_credentials(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS device_category VARCHAR(50); -- Router, Switch, Firewall, Server, Storage, etc.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS os_type VARCHAR(50); -- IOS, JunOS, Linux, Windows, etc.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS os_version VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS polling_interval INTEGER DEFAULT 300; -- seconds
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_monitored BOOLEAN DEFAULT TRUE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS monitoring_status VARCHAR(50) DEFAULT 'active'; -- active, paused, disabled
ALTER TABLE assets ADD COLUMN IF NOT EXISTS rack_location VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS physical_location TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_expiry DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes TEXT;

-- Device interfaces
CREATE TABLE IF NOT EXISTS device_interfaces (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  interface_name VARCHAR(255) NOT NULL,
  interface_alias VARCHAR(255),
  interface_index INTEGER, -- SNMP ifIndex
  interface_type VARCHAR(50), -- Ethernet, FastEthernet, GigabitEthernet, Serial, Virtual, etc.
  
  -- Network Configuration
  ip_address INET,
  subnet_mask INET,
  mac_address MACADDR,
  vlan_id INTEGER,
  
  -- Physical Properties
  speed_mbps INTEGER,
  duplex VARCHAR(20), -- full, half, auto
  mtu INTEGER DEFAULT 1500,
  
  -- Status
  admin_status VARCHAR(50) DEFAULT 'up', -- up, down
  operational_status VARCHAR(50) DEFAULT 'down', -- up, down, testing
  
  -- Monitoring
  is_monitored BOOLEAN DEFAULT TRUE,
  monitor_bandwidth BOOLEAN DEFAULT TRUE,
  monitor_errors BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP,
  
  UNIQUE(asset_id, interface_name)
);

-- Device interface metrics (for historical tracking)
CREATE TABLE IF NOT EXISTS device_interface_metrics (
  id BIGSERIAL PRIMARY KEY,
  interface_id INTEGER NOT NULL REFERENCES device_interfaces(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Traffic Counters
  bytes_in BIGINT,
  bytes_out BIGINT,
  packets_in BIGINT,
  packets_out BIGINT,
  
  -- Utilization
  bandwidth_in_mbps DECIMAL(10, 2),
  bandwidth_out_mbps DECIMAL(10, 2),
  utilization_in_percent DECIMAL(5, 2),
  utilization_out_percent DECIMAL(5, 2),
  
  -- Quality Metrics
  errors_in INTEGER,
  errors_out INTEGER,
  discards_in INTEGER,
  discards_out INTEGER,
  
  -- Status
  status VARCHAR(50)
);

-- Device groups (for organizing devices)
CREATE TABLE IF NOT EXISTS device_groups (
  id SERIAL PRIMARY KEY,
  group_name VARCHAR(255) NOT NULL UNIQUE,
  group_type VARCHAR(50), -- location, function, customer, custom
  description TEXT,
  parent_group_id INTEGER REFERENCES device_groups(id),
  icon VARCHAR(100),
  color VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id)
);

-- Device-Group mapping
CREATE TABLE IF NOT EXISTS device_group_members (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  added_by INTEGER REFERENCES users(id),
  UNIQUE(device_id, group_id)
);

-- Device maintenance windows
CREATE TABLE IF NOT EXISTS device_maintenance_windows (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES device_groups(id) ON DELETE CASCADE,
  window_name VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  recurrence_pattern VARCHAR(100), -- once, daily, weekly, monthly
  is_active BOOLEAN DEFAULT TRUE,
  suppress_alerts BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  CONSTRAINT device_or_group_required CHECK (device_id IS NOT NULL OR group_id IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_customer ON assets(customer_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_ip ON assets(ip_address);
CREATE INDEX IF NOT EXISTS idx_assets_critical ON assets(is_critical);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(device_category);
CREATE INDEX IF NOT EXISTS idx_assets_monitored ON assets(is_monitored);
CREATE INDEX IF NOT EXISTS idx_device_interfaces_asset ON device_interfaces(asset_id);
CREATE INDEX IF NOT EXISTS idx_device_interfaces_status ON device_interfaces(operational_status);
CREATE INDEX IF NOT EXISTS idx_device_interface_metrics_interface ON device_interface_metrics(interface_id);
CREATE INDEX IF NOT EXISTS idx_device_interface_metrics_timestamp ON device_interface_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_device_credentials_type ON device_credentials(credential_type);
CREATE INDEX IF NOT EXISTS idx_device_group_members_device ON device_group_members(device_id);
CREATE INDEX IF NOT EXISTS idx_device_group_members_group ON device_group_members(group_id);

-- View for device overview
CREATE OR REPLACE VIEW v_device_overview AS
SELECT 
  a.id,
  a.name AS device_name,
  a.ip_address,
  a.hostname,
  a.device_category,
  a.device_oem,
  a.device_model,
  a.is_critical,
  a.criticality_level,
  a.monitoring_status,
  c.customer_name,
  c.customer_code,
  l.location_name,
  l.city,
  l.state,
  COUNT(DISTINCT di.id) AS interface_count,
  COUNT(DISTINCT di.id) FILTER (WHERE di.operational_status = 'up') AS interfaces_up,
  a.created_at,
  a.status
FROM assets a
LEFT JOIN customers c ON a.customer_id = c.id
LEFT JOIN customer_locations l ON a.location_id = l.id
LEFT JOIN device_interfaces di ON a.id = di.asset_id
GROUP BY a.id, a.name, a.ip_address, a.hostname, a.device_category, a.device_oem,
         a.device_model, a.is_critical, a.criticality_level, a.monitoring_status,
         c.customer_name, c.customer_code, l.location_name, l.city, l.state, a.created_at, a.status;

-- View for critical devices
CREATE OR REPLACE VIEW v_critical_devices AS
SELECT 
  a.id,
  a.name AS device_name,
  a.ip_address,
  a.device_category,
  a.criticality_level,
  c.customer_name,
  l.location_name,
  a.status,
  a.monitoring_status
FROM assets a
LEFT JOIN customers c ON a.customer_id = c.id
LEFT JOIN customer_locations l ON a.location_id = l.id
WHERE a.is_critical = TRUE
  AND a.is_monitored = TRUE
ORDER BY a.status DESC, a.name;

-- Function to get device health summary
CREATE OR REPLACE FUNCTION get_device_health_summary(p_device_id INTEGER)
RETURNS TABLE(
  device_name VARCHAR,
  overall_status VARCHAR,
  interface_count BIGINT,
  interfaces_up BIGINT,
  interfaces_down BIGINT,
  last_check TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.name,
    a.status,
    COUNT(di.id) AS interface_count,
    COUNT(di.id) FILTER (WHERE di.operational_status = 'up') AS interfaces_up,
    COUNT(di.id) FILTER (WHERE di.operational_status = 'down') AS interfaces_down,
    MAX(di.last_seen) AS last_check
  FROM assets a
  LEFT JOIN device_interfaces di ON a.id = di.asset_id
  WHERE a.id = p_device_id
  GROUP BY a.name, a.status;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_device_credentials_updated_at BEFORE UPDATE ON device_credentials
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_interfaces_updated_at BEFORE UPDATE ON device_interfaces
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE device_credentials IS 'Encrypted storage for device access credentials';
COMMENT ON TABLE device_interfaces IS 'Network interfaces for each device';
COMMENT ON TABLE device_interface_metrics IS 'Historical metrics for device interfaces';
COMMENT ON TABLE device_groups IS 'Logical grouping of devices';
COMMENT ON TABLE device_maintenance_windows IS 'Scheduled maintenance windows (suppress alerts)';
COMMENT ON COLUMN assets.is_critical IS 'Mark device as business-critical';
COMMENT ON COLUMN assets.criticality_level IS 'Granular criticality: critical, high, normal, low';
COMMENT ON COLUMN assets.polling_interval IS 'SNMP polling interval in seconds';
COMMENT ON VIEW v_critical_devices IS 'Quick view of all critical devices';

-- Migration complete
-- Run: psql -U your_user -d ems_platform -f 004_add_device_management.sql
