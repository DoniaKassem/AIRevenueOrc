/**
 * Blog Platform
 * Content management system with SEO optimization and analytics
 */

import { supabase } from '../supabase';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  publishedAt?: Date;
  scheduledFor?: Date;

  // Author
  authorId: string;
  authorName?: string;
  authorAvatar?: string;

  // SEO
  metaTitle: string;
  metaDescription: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  robotsMeta?: string;

  // Featured Image
  featuredImage?: string;
  featuredImageAlt?: string;

  // Organization
  categoryIds: string[];
  tagIds: string[];

  // Settings
  allowComments: boolean;
  enableSocialSharing: boolean;
  template?: 'default' | 'full-width' | 'sidebar' | 'minimal';

  // Analytics
  views: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
  shares: number;
  comments: number;

  // SEO Score
  seoScore?: number;
  seoIssues?: string[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId?: string;
  metaTitle?: string;
  metaDescription?: string;
  postCount: number;
  createdAt: Date;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
  createdAt: Date;
}

export interface BlogComment {
  id: string;
  postId: string;
  authorName: string;
  authorEmail: string;
  authorWebsite?: string;
  content: string;
  status: 'pending' | 'approved' | 'spam' | 'deleted';
  parentId?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

export interface SEOAnalysis {
  score: number;
  issues: string[];
  suggestions: string[];
  metrics: {
    titleLength: number;
    descriptionLength: number;
    contentLength: number;
    headingCount: number;
    imageCount: number;
    linkCount: number;
    keywordDensity: number;
    readabilityScore: number;
  };
}

export interface BlogAnalytics {
  totalPosts: number;
  publishedPosts: number;
  totalViews: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
  topPosts: Array<{
    id: string;
    title: string;
    views: number;
    shares: number;
  }>;
  viewsByDate: Array<{
    date: string;
    views: number;
    visitors: number;
  }>;
  topCategories: Array<{
    id: string;
    name: string;
    postCount: number;
    views: number;
  }>;
  topTags: Array<{
    id: string;
    name: string;
    postCount: number;
  }>;
}

/**
 * Blog Service
 */
export class BlogService {
  /**
   * Create blog post
   */
  async createPost(post: Partial<BlogPost>): Promise<BlogPost> {
    // Generate slug if not provided
    const slug = post.slug || this.generateSlug(post.title || 'post');

    // Analyze SEO
    const seoAnalysis = this.analyzeSEO({
      title: post.title || '',
      metaDescription: post.metaDescription || '',
      content: post.content || '',
      focusKeyword: post.focusKeyword
    });

    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title: post.title,
        slug,
        excerpt: post.excerpt,
        content: post.content,
        status: post.status || 'draft',
        scheduled_for: post.scheduledFor?.toISOString(),
        author_id: post.authorId,
        meta_title: post.metaTitle || post.title,
        meta_description: post.metaDescription,
        focus_keyword: post.focusKeyword,
        canonical_url: post.canonicalUrl,
        robots_meta: post.robotsMeta,
        featured_image: post.featuredImage,
        featured_image_alt: post.featuredImageAlt,
        category_ids: post.categoryIds || [],
        tag_ids: post.tagIds || [],
        allow_comments: post.allowComments !== false,
        enable_social_sharing: post.enableSocialSharing !== false,
        template: post.template || 'default',
        seo_score: seoAnalysis.score,
        seo_issues: seoAnalysis.issues,
        views: 0,
        unique_visitors: 0,
        avg_time_on_page: 0,
        shares: 0,
        comments: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapPost(data);
  }

