/**
 * CMS Hub - Page Builder
 * Full website builder with templates, themes, and dynamic content
 */

import { supabase } from '../supabase';

export interface CMSPage {
  id: string;
  title: string;
  slug: string;
  path: string; // Full URL path including parent pages
  status: 'draft' | 'published' | 'scheduled' | 'archived';

  // Content
  content: PageContent;
  templateId?: string;
  themeId?: string;

  // SEO
  metaTitle: string;
  metaDescription: string;
  metaKeywords?: string[];
  canonicalUrl?: string;
  robotsMeta?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;

  // Hierarchy
  parentId?: string;
  order: number;
  children?: CMSPage[];

  // Settings
  pageType: 'page' | 'homepage' | 'blog' | 'landing' | 'custom';
  isHomepage: boolean;
  requiresAuth: boolean;
  allowedRoles?: string[];

  // Language
  language: string;
  translationGroup?: string; // Group of translated versions
  translations?: Record<string, string>; // language code -> page ID

  // Dynamic Content
  dynamicRules?: DynamicContentRule[];

  // Publishing
  publishedAt?: Date;
  scheduledFor?: Date;
  expiresAt?: Date;

  // Analytics
  views: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
  bounceRate: number;

  // Version Control
  version: number;
  isDraft: boolean;
  publishedVersion?: number;

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageContent {
  sections: PageSection[];
  globalModules?: GlobalModuleInstance[];
  customCode?: {
    head?: string;
    bodyStart?: string;
    bodyEnd?: string;
  };
  settings?: {
    layout: 'full-width' | 'boxed' | 'custom';
    maxWidth?: number;
    backgroundColor?: string;
    backgroundImage?: string;
    customCss?: string;
    customJs?: string;
  };
}

export interface PageSection {
  id: string;
  moduleId?: string; // Reference to global module
  type: string; // header, hero, content, footer, etc.
  name?: string;
  components: Component[];
  layout: {
    columns: number;
    columnsTablet?: number;
    columnsMobile?: number;
    gap?: string;
    padding?: string;
    margin?: string;
  };
  styling: {
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundVideo?: string;
    parallax?: boolean;
    fullWidth?: boolean;
    fullHeight?: boolean;
  };
  animation?: {
    type: string;
    delay?: number;
    duration?: number;
  };
  visibility?: {
    desktop?: boolean;
    tablet?: boolean;
    mobile?: boolean;
    loggedIn?: boolean;
    loggedOut?: boolean;
  };
  order: number;
}

export interface Component {
  id: string;
  type: string;
  content: any;
  settings: Record<string, any>;
  styles: {
    desktop?: Record<string, any>;
    tablet?: Record<string, any>;
    mobile?: Record<string, any>;
  };
  animation?: {
    type: string;
    trigger?: 'scroll' | 'click' | 'hover' | 'load';
  };
  dynamicContent?: {
    enabled: boolean;
    dataSource?: string;
    template?: string;
  };
}

export interface GlobalModuleInstance {
  id: string;
  moduleId: string;
  position: 'header' | 'footer' | 'sidebar' | 'custom';
  settings?: Record<string, any>;
}

export interface DynamicContentRule {
  id: string;
  condition: {
    type: 'device' | 'location' | 'user_role' | 'ab_test' | 'custom';
    operator: 'equals' | 'not_equals' | 'contains' | 'in_list';
    value: any;
  };
  content: PageContent;
  priority: number;
}

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  category: 'homepage' | 'about' | 'contact' | 'product' | 'blog' | 'portfolio' | 'custom';
  thumbnail: string;
  previewUrl?: string;
  content: PageContent;
  themeId?: string;
  isPublic: boolean;
  isPremium: boolean;
  tags: string[];
  usageCount: number;
  rating: number;
  createdBy: string;
  createdAt: Date;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  thumbnail: string;
  previewUrl?: string;

  // Design Tokens
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    headingFont?: string;
    fontSize: {
      base: string;
      xs: string;
      sm: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };

  // Custom CSS
  customCss?: string;
  customJs?: string;

