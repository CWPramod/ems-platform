-- Fix traffic generation function with proper INET casting

DROP FUNCTION IF EXISTS generate_sample_traffic();

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
          ('192.168.1.' || (10 + (RANDOM() * 240)::INTEGER))::INET,
          ('10.0.0.' || (1 + (RANDOM() * 254)::INTEGER))::INET,
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

-- Now generate the traffic data
SELECT generate_sample_traffic();

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW mv_traffic_summary;