  /**
   * Update blog post
   */
  async updatePost(postId: string, updates: Partial<BlogPost>): Promise<BlogPost> {
    // Re-analyze SEO if content changed
    let seoAnalysis;
    if (updates.title || updates.content || updates.metaDescription || updates.focusKeyword) {
      const current = await this.getPost(postId);
      seoAnalysis = this.analyzeSEO({
        title: updates.title || current.title,
        metaDescription: updates.metaDescription || current.metaDescription,
        content: updates.content || current.content,
        focusKeyword: updates.focusKeyword || current.focusKeyword
      });
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .update({
        title: updates.title,
        slug: updates.slug,
        excerpt: updates.excerpt,
        content: updates.content,
        status: updates.status,
        scheduled_for: updates.scheduledFor?.toISOString(),
        meta_title: updates.metaTitle,
        meta_description: updates.metaDescription,
        focus_keyword: updates.focusKeyword,
        canonical_url: updates.canonicalUrl,
        robots_meta: updates.robotsMeta,
        featured_image: updates.featuredImage,
        featured_image_alt: updates.featuredImageAlt,
        category_ids: updates.categoryIds,
        tag_ids: updates.tagIds,
        allow_comments: updates.allowComments,
        enable_social_sharing: updates.enableSocialSharing,
        template: updates.template,
        seo_score: seoAnalysis?.score,
        seo_issues: seoAnalysis?.issues,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;
    return this.mapPost(data);
  }

  /**
   * Publish post
   */
  async publishPost(postId: string): Promise<BlogPost> {
    const { data, error } = await supabase
      .from('blog_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;
    return this.mapPost(data);
  }

  /**
   * Unpublish post
   */
  async unpublishPost(postId: string): Promise<BlogPost> {
    const { data, error } = await supabase
      .from('blog_posts')
      .update({ status: 'draft' })
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;
    return this.mapPost(data);
  }

  /**
   * Schedule post
   */
  async schedulePost(postId: string, scheduledFor: Date): Promise<BlogPost> {
    const { data, error } = await supabase
      .from('blog_posts')
      .update({
        status: 'scheduled',
        scheduled_for: scheduledFor.toISOString()
      })
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;
    return this.mapPost(data);
  }

  /**
   * Get post by slug
   */
  async getPostBySlug(slug: string): Promise<BlogPost | null> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !data) return null;
    return this.mapPost(data);
  }

  /**
   * Get post by ID
   */
  async getPost(postId: string): Promise<BlogPost> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (error) throw error;
    return this.mapPost(data);
  }

  /**
   * Get all posts
   */
  async getPosts(filters?: {
    status?: BlogPost['status'];
    categoryId?: string;
    tagId?: string;
    authorId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<BlogPost[]> {
    let query = supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.categoryId) {
      query = query.contains('category_ids', [filters.categoryId]);
    }

    if (filters?.tagId) {
      query = query.contains('tag_ids', [filters.tagId]);
    }

    if (filters?.authorId) {
      query = query.eq('author_id', filters.authorId);
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data } = await query;
    return (data || []).map(this.mapPost);
  }

  /**
   * Track post view
   */
  async trackPostView(postId: string, sessionId: string, metadata?: {
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
  }): Promise<void> {
    // Check if unique visitor
    const { count } = await supabase
      .from('blog_post_views')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('session_id', sessionId);

    const isUnique = count === 0;

    await supabase.from('blog_post_views').insert({
      post_id: postId,
      session_id: sessionId,
      is_unique: isUnique,
      ip_address: metadata?.ipAddress,
      user_agent: metadata?.userAgent,
      referrer: metadata?.referrer,
      viewed_at: new Date().toISOString()
    });
  }

  /**
   * Track social share
   */
  async trackShare(postId: string, platform: 'facebook' | 'twitter' | 'linkedin' | 'email' | 'other'): Promise<void> {
    await supabase.from('blog_post_shares').insert({
      post_id: postId,
      platform,
      shared_at: new Date().toISOString()
    });

    await supabase.rpc('increment_post_shares', { p_post_id: postId });
  }

  /**
   * Create category
   */
  async createCategory(category: Partial<BlogCategory>): Promise<BlogCategory> {
    const slug = category.slug || this.generateSlug(category.name || 'category');

    const { data, error } = await supabase
      .from('blog_categories')
      .insert({
        name: category.name,
        slug,
        description: category.description,
        parent_id: category.parentId,
        meta_title: category.metaTitle,
        meta_description: category.metaDescription,
        post_count: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapCategory(data);
  }

  /**
   * Get categories
   */
  async getCategories(): Promise<BlogCategory[]> {
    const { data } = await supabase
      .from('blog_categories')
      .select('*')
      .order('name');

    return (data || []).map(this.mapCategory);
  }

  /**
   * Create tag
   */
  async createTag(tag: Partial<BlogTag>): Promise<BlogTag> {
    const slug = tag.slug || this.generateSlug(tag.name || 'tag');

    const { data, error } = await supabase
      .from('blog_tags')
      .insert({
        name: tag.name,
        slug,
        post_count: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTag(data);
  }

  /**
   * Get tags
   */
  async getTags(): Promise<BlogTag[]> {
    const { data } = await supabase
      .from('blog_tags')
      .select('*')
      .order('name');

    return (data || []).map(this.mapTag);
  }

  /**
   * Create comment
   */
  async createComment(comment: Partial<BlogComment>): Promise<BlogComment> {
    const { data, error } = await supabase
      .from('blog_comments')
      .insert({
        post_id: comment.postId,
        author_name: comment.authorName,
        author_email: comment.authorEmail,
        author_website: comment.authorWebsite,
        content: comment.content,
        status: 'pending',
        parent_id: comment.parentId,
        ip_address: comment.ipAddress,
        user_agent: comment.userAgent
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapComment(data);
  }

  /**
   * Approve comment
   */
  async approveComment(commentId: string): Promise<BlogComment> {
    const { data, error } = await supabase
      .from('blog_comments')
      .update({ status: 'approved' })
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw error;

    // Increment comment count
    const comment = this.mapComment(data);
    await supabase.rpc('increment_post_comments', { p_post_id: comment.postId });

    return comment;
  }

  /**
   * Get comments for post
   */
  async getComments(postId: string, status?: BlogComment['status']): Promise<BlogComment[]> {
    let query = supabase
      .from('blog_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data } = await query;
    return (data || []).map(this.mapComment);
  }

  /**
   * Analyze SEO
   */
  analyzeSEO(params: {
    title: string;
    metaDescription: string;
    content: string;
    focusKeyword?: string;
  }): SEOAnalysis {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Title analysis
    const titleLength = params.title.length;
    if (titleLength < 30) {
      issues.push('Title is too short (< 30 characters)');
      score -= 10;
    } else if (titleLength > 60) {
      issues.push('Title is too long (> 60 characters)');
      score -= 5;
    }

    // Meta description analysis
    const descriptionLength = params.metaDescription.length;
    if (descriptionLength < 120) {
      issues.push('Meta description is too short (< 120 characters)');
      score -= 10;
    } else if (descriptionLength > 160) {
      issues.push('Meta description is too long (> 160 characters)');
      score -= 5;
    }

    // Content analysis
    const contentLength = params.content.length;
    const wordCount = params.content.split(/\s+/).length;

    if (wordCount < 300) {
      issues.push('Content is too short (< 300 words)');
      score -= 15;
    } else if (wordCount > 2500) {
      suggestions.push('Consider breaking this into multiple posts');
    }

    // Heading analysis
    const headingCount = (params.content.match(/<h[1-6]>/g) || []).length;
    if (headingCount === 0) {
      issues.push('No headings found in content');
      score -= 10;
    }

    // Image analysis
    const imageCount = (params.content.match(/<img/g) || []).length;
    if (imageCount === 0) {
      suggestions.push('Consider adding images to improve engagement');
    }

    // Link analysis
    const linkCount = (params.content.match(/<a/g) || []).length;

    // Keyword density
    let keywordDensity = 0;
    if (params.focusKeyword) {
      const keywordRegex = new RegExp(params.focusKeyword, 'gi');
      const keywordMatches = params.content.match(keywordRegex) || [];
      keywordDensity = (keywordMatches.length / wordCount) * 100;

      if (!params.title.toLowerCase().includes(params.focusKeyword.toLowerCase())) {
        issues.push('Focus keyword not found in title');
        score -= 10;
      }

      if (!params.metaDescription.toLowerCase().includes(params.focusKeyword.toLowerCase())) {
        issues.push('Focus keyword not found in meta description');
        score -= 5;
      }

      if (keywordDensity < 0.5) {
        suggestions.push('Keyword density is low, consider using focus keyword more');
      } else if (keywordDensity > 2.5) {
        issues.push('Keyword density is too high (keyword stuffing)');
        score -= 10;
      }
    } else {
      suggestions.push('Set a focus keyword for better SEO');
    }

    // Readability score (simplified Flesch reading ease)
    const sentences = params.content.split(/[.!?]+/).length;
    const syllables = this.estimateSyllables(params.content);
    const readabilityScore = 206.835 - 1.015 * (wordCount / sentences) - 84.6 * (syllables / wordCount);

    if (readabilityScore < 60) {
      suggestions.push('Content may be difficult to read, consider simplifying');
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    return {
      score,
      issues,
      suggestions,
      metrics: {
        titleLength,
        descriptionLength,
        contentLength,
        headingCount,
        imageCount,
        linkCount,
        keywordDensity,
        readabilityScore
      }
    };
  }

  /**
   * Get blog analytics
   */
  async getBlogAnalytics(dateRange?: { start: Date; end: Date }): Promise<BlogAnalytics> {
    let postsQuery = supabase.from('blog_posts').select('*');
    let viewsQuery = supabase.from('blog_post_views').select('*');

    if (dateRange) {
      viewsQuery = viewsQuery
        .gte('viewed_at', dateRange.start.toISOString())
        .lte('viewed_at', dateRange.end.toISOString());
    }

    const { data: posts } = await postsQuery;
    const { data: views } = await viewsQuery;

    const totalPosts = posts?.length || 0;
    const publishedPosts = posts?.filter(p => p.status === 'published').length || 0;
    const totalViews = views?.length || 0;
    const uniqueVisitors = new Set(views?.filter(v => v.is_unique).map(v => v.session_id)).size;

    // Top posts
    const postViews: Record<string, number> = {};
    views?.forEach(v => {
      postViews[v.post_id] = (postViews[v.post_id] || 0) + 1;
    });

    const topPosts = Object.entries(postViews)
      .map(([postId, viewCount]) => {
        const post = posts?.find(p => p.id === postId);
        return {
          id: postId,
          title: post?.title || 'Unknown',
          views: viewCount,
          shares: post?.shares || 0
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Views by date
    const viewsByDate: Record<string, { views: number; visitors: Set<string> }> = {};
    views?.forEach(v => {
      const date = new Date(v.viewed_at).toISOString().split('T')[0];
      if (!viewsByDate[date]) {
        viewsByDate[date] = { views: 0, visitors: new Set() };
      }
      viewsByDate[date].views++;
      if (v.is_unique) {
        viewsByDate[date].visitors.add(v.session_id);
      }
    });

    const viewsByDateArray = Object.entries(viewsByDate).map(([date, data]) => ({
      date,
      views: data.views,
      visitors: data.visitors.size
    }));

    // Categories and tags would require joins - placeholder
    const topCategories: BlogAnalytics['topCategories'] = [];
    const topTags: BlogAnalytics['topTags'] = [];

    return {
      totalPosts,
      publishedPosts,
      totalViews,
      uniqueVisitors,
      avgTimeOnPage: 0, // Would calculate from session data
      topPosts,
      viewsByDate: viewsByDateArray,
      topCategories,
      topTags
    };
  }

  /**
   * Generate slug from text
   */
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Estimate syllables for readability score
   */
  private estimateSyllables(text: string): number {
    const words = text.split(/\s+/);
    let syllables = 0;

    words.forEach(word => {
      word = word.toLowerCase().replace(/[^a-z]/g, '');
      if (word.length <= 3) {
        syllables += 1;
      } else {
        const vowelGroups = word.match(/[aeiouy]+/g);
        syllables += vowelGroups ? vowelGroups.length : 1;
      }
    });

    return syllables;
  }

  /**
   * Map database record to BlogPost
   */
  private mapPost(data: any): BlogPost {
    return {
      id: data.id,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      status: data.status,
      publishedAt: data.published_at ? new Date(data.published_at) : undefined,
      scheduledFor: data.scheduled_for ? new Date(data.scheduled_for) : undefined,
      authorId: data.author_id,
      metaTitle: data.meta_title,
      metaDescription: data.meta_description,
      focusKeyword: data.focus_keyword,
      canonicalUrl: data.canonical_url,
      robotsMeta: data.robots_meta,
      featuredImage: data.featured_image,
      featuredImageAlt: data.featured_image_alt,
      categoryIds: data.category_ids,
      tagIds: data.tag_ids,
      allowComments: data.allow_comments,
      enableSocialSharing: data.enable_social_sharing,
      template: data.template,
      views: data.views,
      uniqueVisitors: data.unique_visitors,
      avgTimeOnPage: data.avg_time_on_page,
      shares: data.shares,
      comments: data.comments,
      seoScore: data.seo_score,
      seoIssues: data.seo_issues,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database record to BlogCategory
   */
  private mapCategory(data: any): BlogCategory {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      parentId: data.parent_id,
      metaTitle: data.meta_title,
      metaDescription: data.meta_description,
      postCount: data.post_count,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to BlogTag
   */
  private mapTag(data: any): BlogTag {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      postCount: data.post_count,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to BlogComment
   */
  private mapComment(data: any): BlogComment {
    return {
      id: data.id,
      postId: data.post_id,
      authorName: data.author_name,
      authorEmail: data.author_email,
      authorWebsite: data.author_website,
      content: data.content,
      status: data.status,
      parentId: data.parent_id,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      createdAt: new Date(data.created_at)
    };
  }
}

/**
 * Create Blog Service
 */
export function createBlogService(): BlogService {
  return new BlogService();
}