  // Settings
  isPublic: boolean;
  isPremium: boolean;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface PageVersion {
  id: string;
  pageId: string;
  version: number;
  content: PageContent;
  title: string;
  createdBy: string;
  createdAt: Date;
  restoredFrom?: number;
}

/**
 * CMS Page Service
 */
export class CMSPageService {
  /**
   * Create page
   */
  async createPage(page: Partial<CMSPage>): Promise<CMSPage> {
    // Generate slug and path
    const slug = page.slug || this.generateSlug(page.title || 'page');
    const path = await this.generatePath(slug, page.parentId);

    const { data, error } = await supabase
      .from('cms_pages')
      .insert({
        title: page.title,
        slug,
        path,
        status: page.status || 'draft',
        content: page.content || this.getDefaultContent(),
        template_id: page.templateId,
        theme_id: page.themeId,
        meta_title: page.metaTitle || page.title,
        meta_description: page.metaDescription,
        meta_keywords: page.metaKeywords,
        canonical_url: page.canonicalUrl,
        robots_meta: page.robotsMeta,
        og_image: page.ogImage,
        og_title: page.ogTitle,
        og_description: page.ogDescription,
        parent_id: page.parentId,
        order: page.order || 0,
        page_type: page.pageType || 'page',
        is_homepage: page.isHomepage || false,
        requires_auth: page.requiresAuth || false,
        allowed_roles: page.allowedRoles,
        language: page.language || 'en',
        translation_group: page.translationGroup,
        dynamic_rules: page.dynamicRules,
        scheduled_for: page.scheduledFor?.toISOString(),
        expires_at: page.expiresAt?.toISOString(),
        views: 0,
        unique_visitors: 0,
        avg_time_on_page: 0,
        bounce_rate: 0,
        version: 1,
        is_draft: true,
        created_by: page.createdBy
      })
      .select()
      .single();

    if (error) throw error;

    // Create initial version
    await this.createVersion(data.id, data.content, data.title, page.createdBy!);

    return this.mapPage(data);
  }

  /**
   * Update page
   */
  async updatePage(pageId: string, updates: Partial<CMSPage>, createVersion: boolean = true): Promise<CMSPage> {
    const current = await this.getPage(pageId);

    // Update slug and path if title changed
    let slug = updates.slug;
    let path = updates.path;

    if (updates.title && updates.title !== current.title && !updates.slug) {
      slug = this.generateSlug(updates.title);
      path = await this.generatePath(slug, updates.parentId || current.parentId);
    }

    const newVersion = createVersion ? current.version + 1 : current.version;

    const { data, error } = await supabase
      .from('cms_pages')
      .update({
        title: updates.title,
        slug,
        path,
        status: updates.status,
        content: updates.content,
        template_id: updates.templateId,
        theme_id: updates.themeId,
        meta_title: updates.metaTitle,
        meta_description: updates.metaDescription,
        meta_keywords: updates.metaKeywords,
        canonical_url: updates.canonicalUrl,
        robots_meta: updates.robotsMeta,
        og_image: updates.ogImage,
        og_title: updates.ogTitle,
        og_description: updates.ogDescription,
        parent_id: updates.parentId,
        order: updates.order,
        page_type: updates.pageType,
        is_homepage: updates.isHomepage,
        requires_auth: updates.requiresAuth,
        allowed_roles: updates.allowedRoles,
        language: updates.language,
        dynamic_rules: updates.dynamicRules,
        scheduled_for: updates.scheduledFor?.toISOString(),
        expires_at: updates.expiresAt?.toISOString(),
        version: newVersion,
        updated_at: new Date().toISOString()
      })
      .eq('id', pageId)
      .select()
      .single();

    if (error) throw error;

    // Create version if content changed
    if (createVersion && updates.content) {
      await this.createVersion(
        pageId,
        updates.content,
        updates.title || current.title,
        updates.createdBy || current.createdBy
      );
    }

    return this.mapPage(data);
  }

  /**
   * Publish page
   */
  async publishPage(pageId: string): Promise<CMSPage> {
    const { data, error } = await supabase
      .from('cms_pages')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        is_draft: false,
        published_version: supabase.rpc('get_current_version', { p_page_id: pageId })
      })
      .eq('id', pageId)
      .select()
      .single();

