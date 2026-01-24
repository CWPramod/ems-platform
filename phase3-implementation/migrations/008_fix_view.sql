-- Fix the view and insert statement with correct column names

-- Drop existing view if it exists
DROP VIEW IF EXISTS v_critical_devices_dashboard;

-- Create view for critical devices dashboard (with correct column casing)
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
  AND a."monitoringEnabled" = TRUE
ORDER BY dh.health_score ASC NULLS LAST, a.name ASC;

-- Initialize health records for existing critical devices (with correct column name)
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
WHERE tier = 1 AND "monitoringEnabled" = TRUE
ON CONFLICT (asset_id) DO NOTHING;

COMMENT ON VIEW v_critical_devices_dashboard IS 'Complete view of critical devices with health metrics for dashboard';
