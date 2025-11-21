-- =============================================
-- CMS Hub & Operations Hub Database Schema
-- Website builder, custom objects, webhooks, and automation
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- CMS HUB - PAGES & TEMPLATES
-- =============================================

-- CMS themes table
CREATE TABLE cms_themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  author TEXT NOT NULL,
  thumbnail TEXT,
  preview_url TEXT,

  -- Design tokens
  colors JSONB NOT NULL,
  typography JSONB NOT NULL,
  spacing JSONB NOT NULL,
  border_radius JSONB NOT NULL,
  shadows JSONB NOT NULL,

  -- Custom code
  custom_css TEXT,
  custom_js TEXT,

  -- Settings
  is_public BOOLEAN DEFAULT TRUE,
  is_premium BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CMS page templates table
CREATE TABLE cms_page_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('homepage', 'about', 'contact', 'product', 'blog', 'portfolio', 'custom')) DEFAULT 'custom',
  thumbnail TEXT NOT NULL,
  preview_url TEXT,
  content JSONB NOT NULL,
  theme_id UUID REFERENCES cms_themes(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT TRUE,
  is_premium BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cms_templates_category ON cms_page_templates(category);

-- CMS pages table
CREATE TABLE cms_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('draft', 'published', 'scheduled', 'archived')) DEFAULT 'draft',

  -- Content
  content JSONB NOT NULL,
  template_id UUID REFERENCES cms_page_templates(id) ON DELETE SET NULL,
  theme_id UUID REFERENCES cms_themes(id) ON DELETE SET NULL,

  -- SEO
  meta_title TEXT NOT NULL,
  meta_description TEXT,
  meta_keywords TEXT[],
  canonical_url TEXT,
  robots_meta TEXT,
  og_image TEXT,
  og_title TEXT,
  og_description TEXT,

  -- Hierarchy
  parent_id UUID REFERENCES cms_pages(id) ON DELETE CASCADE,
  "order" INTEGER DEFAULT 0,

  -- Settings
  page_type TEXT CHECK (page_type IN ('page', 'homepage', 'blog', 'landing', 'custom')) DEFAULT 'page',
  is_homepage BOOLEAN DEFAULT FALSE,
  requires_auth BOOLEAN DEFAULT FALSE,
  allowed_roles TEXT[],

  -- Language
  language TEXT DEFAULT 'en',
  translation_group TEXT,
  translations JSONB,

  -- Dynamic content
  dynamic_rules JSONB,

  -- Publishing
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Analytics
  views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_time_on_page DECIMAL DEFAULT 0,
  bounce_rate DECIMAL DEFAULT 0,

  -- Version control
  version INTEGER DEFAULT 1,
  is_draft BOOLEAN DEFAULT TRUE,
  published_version INTEGER,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cms_pages_path ON cms_pages(path);
CREATE INDEX idx_cms_pages_slug ON cms_pages(slug);
CREATE INDEX idx_cms_pages_status ON cms_pages(status);
CREATE INDEX idx_cms_pages_parent_id ON cms_pages(parent_id);
CREATE INDEX idx_cms_pages_language ON cms_pages(language);

-- CMS page versions table
CREATE TABLE cms_page_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  title TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  restored_from INTEGER,

  UNIQUE(page_id, version)
);

CREATE INDEX idx_cms_page_versions_page_id ON cms_page_versions(page_id);

-- =============================================
-- CMS HUB - MODULES & NAVIGATION
-- =============================================

-- Global modules table
CREATE TABLE cms_global_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('header', 'footer', 'sidebar', 'navigation', 'cta', 'form', 'custom')) DEFAULT 'custom',

  -- Content
  content JSONB NOT NULL,

  -- Settings
  is_global BOOLEAN DEFAULT FALSE,
  pages UUID[],
  exclude_pages UUID[],
  visibility JSONB,

  -- Language
  language TEXT DEFAULT 'en',
  translations JSONB,

  -- Analytics
  usage_count INTEGER DEFAULT 0,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Navigation table
CREATE TABLE cms_navigations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('primary', 'secondary', 'footer', 'mobile')) DEFAULT 'primary',
  items JSONB NOT NULL,
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CMS HUB - REDIRECTS & DOMAINS
-- =============================================

-- URL redirects table
CREATE TABLE cms_redirects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_path TEXT NOT NULL,
  to_path TEXT NOT NULL,
  type SMALLINT CHECK (type IN (301, 302, 307, 308)) DEFAULT 301,
  is_active BOOLEAN DEFAULT TRUE,
  match_type TEXT CHECK (match_type IN ('exact', 'prefix', 'regex')) DEFAULT 'exact',
  preserve_query_string BOOLEAN DEFAULT TRUE,
  conditions JSONB,
  hit_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cms_redirects_from_path ON cms_redirects(from_path);