    if (error) throw error;
    return this.mapPage(data);
  }

  /**
   * Get page by path
   */
  async getPageByPath(path: string, language: string = 'en'): Promise<CMSPage | null> {
    const { data, error } = await supabase
      .from('cms_pages')
      .select('*')
      .eq('path', path)
      .eq('language', language)
      .eq('status', 'published')
      .single();

    if (error || !data) return null;
    return this.mapPage(data);
  }

  /**
   * Get page
   */
  async getPage(pageId: string): Promise<CMSPage> {
    const { data, error } = await supabase
      .from('cms_pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (error) throw error;
    return this.mapPage(data);
  }

  /**
   * Get pages
   */
  async getPages(filters?: {
    status?: CMSPage['status'];
    pageType?: CMSPage['pageType'];
    parentId?: string | null;
    language?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<CMSPage[]> {
    let query = supabase
      .from('cms_pages')
      .select('*')
      .order('order', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.pageType) {
      query = query.eq('page_type', filters.pageType);
    }

    if (filters?.parentId === null) {
      query = query.is('parent_id', null);
    } else if (filters?.parentId) {
      query = query.eq('parent_id', filters.parentId);
    }

    if (filters?.language) {
      query = query.eq('language', filters.language);
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,path.ilike.%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data } = await query;
    return (data || []).map(this.mapPage);
  }

  /**
   * Get page tree (hierarchical structure)
   */
  async getPageTree(language: string = 'en'): Promise<CMSPage[]> {
    const allPages = await this.getPages({ language, status: 'published' });
    return this.buildTree(allPages);
  }

  /**
   * Create version
   */
  async createVersion(pageId: string, content: PageContent, title: string, createdBy: string): Promise<PageVersion> {
    const page = await this.getPage(pageId);

    const { data, error } = await supabase
      .from('cms_page_versions')
      .insert({
        page_id: pageId,
        version: page.version,
        content,
        title,
        created_by: createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapVersion(data);
  }

  /**
   * Get versions
   */
  async getVersions(pageId: string, limit: number = 20): Promise<PageVersion[]> {
    const { data } = await supabase
      .from('cms_page_versions')
      .select('*')
      .eq('page_id', pageId)
      .order('version', { ascending: false })
      .limit(limit);

    return (data || []).map(this.mapVersion);
  }

  /**
   * Restore version
   */
  async restoreVersion(pageId: string, versionNumber: number): Promise<CMSPage> {
    const { data: version } = await supabase
      .from('cms_page_versions')
      .select('*')
      .eq('page_id', pageId)
      .eq('version', versionNumber)
      .single();

    if (!version) {
      throw new Error('Version not found');
    }

    return this.updatePage(pageId, {
      content: version.content,
      title: version.title
    });
  }

  /**
   * Create template
   */
  async createTemplate(template: Partial<PageTemplate>): Promise<PageTemplate> {
    const { data, error } = await supabase
      .from('cms_page_templates')
      .insert({
        name: template.name,
        description: template.description,
        category: template.category || 'custom',
        thumbnail: template.thumbnail,
        preview_url: template.previewUrl,
        content: template.content,
        theme_id: template.themeId,
        is_public: template.isPublic !== false,
        is_premium: template.isPremium || false,
        tags: template.tags || [],
        usage_count: 0,
        rating: 0,
        created_by: template.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTemplate(data);
  }

  /**
   * Get templates
   */
  async getTemplates(category?: string): Promise<PageTemplate[]> {
    let query = supabase
      .from('cms_page_templates')
      .select('*')
      .eq('is_public', true)
      .order('usage_count', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data } = await query;
    return (data || []).map(this.mapTemplate);
  }

  /**
   * Create page from template
   */
  async createFromTemplate(templateId: string, title: string, createdBy: string): Promise<CMSPage> {
    const { data: template } = await supabase
      .from('cms_page_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!template) {
      throw new Error('Template not found');
    }

    // Increment usage count
    await supabase
      .from('cms_page_templates')
      .update({ usage_count: template.usage_count + 1 })
      .eq('id', templateId);

    return this.createPage({
      title,
      content: template.content,
      templateId,
      themeId: template.theme_id,
      createdBy
    });
  }

  /**
   * Create theme
   */
  async createTheme(theme: Partial<Theme>): Promise<Theme> {
    const { data, error } = await supabase
      .from('cms_themes')
      .insert({
        name: theme.name,
        description: theme.description,
        version: theme.version || '1.0.0',
        author: theme.author,
        thumbnail: theme.thumbnail,
        preview_url: theme.previewUrl,
        colors: theme.colors,
        typography: theme.typography,
        spacing: theme.spacing,
        border_radius: theme.borderRadius,
        shadows: theme.shadows,
        custom_css: theme.customCss,
        custom_js: theme.customJs,
        is_public: theme.isPublic !== false,
        is_premium: theme.isPremium || false,
        is_active: theme.isActive !== false
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTheme(data);
  }

  /**
   * Get themes
   */
  async getThemes(): Promise<Theme[]> {
    const { data } = await supabase
      .from('cms_themes')
      .select('*')
      .eq('is_public', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return (data || []).map(this.mapTheme);
  }

  /**
   * Get theme
   */
  async getTheme(themeId: string): Promise<Theme> {
    const { data, error } = await supabase
      .from('cms_themes')
      .select('*')
      .eq('id', themeId)
      .single();

    if (error) throw error;
    return this.mapTheme(data);
  }

  /**
   * Duplicate page
   */
  async duplicatePage(pageId: string, newTitle: string): Promise<CMSPage> {
    const original = await this.getPage(pageId);

    return this.createPage({
      title: newTitle,
      content: original.content,
      templateId: original.templateId,
      themeId: original.themeId,
      metaDescription: original.metaDescription,
      pageType: original.pageType,
      language: original.language,
      createdBy: original.createdBy
    });
  }

  /**
   * Delete page
   */
  async deletePage(pageId: string): Promise<void> {
    await supabase
      .from('cms_pages')
      .delete()
      .eq('id', pageId);
  }

  /**
   * Generate path from slug and parent
   */
  private async generatePath(slug: string, parentId?: string): Promise<string> {
    if (!parentId) {
      return `/${slug}`;
    }

    const parent = await this.getPage(parentId);
    return `${parent.path}/${slug}`;
  }

  /**
   * Generate slug
   */
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get default content
   */
  private getDefaultContent(): PageContent {
    return {
      sections: [],
      settings: {
        layout: 'full-width',
        maxWidth: 1200
      }
    };
  }

  /**
   * Build hierarchical tree
   */
  private buildTree(pages: CMSPage[], parentId?: string): CMSPage[] {
    return pages
      .filter(p => p.parentId === parentId)
      .map(page => ({
        ...page,
        children: this.buildTree(pages, page.id)
      }));
  }

  /**
   * Map database record to CMSPage
   */
  private mapPage(data: any): CMSPage {
    return {
      id: data.id,
      title: data.title,
      slug: data.slug,
      path: data.path,
      status: data.status,
      content: data.content,
      templateId: data.template_id,
      themeId: data.theme_id,
      metaTitle: data.meta_title,
      metaDescription: data.meta_description,
      metaKeywords: data.meta_keywords,
      canonicalUrl: data.canonical_url,
      robotsMeta: data.robots_meta,
      ogImage: data.og_image,
      ogTitle: data.og_title,
      ogDescription: data.og_description,
      parentId: data.parent_id,
      order: data.order,
      pageType: data.page_type,
      isHomepage: data.is_homepage,
      requiresAuth: data.requires_auth,
      allowedRoles: data.allowed_roles,
      language: data.language,
      translationGroup: data.translation_group,
      translations: data.translations,
      dynamicRules: data.dynamic_rules,
      publishedAt: data.published_at ? new Date(data.published_at) : undefined,
      scheduledFor: data.scheduled_for ? new Date(data.scheduled_for) : undefined,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      views: data.views,
      uniqueVisitors: data.unique_visitors,
      avgTimeOnPage: data.avg_time_on_page,
      bounceRate: data.bounce_rate,
      version: data.version,
      isDraft: data.is_draft,
      publishedVersion: data.published_version,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database record to PageVersion
   */
  private mapVersion(data: any): PageVersion {
    return {
      id: data.id,
      pageId: data.page_id,
      version: data.version,
      content: data.content,
      title: data.title,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      restoredFrom: data.restored_from
    };
  }

  /**
   * Map database record to PageTemplate
   */
  private mapTemplate(data: any): PageTemplate {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      thumbnail: data.thumbnail,
      previewUrl: data.preview_url,
      content: data.content,
      themeId: data.theme_id,
      isPublic: data.is_public,
      isPremium: data.is_premium,
      tags: data.tags,
      usageCount: data.usage_count,
      rating: data.rating,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to Theme
   */
  private mapTheme(data: any): Theme {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      version: data.version,
      author: data.author,
      thumbnail: data.thumbnail,
      previewUrl: data.preview_url,
      colors: data.colors,
      typography: data.typography,
      spacing: data.spacing,
      borderRadius: data.border_radius,
      shadows: data.shadows,
      customCss: data.custom_css,
      customJs: data.custom_js,
      isPublic: data.is_public,
      isPremium: data.is_premium,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

/**
 * Create CMS Page Service
 */
export function createCMSPageService(): CMSPageService {
  return new CMSPageService();
}
