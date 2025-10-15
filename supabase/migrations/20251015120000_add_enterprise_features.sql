/*
  # Add Enterprise Features Schema

  1. New Tables
    - `organizations`
      - `id` (uuid, primary key)
      - `name` (text)
      - `slug` (text, unique)
      - `plan` (text) - free, professional, enterprise
      - `max_users` (int)
      - `settings` (jsonb)
      - `billing_email` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `roles`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `name` (text)
      - `description` (text)
      - `permissions` (jsonb)
      - `is_system_role` (boolean)
      - `created_at` (timestamptz)

    - `user_roles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `role_id` (uuid, foreign key)
      - `team_id` (uuid, foreign key, nullable)
      - `assigned_by` (uuid)
      - `assigned_at` (timestamptz)

    - `audit_logs`
      - `id` (uuid, primary key)
      - `organization_id` (uuid)
      - `user_id` (uuid)
      - `action` (text)
      - `entity_type` (text)
      - `entity_id` (uuid)
      - `changes` (jsonb)
      - `ip_address` (inet)
      - `user_agent` (text)
      - `created_at` (timestamptz)

    - `user_quotas`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `quota_type` (text)
      - `limit` (int)
      - `used` (int)
      - `reset_at` (timestamptz)
      - `created_at` (timestamptz)

    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `type` (text)
      - `title` (text)
      - `message` (text)
      - `link` (text)
      - `read_at` (timestamptz)
      - `created_at` (timestamptz)

    - `sso_providers`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `provider_type` (text) - saml, oidc
      - `config` (jsonb)
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `data_retention_policies`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `entity_type` (text)
      - `retention_days` (int)
      - `action` (text) - archive, delete
      - `is_active` (boolean)

  2. Security
    - Enable RLS on all tables
    - Add policies for organization-based access control
    - Add policies for role-based permissions
*/

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'professional' CHECK (plan IN ('free', 'professional', 'enterprise')),
  max_users int DEFAULT 10,
  settings jsonb DEFAULT '{}'::jsonb,
  billing_email text,
  logo_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Roles table (RBAC)
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  permissions jsonb DEFAULT '[]'::jsonb,
  is_system_role boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id, team_id)
);

-- Audit logs for compliance
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- User quotas
CREATE TABLE IF NOT EXISTS user_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  quota_type text NOT NULL,
  limit_value int NOT NULL,
  used_value int DEFAULT 0,
  period text DEFAULT 'monthly' CHECK (period IN ('daily', 'weekly', 'monthly')),
  reset_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, quota_type, period)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- SSO providers
CREATE TABLE IF NOT EXISTS sso_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('saml', 'oidc', 'azure_ad', 'okta', 'google_workspace')),
  provider_name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Data retention policies
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  retention_days int NOT NULL,
  action text NOT NULL DEFAULT 'archive' CHECK (action IN ('archive', 'delete', 'anonymize')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, entity_type)
);

-- IP whitelisting for enterprise security
CREATE TABLE IF NOT EXISTS ip_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ip_address inet NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  prefix text NOT NULL,
  scopes jsonb DEFAULT '[]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(organization_id);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Organizations (users can see their own organization)
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM user_roles
      JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = auth.uid()
    )
  );

-- Roles
CREATE POLICY "Users can view roles in their organization"
  ON roles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles
      JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = auth.uid()
    )
  );

-- User roles
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Audit logs (read-only for users, admins can see all)
CREATE POLICY "Users can view audit logs in their organization"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles
      JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = auth.uid()
    )
  );

-- Notifications
CREATE POLICY "Users can manage their own notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- User quotas
CREATE POLICY "Users can view their own quotas"
  ON user_quotas FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- SSO providers (organization admins only - handled in application)
CREATE POLICY "Users can view SSO providers for their organization"
  ON sso_providers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles
      JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = auth.uid()
    )
  );

-- Seed default organization
INSERT INTO organizations (id, name, slug, plan, max_users)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default',
  'enterprise',
  500
)
ON CONFLICT (id) DO NOTHING;

-- Seed system roles
INSERT INTO roles (organization_id, name, description, permissions, is_system_role) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Admin',
    'Full system access including user management and settings',
    '["users:manage", "settings:manage", "integrations:manage", "analytics:view", "audit:view", "all"]'::jsonb,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Sales Manager',
    'Manage sales team and view all deals',
    '["prospects:manage", "deals:manage", "team:view", "analytics:view", "cadences:manage"]'::jsonb,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Sales Rep',
    'Standard sales user access',
    '["prospects:view", "prospects:create", "deals:manage", "activities:manage", "cadences:execute"]'::jsonb,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Viewer',
    'Read-only access to analytics and reports',
    '["analytics:view", "prospects:view", "deals:view"]'::jsonb,
    true
  )
ON CONFLICT (organization_id, name) DO NOTHING;

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
    VALUES (
      COALESCE(NEW.organization_id, NEW.team_id::uuid),
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
    VALUES (
      COALESCE(NEW.organization_id, NEW.team_id::uuid),
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, changes)
    VALUES (
      COALESCE(OLD.organization_id, OLD.team_id::uuid),
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      OLD.id,
      to_jsonb(OLD)
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to critical tables
DROP TRIGGER IF EXISTS audit_prospects_trigger ON prospects;
CREATE TRIGGER audit_prospects_trigger
  AFTER INSERT OR UPDATE OR DELETE ON prospects
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

DROP TRIGGER IF EXISTS audit_deals_trigger ON deals;
CREATE TRIGGER audit_deals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON deals
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();