CREATE INDEX idx_cms_redirects_is_active ON cms_redirects(is_active);

-- Domains table
CREATE TABLE cms_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT UNIQUE NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,

  -- SSL/TLS
  ssl_enabled BOOLEAN DEFAULT FALSE,
  ssl_provider TEXT CHECK (ssl_provider IN ('lets_encrypt', 'custom', 'cloudflare')),
  ssl_certificate TEXT,
  ssl_key TEXT,
  ssl_expires_at TIMESTAMPTZ,
  auto_renew_ssl BOOLEAN DEFAULT TRUE,

  -- DNS
  dns_records JSONB,
  dns_status TEXT CHECK (dns_status IN ('pending', 'active', 'failed')) DEFAULT 'pending',

  -- CDN
  cdn_enabled BOOLEAN DEFAULT FALSE,
  cdn_provider TEXT CHECK (cdn_provider IN ('cloudflare', 'fastly', 'akamai', 'aws_cloudfront')),
  cdn_url TEXT,

  -- Settings
  force_https BOOLEAN DEFAULT TRUE,
  www_redirect TEXT CHECK (www_redirect IN ('add_www', 'remove_www', 'none')) DEFAULT 'none',
  default_language TEXT DEFAULT 'en',

  -- Verification
  verification_token TEXT,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cms_domains_is_primary ON cms_domains(is_primary);

-- =============================================
-- OPERATIONS HUB - CUSTOM OBJECTS
-- =============================================

-- Custom objects definition table
CREATE TABLE custom_objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plural_name TEXT NOT NULL,
  api_name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,

  -- Schema
  properties JSONB NOT NULL,
  associations JSONB,

  -- Settings
  is_searchable BOOLEAN DEFAULT TRUE,
  enable_activities BOOLEAN DEFAULT FALSE,
  enable_workflows BOOLEAN DEFAULT FALSE,
  primary_display_property TEXT,
  secondary_display_properties TEXT[],

  -- Permissions
  permissions JSONB,

  -- Metadata
  record_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_objects_api_name ON custom_objects(api_name);

-- Custom object associations table
CREATE TABLE custom_object_associations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_object_id UUID REFERENCES custom_objects(id) ON DELETE CASCADE,
  from_record_id UUID NOT NULL,
  to_object_id UUID REFERENCES custom_objects(id) ON DELETE CASCADE,
  to_record_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(from_object_id, from_record_id, to_object_id, to_record_id)
);

CREATE INDEX idx_custom_associations_from ON custom_object_associations(from_object_id, from_record_id);
CREATE INDEX idx_custom_associations_to ON custom_object_associations(to_object_id, to_record_id);

-- =============================================
-- OPERATIONS HUB - WEBHOOKS
-- =============================================

-- Webhooks table
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  method TEXT CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')) DEFAULT 'POST',

  -- Events
  events JSONB NOT NULL,

  -- Authentication
  auth_type TEXT CHECK (auth_type IN ('none', 'basic', 'bearer', 'api_key', 'oauth')) DEFAULT 'none',
  auth_config JSONB,

  -- Headers & payload
  headers JSONB,
  payload_template TEXT,
  include_metadata BOOLEAN DEFAULT TRUE,

  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  retry_on_failure BOOLEAN DEFAULT TRUE,
  max_retries INTEGER DEFAULT 3,
  timeout INTEGER DEFAULT 30000,

  -- Filtering
  filters JSONB,

  -- Analytics
  total_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  last_called_at TIMESTAMPTZ,
  last_status INTEGER,
  last_error TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);

-- Webhook logs table
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB,
  request_headers JSONB,
  request_body JSONB,
  response_status INTEGER,
  response_body TEXT,
  response_time INTEGER,
  success BOOLEAN DEFAULT FALSE,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_executed_at ON webhook_logs(executed_at);

-- =============================================
-- OPERATIONS HUB - PROGRAMMABLE AUTOMATION
-- =============================================

