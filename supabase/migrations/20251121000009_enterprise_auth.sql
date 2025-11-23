-- Enterprise Authentication & Security Schema
-- Supports SSO/SAML, RBAC, MFA, and security features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SSO / SAML Tables
-- =====================================================

-- SSO Providers (SAML configurations)
CREATE TABLE IF NOT EXISTS sso_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Provider info
  provider_type TEXT NOT NULL CHECK (provider_type IN ('saml', 'oauth2', 'oidc')),
  provider_name TEXT NOT NULL CHECK (provider_name IN ('okta', 'azure_ad', 'google', 'onelogin', 'custom_saml')),

  -- SAML configuration (stored as JSONB)
  configuration JSONB NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(organization_id, provider_type)
);

-- SSO Sessions
CREATE TABLE IF NOT EXISTS sso_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Session info
  provider TEXT NOT NULL,
  session_index TEXT, -- SAML SessionIndex

  -- Session metadata
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SSO Audit Log
CREATE TABLE IF NOT EXISTS sso_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL,
  user_id UUID,

  -- Event details
  provider TEXT NOT NULL,
  action TEXT NOT NULL, -- login_initiated, login_success, login_failed, logout
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- RBAC (Role-Based Access Control) Tables
-- =====================================================

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Role info
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('super_admin', 'admin', 'manager', 'rep', 'read_only', 'custom')),
  description TEXT,

  -- Permissions (array of permission strings)
  permissions TEXT[] NOT NULL DEFAULT '{}',

  -- System role (cannot be deleted/edited)
  is_system BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(organization_id, name)
);

-- User Roles (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,

  -- Assignment info
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, role_id)
);

-- RBAC Audit Log
CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Subject of change
  user_id UUID,
  role_id UUID,

  -- Action details
  action TEXT NOT NULL, -- role_created, role_updated, role_deleted, role_assigned, role_removed
  performed_by UUID NOT NULL REFERENCES users(id),

  -- Metadata
  changes JSONB, -- Before/after state
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MFA (Multi-Factor Authentication) Tables
-- =====================================================

-- MFA Configurations
CREATE TABLE IF NOT EXISTS mfa_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- MFA method
  method TEXT NOT NULL CHECK (method IN ('totp', 'sms', 'backup_codes')),

  -- TOTP (Time-based One-Time Password) settings
  secret TEXT, -- Base32 encoded secret for TOTP

  -- SMS settings
  phone_number TEXT,

  -- Backup codes
  backup_codes TEXT[], -- Array of backup codes

  -- Status
  is_enabled BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(user_id, method)
);

-- MFA SMS Codes (temporary verification codes)
CREATE TABLE IF NOT EXISTS mfa_sms_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Code details
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MFA Audit Log
CREATE TABLE IF NOT EXISTS mfa_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Event details
  method TEXT NOT NULL CHECK (method IN ('totp', 'sms', 'backup_codes')),
  action TEXT NOT NULL, -- enabled, disabled, verify, regenerate_backup_codes
  success BOOLEAN NOT NULL,

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Security Features Tables
-- =====================================================

-- Security Audit Log (comprehensive security events)
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL, -- login, logout, password_change, permission_change, data_access, etc.
  event_category TEXT NOT NULL CHECK (event_category IN ('authentication', 'authorization', 'data_access', 'configuration', 'security')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Event data
  description TEXT NOT NULL,
  metadata JSONB,

  -- Context
  ip_address TEXT,
  user_agent TEXT,
  resource_type TEXT,
  resource_id TEXT,

  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- Timestamps
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Failed Login Attempts (for brute force detection)
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Attempt info
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,

  -- Failure reason
  reason TEXT NOT NULL, -- invalid_password, invalid_email, account_locked, mfa_failed, etc.

  -- Timestamps
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- IP Whitelist (organization-level IP restrictions)
CREATE TABLE IF NOT EXISTS ip_whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- IP info
  ip_address TEXT NOT NULL, -- Can be single IP or CIDR range
  description TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(organization_id, ip_address)
);

-- Sessions (enhanced session management)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Session info
  session_token TEXT NOT NULL UNIQUE,
  refresh_token TEXT UNIQUE,

  -- Device info
  device_id TEXT,
  device_name TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT,

  -- Location
  country TEXT,
  city TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Expiration
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,

  -- Last activity
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device Fingerprints (for device recognition)
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Fingerprint
  fingerprint_hash TEXT NOT NULL,

  -- Device info
  device_type TEXT, -- desktop, mobile, tablet
  browser TEXT,
  os TEXT,

  -- Trust status
  is_trusted BOOLEAN DEFAULT false,
  trusted_at TIMESTAMPTZ,

  -- Last seen
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_ip_address TEXT,

  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, fingerprint_hash)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- SSO Providers
