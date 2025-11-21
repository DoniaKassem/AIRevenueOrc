/**
 * Service Hub - Knowledge Base
 * Self-service help center with articles, search, and customer portal
 */

import { supabase } from '../supabase';

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'published' | 'archived';

  // Organization
  categoryId: string;
  categoryName?: string;
  tags: string[];

  // SEO
  metaTitle?: string;
  metaDescription?: string;

  // Access Control
  visibility: 'public' | 'internal' | 'customer_portal';
  requiresAuthentication: boolean;

  // Analytics
  views: number;
  helpfulVotes: number;
  unhelpfulVotes: number;
  helpfulnessScore: number; // percentage

  // Author
  authorId: string;
  authorName?: string;

  // Related
  relatedArticleIds?: string[];

  // Metadata
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeBaseCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  parentId?: string;
  order: number;
  articleCount: number;
  visibility: 'public' | 'internal' | 'customer_portal';
  createdAt: Date;
}

export interface ArticleAttachment {
  id: string;
  articleId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface ArticleFeedback {
  id: string;
  articleId: string;
  isHelpful: boolean;
  comment?: string;
  userId?: string;
  email?: string;
  ipAddress: string;
  createdAt: Date;
}

export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  categoryName: string;
  relevanceScore: number;
  highlights?: {
    title?: string;
    content?: string;
  };
}

export interface KnowledgeBaseAnalytics {
  totalArticles: number;
  publishedArticles: number;
  totalViews: number;
  avgHelpfulnessScore: number;
  topArticles: Array<{
    id: string;
    title: string;
    views: number;
    helpfulnessScore: number;
  }>;
  topCategories: Array<{
    id: string;
    name: string;
    articleCount: number;
    views: number;
  }>;
  searchQueries: Array<{
    query: string;
    count: number;
    avgResultsClicked: number;
  }>;
  viewsByDate: Array<{
    date: string;
    views: number;
  }>;
}

/**
 * Knowledge Base Service
 */
