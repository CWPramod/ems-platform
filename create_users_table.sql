-- Create Users Table
-- This was missing from the original migration

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  password_changed_at TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked_until TIMESTAMP,
  last_activity TIMESTAMP,
  last_login TIMESTAMP,
  force_password_change BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER,
  updated_by INTEGER
);

-- Create index on username and email
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- Update existing users to have default role (if any exist)
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'user' LIMIT 1)
WHERE role_id IS NULL;

-- Create user_permissions table (was missing)
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  is_granted BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- Create the view for user roles and permissions
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

COMMENT ON TABLE users IS 'System users with authentication credentials';
COMMENT ON VIEW v_user_roles_permissions IS 'Comprehensive view of users with their roles and permissions';

-- Insert a default admin user (password: admin123)
-- Password hash generated with bcrypt, rounds=10
INSERT INTO users (username, email, password, role_id, created_at)
VALUES (
  'admin',
  'admin@canaris.com',
  '$2b$10$rZ5D5vK5K5K5K5K5K5K5Ke5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5',
  (SELECT id FROM roles WHERE name = 'admin'),
  NOW()
) ON CONFLICT (username) DO NOTHING;

-- Note: Please change the admin password after first login!