CREATE INDEX idx_sso_providers_org ON sso_providers(organization_id);
CREATE INDEX idx_sso_providers_active ON sso_providers(organization_id, is_active);

-- SSO Sessions
CREATE INDEX idx_sso_sessions_user ON sso_sessions(user_id);
CREATE INDEX idx_sso_sessions_org ON sso_sessions(organization_id);
CREATE INDEX idx_sso_sessions_active ON sso_sessions(user_id, is_active);
CREATE INDEX idx_sso_sessions_expires ON sso_sessions(expires_at);

-- SSO Audit Log
CREATE INDEX idx_sso_audit_org ON sso_audit_log(organization_id);
CREATE INDEX idx_sso_audit_user ON sso_audit_log(user_id);
CREATE INDEX idx_sso_audit_timestamp ON sso_audit_log(timestamp DESC);

-- Roles
CREATE INDEX idx_roles_org ON roles(organization_id);
CREATE INDEX idx_roles_type ON roles(organization_id, type);

-- User Roles
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- RBAC Audit Log
CREATE INDEX idx_rbac_audit_user ON rbac_audit_log(user_id);
CREATE INDEX idx_rbac_audit_role ON rbac_audit_log(role_id);
CREATE INDEX idx_rbac_audit_timestamp ON rbac_audit_log(timestamp DESC);

-- MFA Configurations
CREATE INDEX idx_mfa_config_user ON mfa_configurations(user_id);
CREATE INDEX idx_mfa_config_enabled ON mfa_configurations(user_id, is_enabled);

-- MFA SMS Codes
CREATE INDEX idx_mfa_sms_user ON mfa_sms_codes(user_id);
CREATE INDEX idx_mfa_sms_expires ON mfa_sms_codes(expires_at);

-- MFA Audit Log
CREATE INDEX idx_mfa_audit_user ON mfa_audit_log(user_id);
CREATE INDEX idx_mfa_audit_timestamp ON mfa_audit_log(timestamp DESC);

-- Security Audit Log
CREATE INDEX idx_security_audit_org ON security_audit_log(organization_id);
CREATE INDEX idx_security_audit_user ON security_audit_log(user_id);
CREATE INDEX idx_security_audit_type ON security_audit_log(event_type);
CREATE INDEX idx_security_audit_severity ON security_audit_log(severity, timestamp DESC);
CREATE INDEX idx_security_audit_timestamp ON security_audit_log(timestamp DESC);

-- Failed Login Attempts
CREATE INDEX idx_failed_login_email ON failed_login_attempts(email);
CREATE INDEX idx_failed_login_ip ON failed_login_attempts(ip_address);
CREATE INDEX idx_failed_login_timestamp ON failed_login_attempts(attempted_at DESC);

-- IP Whitelist
CREATE INDEX idx_ip_whitelist_org ON ip_whitelist(organization_id);
CREATE INDEX idx_ip_whitelist_active ON ip_whitelist(organization_id, is_active);

-- Sessions
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_active ON sessions(user_id, is_active);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Device Fingerprints
CREATE INDEX idx_device_fingerprints_user ON device_fingerprints(user_id);
CREATE INDEX idx_device_fingerprints_hash ON device_fingerprints(user_id, fingerprint_hash);
CREATE INDEX idx_device_fingerprints_trusted ON device_fingerprints(user_id, is_trusted);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Clean up expired SSO sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sso_sessions()
RETURNS void AS $$
BEGIN
  UPDATE sso_sessions
  SET is_active = false
  WHERE expires_at < NOW() AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired MFA SMS codes
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM mfa_sms_codes
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE sessions
  SET is_active = false
  WHERE expires_at < NOW() AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  -- Check if user has the permission through any of their roles
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND (
        p_permission = ANY(r.permissions)
        OR 'admin:full_access' = ANY(r.permissions)
      )
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql;

