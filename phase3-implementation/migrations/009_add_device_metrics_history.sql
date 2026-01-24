-- Phase 3: Device Metrics History Table
-- Migration: 009_add_device_metrics_history.sql
-- Purpose: Store time-series performance metrics for drill-down views

-- Create device_metrics_history table
CREATE TABLE IF NOT EXISTS device_metrics_history (
  id SERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL,
  value DECIMAL(15, 2) NOT NULL,
  unit VARCHAR(20),
  timestamp TIMESTAMP NOT NULL,
  aggregation_type VARCHAR(20) DEFAULT 'instant',
  collection_interval INTEGER DEFAULT 300,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_metrics_history_asset ON device_metrics_history(asset_id);
CREATE INDEX idx_metrics_history_timestamp ON device_metrics_history(timestamp);
CREATE INDEX idx_metrics_history_asset_time ON device_metrics_history(asset_id, timestamp);
CREATE INDEX idx_metrics_history_asset_type_time ON device_metrics_history(asset_id, metric_type, timestamp);
CREATE INDEX idx_metrics_history_type ON device_metrics_history(metric_type);

-- Create hypertable for time-series optimization (if TimescaleDB is available)
-- This is optional and will fail gracefully if TimescaleDB is not installed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('device_metrics_history', 'timestamp', if_not_exists => TRUE);
  END IF;
END $$;

-- Create function to generate sample metrics for testing
CREATE OR REPLACE FUNCTION generate_sample_metrics(
  p_asset_id UUID,
  p_hours INTEGER DEFAULT 24
)
RETURNS void AS $$
DECLARE
  v_timestamp TIMESTAMP;
  v_cpu DECIMAL;
  v_memory DECIMAL;
  v_bandwidth_in DECIMAL;
  v_bandwidth_out DECIMAL;
BEGIN
  -- Generate metrics for the past N hours at 5-minute intervals
  FOR i IN 0..(p_hours * 12) LOOP
    v_timestamp := NOW() - (i * INTERVAL '5 minutes');
    
    -- Generate realistic varying metrics
    v_cpu := 20 + (RANDOM() * 60);
    v_memory := 40 + (RANDOM() * 40);
    v_bandwidth_in := 50 + (RANDOM() * 200);
    v_bandwidth_out := 30 + (RANDOM() * 150);
    
    -- Insert CPU metric
    INSERT INTO device_metrics_history (asset_id, metric_type, value, unit, timestamp, aggregation_type)
    VALUES (p_asset_id, 'cpu', v_cpu, 'percent', v_timestamp, 'instant');
    
    -- Insert Memory metric
    INSERT INTO device_metrics_history (asset_id, metric_type, value, unit, timestamp, aggregation_type)
    VALUES (p_asset_id, 'memory', v_memory, 'percent', v_timestamp, 'instant');
    
    -- Insert Bandwidth In metric
    INSERT INTO device_metrics_history (asset_id, metric_type, value, unit, timestamp, aggregation_type)
    VALUES (p_asset_id, 'bandwidth_in', v_bandwidth_in, 'mbps', v_timestamp, 'instant');
    
    -- Insert Bandwidth Out metric
    INSERT INTO device_metrics_history (asset_id, metric_type, value, unit, timestamp, aggregation_type)
    VALUES (p_asset_id, 'bandwidth_out', v_bandwidth_out, 'mbps', v_timestamp, 'instant');
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create view for recent metrics (last 24 hours)
CREATE OR REPLACE VIEW v_recent_device_metrics AS
SELECT 
  dmh.asset_id,
  a.name AS device_name,
  dmh.metric_type,
  dmh.value,
  dmh.unit,
  dmh.timestamp,
  dmh.aggregation_type
FROM device_metrics_history dmh
JOIN assets a ON dmh.asset_id = a.id
WHERE dmh.timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY dmh.timestamp DESC;

-- Create materialized view for hourly aggregates (for performance)
CREATE MATERIALIZED VIEW mv_device_metrics_hourly AS
SELECT 
  asset_id,
  metric_type,
  DATE_TRUNC('hour', timestamp) AS hour,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  COUNT(*) AS sample_count
FROM device_metrics_history
GROUP BY asset_id, metric_type, DATE_TRUNC('hour', timestamp)
ORDER BY asset_id, metric_type, hour DESC;

-- Create index on materialized view
CREATE INDEX idx_mv_metrics_hourly_asset_time ON mv_device_metrics_hourly(asset_id, hour);
CREATE INDEX idx_mv_metrics_hourly_type ON mv_device_metrics_hourly(metric_type);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_hourly_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_device_metrics_hourly;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE device_metrics_history IS 'Time-series storage for device performance metrics';
COMMENT ON COLUMN device_metrics_history.metric_type IS 'Type of metric: cpu, memory, bandwidth_in, bandwidth_out, latency, packet_loss';
COMMENT ON COLUMN device_metrics_history.aggregation_type IS 'How the metric was aggregated: instant, avg, min, max, sum';
COMMENT ON FUNCTION generate_sample_metrics IS 'Generate sample metrics data for testing drill-down views';
COMMENT ON VIEW v_recent_device_metrics IS 'Recent metrics from last 24 hours for quick queries';
COMMENT ON MATERIALIZED VIEW mv_device_metrics_hourly IS 'Pre-aggregated hourly metrics for performance';

-- Generate sample metrics for critical devices (for testing)
DO $$
DECLARE
  v_device RECORD;
BEGIN
  FOR v_device IN 
    SELECT id FROM assets WHERE tier = 1 AND "monitoringEnabled" = TRUE LIMIT 5
  LOOP
    PERFORM generate_sample_metrics(v_device.id, 24);
  END LOOP;
END $$;
