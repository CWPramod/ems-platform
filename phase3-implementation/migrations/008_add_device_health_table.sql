-- Phase 3: Device Health Tracking Table
-- Migration: 008_add_device_health_table.sql
-- Purpose: Track real-time health status and metrics for critical devices

-- Create device_health table
CREATE TABLE IF NOT EXISTS device_health (
  id SERIAL PRIMARY KEY,
  asset_id UUID NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'unknown',
  health_score DECIMAL(5, 2) DEFAULT 0,
  is_critical BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP,
  response_time_ms INTEGER,
  
  -- Performance Metrics
  cpu_utilization DECIMAL(5, 2),
  memory_utilization DECIMAL(5, 2),
  disk_utilization DECIMAL(5, 2),
  bandwidth_in_mbps DECIMAL(10, 2),
  bandwidth_out_mbps DECIMAL(10, 2),
  packet_loss_percent DECIMAL(5, 2),
  latency_ms DECIMAL(10, 2),
  
  -- Interface Status
  total_interfaces INTEGER DEFAULT 0,
  interfaces_up INTEGER DEFAULT 0,
  interfaces_down INTEGER DEFAULT 0,
  
  -- Alerts
  active_alerts_count INTEGER DEFAULT 0,
  critical_alerts_count INTEGER DEFAULT 0,
  warning_alerts_count INTEGER DEFAULT 0,
  
  -- Availability
  uptime_percent_24h DECIMAL(5, 2),
  uptime_percent_7d DECIMAL(5, 2),
  uptime_percent_30d DECIMAL(5, 2),
  
  -- SLA
  sla_compliance BOOLEAN DEFAULT TRUE,
  sla_target_percent DECIMAL(5, 2),
  
  last_health_check TIMESTAMP,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_device_health_asset ON device_health(asset_id);
CREATE INDEX idx_device_health_status ON device_health(status);
CREATE INDEX idx_device_health_critical ON device_health(is_critical);
CREATE INDEX idx_device_health_score ON device_health(health_score);
CREATE INDEX idx_device_health_alerts ON device_health(active_alerts_count);

-- Create view for critical devices dashboard
CREATE OR REPLACE VIEW v_critical_devices_dashboard AS
SELECT 
  a.id AS asset_id,
  a.name AS device_name,
  a.type AS device_type,
  a.ip AS ip_address,
  a.location,
  a.vendor,
  a.model,
  a.tier,
  a.status AS asset_status,
  dh.status AS health_status,
  dh.health_score,
  dh.last_seen,
  dh.cpu_utilization,
  dh.memory_utilization,
  dh.bandwidth_in_mbps,
  dh.bandwidth_out_mbps,
  dh.active_alerts_count,
  dh.critical_alerts_count,
  dh.warning_alerts_count,
  dh.uptime_percent_24h,
  dh.uptime_percent_7d,
  dh.uptime_percent_30d,
  dh.sla_compliance,
  dh.interfaces_up,
  dh.interfaces_down,
  dh.total_interfaces,
  dh.last_health_check
FROM assets a
LEFT JOIN device_health dh ON a.id = dh.asset_id
WHERE a.tier = 1 
  AND a.monitoringEnabled = TRUE
ORDER BY dh.health_score ASC NULLS LAST, a.name ASC;

-- Create function to update health timestamp
CREATE OR REPLACE FUNCTION update_device_health_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating timestamp
CREATE TRIGGER trigger_update_device_health_timestamp
  BEFORE UPDATE ON device_health
  FOR EACH ROW
  EXECUTE FUNCTION update_device_health_timestamp();

-- Comments
COMMENT ON TABLE device_health IS 'Real-time health status and metrics for monitored devices';
COMMENT ON COLUMN device_health.health_score IS 'Overall health score from 0-100';
COMMENT ON COLUMN device_health.is_critical IS 'Whether this is a critical/tier-1 device';
COMMENT ON VIEW v_critical_devices_dashboard IS 'Complete view of critical devices with health metrics for dashboard';

-- Initialize health records for existing critical devices
INSERT INTO device_health (asset_id, is_critical, status, health_score)
SELECT 
  id,
  TRUE,
  CASE 
    WHEN status = 'online' THEN 'online'
    WHEN status = 'offline' THEN 'offline'
    ELSE 'unknown'
  END,
  CASE 
    WHEN status = 'online' THEN 100
    WHEN status = 'offline' THEN 0
    ELSE 50
  END
FROM assets
WHERE tier = 1 AND monitoringEnabled = TRUE
ON CONFLICT (asset_id) DO NOTHING;