-- Get user's all permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  v_permissions TEXT[];
BEGIN
  -- Aggregate all permissions from user's roles
  SELECT ARRAY_AGG(DISTINCT perm)
  INTO v_permissions
  FROM (
    SELECT unnest(r.permissions) as perm
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
  ) perms;

  RETURN COALESCE(v_permissions, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- Check failed login attempts (brute force detection)
CREATE OR REPLACE FUNCTION check_failed_login_attempts(
  p_email TEXT,
  p_ip_address TEXT,
  p_time_window_minutes INT DEFAULT 15,
  p_max_attempts INT DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
  v_attempt_count INT;
  v_is_locked BOOLEAN;
BEGIN
  -- Count failed attempts in time window
  SELECT COUNT(*)
  INTO v_attempt_count
  FROM failed_login_attempts
  WHERE (email = p_email OR ip_address = p_ip_address)
    AND attempted_at > NOW() - (p_time_window_minutes || ' minutes')::INTERVAL;

  -- Check if locked
  v_is_locked := v_attempt_count >= p_max_attempts;

  RETURN v_is_locked;
END;
$$ LANGUAGE plpgsql;

-- Log security event
CREATE OR REPLACE FUNCTION log_security_event(
  p_organization_id UUID,
  p_user_id UUID,
  p_event_type TEXT,
  p_event_category TEXT,
  p_severity TEXT,
  p_description TEXT,
  p_success BOOLEAN,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO security_audit_log (
    organization_id,
    user_id,
    event_type,
    event_category,
    severity,
    description,
    success,
    metadata,
    ip_address,
    user_agent,
    timestamp
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_event_type,
    p_event_category,
    p_severity,
    p_description,
    p_success,
    p_metadata,
    p_ip_address,
    p_user_agent,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Check if IP is whitelisted
CREATE OR REPLACE FUNCTION is_ip_whitelisted(
  p_organization_id UUID,
  p_ip_address TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_whitelisted BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM ip_whitelist
    WHERE organization_id = p_organization_id
      AND ip_address = p_ip_address
      AND is_active = true
  ) INTO v_is_whitelisted;

  RETURN v_is_whitelisted;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE sso_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rbac_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_sms_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own org's data)
-- Note: These are basic policies. In production, implement more granular policies based on roles.

-- SSO Providers: Only admins can view/edit
CREATE POLICY sso_providers_policy ON sso_providers
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_permission(auth.uid(), 'settings:manage:sso')
  );

-- SSO Sessions: Users can view their own
CREATE POLICY sso_sessions_policy ON sso_sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- Roles: Users can view roles in their org
CREATE POLICY roles_view_policy ON roles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Roles: Only admins can modify
CREATE POLICY roles_modify_policy ON roles
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_permission(auth.uid(), 'team:manage_roles')
  );

-- User Roles: Users can view their own roles
CREATE POLICY user_roles_view_own_policy ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- MFA Configurations: Users can only access their own
CREATE POLICY mfa_configurations_policy ON mfa_configurations
  FOR ALL
  USING (user_id = auth.uid());

-- Sessions: Users can only access their own
CREATE POLICY sessions_policy ON sessions
  FOR ALL
  USING (user_id = auth.uid());

-- Device Fingerprints: Users can only access their own
CREATE POLICY device_fingerprints_policy ON device_fingerprints
  FOR ALL
  USING (user_id = auth.uid());

-- =====================================================
-- Automatic Cleanup (using pg_cron if available)
-- =====================================================

-- Schedule automatic cleanup (requires pg_cron extension)
-- Run every hour
-- SELECT cron.schedule('cleanup-expired-sso-sessions', '0 * * * *', 'SELECT cleanup_expired_sso_sessions()');
-- SELECT cron.schedule('cleanup-expired-mfa-codes', '0 * * * *', 'SELECT cleanup_expired_mfa_codes()');
-- SELECT cron.schedule('cleanup-expired-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions()');

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE sso_providers IS 'SSO/SAML provider configurations for organizations';
COMMENT ON TABLE sso_sessions IS 'Active SSO sessions';
COMMENT ON TABLE sso_audit_log IS 'Audit log for SSO events';
COMMENT ON TABLE roles IS 'Role definitions with permissions';
COMMENT ON TABLE user_roles IS 'User role assignments (many-to-many)';
COMMENT ON TABLE rbac_audit_log IS 'Audit log for role changes';
COMMENT ON TABLE mfa_configurations IS 'User MFA configurations (TOTP, SMS)';
COMMENT ON TABLE mfa_sms_codes IS 'Temporary SMS verification codes';
COMMENT ON TABLE mfa_audit_log IS 'Audit log for MFA events';
COMMENT ON TABLE security_audit_log IS 'Comprehensive security event log';
COMMENT ON TABLE failed_login_attempts IS 'Failed login attempts for brute force detection';
COMMENT ON TABLE ip_whitelist IS 'IP whitelist for organization access control';
COMMENT ON TABLE sessions IS 'User sessions with device tracking';
COMMENT ON TABLE device_fingerprints IS 'Device fingerprints for trusted device recognition';

-- =====================================================
-- Initial Data
-- =====================================================

-- Note: Default roles should be created per organization when they sign up
-- This is handled by the RBACManager.initializeDefaultRoles() function
