-- Migration: KPI Definitions and Threshold Management
-- Phase 2.5: Centralized KPI definitions and threshold rules
-- Created: 2026-01-23

-- KPI definitions (Key Performance Indicators)
CREATE TABLE IF NOT EXISTS kpi_definitions (
  id SERIAL PRIMARY KEY,
  kpi_code VARCHAR(50) UNIQUE NOT NULL,
  kpi_name VARCHAR(255) NOT NULL,
  kpi_category VARCHAR(50), -- Availability, Performance, Capacity, Quality, Security
  
  -- Measurement
  description TEXT,
  unit VARCHAR(50), -- %, ms, Mbps, GB, count, etc.
  data_type VARCHAR(50), -- gauge, counter, rate, percentage
  aggregation_method VARCHAR(50), -- avg, max, min, sum, count, p95, p99
  
  -- Display
  display_format VARCHAR(100), -- "0.00", "0.00%", "0.00 ms"
  chart_type VARCHAR(50) DEFAULT 'line', -- line, area, bar, gauge, pie
  color_good VARCHAR(20) DEFAULT '#4CAF50',
  color_warning VARCHAR(20) DEFAULT '#FF9800',
  color_critical VARCHAR(20) DEFAULT '#F44336',
  
  -- Thresholds (default values)
  default_warning_threshold DECIMAL(10, 2),
  default_critical_threshold DECIMAL(10, 2),
  threshold_comparison VARCHAR(10) DEFAULT '>',  -- >, <, >=, <=, ==, !=
  
  -- Calculation
  calculation_formula TEXT, -- For derived KPIs
  source_kpis VARCHAR(50)[], -- KPIs used in calculation
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_derived BOOLEAN DEFAULT FALSE, -- Calculated from other KPIs
  
  -- Metadata
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default KPIs
INSERT INTO kpi_definitions (kpi_code, kpi_name, kpi_category, unit, data_type, aggregation_method, 
                             default_warning_threshold, default_critical_threshold, threshold_comparison) VALUES
-- Availability KPIs
('availability', 'System Availability', 'Availability', '%', 'percentage', 'avg', 99.0, 95.0, '<'),
('uptime', 'System Uptime', 'Availability', 'hours', 'counter', 'sum', NULL, NULL, NULL),
('downtime', 'System Downtime', 'Availability', 'hours', 'counter', 'sum', 1.0, 4.0, '>'),

-- Network Performance KPIs
('bandwidth_in', 'Inbound Bandwidth', 'Performance', 'Mbps', 'gauge', 'avg', 80.0, 95.0, '>'),
('bandwidth_out', 'Outbound Bandwidth', 'Performance', 'Mbps', 'gauge', 'avg', 80.0, 95.0, '>'),
('bandwidth_utilization', 'Bandwidth Utilization', 'Performance', '%', 'percentage', 'avg', 80.0, 95.0, '>'),
('latency', 'Network Latency', 'Performance', 'ms', 'gauge', 'avg', 100.0, 200.0, '>'),
('jitter', 'Jitter', 'Quality', 'ms', 'gauge', 'avg', 30.0, 50.0, '>'),
('packet_loss', 'Packet Loss', 'Quality', '%', 'percentage', 'avg', 1.0, 5.0, '>'),
('network_speed', 'Network Speed', 'Performance', 'Mbps', 'gauge', 'avg', NULL, NULL, NULL),

-- System Performance KPIs
('cpu_utilization', 'CPU Utilization', 'Performance', '%', 'percentage', 'avg', 80.0, 95.0, '>'),
('memory_utilization', 'Memory Utilization', 'Performance', '%', 'percentage', 'avg', 85.0, 95.0, '>'),
('disk_utilization', 'Disk Utilization', 'Capacity', '%', 'percentage', 'avg', 80.0, 90.0, '>'),
('disk_iops', 'Disk IOPS', 'Performance', 'iops', 'gauge', 'avg', NULL, NULL, NULL),

-- Quality KPIs
('interface_errors', 'Interface Errors', 'Quality', 'count', 'counter', 'sum', 100, 1000, '>'),
('crc_errors', 'CRC Errors', 'Quality', 'count', 'counter', 'sum', 10, 100, '>'),
('collisions', 'Collisions', 'Quality', 'count', 'counter', 'sum', 50, 500, '>'),

-- Application Performance KPIs
('response_time', 'Response Time', 'Performance', 'ms', 'gauge', 'avg', 500.0, 2000.0, '>'),
('transactions_per_second', 'Transactions Per Second', 'Performance', 'tps', 'rate', 'avg', NULL, NULL, NULL),
('error_rate', 'Error Rate', 'Quality', '%', 'percentage', 'avg', 1.0, 5.0, '>'),

-- VoIP Quality KPIs
('mos_score', 'MOS Score', 'Quality', 'score', 'gauge', 'avg', 3.5, 3.0, '<'),
('voip_jitter', 'VoIP Jitter', 'Quality', 'ms', 'gauge', 'avg', 30.0, 50.0, '>'),
('voip_packet_loss', 'VoIP Packet Loss', 'Quality', '%', 'percentage', 'avg', 1.0, 3.0, '>'),

-- QoS KPIs
('qos_bandwidth_guaranteed', 'QoS Bandwidth Guaranteed', 'QoS', 'Mbps', 'gauge', 'avg', NULL, NULL, NULL),
('qos_priority_queue_depth', 'QoS Queue Depth', 'QoS', 'packets', 'gauge', 'avg', 100, 500, '>'),

-- Ping/HTTP Availability
('ping_success_rate', 'Ping Success Rate', 'Availability', '%', 'percentage', 'avg', 99.0, 95.0, '<'),
('http_availability', 'HTTP Availability', 'Availability', '%', 'percentage', 'avg', 99.0, 95.0, '<')

ON CONFLICT (kpi_code) DO NOTHING;

-- Threshold rules
CREATE TABLE IF NOT EXISTS threshold_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL,
  kpi_code VARCHAR(50) NOT NULL REFERENCES kpi_definitions(kpi_code),
  
  -- Scope (where to apply this rule)
  asset_id INTEGER REFERENCES assets(id), -- Specific device (NULL = all devices)
  customer_id INTEGER REFERENCES customers(id), -- All devices for customer
  location_id INTEGER REFERENCES customer_locations(id), -- All devices at location
  device_category VARCHAR(50), -- All devices of this category
  device_group_id INTEGER REFERENCES device_groups(id), -- All devices in group
  
  -- Threshold Values
  warning_threshold DECIMAL(10, 2),
  critical_threshold DECIMAL(10, 2),
  operator VARCHAR(10) NOT NULL, -- >, <, >=, <=, ==, !=
  
  -- Duration (threshold must be breached for this long)
  duration_seconds INTEGER DEFAULT 300, -- 5 minutes
  consecutive_breaches INTEGER DEFAULT 3, -- Must breach 3 times in a row
  
  -- Alert Configuration
  severity VARCHAR(50) DEFAULT 'warning', -- information, warning, error, critical
  alert_enabled BOOLEAN DEFAULT TRUE,
  
  -- Notification
  notification_enabled BOOLEAN DEFAULT TRUE,
  notification_channels JSONB, -- ['email', 'sms', 'webhook', 'slack']
  notification_recipients TEXT[], -- Array of emails/phone numbers
  
  -- Auto-remediation
  auto_remediate BOOLEAN DEFAULT FALSE,
  remediation_action VARCHAR(100), -- restart-service, run-script, etc.
  remediation_script TEXT,
  
  -- Schedule (when rule is active)
  active_hours VARCHAR(100), -- "09:00-17:00" or "00:00-23:59"
  active_days VARCHAR(50)[], -- ['Monday', 'Tuesday', ...]
  exclude_maintenance_windows BOOLEAN DEFAULT TRUE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered TIMESTAMP,
  trigger_count INTEGER DEFAULT 0,
  
  -- Metadata
  description TEXT,
  tags TEXT[],
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

-- Threshold breach history
CREATE TABLE IF NOT EXISTS threshold_breach_history (
  id BIGSERIAL PRIMARY KEY,
  threshold_rule_id INTEGER NOT NULL REFERENCES threshold_rules(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  kpi_code VARCHAR(50) NOT NULL,
  
  -- Breach Details
  breach_type VARCHAR(50), -- warning, critical
  threshold_value DECIMAL(10, 2),
  actual_value DECIMAL(10, 2),
  
  -- Context
  breach_started_at TIMESTAMP NOT NULL,
  breach_ended_at TIMESTAMP,
  breach_duration_seconds INTEGER,
  consecutive_breaches INTEGER,
  
  -- Alert
  alert_created BOOLEAN DEFAULT FALSE,
  alert_id INTEGER, -- Reference to alerts table
  
  -- Resolution
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- KPI metric aggregations (pre-calculated for performance)
CREATE TABLE IF NOT EXISTS kpi_metric_aggregations (
  id BIGSERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  kpi_code VARCHAR(50) NOT NULL,
  
  -- Time Window
  aggregation_period VARCHAR(50) NOT NULL, -- 5min, 15min, 1hour, 1day
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  
  -- Aggregated Values
  avg_value DECIMAL(10, 2),
  min_value DECIMAL(10, 2),
  max_value DECIMAL(10, 2),
  sum_value DECIMAL(10, 2),
  count_value INTEGER,
  p95_value DECIMAL(10, 2),
  p99_value DECIMAL(10, 2),
  
  -- Status
  breach_warning BOOLEAN DEFAULT FALSE,
  breach_critical BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_code ON kpi_definitions(kpi_code);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_category ON kpi_definitions(kpi_category);
CREATE INDEX IF NOT EXISTS idx_threshold_rules_kpi ON threshold_rules(kpi_code);
CREATE INDEX IF NOT EXISTS idx_threshold_rules_asset ON threshold_rules(asset_id);
CREATE INDEX IF NOT EXISTS idx_threshold_rules_customer ON threshold_rules(customer_id);
CREATE INDEX IF NOT EXISTS idx_threshold_rules_active ON threshold_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_threshold_breach_history_rule ON threshold_breach_history(threshold_rule_id);
CREATE INDEX IF NOT EXISTS idx_threshold_breach_history_asset ON threshold_breach_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_threshold_breach_history_started ON threshold_breach_history(breach_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_threshold_breach_history_resolved ON threshold_breach_history(is_resolved);
CREATE INDEX IF NOT EXISTS idx_kpi_metric_aggregations_asset_kpi ON kpi_metric_aggregations(asset_id, kpi_code);
CREATE INDEX IF NOT EXISTS idx_kpi_metric_aggregations_period ON kpi_metric_aggregations(period_start, period_end);

-- Views
CREATE OR REPLACE VIEW v_active_threshold_rules AS
SELECT 
  tr.id,
  tr.rule_name,
  kd.kpi_name,
  kd.kpi_category,
  tr.warning_threshold,
  tr.critical_threshold,
  tr.operator,
  tr.severity,
  a.name AS device_name,
  c.customer_name,
  tr.is_active,
  tr.last_triggered,
  tr.trigger_count
FROM threshold_rules tr
INNER JOIN kpi_definitions kd ON tr.kpi_code = kd.kpi_code
LEFT JOIN assets a ON tr.asset_id = a.id
LEFT JOIN customers c ON tr.customer_id = c.id
WHERE tr.is_active = TRUE;

CREATE OR REPLACE VIEW v_recent_threshold_breaches AS
SELECT 
  tbh.id,
  tr.rule_name,
  a.name AS device_name,
  a.ip_address,
  kd.kpi_name,
  tbh.breach_type,
  tbh.threshold_value,
  tbh.actual_value,
  tbh.breach_started_at,
  tbh.breach_ended_at,
  tbh.breach_duration_seconds,
  tbh.is_resolved,
  u.username AS resolved_by_user
FROM threshold_breach_history tbh
INNER JOIN threshold_rules tr ON tbh.threshold_rule_id = tr.id
INNER JOIN assets a ON tbh.asset_id = a.id
INNER JOIN kpi_definitions kd ON tbh.kpi_code = kd.kpi_code
LEFT JOIN users u ON tbh.resolved_by = u.id
WHERE tbh.breach_started_at > NOW() - INTERVAL '7 days'
ORDER BY tbh.breach_started_at DESC;

-- Functions
CREATE OR REPLACE FUNCTION check_threshold_breach(
  p_asset_id INTEGER,
  p_kpi_code VARCHAR,
  p_current_value DECIMAL
) RETURNS TABLE(
  rule_id INTEGER,
  breach_type VARCHAR,
  threshold_value DECIMAL,
  should_alert BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tr.id,
    CASE 
      WHEN p_current_value >= tr.critical_threshold AND tr.operator = '>=' THEN 'critical'
      WHEN p_current_value > tr.critical_threshold AND tr.operator = '>' THEN 'critical'
      WHEN p_current_value <= tr.critical_threshold AND tr.operator = '<=' THEN 'critical'
      WHEN p_current_value < tr.critical_threshold AND tr.operator = '<' THEN 'critical'
      WHEN p_current_value >= tr.warning_threshold AND tr.operator = '>=' THEN 'warning'
      WHEN p_current_value > tr.warning_threshold AND tr.operator = '>' THEN 'warning'
      WHEN p_current_value <= tr.warning_threshold AND tr.operator = '<=' THEN 'warning'
      WHEN p_current_value < tr.warning_threshold AND tr.operator = '<' THEN 'warning'
      ELSE 'normal'
    END AS breach_type,
    COALESCE(tr.critical_threshold, tr.warning_threshold) AS threshold_value,
    tr.alert_enabled AS should_alert
  FROM threshold_rules tr
  WHERE tr.is_active = TRUE
    AND tr.kpi_code = p_kpi_code
    AND (tr.asset_id = p_asset_id OR tr.asset_id IS NULL);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_applicable_thresholds(
  p_asset_id INTEGER,
  p_kpi_code VARCHAR
) RETURNS TABLE(
  rule_id INTEGER,
  rule_name VARCHAR,
  warning_threshold DECIMAL,
  critical_threshold DECIMAL,
  operator VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tr.id,
    tr.rule_name,
    tr.warning_threshold,
    tr.critical_threshold,
    tr.operator
  FROM threshold_rules tr
  INNER JOIN assets a ON (tr.asset_id = a.id OR tr.asset_id IS NULL)
  WHERE tr.is_active = TRUE
    AND tr.kpi_code = p_kpi_code
    AND a.id = p_asset_id
    AND (tr.customer_id IS NULL OR tr.customer_id = a.customer_id)
    AND (tr.location_id IS NULL OR tr.location_id = a.location_id)
  ORDER BY 
    CASE WHEN tr.asset_id IS NOT NULL THEN 1 ELSE 2 END, -- Specific rules first
    tr.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE kpi_definitions IS 'Centralized KPI definitions used across all monitoring modules';
COMMENT ON TABLE threshold_rules IS 'Configurable threshold rules for KPI monitoring and alerting';
COMMENT ON TABLE threshold_breach_history IS 'Historical record of all threshold breaches';
COMMENT ON TABLE kpi_metric_aggregations IS 'Pre-calculated KPI aggregations for performance';
COMMENT ON COLUMN threshold_rules.duration_seconds IS 'Breach must persist for this duration before alerting';
COMMENT ON COLUMN threshold_rules.consecutive_breaches IS 'Number of consecutive breaches required';
COMMENT ON FUNCTION check_threshold_breach IS 'Check if a KPI value breaches any thresholds';

-- Migration complete
-- Run: psql -U your_user -d ems_platform -f 007_add_kpi_thresholds.sql
