-- Migration: Auto Discovery
-- Phase 2.3: Network discovery and device auto-detection
-- Created: 2026-01-23

-- Discovery jobs
CREATE TABLE IF NOT EXISTS discovery_jobs (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(255) NOT NULL,
  discovery_type VARCHAR(50) NOT NULL, -- network-scan, snmp-walk, topology, wireless
  
  -- Scan Configuration
  ip_range VARCHAR(100), -- CIDR notation: 192.168.1.0/24
  ip_ranges TEXT[], -- Multiple ranges
  customer_id INTEGER REFERENCES customers(id),
  location_id INTEGER REFERENCES customer_locations(id),
  credentials_id INTEGER REFERENCES device_credentials(id),
  
  -- Discovery Options
  scan_method VARCHAR(50) DEFAULT 'icmp', -- icmp, tcp, udp, snmp, all
  port_scan_enabled BOOLEAN DEFAULT FALSE,
  ports_to_scan INTEGER[] DEFAULT ARRAY[22, 23, 80, 443, 161, 3389],
  snmp_discovery_enabled BOOLEAN DEFAULT TRUE,
  ssh_discovery_enabled BOOLEAN DEFAULT FALSE,
  topology_discovery_enabled BOOLEAN DEFAULT FALSE, -- LLDP, CDP
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  progress_percent INTEGER DEFAULT 0,
  devices_found INTEGER DEFAULT 0,
  devices_added INTEGER DEFAULT 0,
  devices_skipped INTEGER DEFAULT 0,
  
  -- Execution Details
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  error_message TEXT,
  
  -- Schedule (for recurring discovery)
  is_scheduled BOOLEAN DEFAULT FALSE,
  cron_expression VARCHAR(100),
  next_run_at TIMESTAMP,
  last_run_at TIMESTAMP,
  
  -- Metadata
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Discovered devices (temporary storage before import)
CREATE TABLE IF NOT EXISTS discovered_devices (
  id SERIAL PRIMARY KEY,
  discovery_job_id INTEGER NOT NULL REFERENCES discovery_jobs(id) ON DELETE CASCADE,
  
  -- Basic Info
  ip_address INET NOT NULL,
  hostname VARCHAR(255),
  mac_address MACADDR,
  
  -- Device Classification
  device_type VARCHAR(50), -- Router, Switch, Firewall, Server, Printer, Unknown
  device_category VARCHAR(100),
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  os_info TEXT,
  serial_number VARCHAR(100),
  
  -- Discovery Details
  discovery_method VARCHAR(50), -- icmp, snmp, ssh, http
  response_time_ms INTEGER,
  
  -- Reachability
  icmp_reachable BOOLEAN DEFAULT FALSE,
  snmp_reachable BOOLEAN DEFAULT FALSE,
  ssh_reachable BOOLEAN DEFAULT FALSE,
  telnet_reachable BOOLEAN DEFAULT FALSE,
  http_reachable BOOLEAN DEFAULT FALSE,
  https_reachable BOOLEAN DEFAULT FALSE,
  
  -- Port Scan Results
  open_ports INTEGER[],
  
  -- SNMP Data (if available)
  snmp_sys_descr TEXT,
  snmp_sys_name VARCHAR(255),
  snmp_sys_object_id VARCHAR(255),
  snmp_sys_uptime BIGINT,
  snmp_sys_contact VARCHAR(255),
  snmp_sys_location VARCHAR(255),
  
  -- Status
  is_imported BOOLEAN DEFAULT FALSE,
  imported_asset_id INTEGER REFERENCES assets(id),
  import_status VARCHAR(50), -- pending, imported, skipped, error
  import_notes TEXT,
  
  -- Metadata
  discovered_at TIMESTAMP DEFAULT NOW(),
  confidence_score INTEGER DEFAULT 50 -- 0-100, how confident we are about the classification
);

-- Discovery topology links (from LLDP/CDP)
CREATE TABLE IF NOT EXISTS discovered_topology_links (
  id SERIAL PRIMARY KEY,
  discovery_job_id INTEGER NOT NULL REFERENCES discovery_jobs(id) ON DELETE CASCADE,
  source_device_id INTEGER REFERENCES discovered_devices(id),
  source_ip INET,
  source_interface VARCHAR(255),
  target_device_id INTEGER REFERENCES discovered_devices(id),
  target_ip INET,
  target_interface VARCHAR(255),
  link_type VARCHAR(50), -- LLDP, CDP, ARP, Manual
  protocol VARCHAR(50),
  discovered_at TIMESTAMP DEFAULT NOW()
);

-- Discovery exclusion rules (IPs/ranges to skip)
CREATE TABLE IF NOT EXISTS discovery_exclusions (
  id SERIAL PRIMARY KEY,
  exclusion_type VARCHAR(50), -- ip, range, subnet, hostname
  exclusion_value TEXT NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Discovery templates (save common discovery configurations)
CREATE TABLE IF NOT EXISTS discovery_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  discovery_type VARCHAR(50) NOT NULL,
  credentials_id INTEGER REFERENCES device_credentials(id),
  scan_method VARCHAR(50),
  port_scan_enabled BOOLEAN DEFAULT FALSE,
  ports_to_scan INTEGER[],
  snmp_discovery_enabled BOOLEAN DEFAULT TRUE,
  ssh_discovery_enabled BOOLEAN DEFAULT FALSE,
  topology_discovery_enabled BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_status ON discovery_jobs(status);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_customer ON discovery_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_created_at ON discovery_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_devices_job ON discovered_devices(discovery_job_id);
CREATE INDEX IF NOT EXISTS idx_discovered_devices_ip ON discovered_devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_discovered_devices_imported ON discovered_devices(is_imported);
CREATE INDEX IF NOT EXISTS idx_discovered_devices_type ON discovered_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_discovered_topology_job ON discovered_topology_links(discovery_job_id);
CREATE INDEX IF NOT EXISTS idx_discovery_exclusions_active ON discovery_exclusions(is_active);

-- View for discovery job summary
CREATE OR REPLACE VIEW v_discovery_job_summary AS
SELECT 
  dj.id,
  dj.job_name,
  dj.discovery_type,
  dj.status,
  dj.progress_percent,
  dj.devices_found,
  dj.devices_added,
  dj.devices_skipped,
  dj.started_at,
  dj.completed_at,
  dj.duration_seconds,
  c.customer_name,
  l.location_name,
  u.username AS created_by_user,
  dj.created_at
FROM discovery_jobs dj
LEFT JOIN customers c ON dj.customer_id = c.id
LEFT JOIN customer_locations l ON dj.location_id = l.id
LEFT JOIN users u ON dj.created_by = u.id
ORDER BY dj.created_at DESC;

-- View for discovered devices summary
CREATE OR REPLACE VIEW v_discovered_devices_summary AS
SELECT 
  dd.discovery_job_id,
  dd.device_type,
  dd.manufacturer,
  COUNT(*) AS device_count,
  COUNT(*) FILTER (WHERE dd.is_imported = TRUE) AS imported_count,
  COUNT(*) FILTER (WHERE dd.is_imported = FALSE) AS pending_count,
  AVG(dd.confidence_score) AS avg_confidence_score
FROM discovered_devices dd
GROUP BY dd.discovery_job_id, dd.device_type, dd.manufacturer;

-- Function to check if IP should be excluded
CREATE OR REPLACE FUNCTION is_ip_excluded(p_ip_address INET)
RETURNS BOOLEAN AS $$
DECLARE
  excluded BOOLEAN := FALSE;
BEGIN
  -- Check exact IP match
  IF EXISTS(
    SELECT 1 FROM discovery_exclusions 
    WHERE exclusion_type = 'ip' 
    AND exclusion_value = p_ip_address::TEXT 
    AND is_active = TRUE
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if IP is in excluded subnet/range
  IF EXISTS(
    SELECT 1 FROM discovery_exclusions 
    WHERE exclusion_type IN ('range', 'subnet')
    AND p_ip_address << exclusion_value::CIDR
    AND is_active = TRUE
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-classify device based on SNMP data
CREATE OR REPLACE FUNCTION classify_device(
  p_sys_descr TEXT,
  p_sys_object_id VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
  device_type VARCHAR(50) := 'Unknown';
BEGIN
  -- Router detection
  IF p_sys_descr ILIKE '%router%' OR p_sys_descr ILIKE '%cisco%' THEN
    device_type := 'Router';
  
  -- Switch detection
  ELSIF p_sys_descr ILIKE '%switch%' OR p_sys_descr ILIKE '%catalyst%' THEN
    device_type := 'Switch';
  
  -- Firewall detection
  ELSIF p_sys_descr ILIKE '%firewall%' OR p_sys_descr ILIKE '%asa%' THEN
    device_type := 'Firewall';
  
  -- Server detection
  ELSIF p_sys_descr ILIKE '%server%' OR p_sys_descr ILIKE '%linux%' OR p_sys_descr ILIKE '%windows%' THEN
    device_type := 'Server';
  
  -- Wireless AP detection
  ELSIF p_sys_descr ILIKE '%wireless%' OR p_sys_descr ILIKE '%access point%' THEN
    device_type := 'Wireless AP';
  
  -- Printer detection
  ELSIF p_sys_descr ILIKE '%printer%' OR p_sys_descr ILIKE '%jetdirect%' THEN
    device_type := 'Printer';
  
  -- Storage detection
  ELSIF p_sys_descr ILIKE '%storage%' OR p_sys_descr ILIKE '%netapp%' THEN
    device_type := 'Storage';
  END IF;
  
  RETURN device_type;
END;
$$ LANGUAGE plpgsql;

-- Function to update discovery job progress
CREATE OR REPLACE FUNCTION update_discovery_progress(
  p_job_id INTEGER,
  p_progress INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE discovery_jobs
  SET 
    progress_percent = p_progress,
    devices_found = (
      SELECT COUNT(*) FROM discovered_devices WHERE discovery_job_id = p_job_id
    )
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE discovery_jobs IS 'Network discovery job configurations and execution tracking';
COMMENT ON TABLE discovered_devices IS 'Temporary storage for discovered devices before import';
COMMENT ON TABLE discovered_topology_links IS 'Discovered network topology connections (LLDP/CDP)';
COMMENT ON TABLE discovery_exclusions IS 'IP addresses/ranges to exclude from discovery';
COMMENT ON TABLE discovery_templates IS 'Reusable discovery configuration templates';
COMMENT ON COLUMN discovered_devices.confidence_score IS 'Classification confidence: 0-100';
COMMENT ON FUNCTION is_ip_excluded IS 'Check if IP address should be skipped in discovery';
COMMENT ON FUNCTION classify_device IS 'Auto-classify device type based on SNMP sysDescr';

-- Migration complete
-- Run: psql -U your_user -d ems_platform -f 005_add_discovery_tables.sql
