/**
 * CMS Hub - Global Modules
 * Reusable components across pages (headers, footers, sidebars)
 */

import { supabase } from '../supabase';
import { PageSection } from './pages';

export interface GlobalModule {
  id: string;
  name: string;
  description: string;
  type: 'header' | 'footer' | 'sidebar' | 'navigation' | 'cta' | 'form' | 'custom';

  // Content
  content: PageSection[];

  // Settings
  isGlobal: boolean; // Apply to all pages
  pages?: string[]; // Specific pages to include
  excludePages?: string[]; // Pages to exclude

  // Visibility
  visibility: {
    desktop?: boolean;
    tablet?: boolean;
    mobile?: boolean;
    loggedIn?: boolean;
    loggedOut?: boolean;
  };

  // Language
  language: string;
  translations?: Record<string, string>; // language code -> module ID

  // Analytics
  usageCount: number;

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Navigation {
  id: string;
  name: string;
  type: 'primary' | 'secondary' | 'footer' | 'mobile';
  items: NavigationItem[];
  settings: {
    showOnPages?: string[];
    hideOnPages?: string[];
    maxDepth?: number;
    style?: 'horizontal' | 'vertical' | 'dropdown' | 'mega';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NavigationItem {
  id: string;
  label: string;
  url?: string;
  pageId?: string;
  type: 'page' | 'url' | 'category' | 'custom';
  target?: '_self' | '_blank';
  icon?: string;
  badge?: string;
  children?: NavigationItem[];
  order: number;
  visibility?: {
    loggedIn?: boolean;
    loggedOut?: boolean;
    roles?: string[];
  };
}

/**
 * Global Module Service
 */
export class GlobalModuleService {
  /**
   * Create module
   */
  async createModule(module: Partial<GlobalModule>): Promise<GlobalModule> {
    const { data, error } = await supabase
      .from('cms_global_modules')
      .insert({
        name: module.name,
        description: module.description,
        type: module.type || 'custom',
        content: module.content || [],
        is_global: module.isGlobal || false,
        pages: module.pages,
        exclude_pages: module.excludePages,
        visibility: module.visibility || {},
        language: module.language || 'en',
        usage_count: 0,
        created_by: module.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapModule(data);
  }

  /**
   * Update module
   */
  async updateModule(moduleId: string, updates: Partial<GlobalModule>): Promise<GlobalModule> {
    const { data, error } = await supabase
      .from('cms_global_modules')
      .update({
        name: updates.name,
        description: updates.description,
        type: updates.type,
        content: updates.content,
        is_global: updates.isGlobal,
        pages: updates.pages,
        exclude_pages: updates.excludePages,
        visibility: updates.visibility,
        language: updates.language,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)
      .select()
      .single();

    if (error) throw error;
    return this.mapModule(data);
  }

  /**
   * Get module
   */
  async getModule(moduleId: string): Promise<GlobalModule> {
    const { data, error } = await supabase
      .from('cms_global_modules')
      .select('*')
      .eq('id', moduleId)
      .single();

    if (error) throw error;
    return this.mapModule(data);
  }

  /**
   * Get modules
   */
  async getModules(filters?: {
    type?: GlobalModule['type'];
    language?: string;
    isGlobal?: boolean;
  }): Promise<GlobalModule[]> {
    let query = supabase
      .from('cms_global_modules')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    if (filters?.language) {
      query = query.eq('language', filters.language);
    }

    if (filters?.isGlobal !== undefined) {
      query = query.eq('is_global', filters.isGlobal);
    }

    const { data } = await query;
    return (data || []).map(this.mapModule);
  }

  /**
   * Get modules for page
   */
  async getModulesForPage(pageId: string): Promise<GlobalModule[]> {
    const { data } = await supabase
      .from('cms_global_modules')
      .select('*')
      .or(`is_global.eq.true,pages.cs.{${pageId}}`)
      .not('exclude_pages', 'cs', `{${pageId}}`);

    return (data || []).map(this.mapModule);
  }

  /**
   * Delete module
   */
  async deleteModule(moduleId: string): Promise<void> {
    await supabase
      .from('cms_global_modules')
      .delete()
      .eq('id', moduleId);
  }

  /**
   * Create navigation
   */
  async createNavigation(nav: Partial<Navigation>): Promise<Navigation> {
    const { data, error } = await supabase
      .from('cms_navigations')
      .insert({
        name: nav.name,
        type: nav.type || 'primary',
        items: nav.items || [],
        settings: nav.settings || {}
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapNavigation(data);
  }

  /**
   * Update navigation
   */
  async updateNavigation(navId: string, updates: Partial<Navigation>): Promise<Navigation> {
    const { data, error } = await supabase
      .from('cms_navigations')
      .update({
        name: updates.name,
        type: updates.type,
        items: updates.items,
        settings: updates.settings,
        updated_at: new Date().toISOString()
      })
      .eq('id', navId)
      .select()
      .single();

    if (error) throw error;
    return this.mapNavigation(data);
  }

  /**
   * Get navigation
   */
  async getNavigation(navId: string): Promise<Navigation> {
    const { data, error } = await supabase
      .from('cms_navigations')
      .select('*')
      .eq('id', navId)
      .single();

    if (error) throw error;
    return this.mapNavigation(data);
  }

  /**
   * Get navigation by type
   */
  async getNavigationByType(type: Navigation['type']): Promise<Navigation | null> {
    const { data } = await supabase
      .from('cms_navigations')
      .select('*')
      .eq('type', type)
      .single();

    if (!data) return null;
    return this.mapNavigation(data);
  }

  /**
   * Map database record to GlobalModule
   */
  private mapModule(data: any): GlobalModule {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      type: data.type,
      content: data.content,
      isGlobal: data.is_global,
      pages: data.pages,
      excludePages: data.exclude_pages,
      visibility: data.visibility,
      language: data.language,
      translations: data.translations,
      usageCount: data.usage_count,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database record to Navigation
   */
  private mapNavigation(data: any): Navigation {
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      items: data.items,
      settings: data.settings,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

/**
 * Create Global Module Service
 */
export function createGlobalModuleService(): GlobalModuleService {
  return new GlobalModuleService();
}
