-- Phase 3: Topology and Traffic Flow Tables
-- Migration: 010_add_topology_traffic_tables.sql
-- Purpose: Store network topology connections and traffic flow data

-- Create device_connections table
CREATE TABLE IF NOT EXISTS device_connections (
  id SERIAL PRIMARY KEY,
  source_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  source_interface_id INTEGER REFERENCES device_interfaces(id) ON DELETE SET NULL,
  destination_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  destination_interface_id INTEGER REFERENCES device_interfaces(id) ON DELETE SET NULL,
  connection_type VARCHAR(50) DEFAULT 'physical',
  link_speed_mbps INTEGER,
  link_status VARCHAR(20) DEFAULT 'up',
  protocol VARCHAR(50),
  bandwidth_utilization DECIMAL(5, 2),
  latency INTEGER DEFAULT 0,
  packet_loss DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  discovered_at TIMESTAMP,
  last_seen TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for device_connections
CREATE INDEX idx_connections_source ON device_connections(source_asset_id);
CREATE INDEX idx_connections_dest ON device_connections(destination_asset_id);
CREATE INDEX idx_connections_source_dest ON device_connections(source_asset_id, destination_asset_id);
CREATE INDEX idx_connections_status ON device_connections(link_status);

-- Create traffic_flows table
CREATE TABLE IF NOT EXISTS traffic_flows (
  id SERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  interface_id INTEGER REFERENCES device_interfaces(id) ON DELETE SET NULL,
  source_ip INET NOT NULL,
  destination_ip INET NOT NULL,
  source_port INTEGER,
  destination_port INTEGER,
  protocol VARCHAR(20) NOT NULL,
  bytes_in BIGINT DEFAULT 0,
  bytes_out BIGINT DEFAULT 0,
  packets_in BIGINT DEFAULT 0,
  packets_out BIGINT DEFAULT 0,
  flow_duration INTEGER DEFAULT 0,
  timestamp TIMESTAMP NOT NULL,
  aggregation_interval INTEGER DEFAULT 300,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for traffic_flows
CREATE INDEX idx_traffic_asset ON traffic_flows(asset_id);
CREATE INDEX idx_traffic_timestamp ON traffic_flows(timestamp);
CREATE INDEX idx_traffic_asset_time ON traffic_flows(asset_id, timestamp);
CREATE INDEX idx_traffic_ips ON traffic_flows(source_ip, destination_ip, timestamp);
CREATE INDEX idx_traffic_protocol ON traffic_flows(protocol);

-- Create view for network topology
CREATE OR REPLACE VIEW v_network_topology AS
SELECT 
  dc.id AS connection_id,
  sa.id AS source_id,
  sa.name AS source_name,
  sa.type AS source_type,
  sa.tier AS source_tier,
  sa.location AS source_location,
  da.id AS dest_id,
  da.name AS dest_name,
  da.type AS dest_type,
  da.tier AS dest_tier,
  da.location AS dest_location,
  dc.connection_type,
  dc.link_speed_mbps,
  dc.link_status,
  dc.bandwidth_utilization,
  dc.latency,
  dc.packet_loss
FROM device_connections dc
JOIN assets sa ON dc.source_asset_id = sa.id
JOIN assets da ON dc.destination_asset_id = da.id
WHERE dc.is_active = TRUE;

-- Create materialized view for traffic summary
CREATE MATERIALIZED VIEW mv_traffic_summary AS
SELECT 
  asset_id,
  protocol,
  DATE_TRUNC('hour', timestamp) AS hour,
  SUM(bytes_in + bytes_out) AS total_bytes,
  SUM(packets_in + packets_out) AS total_packets,
  COUNT(*) AS flow_count
FROM traffic_flows
GROUP BY asset_id, protocol, DATE_TRUNC('hour', timestamp)
ORDER BY asset_id, hour DESC;

CREATE INDEX idx_mv_traffic_asset_hour ON mv_traffic_summary(asset_id, hour);

-- Function to generate sample topology connections
CREATE OR REPLACE FUNCTION generate_sample_topology()
RETURNS void AS $$
DECLARE
  v_device1 RECORD;
  v_device2 RECORD;
  v_counter INTEGER := 0;
BEGIN
  -- Create connections between critical devices
  FOR v_device1 IN 
    SELECT id, type FROM assets 
    WHERE tier = 1 AND "monitoringEnabled" = TRUE 
    ORDER BY id LIMIT 5
  LOOP
    FOR v_device2 IN 
      SELECT id, type FROM assets 
      WHERE tier = 1 AND "monitoringEnabled" = TRUE AND id > v_device1.id
      ORDER BY id LIMIT 2
    LOOP
      INSERT INTO device_connections (
        source_asset_id,
        destination_asset_id,
        connection_type,
        link_speed_mbps,
        link_status,
        protocol,
        bandwidth_utilization,
        latency,
        packet_loss,
        discovered_at,
        last_seen
      ) VALUES (
        v_device1.id,
        v_device2.id,
        'physical',
        1000,
        'up',
        'LLDP',
        (RANDOM() * 80)::DECIMAL(5,2),
        (5 + RANDOM() * 50)::INTEGER,
        (RANDOM() * 2)::DECIMAL(5,2),
        NOW() - INTERVAL '1 day',
        NOW()
      );
      
      v_counter := v_counter + 1;
      EXIT WHEN v_counter >= 8;
    END LOOP;
    EXIT WHEN v_counter >= 8;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to generate sample traffic flows
CREATE OR REPLACE FUNCTION generate_sample_traffic()
RETURNS void AS $$
DECLARE
  v_device RECORD;
  v_hour INTEGER;
  v_proto VARCHAR;
BEGIN
  FOR v_device IN 
    SELECT id FROM assets WHERE tier = 1 AND "monitoringEnabled" = TRUE LIMIT 5
  LOOP
    FOR v_hour IN 0..23 LOOP
      FOR v_proto IN SELECT unnest(ARRAY['TCP', 'UDP', 'ICMP']) LOOP
        INSERT INTO traffic_flows (
          asset_id,
          source_ip,
          destination_ip,
          protocol,
          bytes_in,
          bytes_out,
          packets_in,
          packets_out,
          timestamp
        ) VALUES (
          v_device.id,
          '192.168.1.' || (10 + (RANDOM() * 240)::INTEGER),
          '10.0.0.' || (1 + (RANDOM() * 254)::INTEGER),
          v_proto,
          (1000000 + RANDOM() * 10000000)::BIGINT,
          (500000 + RANDOM() * 5000000)::BIGINT,
          (1000 + RANDOM() * 10000)::BIGINT,
          (500 + RANDOM() * 5000)::BIGINT,
          NOW() - (v_hour || ' hours')::INTERVAL
        );
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE device_connections IS 'Network topology connections between devices';
COMMENT ON TABLE traffic_flows IS 'Network traffic flow data for top talkers analysis';
COMMENT ON VIEW v_network_topology IS 'Complete network topology view for visualization';
COMMENT ON MATERIALIZED VIEW mv_traffic_summary IS 'Pre-aggregated traffic summary for performance';

-- Generate sample data
SELECT generate_sample_topology();
SELECT generate_sample_traffic();
REFRESH MATERIALIZED VIEW mv_traffic_summary;