-- Programmable automations table
CREATE TABLE programmable_automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  trigger JSONB NOT NULL,
  code TEXT NOT NULL,
  language TEXT CHECK (language IN ('javascript', 'typescript', 'python')) DEFAULT 'javascript',

  -- Execution
  is_active BOOLEAN DEFAULT TRUE,
  timeout INTEGER DEFAULT 60000,
  memory INTEGER DEFAULT 128,

  -- Secrets (encrypted)
  secrets JSONB,

  -- Dependencies
  dependencies TEXT[],

  -- Analytics
  execution_count INTEGER DEFAULT 0,
  avg_execution_time DECIMAL DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  last_error TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automations_is_active ON programmable_automations(is_active);

-- Automation executions table
CREATE TABLE automation_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES programmable_automations(id) ON DELETE CASCADE,
  trigger JSONB NOT NULL,
  status TEXT CHECK (status IN ('running', 'completed', 'failed', 'timeout')) DEFAULT 'running',
  logs TEXT[],
  result JSONB,
  error TEXT,
  execution_time INTEGER,
  memory_used INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_automation_executions_automation_id ON automation_executions(automation_id);
CREATE INDEX idx_automation_executions_started_at ON automation_executions(started_at);

-- =============================================
-- OPERATIONS HUB - DATA SYNC
-- =============================================

-- Data sync jobs table
CREATE TABLE data_sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  source JSONB NOT NULL,
  destination JSONB NOT NULL,
  mapping JSONB NOT NULL,
  schedule JSONB NOT NULL,
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('idle', 'running', 'failed')) DEFAULT 'idle',
  sync_count INTEGER DEFAULT 0,
  records_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Get current page version
CREATE OR REPLACE FUNCTION get_current_version(p_page_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_version INTEGER;
BEGIN
  SELECT version INTO v_version
  FROM cms_pages
  WHERE id = p_page_id;

  RETURN v_version;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update CMS page timestamp
CREATE TRIGGER trigger_cms_pages_updated_at
  BEFORE UPDATE ON cms_pages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- Update theme timestamp
CREATE TRIGGER trigger_cms_themes_updated_at
  BEFORE UPDATE ON cms_themes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- Update global module timestamp
CREATE TRIGGER trigger_cms_modules_updated_at
  BEFORE UPDATE ON cms_global_modules
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- Update domain timestamp
CREATE TRIGGER trigger_cms_domains_updated_at
  BEFORE UPDATE ON cms_domains
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE cms_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_page_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_global_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_navigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_object_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmable_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for CMS pages
CREATE POLICY "Anyone can view published pages"
  ON cms_pages FOR SELECT
  USING (status = 'published');

CREATE POLICY "Users can manage pages in their organization"
  ON cms_pages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = (
        SELECT organization_id FROM users WHERE id = cms_pages.created_by
      )
    )
  );

-- RLS policies for custom objects
CREATE POLICY "Users can manage custom objects in their organization"
  ON custom_objects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = (
        SELECT organization_id FROM users WHERE id = custom_objects.created_by
      )
    )
  );

-- RLS policies for webhooks
CREATE POLICY "Users can manage webhooks in their organization"
  ON webhooks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = (
        SELECT organization_id FROM users WHERE id = webhooks.created_by
      )
    )
  );

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Full-text search for CMS pages
CREATE INDEX idx_cms_pages_search ON cms_pages USING gin(to_tsvector('english', title || ' ' || COALESCE(meta_description, '')));

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default theme
INSERT INTO cms_themes (name, description, version, author, colors, typography, spacing, border_radius, shadows) VALUES
  (
    'Default Theme',
    'Clean and modern default theme',
    '1.0.0',
    'AIRevenueOrc',
    '{"primary": "#0078d4", "secondary": "#6c757d", "accent": "#28a745", "background": "#ffffff", "surface": "#f8f9fa", "text": "#212529", "textSecondary": "#6c757d", "border": "#dee2e6", "error": "#dc3545", "warning": "#ffc107", "success": "#28a745", "info": "#17a2b8"}'::jsonb,
    '{"fontFamily": "Inter, system-ui, sans-serif", "headingFont": "Inter, system-ui, sans-serif", "fontSize": {"base": "16px", "xs": "12px", "sm": "14px", "lg": "18px", "xl": "20px", "2xl": "24px", "3xl": "30px"}, "fontWeight": {"normal": 400, "medium": 500, "semibold": 600, "bold": 700}, "lineHeight": {"tight": 1.25, "normal": 1.5, "relaxed": 1.75}}'::jsonb,
    '{"xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "32px", "2xl": "48px"}'::jsonb,
    '{"sm": "4px", "md": "8px", "lg": "12px", "full": "9999px"}'::jsonb,
    '{"sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)", "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)", "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)", "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)"}'::jsonb
  );
