-- Fix Device Interfaces and Related Tables for UUID Asset IDs
-- Run this to fix the foreign key type mismatches

-- Create device_interfaces with UUID asset_id
CREATE TABLE IF NOT EXISTS device_interfaces (
  id SERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  interface_name VARCHAR(255) NOT NULL,
  interface_alias VARCHAR(255),
  interface_index INTEGER,
  interface_type VARCHAR(50),
  ip_address INET,
  subnet_mask INET,
  mac_address MACADDR,
  vlan_id INTEGER,
  speed_mbps INTEGER,
  duplex VARCHAR(20),
  mtu INTEGER DEFAULT 1500,
  admin_status VARCHAR(50) DEFAULT 'up',
  operational_status VARCHAR(50) DEFAULT 'down',
  is_monitored BOOLEAN DEFAULT TRUE,
  monitor_bandwidth BOOLEAN DEFAULT TRUE,
  monitor_errors BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP,
  UNIQUE(asset_id, interface_name)
);

-- Create device_interface_metrics with proper foreign key
CREATE TABLE IF NOT EXISTS device_interface_metrics (
  id BIGSERIAL PRIMARY KEY,
  interface_id INTEGER NOT NULL REFERENCES device_interfaces(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  bytes_in BIGINT,
  bytes_out BIGINT,
  packets_in BIGINT,
  packets_out BIGINT,
  bandwidth_in_mbps DECIMAL(10, 2),
  bandwidth_out_mbps DECIMAL(10, 2),
  utilization_in_percent DECIMAL(5, 2),
  utilization_out_percent DECIMAL(5, 2),
  errors_in INTEGER,
  errors_out INTEGER,
  discards_in INTEGER,
  discards_out INTEGER,
  status VARCHAR(50)
);

-- Fix device_group_members
CREATE TABLE IF NOT EXISTS device_group_members (
  id SERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  added_by INTEGER REFERENCES users(id),
  UNIQUE(device_id, group_id)
);

-- Fix device_maintenance_windows
CREATE TABLE IF NOT EXISTS device_maintenance_windows (
  id SERIAL PRIMARY KEY,
  device_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES device_groups(id) ON DELETE CASCADE,
  window_name VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  recurrence_pattern VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  suppress_alerts BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  CONSTRAINT device_or_group_required CHECK (device_id IS NOT NULL OR group_id IS NOT NULL)
);

-- Fix discovered_devices
DROP TABLE IF EXISTS discovered_devices CASCADE;
CREATE TABLE discovered_devices (
  id SERIAL PRIMARY KEY,
  discovery_job_id INTEGER NOT NULL REFERENCES discovery_jobs(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  hostname VARCHAR(255),
  mac_address MACADDR,
  device_type VARCHAR(50),
  device_category VARCHAR(100),
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  os_info TEXT,
  serial_number VARCHAR(100),
  discovery_method VARCHAR(50),
  response_time_ms INTEGER,
  icmp_reachable BOOLEAN DEFAULT FALSE,
  snmp_reachable BOOLEAN DEFAULT FALSE,
  ssh_reachable BOOLEAN DEFAULT FALSE,
  telnet_reachable BOOLEAN DEFAULT FALSE,
  http_reachable BOOLEAN DEFAULT FALSE,
  https_reachable BOOLEAN DEFAULT FALSE,
  open_ports INTEGER[],
  snmp_sys_descr TEXT,
  snmp_sys_name VARCHAR(255),
  snmp_sys_object_id VARCHAR(255),
  snmp_sys_uptime BIGINT,
  snmp_sys_contact VARCHAR(255),
  snmp_sys_location VARCHAR(255),
  is_imported BOOLEAN DEFAULT FALSE,
  imported_asset_id UUID REFERENCES assets(id),
  import_status VARCHAR(50),
  import_notes TEXT,
  discovered_at TIMESTAMP DEFAULT NOW(),
  confidence_score INTEGER DEFAULT 50
);

-- Fix config tables
DROP TABLE IF EXISTS config_deployment_results CASCADE;
CREATE TABLE config_deployment_results (
  id SERIAL PRIMARY KEY,
  deployment_id INTEGER NOT NULL REFERENCES config_deployments(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id),
  status VARCHAR(50),
  config_deployed TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  error_message TEXT,
  error_code VARCHAR(50),
  command_output TEXT,
  rollback_performed BOOLEAN DEFAULT FALSE,
  rollback_status VARCHAR(50)
);

DROP TABLE IF EXISTS config_backups CASCADE;
CREATE TABLE config_backups (
  id SERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  backup_type VARCHAR(50) DEFAULT 'scheduled',
  backup_method VARCHAR(50),
  config_content TEXT NOT NULL,
  config_format VARCHAR(50) DEFAULT 'text',
  file_size_kb INTEGER,
  file_hash VARCHAR(64),
  file_path VARCHAR(500),
  storage_location VARCHAR(50) DEFAULT 'database',
  diff_from_previous TEXT,
  has_changes BOOLEAN DEFAULT FALSE,
  backed_up_at TIMESTAMP DEFAULT NOW(),
  backed_up_by INTEGER REFERENCES users(id),
  notes TEXT
);

DROP TABLE IF EXISTS config_change_history CASCADE;
CREATE TABLE config_change_history (
  id SERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  change_type VARCHAR(50),
  config_before TEXT,
  config_after TEXT,
  config_diff TEXT,
  deployment_id INTEGER REFERENCES config_deployments(id),
  backup_id INTEGER REFERENCES config_backups(id),
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  change_reason TEXT,
  approval_status VARCHAR(50),
  approved_by INTEGER REFERENCES users(id)
);

DROP TABLE IF EXISTS config_compliance_results CASCADE;
CREATE TABLE config_compliance_results (
  id SERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES config_compliance_rules(id) ON DELETE CASCADE,
  backup_id INTEGER REFERENCES config_backups(id),
  is_compliant BOOLEAN,
  violation_details TEXT,
  recommendation TEXT,
  status VARCHAR(50) DEFAULT 'open',
  remediation_status VARCHAR(50),
  checked_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  acknowledged_by INTEGER REFERENCES users(id)
);

-- Fix threshold tables
DROP TABLE IF EXISTS threshold_rules CASCADE;
CREATE TABLE threshold_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL,
  kpi_code VARCHAR(50) NOT NULL REFERENCES kpi_definitions(kpi_code),
  asset_id UUID REFERENCES assets(id),
  customer_id INTEGER REFERENCES customers(id),
  location_id INTEGER REFERENCES customer_locations(id),
  device_category VARCHAR(50),
  device_group_id INTEGER REFERENCES device_groups(id),
  warning_threshold DECIMAL(10, 2),
  critical_threshold DECIMAL(10, 2),
  operator VARCHAR(10) NOT NULL,
  duration_seconds INTEGER DEFAULT 300,
  consecutive_breaches INTEGER DEFAULT 3,
  severity VARCHAR(50) DEFAULT 'warning',
  alert_enabled BOOLEAN DEFAULT TRUE,
  notification_enabled BOOLEAN DEFAULT TRUE,
  notification_channels JSONB,
  notification_recipients TEXT[],
  auto_remediate BOOLEAN DEFAULT FALSE,
  remediation_action VARCHAR(100),
  remediation_script TEXT,
  active_hours VARCHAR(100),
  active_days VARCHAR(50)[],
  exclude_maintenance_windows BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered TIMESTAMP,
  trigger_count INTEGER DEFAULT 0,
  description TEXT,
  tags TEXT[],
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

DROP TABLE IF EXISTS threshold_breach_history CASCADE;
CREATE TABLE threshold_breach_history (
  id BIGSERIAL PRIMARY KEY,
  threshold_rule_id INTEGER NOT NULL REFERENCES threshold_rules(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  kpi_code VARCHAR(50) NOT NULL,
  breach_type VARCHAR(50),
  threshold_value DECIMAL(10, 2),
  actual_value DECIMAL(10, 2),
  breach_started_at TIMESTAMP NOT NULL,
  breach_ended_at TIMESTAMP,
  breach_duration_seconds INTEGER,
  consecutive_breaches INTEGER,
  alert_created BOOLEAN DEFAULT FALSE,
  alert_id INTEGER,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS kpi_metric_aggregations CASCADE;
CREATE TABLE kpi_metric_aggregations (
  id BIGSERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  kpi_code VARCHAR(50) NOT NULL,
  aggregation_period VARCHAR(50) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  avg_value DECIMAL(10, 2),
  min_value DECIMAL(10, 2),
  max_value DECIMAL(10, 2),
  sum_value DECIMAL(10, 2),
  count_value INTEGER,
  p95_value DECIMAL(10, 2),
  p99_value DECIMAL(10, 2),
  breach_warning BOOLEAN DEFAULT FALSE,
  breach_critical BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create all indexes
CREATE INDEX IF NOT EXISTS idx_device_interfaces_asset ON device_interfaces(asset_id);
CREATE INDEX IF NOT EXISTS idx_device_interface_metrics_interface ON device_interface_metrics(interface_id);
CREATE INDEX IF NOT EXISTS idx_device_group_members_device ON device_group_members(device_id);
CREATE INDEX IF NOT EXISTS idx_discovered_devices_job ON discovered_devices(discovery_job_id);
CREATE INDEX IF NOT EXISTS idx_config_deployment_results_asset ON config_deployment_results(asset_id);
CREATE INDEX IF NOT EXISTS idx_config_backups_asset ON config_backups(asset_id);
CREATE INDEX IF NOT EXISTS idx_config_change_history_asset ON config_change_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_config_compliance_results_asset ON config_compliance_results(asset_id);
CREATE INDEX IF NOT EXISTS idx_threshold_rules_asset ON threshold_rules(asset_id);
CREATE INDEX IF NOT EXISTS idx_threshold_breach_history_asset ON threshold_breach_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_kpi_metric_aggregations_asset ON kpi_metric_aggregations(asset_id);

COMMENT ON TABLE device_interfaces IS 'Network interfaces for devices (UUID asset_id)';
COMMENT ON TABLE threshold_rules IS 'Threshold rules supporting UUID asset references';
