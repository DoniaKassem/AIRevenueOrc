/**
 * Landing Page Builder
 * Create and manage landing pages with drag-and-drop components
 */

import { supabase } from '../supabase';

export interface LandingPage {
  id: string;
  name: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived';

  // URL
  slug: string;
  metaTitle: string;
  metaDescription: string;

  // Content
  content: PageContent;
  customHtml?: string;
  customCss?: string;
  customJs?: string;

  // Settings
  templateId?: string;
  formId?: string;
  enableAbTest: boolean;
  abTestVariants?: Array<{
    name: string;
    content: PageContent;
    percentage: number;
  }>;

  // Analytics
  views: number;
  uniqueVisitors: number;
  conversions: number;
  conversionRate: number;

  // SEO
  canonicalUrl?: string;
  robotsMeta?: string;

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface PageContent {
  sections: PageSection[];
  globalStyles?: {
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    maxWidth?: number;
  };
}

export interface PageSection {
  id: string;
  type: 'header' | 'hero' | 'features' | 'testimonials' | 'pricing' | 'cta' | 'form' | 'text' | 'image' | 'video' | 'custom';
  order: number;
  components: PageComponent[];
  settings: {
    backgroundColor?: string;
    padding?: string;
    margin?: string;
    fullWidth?: boolean;
  };
}

export interface PageComponent {
  id: string;
  type: 'heading' | 'paragraph' | 'button' | 'image' | 'video' | 'form' | 'html' | 'spacer' | 'divider' | 'icon' | 'columns';
  content: any;
  styles?: Record<string, any>;
  settings?: Record<string, any>;
}

export interface PageTemplate {
  id: string;
  name: string;
  category: 'landing' | 'thank-you' | 'blog' | 'blank';
  thumbnail: string;
  content: PageContent;
  isPublic: boolean;
}

export interface PageView {
  pageId: string;
  prospectId?: string;
  sessionId: string;
  isUnique: boolean;
  ipAddress: string;
  userAgent: string;
  referrer: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  country?: string;
  city?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  viewedAt: Date;
}

/**
 * Landing Page Service
 */
export class LandingPageService {
  /**
   * Create landing page
   */
  async createPage(page: Partial<LandingPage>): Promise<LandingPage> {
    // Generate slug if not provided
    const slug = page.slug || this.generateSlug(page.name || 'page');

    const { data, error } = await supabase
      .from('landing_pages')
      .insert({
        name: page.name,
        title: page.title,
        description: page.description,
        status: 'draft',
        slug,
        meta_title: page.metaTitle || page.title,
        meta_description: page.metaDescription || page.description,
        content: page.content || this.getDefaultContent(),
        custom_html: page.customHtml,
        custom_css: page.customCss,
        custom_js: page.customJs,
        template_id: page.templateId,
        form_id: page.formId,
        enable_ab_test: page.enableAbTest || false,
        ab_test_variants: page.abTestVariants,
        views: 0,
        unique_visitors: 0,
        conversions: 0,
        conversion_rate: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapPage(data);
  }

  /**
   * Update landing page
   */
  async updatePage(pageId: string, updates: Partial<LandingPage>): Promise<LandingPage> {
    const { data, error } = await supabase
      .from('landing_pages')
      .update({
        name: updates.name,
        title: updates.title,
        description: updates.description,
        slug: updates.slug,
        meta_title: updates.metaTitle,
        meta_description: updates.metaDescription,
        content: updates.content,
        custom_html: updates.customHtml,
        custom_css: updates.customCss,
        custom_js: updates.customJs,
        form_id: updates.formId,
        enable_ab_test: updates.enableAbTest,
        ab_test_variants: updates.abTestVariants,
        canonical_url: updates.canonicalUrl,
        robots_meta: updates.robotsMeta,
        updated_at: new Date().toISOString()
      })
      .eq('id', pageId)
      .select()
      .single();

    if (error) throw error;
    return this.mapPage(data);
  }

  /**
   * Publish page
   */
  async publishPage(pageId: string): Promise<LandingPage> {
    const { data, error } = await supabase
      .from('landing_pages')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', pageId)
      .select()
      .single();

    if (error) throw error;
    return this.mapPage(data);
  }

  /**
   * Unpublish page
   */
  async unpublishPage(pageId: string): Promise<LandingPage> {
    const { data, error } = await supabase
      .from('landing_pages')
      .update({ status: 'draft' })
      .eq('id', pageId)
      .select()
      .single();

    if (error) throw error;
    return this.mapPage(data);
  }

  /**
   * Get page by slug
   */
  async getPageBySlug(slug: string): Promise<LandingPage | null> {
    const { data, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !data) return null;
    return this.mapPage(data);
  }

  /**
   * Get page by ID
   */
  async getPage(pageId: string): Promise<LandingPage> {
    const { data, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', pageId)
      .single();

    if (error) throw error;
    return this.mapPage(data);
  }

  /**
   * Get all pages
   */
  async getPages(filters?: {
    status?: LandingPage['status'];
    limit?: number;
    offset?: number;
  }): Promise<LandingPage[]> {
    let query = supabase
      .from('landing_pages')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
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
   * Track page view
   */
  async trackPageView(view: Partial<PageView>): Promise<void> {
    // Check if this is a unique visitor
    const { count } = await supabase
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .eq('page_id', view.pageId)
      .eq('session_id', view.sessionId!);

    const isUnique = count === 0;

    await supabase.from('page_views').insert({
      page_id: view.pageId,
      prospect_id: view.prospectId,
      session_id: view.sessionId,
      is_unique: isUnique,
      ip_address: view.ipAddress,
      user_agent: view.userAgent,
      referrer: view.referrer,
      device_type: view.deviceType,
      browser: view.browser,
      os: view.os,
      country: view.country,
      city: view.city,
      utm_source: view.utmSource,
      utm_medium: view.utmMedium,
      utm_campaign: view.utmCampaign,
      viewed_at: new Date().toISOString()
    });
  }

  /**
   * Track conversion
   */
  async trackConversion(pageId: string, prospectId?: string): Promise<void> {
    const { data: page } = await supabase
      .from('landing_pages')
      .select('conversions, unique_visitors')
      .eq('id', pageId)
      .single();

    if (page) {
      const newConversions = page.conversions + 1;
      const conversionRate = page.unique_visitors > 0
        ? (newConversions / page.unique_visitors) * 100
        : 0;

      await supabase
        .from('landing_pages')
        .update({
          conversions: newConversions,
          conversion_rate: conversionRate
        })
        .eq('id', pageId);
    }
  }

  /**
   * Get page analytics
   */
  async getPageAnalytics(pageId: string, dateRange?: { start: Date; end: Date }): Promise<{
    views: number;
    uniqueVisitors: number;
    conversions: number;
    conversionRate: number;
    avgTimeOnPage: number;
    bounceRate: number;
    topReferrers: Array<{ referrer: string; count: number }>;
    deviceBreakdown: { desktop: number; mobile: number; tablet: number };
    locationBreakdown: Record<string, number>;
  }> {
    let query = supabase
      .from('page_views')
      .select('*')
      .eq('page_id', pageId);

    if (dateRange) {
      query = query
        .gte('viewed_at', dateRange.start.toISOString())
        .lte('viewed_at', dateRange.end.toISOString());
    }

    const { data: views } = await query;

    const { data: page } = await supabase
      .from('landing_pages')
      .select('views, unique_visitors, conversions, conversion_rate')
      .eq('id', pageId)
      .single();

    // Calculate metrics
    const totalViews = views?.length || 0;
    const uniqueVisitors = new Set(views?.map(v => v.session_id)).size;

    // Device breakdown
    const deviceBreakdown = {
      desktop: views?.filter(v => v.device_type === 'desktop').length || 0,
      mobile: views?.filter(v => v.device_type === 'mobile').length || 0,
      tablet: views?.filter(v => v.device_type === 'tablet').length || 0
    };

    // Top referrers
    const referrerCounts: Record<string, number> = {};
    views?.forEach(v => {
      if (v.referrer) {
        referrerCounts[v.referrer] = (referrerCounts[v.referrer] || 0) + 1;
      }
    });
    const topReferrers = Object.entries(referrerCounts)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Location breakdown
    const locationBreakdown: Record<string, number> = {};
    views?.forEach(v => {
      if (v.country) {
        locationBreakdown[v.country] = (locationBreakdown[v.country] || 0) + 1;
      }
    });

    return {
      views: page?.views || 0,
      uniqueVisitors: page?.unique_visitors || 0,
      conversions: page?.conversions || 0,
      conversionRate: page?.conversion_rate || 0,
      avgTimeOnPage: 0, // Would calculate from session data
      bounceRate: 0, // Would calculate from session data
      topReferrers,
      deviceBreakdown,
      locationBreakdown
    };
  }

  /**
   * Duplicate page
   */
  async duplicatePage(pageId: string, newName: string): Promise<LandingPage> {
    const original = await this.getPage(pageId);

    return this.createPage({
      name: newName,
      title: original.title,
      description: original.description,
      content: original.content,
      customHtml: original.customHtml,
      customCss: original.customCss,
      customJs: original.customJs,
      formId: original.formId,
      enableAbTest: original.enableAbTest,
      abTestVariants: original.abTestVariants
    });
  }

  /**
   * Delete page
   */
  async deletePage(pageId: string): Promise<void> {
    await supabase
      .from('landing_pages')
      .delete()
      .eq('id', pageId);
  }

  /**
   * Create page template
   */
  async createTemplate(template: Partial<PageTemplate>): Promise<PageTemplate> {
    const { data, error } = await supabase
      .from('page_templates')
      .insert({
        name: template.name,
        category: template.category || 'landing',
        thumbnail: template.thumbnail,
        content: template.content,
        is_public: template.isPublic || false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get templates
   */
  async getTemplates(category?: PageTemplate['category']): Promise<PageTemplate[]> {
    let query = supabase
      .from('page_templates')
      .select('*')
      .eq('is_public', true);

    if (category) {
      query = query.eq('category', category);
    }

    const { data } = await query;
    return data || [];
  }

  /**
   * Create page from template
   */
  async createFromTemplate(templateId: string, name: string): Promise<LandingPage> {
    const { data: template } = await supabase
      .from('page_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!template) {
      throw new Error('Template not found');
    }

    return this.createPage({
      name,
      title: name,
      content: template.content,
      templateId
    });
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get default page content
   */
  private getDefaultContent(): PageContent {
    return {
      sections: [
        {
          id: 'hero-1',
          type: 'hero',
          order: 0,
          components: [
            {
              id: 'heading-1',
              type: 'heading',
              content: 'Welcome to Our Page',
              styles: {
                fontSize: '48px',
                fontWeight: 'bold',
                textAlign: 'center'
              }
            },
            {
              id: 'paragraph-1',
              type: 'paragraph',
              content: 'This is your new landing page. Edit this content to get started.',
              styles: {
                fontSize: '18px',
                textAlign: 'center'
              }
            },
            {
              id: 'button-1',
              type: 'button',
              content: 'Get Started',
              styles: {
                backgroundColor: '#0078d4',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '4px'
              },
              settings: {
                href: '#',
                openInNewTab: false
              }
            }
          ],
          settings: {
            backgroundColor: '#ffffff',
            padding: '80px 20px',
            fullWidth: true
          }
        }
      ],
      globalStyles: {
        backgroundColor: '#ffffff',
        textColor: '#333333',
        fontFamily: 'Arial, sans-serif',
        maxWidth: 1200
      }
    };
  }

  /**
   * Map database record to LandingPage
   */
  private mapPage(data: any): LandingPage {
    return {
      id: data.id,
      name: data.name,
      title: data.title,
      description: data.description,
      status: data.status,
      slug: data.slug,
      metaTitle: data.meta_title,
      metaDescription: data.meta_description,
      content: data.content,
      customHtml: data.custom_html,
      customCss: data.custom_css,
      customJs: data.custom_js,
      templateId: data.template_id,
      formId: data.form_id,
      enableAbTest: data.enable_ab_test,
      abTestVariants: data.ab_test_variants,
      views: data.views,
      uniqueVisitors: data.unique_visitors,
      conversions: data.conversions,
      conversionRate: data.conversion_rate,
      canonicalUrl: data.canonical_url,
      robotsMeta: data.robots_meta,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      publishedAt: data.published_at ? new Date(data.published_at) : undefined
    };
  }
}

/**
 * Create Landing Page Service
 */
export function createLandingPageService(): LandingPageService {
  return new LandingPageService();
}