export class KnowledgeBaseService {
  /**
   * Create article
   */
  async createArticle(article: Partial<KnowledgeBaseArticle>): Promise<KnowledgeBaseArticle> {
    const slug = article.slug || this.generateSlug(article.title || 'article');

    const { data, error } = await supabase
      .from('knowledge_base_articles')
      .insert({
        title: article.title,
        slug,
        content: article.content,
        excerpt: article.excerpt,
        status: article.status || 'draft',
        category_id: article.categoryId,
        tags: article.tags || [],
        meta_title: article.metaTitle || article.title,
        meta_description: article.metaDescription,
        visibility: article.visibility || 'public',
        requires_authentication: article.requiresAuthentication || false,
        author_id: article.authorId,
        related_article_ids: article.relatedArticleIds,
        views: 0,
        helpful_votes: 0,
        unhelpful_votes: 0,
        helpfulness_score: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapArticle(data);
  }

  /**
   * Update article
   */
  async updateArticle(articleId: string, updates: Partial<KnowledgeBaseArticle>): Promise<KnowledgeBaseArticle> {
    const { data, error } = await supabase
      .from('knowledge_base_articles')
      .update({
        title: updates.title,
        slug: updates.slug,
        content: updates.content,
        excerpt: updates.excerpt,
        status: updates.status,
        category_id: updates.categoryId,
        tags: updates.tags,
        meta_title: updates.metaTitle,
        meta_description: updates.metaDescription,
        visibility: updates.visibility,
        requires_authentication: updates.requiresAuthentication,
        related_article_ids: updates.relatedArticleIds,
        updated_at: new Date().toISOString()
      })
      .eq('id', articleId)
      .select()
      .single();

    if (error) throw error;
    return this.mapArticle(data);
  }

  /**
   * Publish article
   */
  async publishArticle(articleId: string): Promise<KnowledgeBaseArticle> {
    const { data, error } = await supabase
      .from('knowledge_base_articles')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', articleId)
      .select()
      .single();

    if (error) throw error;
    return this.mapArticle(data);
  }

  /**
   * Get article by slug
   */
  async getArticleBySlug(slug: string): Promise<KnowledgeBaseArticle | null> {
    const { data, error } = await supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        knowledge_base_categories (
          name
        )
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !data) return null;

    const article = this.mapArticle(data);
    article.categoryName = data.knowledge_base_categories?.name;
    return article;
  }

  /**
   * Get article
   */
  async getArticle(articleId: string): Promise<KnowledgeBaseArticle> {
    const { data, error } = await supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        knowledge_base_categories (
          name
        )
      `)
      .eq('id', articleId)
      .single();

    if (error) throw error;

    const article = this.mapArticle(data);
    article.categoryName = data.knowledge_base_categories?.name;
    return article;
  }

  /**
   * Get articles
   */
  async getArticles(filters?: {
    status?: KnowledgeBaseArticle['status'];
    categoryId?: string;
    visibility?: KnowledgeBaseArticle['visibility'];
    tag?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeBaseArticle[]> {
    let query = supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        knowledge_base_categories (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    if (filters?.visibility) {
      query = query.eq('visibility', filters.visibility);
    }

    if (filters?.tag) {
      query = query.contains('tags', [filters.tag]);
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
    return (data || []).map(d => {
      const article = this.mapArticle(d);
      article.categoryName = d.knowledge_base_categories?.name;
      return article;
    });
  }

  /**
   * Search articles
   */
  async searchArticles(query: string, filters?: {
    categoryId?: string;
    visibility?: KnowledgeBaseArticle['visibility'];
    limit?: number;
  }): Promise<SearchResult[]> {
    // Log search query for analytics
    await this.logSearch(query);

    let dbQuery = supabase
      .from('knowledge_base_articles')
      .select(`
        *,
        knowledge_base_categories (
          name
        )
      `)
      .eq('status', 'published')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`)
      .order('views', { ascending: false });

    if (filters?.categoryId) {
      dbQuery = dbQuery.eq('category_id', filters.categoryId);
    }

    if (filters?.visibility) {
      dbQuery = dbQuery.eq('visibility', filters.visibility);
    }

    if (filters?.limit) {
      dbQuery = dbQuery.limit(filters.limit);
    } else {
      dbQuery = dbQuery.limit(20);
    }

    const { data } = await dbQuery;

    return (data || []).map(article => {
      // Calculate simple relevance score based on where match was found
      let relevanceScore = 0;
      const lowerQuery = query.toLowerCase();
      const lowerTitle = article.title.toLowerCase();
      const lowerContent = article.content.toLowerCase();

      if (lowerTitle.includes(lowerQuery)) {
        relevanceScore += 100;
        if (lowerTitle.startsWith(lowerQuery)) {
          relevanceScore += 50;
        }
      }

      if (lowerContent.includes(lowerQuery)) {
        relevanceScore += 10;
      }

      if (article.tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery))) {
        relevanceScore += 25;
      }

      // Boost by views and helpfulness
      relevanceScore += (article.views / 100);
      relevanceScore += (article.helpfulness_score / 10);

      return {
        id: article.id,
        title: article.title,
        excerpt: article.excerpt,
        slug: article.slug,
        categoryName: article.knowledge_base_categories?.name || 'Unknown',
        relevanceScore,
        highlights: {
          title: this.highlightQuery(article.title, query),
          content: this.highlightQuery(article.excerpt || article.content.substring(0, 200), query)
        }
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Track article view
   */
  async trackArticleView(articleId: string, metadata?: {
    sessionId?: string;
    userId?: string;
    ipAddress?: string;
  }): Promise<void> {
    await supabase.from('knowledge_base_views').insert({
      article_id: articleId,
      session_id: metadata?.sessionId,
      user_id: metadata?.userId,
      ip_address: metadata?.ipAddress,
      viewed_at: new Date().toISOString()
    });

    await supabase.rpc('increment_article_views', { p_article_id: articleId });
  }

  /**
   * Submit article feedback
   */
  async submitFeedback(feedback: Partial<ArticleFeedback>): Promise<ArticleFeedback> {
    const { data, error } = await supabase
      .from('knowledge_base_feedback')
      .insert({
        article_id: feedback.articleId,
        is_helpful: feedback.isHelpful,
        comment: feedback.comment,
        user_id: feedback.userId,
        email: feedback.email,
        ip_address: feedback.ipAddress
      })
      .select()
      .single();

    if (error) throw error;

    // Update article helpfulness score
    const { data: article } = await supabase
      .from('knowledge_base_articles')
      .select('helpful_votes, unhelpful_votes')
      .eq('id', feedback.articleId)
      .single();

    if (article) {
      const helpfulVotes = article.helpful_votes + (feedback.isHelpful ? 1 : 0);
      const unhelpfulVotes = article.unhelpful_votes + (!feedback.isHelpful ? 1 : 0);
      const totalVotes = helpfulVotes + unhelpfulVotes;
      const helpfulnessScore = totalVotes > 0 ? (helpfulVotes / totalVotes) * 100 : 0;

      await supabase
        .from('knowledge_base_articles')
        .update({
          helpful_votes: helpfulVotes,
          unhelpful_votes: unhelpfulVotes,
          helpfulness_score: helpfulnessScore
        })
        .eq('id', feedback.articleId);
    }

    return this.mapFeedback(data);
  }

  /**
   * Create category
   */
  async createCategory(category: Partial<KnowledgeBaseCategory>): Promise<KnowledgeBaseCategory> {
    const slug = category.slug || this.generateSlug(category.name || 'category');

    const { data, error } = await supabase
      .from('knowledge_base_categories')
      .insert({
        name: category.name,
        slug,
        description: category.description,
        icon: category.icon,
        parent_id: category.parentId,
        order: category.order || 0,
        visibility: category.visibility || 'public',
        article_count: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapCategory(data);
  }

  /**
   * Get categories
   */
  async getCategories(parentId?: string | null): Promise<KnowledgeBaseCategory[]> {
    let query = supabase
      .from('knowledge_base_categories')
      .select('*')
      .order('order');

    if (parentId === null) {
      query = query.is('parent_id', null);
    } else if (parentId) {
      query = query.eq('parent_id', parentId);
    }

    const { data } = await query;
    return (data || []).map(this.mapCategory);
  }

  /**
   * Upload attachment
   */
  async uploadAttachment(attachment: Partial<ArticleAttachment>): Promise<ArticleAttachment> {
    const { data, error } = await supabase
      .from('knowledge_base_attachments')
      .insert({
        article_id: attachment.articleId,
        file_name: attachment.fileName,
        file_url: attachment.fileUrl,
        file_size: attachment.fileSize,
        mime_type: attachment.mimeType,
        uploaded_by: attachment.uploadedBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapAttachment(data);
  }

  /**
   * Get article attachments
   */
  async getAttachments(articleId: string): Promise<ArticleAttachment[]> {
    const { data } = await supabase
      .from('knowledge_base_attachments')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at');

    return (data || []).map(this.mapAttachment);
  }

  /**
   * Get analytics
   */
  async getAnalytics(dateRange?: { start: Date; end: Date }): Promise<KnowledgeBaseAnalytics> {
    let articlesQuery = supabase.from('knowledge_base_articles').select('*');
    let viewsQuery = supabase.from('knowledge_base_views').select('*');

    if (dateRange) {
      viewsQuery = viewsQuery
        .gte('viewed_at', dateRange.start.toISOString())
        .lte('viewed_at', dateRange.end.toISOString());
    }

    const { data: articles } = await articlesQuery;
    const { data: views } = await viewsQuery;

    const totalArticles = articles?.length || 0;
    const publishedArticles = articles?.filter(a => a.status === 'published').length || 0;
    const totalViews = views?.length || 0;

    // Average helpfulness
    const helpfulnessScores = articles?.map(a => a.helpfulness_score) || [];
    const avgHelpfulnessScore = helpfulnessScores.length > 0
      ? helpfulnessScores.reduce((a, b) => a + b, 0) / helpfulnessScores.length
      : 0;

    // Top articles
    const topArticles = (articles || [])
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map(a => ({
        id: a.id,
        title: a.title,
        views: a.views,
        helpfulnessScore: a.helpfulness_score
      }));

    // Top categories (placeholder - would need joins)
    const topCategories: KnowledgeBaseAnalytics['topCategories'] = [];

    // Search queries (placeholder - would track separately)
    const searchQueries: KnowledgeBaseAnalytics['searchQueries'] = [];

    // Views by date
    const viewsByDate = this.groupViewsByDate(views || []);

    return {
      totalArticles,
      publishedArticles,
      totalViews,
      avgHelpfulnessScore,
      topArticles,
      topCategories,
      searchQueries,
      viewsByDate
    };
  }

  /**
   * Get related articles
   */
  async getRelatedArticles(articleId: string, limit: number = 5): Promise<KnowledgeBaseArticle[]> {
    const article = await this.getArticle(articleId);

    // Get articles from same category
    let query = supabase
      .from('knowledge_base_articles')
      .select('*')
      .eq('status', 'published')
      .eq('category_id', article.categoryId)
      .neq('id', articleId)
      .order('views', { ascending: false })
      .limit(limit);

    const { data } = await query;
    return (data || []).map(this.mapArticle);
  }

  /**
   * Log search query
   */
  private async logSearch(query: string): Promise<void> {
    await supabase.from('knowledge_base_searches').insert({
      query,
      searched_at: new Date().toISOString()
    });
  }

  /**
   * Highlight query in text
   */
  private highlightQuery(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
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
   * Group views by date
   */
  private groupViewsByDate(views: any[]): Array<{ date: string; views: number }> {
    const groups: Record<string, number> = {};

    views.forEach(v => {
      const date = new Date(v.viewed_at).toISOString().split('T')[0];
      groups[date] = (groups[date] || 0) + 1;
    });

    return Object.entries(groups)
      .map(([date, views]) => ({ date, views }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Map database record to Article
   */
  private mapArticle(data: any): KnowledgeBaseArticle {
    return {
      id: data.id,
      title: data.title,
      slug: data.slug,
      content: data.content,
      excerpt: data.excerpt,
      status: data.status,
      categoryId: data.category_id,
      tags: data.tags || [],
      metaTitle: data.meta_title,
      metaDescription: data.meta_description,
      visibility: data.visibility,
      requiresAuthentication: data.requires_authentication,
      views: data.views,
      helpfulVotes: data.helpful_votes,
      unhelpfulVotes: data.unhelpful_votes,
      helpfulnessScore: data.helpfulness_score,
      authorId: data.author_id,
      relatedArticleIds: data.related_article_ids,
      publishedAt: data.published_at ? new Date(data.published_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database record to Category
   */
  private mapCategory(data: any): KnowledgeBaseCategory {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      icon: data.icon,
      parentId: data.parent_id,
      order: data.order,
      articleCount: data.article_count,
      visibility: data.visibility,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to Attachment
   */
  private mapAttachment(data: any): ArticleAttachment {
    return {
      id: data.id,
      articleId: data.article_id,
      fileName: data.file_name,
      fileUrl: data.file_url,
      fileSize: data.file_size,
      mimeType: data.mime_type,
      uploadedBy: data.uploaded_by,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to Feedback
   */
  private mapFeedback(data: any): ArticleFeedback {
    return {
      id: data.id,
      articleId: data.article_id,
      isHelpful: data.is_helpful,
      comment: data.comment,
      userId: data.user_id,
      email: data.email,
      ipAddress: data.ip_address,
      createdAt: new Date(data.created_at)
    };
  }
}

/**
 * Create Knowledge Base Service
 */
export function createKnowledgeBaseService(): KnowledgeBaseService {
  return new KnowledgeBaseService();
}
