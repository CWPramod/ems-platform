-- Migration: Enhanced Authentication Tables
-- Phase 1.1: Password policies, session management, and activity tracking
-- Created: 2026-01-23

-- Add columns to existing users table for enhanced authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;

-- Password history table (prevent password reuse)
CREATE TABLE IF NOT EXISTS password_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_password_history_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at DESC);

-- User sessions table (track active sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_activity TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for session management
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);

-- Login audit log
CREATE TABLE IF NOT EXISTS login_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(255),
  login_status VARCHAR(50) NOT NULL, -- success, failed, locked
  ip_address VARCHAR(45),
  user_agent TEXT,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON login_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON login_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_status ON login_audit_log(login_status);

-- Function to clean up expired sessions (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions 
  WHERE expires_at < NOW() OR (is_active = FALSE AND created_at < NOW() - INTERVAL '7 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update last activity
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE password_history IS 'Stores password history to prevent reuse of recent passwords';
COMMENT ON TABLE user_sessions IS 'Tracks active user sessions for session management and timeout';
COMMENT ON TABLE login_audit_log IS 'Audit log for all login attempts (success and failures)';
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for consecutive failed login attempts';
COMMENT ON COLUMN users.account_locked_until IS 'Timestamp until which account is locked after too many failed attempts';
COMMENT ON COLUMN users.last_activity IS 'Last activity timestamp for session timeout calculation';

-- Insert default password policy configuration (can be modified later)
CREATE TABLE IF NOT EXISTS password_policies (
  id SERIAL PRIMARY KEY,
  policy_name VARCHAR(100) UNIQUE NOT NULL,
  min_length INTEGER DEFAULT 8,
  require_uppercase BOOLEAN DEFAULT TRUE,
  require_lowercase BOOLEAN DEFAULT TRUE,
  require_numbers BOOLEAN DEFAULT TRUE,
  require_special_chars BOOLEAN DEFAULT TRUE,
  password_history_count INTEGER DEFAULT 5, -- Prevent reuse of last 5 passwords
  max_failed_attempts INTEGER DEFAULT 5,
  lockout_duration_minutes INTEGER DEFAULT 30,
  session_timeout_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default policy
INSERT INTO password_policies (policy_name, min_length, session_timeout_minutes)
VALUES ('default', 8, 30)
ON CONFLICT (policy_name) DO NOTHING;

COMMENT ON TABLE password_policies IS 'Configurable password policy rules';

-- Migration complete
-- Run this migration using: psql -U your_user -d ems_platform -f 001_add_enhanced_auth_tables.sql
