-- Migration: Role-Based Access Control (RBAC) Tables
-- Phase 1.2: Roles, Permissions, and Access Control
-- Created: 2026-01-23

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE, -- System roles cannot be deleted
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, display_name, description, is_system_role) VALUES
('admin', 'Administrator', 'Full system access with all permissions', TRUE),
('user', 'User', 'Standard user with limited access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL, -- asset, device, report, alert, etc.
  action VARCHAR(50) NOT NULL, -- create, read, update, delete, execute
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default permissions
INSERT INTO permissions (name, resource, action, description) VALUES
-- Asset Management
('asset:create', 'asset', 'create', 'Create new assets'),
('asset:read', 'asset', 'read', 'View assets'),
('asset:update', 'asset', 'update', 'Update assets'),
('asset:delete', 'asset', 'delete', 'Delete assets'),

-- Device Management
('device:create', 'device', 'create', 'Add new devices'),
('device:read', 'device', 'read', 'View devices'),
('device:update', 'device', 'update', 'Update device configurations'),
('device:delete', 'device', 'delete', 'Delete devices'),

-- NMS Specific
('nms:config:manage', 'nms', 'manage', 'Manage device configurations'),
('nms:discovery:run', 'nms', 'execute', 'Run network discovery'),
('nms:threshold:set', 'nms', 'manage', 'Configure alert thresholds'),
('nms:remote:access', 'nms', 'execute', 'Remote access to devices (SSH/Telnet)'),
('nms:topology:view', 'nms', 'read', 'View network topology'),
('nms:topology:edit', 'nms', 'update', 'Edit network topology'),

-- Reports
('report:view', 'report', 'read', 'View reports'),
('report:export', 'report', 'execute', 'Export reports'),
('report:schedule', 'report', 'manage', 'Schedule automated reports'),
('report:delete', 'report', 'delete', 'Delete reports'),

-- Alerts
('alert:view', 'alert', 'read', 'View alerts'),
('alert:acknowledge', 'alert', 'update', 'Acknowledge alerts'),
('alert:delete', 'alert', 'delete', 'Delete alerts'),
('alert:configure', 'alert', 'manage', 'Configure alert rules'),

-- Dashboard
('dashboard:view', 'dashboard', 'read', 'View dashboards'),
('dashboard:critical', 'dashboard', 'read', 'View critical devices dashboard'),

-- Customers
('customer:create', 'customer', 'create', 'Create customers'),
('customer:read', 'customer', 'read', 'View customers'),
('customer:update', 'customer', 'update', 'Update customers'),
('customer:delete', 'customer', 'delete', 'Delete customers'),

-- Users
('user:create', 'user', 'create', 'Create users'),
('user:read', 'user', 'read', 'View users'),
('user:update', 'user', 'update', 'Update users'),
('user:delete', 'user', 'delete', 'Delete users'),
('user:manage:roles', 'user', 'manage', 'Assign roles to users'),

-- System Configuration
('system:config', 'system', 'manage', 'Configure system settings'),
('system:license', 'system', 'manage', 'Manage licenses'),
('system:maintenance', 'system', 'execute', 'System maintenance operations'),

-- Graphs
('graph:view', 'graph', 'read', 'View graphs'),
('graph:export', 'graph', 'execute', 'Export graphs'),

-- Top Talker
('toptalker:view', 'toptalker', 'read', 'View top talker analysis')

ON CONFLICT (name) DO NOTHING;

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Assign permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign limited permissions to User role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'user' 
AND p.action IN ('read', 'execute')
AND p.resource NOT IN ('user', 'system')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Also allow users to acknowledge alerts
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'user' 
AND p.name = 'alert:acknowledge'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Update users table to include role
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);

-- Set default role for existing users (if any)
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'user' LIMIT 1)
WHERE role_id IS NULL;

-- Make role_id NOT NULL after setting defaults
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;

-- User-specific permission overrides (optional - for granular control)
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  is_granted BOOLEAN DEFAULT TRUE, -- TRUE = grant, FALSE = revoke
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, permission_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id INTEGER,
  p_permission_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN;
BEGIN
  -- Check user's role permissions
  SELECT EXISTS(
    SELECT 1
    FROM users u
    JOIN role_permissions rp ON u.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = p_user_id AND p.name = p_permission_name
  ) INTO has_permission;
  
  -- Check for user-specific overrides
  IF EXISTS(
    SELECT 1 FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = p_user_id AND p.name = p_permission_name
  ) THEN
    SELECT is_granted INTO has_permission
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = p_user_id AND p.name = p_permission_name;
  END IF;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

-- Function to get all user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id INTEGER)
RETURNS TABLE(permission_name VARCHAR, resource VARCHAR, action VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.name, p.resource, p.action
  FROM users u
  JOIN role_permissions rp ON u.role_id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE u.id = p_user_id
  
  UNION
  
  SELECT p.name, p.resource, p.action
  FROM user_permissions up
  JOIN permissions p ON up.permission_id = p.id
  WHERE up.user_id = p_user_id AND up.is_granted = TRUE
  
  EXCEPT
  
  SELECT p.name, p.resource, p.action
  FROM user_permissions up
  JOIN permissions p ON up.permission_id = p.id
  WHERE up.user_id = p_user_id AND up.is_granted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE roles IS 'User roles for RBAC system';
COMMENT ON TABLE permissions IS 'System permissions for granular access control';
COMMENT ON TABLE role_permissions IS 'Mapping between roles and permissions';
COMMENT ON TABLE user_permissions IS 'User-specific permission overrides (grants or revokes)';
COMMENT ON FUNCTION user_has_permission IS 'Check if user has a specific permission';
COMMENT ON FUNCTION get_user_permissions IS 'Get all permissions for a user (role + overrides)';

-- View for easy permission checking
CREATE OR REPLACE VIEW v_user_roles_permissions AS
SELECT 
  u.id AS user_id,
  u.username,
  u.email,
  r.name AS role_name,
  r.display_name AS role_display_name,
  p.name AS permission_name,
  p.resource,
  p.action,
  p.description AS permission_description
FROM users u
JOIN roles r ON u.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id;

COMMENT ON VIEW v_user_roles_permissions IS 'Comprehensive view of users with their roles and permissions';

-- Migration complete
-- Run this migration using: psql -U your_user -d ems_platform -f 002_add_rbac_tables.sql
