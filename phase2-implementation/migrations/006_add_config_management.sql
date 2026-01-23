-- Migration: Configuration Management
-- Phase 2.4: Device configuration templates, deployment, and backups
-- Created: 2026-01-23

-- Configuration templates
CREATE TABLE IF NOT EXISTS config_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL UNIQUE,
  template_category VARCHAR(100), -- base-config, security, routing, vlan, etc.
  device_category VARCHAR(50), -- Router, Switch, Firewall
  vendor VARCHAR(100), -- Cisco, Juniper, HP, Dell, Huawei, etc.
  device_models TEXT[], -- Applicable models
  
  -- Template Content
  config_content TEXT NOT NULL,
  config_format VARCHAR(50) DEFAULT 'text', -- text, json, xml
  
  -- Variables (for dynamic substitution)
  variables JSONB, -- {"hostname": "string", "ip_address": "string", ...}
  
  -- Validation
  syntax_check_enabled BOOLEAN DEFAULT FALSE,
  validation_rules JSONB,
  
  -- Version Control
  version VARCHAR(50) DEFAULT '1.0',
  is_latest BOOLEAN DEFAULT TRUE,
  parent_template_id INTEGER REFERENCES config_templates(id),
  
  -- Metadata
  description TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

-- Configuration deployments
CREATE TABLE IF NOT EXISTS config_deployments (
  id SERIAL PRIMARY KEY,
  deployment_name VARCHAR(255),
  template_id INTEGER REFERENCES config_templates(id),
  asset_ids INTEGER[] NOT NULL, -- Array of device IDs to deploy to
  
  -- Deployment Configuration
  deployment_method VARCHAR(50) DEFAULT 'ssh', -- ssh, telnet, netconf, api
  deployment_mode VARCHAR(50) DEFAULT 'merge', -- merge, replace, append
  
  -- Rendered Configuration
  rendered_configs JSONB, -- {asset_id: rendered_config}
  
  -- Execution
  status VARCHAR(50) DEFAULT 'pending', -- pending, in-progress, completed, failed, partial
  execution_strategy VARCHAR(50) DEFAULT 'sequential', -- sequential, parallel
  max_parallel_deploys INTEGER DEFAULT 5,
  
  -- Progress Tracking
  total_devices INTEGER,
  successful_deploys INTEGER DEFAULT 0,
  failed_deploys INTEGER DEFAULT 0,
  in_progress_deploys INTEGER DEFAULT 0,
  
  -- Rollback
  rollback_enabled BOOLEAN DEFAULT TRUE,
  backup_before_deploy BOOLEAN DEFAULT TRUE,
  
  -- Schedule
  is_scheduled BOOLEAN DEFAULT FALSE,
  scheduled_at TIMESTAMP,
  
  -- Execution Details
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  
  -- Metadata
  deployed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Deployment results per device
CREATE TABLE IF NOT EXISTS config_deployment_results (
  id SERIAL PRIMARY KEY,
  deployment_id INTEGER NOT NULL REFERENCES config_deployments(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id),
  
  -- Result
  status VARCHAR(50), -- success, failed, skipped
  config_deployed TEXT,
  
  -- Execution Details
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  
  -- Error Handling
  error_message TEXT,
  error_code VARCHAR(50),
  
  -- Output
  command_output TEXT,
  
  -- Rollback
  rollback_performed BOOLEAN DEFAULT FALSE,
  rollback_status VARCHAR(50)
);

-- Configuration backups
CREATE TABLE IF NOT EXISTS config_backups (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  
  -- Backup Details
  backup_type VARCHAR(50) DEFAULT 'scheduled', -- scheduled, manual, pre-change, on-demand
  backup_method VARCHAR(50), -- tftp, scp, ssh, cli, api
  
  -- Configuration Content
  config_content TEXT NOT NULL,
  config_format VARCHAR(50) DEFAULT 'text',
  
  -- File Information
  file_size_kb INTEGER,
  file_hash VARCHAR(64), -- SHA-256 hash for comparison
  
  -- Storage
  file_path VARCHAR(500),
  storage_location VARCHAR(50) DEFAULT 'database', -- database, filesystem, s3, azure
  
  -- Comparison
  diff_from_previous TEXT, -- Diff output
  has_changes BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  backed_up_at TIMESTAMP DEFAULT NOW(),
  backed_up_by INTEGER REFERENCES users(id),
  notes TEXT
);

-- Backup schedules
CREATE TABLE IF NOT EXISTS backup_schedules (
  id SERIAL PRIMARY KEY,
  schedule_name VARCHAR(255) NOT NULL,
  
  -- Scope
  asset_ids INTEGER[], -- Specific devices
  device_group_ids INTEGER[], -- Device groups
  customer_ids INTEGER[], -- All devices for customers
  location_ids INTEGER[], -- All devices at locations
  apply_to_all_devices BOOLEAN DEFAULT FALSE,
  
  -- Schedule Configuration
  cron_expression VARCHAR(100) NOT NULL, -- "0 2 * * *" = daily 2 AM
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Backup Options
  backup_method VARCHAR(50) DEFAULT 'ssh',
  retention_days INTEGER DEFAULT 30,
  compress_backups BOOLEAN DEFAULT TRUE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  last_run_status VARCHAR(50),
  last_run_device_count INTEGER,
  last_run_success_count INTEGER,
  last_run_failure_count INTEGER,
  
  -- Notifications
  notify_on_failure BOOLEAN DEFAULT TRUE,
  notification_emails TEXT[],
  
  -- Metadata
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Configuration change history
CREATE TABLE IF NOT EXISTS config_change_history (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  change_type VARCHAR(50), -- deployment, manual, rollback, import
  
  -- Change Details
  config_before TEXT,
  config_after TEXT,
  config_diff TEXT,
  
  -- Context
  deployment_id INTEGER REFERENCES config_deployments(id),
  backup_id INTEGER REFERENCES config_backups(id),
  
  -- Metadata
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  change_reason TEXT,
  approval_status VARCHAR(50), -- approved, pending, rejected
  approved_by INTEGER REFERENCES users(id)
);

-- Configuration compliance rules
CREATE TABLE IF NOT EXISTS config_compliance_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL UNIQUE,
  rule_category VARCHAR(100), -- security, performance, standards
  
  -- Rule Definition
  rule_type VARCHAR(50), -- regex, contains, not-contains, json-path, custom
  rule_pattern TEXT,
  rule_description TEXT,
  
  -- Scope
  applies_to_device_types VARCHAR(50)[],
  applies_to_vendors VARCHAR(100)[],
  
  -- Severity
  severity VARCHAR(50) DEFAULT 'warning', -- critical, warning, info
  is_mandatory BOOLEAN DEFAULT FALSE,
  
  -- Actions
  auto_remediate BOOLEAN DEFAULT FALSE,
  remediation_template_id INTEGER REFERENCES config_templates(id),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Configuration compliance results
CREATE TABLE IF NOT EXISTS config_compliance_results (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  rule_id INTEGER NOT NULL REFERENCES config_compliance_rules(id) ON DELETE CASCADE,
  backup_id INTEGER REFERENCES config_backups(id),
  
  -- Result
  is_compliant BOOLEAN,
  violation_details TEXT,
  recommendation TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'open', -- open, acknowledged, resolved, ignored
  remediation_status VARCHAR(50), -- pending, in-progress, completed, failed
  
  -- Timestamps
  checked_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  acknowledged_by INTEGER REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_config_templates_vendor ON config_templates(vendor);
CREATE INDEX IF NOT EXISTS idx_config_templates_category ON config_templates(device_category);
CREATE INDEX IF NOT EXISTS idx_config_deployments_status ON config_deployments(status);
CREATE INDEX IF NOT EXISTS idx_config_deployments_template ON config_deployments(template_id);
CREATE INDEX IF NOT EXISTS idx_config_deployment_results_deployment ON config_deployment_results(deployment_id);
CREATE INDEX IF NOT EXISTS idx_config_deployment_results_asset ON config_deployment_results(asset_id);
CREATE INDEX IF NOT EXISTS idx_config_backups_asset ON config_backups(asset_id);
CREATE INDEX IF NOT EXISTS idx_config_backups_date ON config_backups(backed_up_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_backups_hash ON config_backups(file_hash);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_active ON backup_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_config_change_history_asset ON config_change_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_config_change_history_date ON config_change_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_compliance_results_asset ON config_compliance_results(asset_id);
CREATE INDEX IF NOT EXISTS idx_config_compliance_results_status ON config_compliance_results(status);

-- Views
CREATE OR REPLACE VIEW v_latest_config_backups AS
SELECT DISTINCT ON (asset_id)
  cb.id,
  cb.asset_id,
  a.name AS device_name,
  a.ip_address,
  cb.backup_type,
  cb.file_size_kb,
  cb.has_changes,
  cb.backed_up_at,
  u.username AS backed_up_by_user
FROM config_backups cb
INNER JOIN assets a ON cb.asset_id = a.id
LEFT JOIN users u ON cb.backed_up_by = u.id
ORDER BY asset_id, backed_up_at DESC;

CREATE OR REPLACE VIEW v_config_deployment_summary AS
SELECT 
  cd.id,
  cd.deployment_name,
  ct.template_name,
  cd.status,
  cd.total_devices,
  cd.successful_deploys,
  cd.failed_deploys,
  cd.started_at,
  cd.completed_at,
  cd.duration_seconds,
  u.username AS deployed_by_user
FROM config_deployments cd
LEFT JOIN config_templates ct ON cd.template_id = ct.id
LEFT JOIN users u ON cd.deployed_by = u.id
ORDER BY cd.created_at DESC;

-- Functions
CREATE OR REPLACE FUNCTION calculate_config_diff(
  p_config_before TEXT,
  p_config_after TEXT
) RETURNS TEXT AS $$
BEGIN
  -- This is a placeholder - in practice, you'd use a diff library
  IF p_config_before = p_config_after THEN
    RETURN 'No changes';
  ELSE
    RETURN 'Configuration changed';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update backup schedule next run time
CREATE OR REPLACE FUNCTION update_backup_schedule_next_run()
RETURNS TRIGGER AS $$
BEGIN
  -- Simple logic - add 1 day for daily backups
  -- In practice, parse cron expression
  NEW.next_run_at = NEW.last_run_at + INTERVAL '1 day';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_next_run_after_backup BEFORE UPDATE OF last_run_at ON backup_schedules
FOR EACH ROW EXECUTE FUNCTION update_backup_schedule_next_run();

-- Comments
COMMENT ON TABLE config_templates IS 'Configuration templates with variable substitution';
COMMENT ON TABLE config_deployments IS 'Configuration deployment jobs to multiple devices';
COMMENT ON TABLE config_deployment_results IS 'Per-device deployment results';
COMMENT ON TABLE config_backups IS 'Configuration backups with version control';
COMMENT ON TABLE backup_schedules IS 'Automated backup schedules (cron-based)';
COMMENT ON TABLE config_change_history IS 'Audit trail of all configuration changes';
COMMENT ON TABLE config_compliance_rules IS 'Configuration compliance rules and policies';
COMMENT ON TABLE config_compliance_results IS 'Compliance check results per device';

-- Migration complete
-- Run: psql -U your_user -d ems_platform -f 006_add_config_management.sql
