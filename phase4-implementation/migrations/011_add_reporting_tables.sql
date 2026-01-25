-- Phase 4: Reporting & Analytics Tables
-- Migration: 011_add_reporting_tables.sql
-- Purpose: Create tables for reports, schedules, history, and custom dashboards

-- Create report_definitions table
CREATE TABLE IF NOT EXISTS report_definitions (
  id SERIAL PRIMARY KEY,
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  description TEXT,
  format VARCHAR(50) DEFAULT 'pdf',
  parameters JSONB NOT NULL,
  filters JSONB,
  columns JSONB,
  sorting JSONB,
  grouping JSONB,
  include_charts BOOLEAN DEFAULT TRUE,
  include_summary BOOLEAN DEFAULT TRUE,
  is_template BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create report_schedules table
CREATE TABLE IF NOT EXISTS report_schedules (
  id SERIAL PRIMARY KEY,
  report_definition_id INTEGER NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  schedule_name VARCHAR(255) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  cron_expression VARCHAR(100),
  time_of_day TIME,
  day_of_week INTEGER,
  day_of_month INTEGER,
  recipients JSONB NOT NULL,
  email_subject VARCHAR(500),
  email_body TEXT,
  attach_report BOOLEAN DEFAULT TRUE,
  include_link BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  run_count INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create report_history table
CREATE TABLE IF NOT EXISTS report_history (
  id SERIAL PRIMARY KEY,
  report_definition_id INTEGER NOT NULL REFERENCES report_definitions(id),
  schedule_id INTEGER REFERENCES report_schedules(id),
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  format VARCHAR(50) NOT NULL,
  file_path VARCHAR(500),
  file_size BIGINT,
  status VARCHAR(50) NOT NULL,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds INTEGER,
  row_count INTEGER,
  error_message TEXT,
  parameters JSONB,
  generated_by INTEGER,
  is_scheduled BOOLEAN DEFAULT FALSE,
  is_emailed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create dashboard_configurations table
CREATE TABLE IF NOT EXISTS dashboard_configurations (
  id SERIAL PRIMARY KEY,
  dashboard_name VARCHAR(255) NOT NULL,
  description TEXT,
  layout JSONB NOT NULL,
  widgets JSONB NOT NULL,
  refresh_interval INTEGER DEFAULT 300,
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  user_id INTEGER,
  shared_with JSONB,
  filters JSONB,
  theme VARCHAR(50) DEFAULT 'light',
  created_by INTEGER,
  updated_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_report_defs_type ON report_definitions(report_type);
CREATE INDEX idx_report_defs_public ON report_definitions(is_public);
CREATE INDEX idx_report_schedules_active ON report_schedules(is_active);
CREATE INDEX idx_report_schedules_next_run ON report_schedules(next_run);
CREATE INDEX idx_report_history_def ON report_history(report_definition_id);
CREATE INDEX idx_report_history_status ON report_history(status);
CREATE INDEX idx_report_history_created ON report_history(created_at);
CREATE INDEX idx_dashboards_user ON dashboard_configurations(user_id);
CREATE INDEX idx_dashboards_public ON dashboard_configurations(is_public);
CREATE INDEX idx_dashboards_default ON dashboard_configurations(is_default);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_reporting_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating timestamps
CREATE TRIGGER trigger_update_report_def_timestamp
  BEFORE UPDATE ON report_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_reporting_timestamp();

CREATE TRIGGER trigger_update_report_schedule_timestamp
  BEFORE UPDATE ON report_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_reporting_timestamp();

CREATE TRIGGER trigger_update_dashboard_timestamp
  BEFORE UPDATE ON dashboard_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_reporting_timestamp();

-- Comments
COMMENT ON TABLE report_definitions IS 'Report template definitions with parameters and filters';
COMMENT ON TABLE report_schedules IS 'Scheduled report configurations for automated generation';
COMMENT ON TABLE report_history IS 'Generated report execution history and audit trail';
COMMENT ON TABLE dashboard_configurations IS 'Custom user dashboards with widgets and drill-down capabilities';

-- Insert sample report definitions
INSERT INTO report_definitions (report_name, report_type, description, format, parameters, is_template, is_public)
VALUES 
  ('Daily SLA Report', 'sla', 'Daily SLA compliance report for all critical devices', 'pdf', 
   '{"dateRange": "24h", "tier": 1}'::jsonb, true, true),
  ('Weekly Uptime Summary', 'uptime', 'Weekly uptime summary for all monitored devices', 'excel', 
   '{"dateRange": "7d"}'::jsonb, true, true),
  ('Monthly Performance Report', 'performance', 'Monthly performance metrics report', 'pdf', 
   '{"dateRange": "30d", "includeCharts": true}'::jsonb, true, true);

-- Insert sample dashboard configuration
INSERT INTO dashboard_configurations (dashboard_name, description, layout, widgets, is_default, is_public, theme)
VALUES 
  ('Executive Dashboard', 'High-level overview for executives', 
   '{"rows": 3, "columns": 3}'::jsonb,
   '[
     {"type": "critical-devices", "position": {"row": 0, "col": 0}, "size": {"width": 2, "height": 1}, "drillDown": "/monitoring/drilldown/device/:id/overview"},
     {"type": "sla-compliance", "position": {"row": 0, "col": 2}, "size": {"width": 1, "height": 1}, "drillDown": "/reporting/reports/sla"},
     {"type": "top-talkers", "position": {"row": 1, "col": 0}, "size": {"width": 3, "height": 1}, "drillDown": "/monitoring/top-talkers"},
     {"type": "network-topology", "position": {"row": 2, "col": 0}, "size": {"width": 3, "height": 1}, "drillDown": "/monitoring/topology/network"}
   ]'::jsonb,
   true, true, 'light');

COMMENT ON TABLE report_definitions IS 'Sample report definitions created for testing';
COMMENT ON TABLE dashboard_configurations IS 'Sample executive dashboard with drill-down widgets';
