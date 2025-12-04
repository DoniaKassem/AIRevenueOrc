/**
 * LinkedIn Data Connector
 * Uses Proxycurl API for LinkedIn profile and company data enrichment
 * Also supports RapidAPI LinkedIn API as fallback
 */

import { supabase } from '../supabase';

export interface LinkedInProfile {
  firstName: string;
  lastName: string;
  headline: string;
  summary: string;
  profilePicUrl: string;
  publicIdentifier: string;
  linkedinUrl: string;
  location: string;
  country: string;
  currentCompany: {
    name: string;
    title: string;
    startDate: string;
    linkedinUrl?: string;
  };
  experiences: Array<{
    company: string;
    title: string;
    description: string;
    startDate: string;
    endDate?: string;
    location: string;
    linkedinUrl?: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate?: string;
  }>;
  skills: string[];
  certifications: Array<{
    name: string;
    authority: string;
    startDate?: string;
  }>;
  languages: string[];
  connections: number;
  followers: number;
}

export interface LinkedInCompany {
  name: string;
  description: string;
  website: string;
  industry: string;
  companySize: string;
  employeeCount: number;
  headquarters: {
    city: string;
    country: string;
    postalCode: string;
  };
  founded: number;
  specialties: string[];
  linkedinUrl: string;
  logoUrl: string;
  followerCount: number;
  type: string; // Public, Private, etc.
  recentPosts: Array<{
    text: string;
    postedAt: string;
    likes: number;
    comments: number;
  }>;
  recentHires: Array<{
    name: string;
    title: string;
    linkedinUrl: string;
    joinedDate: string;
  }>;
  jobPostings: Array<{
    title: string;
    location: string;
    postedAt: string;
    jobUrl: string;
  }>;
}

export interface LinkedInEnrichmentResult {
  success: boolean;
  provider: 'proxycurl' | 'rapidapi' | 'mock';
  profile?: LinkedInProfile;
  company?: LinkedInCompany;
  error?: string;
  metadata: {
    requestedAt: string;
    completedAt: string;
    durationMs: number;
    creditsUsed: number;
  };
}

/**
 * LinkedIn Connector using Proxycurl API
 */
export class LinkedInConnector {
  private proxycurlApiKey: string;
  private rapidApiKey?: string;
  private baseUrl = 'https://nubela.co/proxycurl/api';

  constructor(proxycurlApiKey: string, rapidApiKey?: string) {
    this.proxycurlApiKey = proxycurlApiKey;
    this.rapidApiKey = rapidApiKey;
  }

  /**
   * Enrich person profile from LinkedIn URL
   */
  async enrichPerson(linkedinUrl: string): Promise<LinkedInEnrichmentResult> {
    const startTime = Date.now();

    try {
      // Try Proxycurl first
      const profile = await this.fetchProxycurlProfile(linkedinUrl);

      return {
        success: true,
        provider: 'proxycurl',
        profile,
        metadata: {
          requestedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          creditsUsed: 1,
        },
      };
    } catch (proxycurlError) {
      console.error('Proxycurl enrichment failed:', proxycurlError);

      // Try RapidAPI fallback if available
      if (this.rapidApiKey) {
        try {
          const profile = await this.fetchRapidAPIProfile(linkedinUrl);
          return {
            success: true,
            provider: 'rapidapi',
            profile,
            metadata: {
              requestedAt: new Date(startTime).toISOString(),
              completedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
              creditsUsed: 1,
            },
          };
        } catch (rapidApiError) {
          console.error('RapidAPI fallback failed:', rapidApiError);
        }
      }

      return {
        success: false,
        provider: 'proxycurl',
        error: proxycurlError instanceof Error ? proxycurlError.message : 'LinkedIn enrichment failed',
        metadata: {
          requestedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          creditsUsed: 0,
        },
      };
    }
  }

  /**
   * Enrich company profile from LinkedIn URL or domain
   */
  async enrichCompany(linkedinUrlOrDomain: string): Promise<LinkedInEnrichmentResult> {
    const startTime = Date.now();

    try {
      const company = await this.fetchProxycurlCompany(linkedinUrlOrDomain);

      return {
        success: true,
        provider: 'proxycurl',
        company,
        metadata: {
          requestedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          creditsUsed: 1,
        },
      };
    } catch (error) {
      console.error('LinkedIn company enrichment failed:', error);

      return {
        success: false,
        provider: 'proxycurl',
        error: error instanceof Error ? error.message : 'Company enrichment failed',
        metadata: {
          requestedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          creditsUsed: 0,
        },
      };
    }
  }

  /**
   * Find LinkedIn URL from email
   */
  async findLinkedInUrl(email: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/linkedin/profile/resolve/email?work_email=${encodeURIComponent(email)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.proxycurlApiKey}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.url || null;
    } catch (error) {
      console.error('LinkedIn URL lookup failed:', error);
      return null;
    }
  }

  /**
   * Get company employees by role
   */
  async getCompanyEmployees(
    companyLinkedinUrl: string,
    roleKeywords?: string[],
    limit: number = 10
  ): Promise<Array<{ name: string; title: string; linkedinUrl: string }>> {
    try {
      const params = new URLSearchParams({
        url: companyLinkedinUrl,
        role_search: roleKeywords?.join(' OR ') || 'VP Director Manager',
        page_size: limit.toString(),
      });

      const response = await fetch(
        `${this.baseUrl}/linkedin/company/employees?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${this.proxycurlApiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.employees || []).map((emp: any) => ({
        name: emp.name,
        title: emp.title,
        linkedinUrl: emp.profile_url,
      }));
    } catch (error) {
      console.error('Company employees lookup failed:', error);
      return [];
    }
  }

  /**
   * Fetch profile from Proxycurl API
   */
  private async fetchProxycurlProfile(linkedinUrl: string): Promise<LinkedInProfile> {
    const response = await fetch(
      `${this.baseUrl}/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}&skills=include&inferred_salary=include&personal_email=include&personal_contact_number=include`,
      {
        headers: {
          'Authorization': `Bearer ${this.proxycurlApiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Proxycurl API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse current position
    const currentExperience = data.experiences?.find((exp: any) => !exp.ends_at) || data.experiences?.[0];

    return {
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      headline: data.headline || '',
      summary: data.summary || '',
      profilePicUrl: data.profile_pic_url || '',
      publicIdentifier: data.public_identifier || '',
      linkedinUrl: linkedinUrl,
      location: data.city || '',
      country: data.country_full_name || '',
      currentCompany: {
        name: currentExperience?.company || '',
        title: currentExperience?.title || '',
        startDate: this.formatDate(currentExperience?.starts_at),
        linkedinUrl: currentExperience?.company_linkedin_profile_url,
      },
      experiences: (data.experiences || []).map((exp: any) => ({
        company: exp.company || '',
        title: exp.title || '',
        description: exp.description || '',
        startDate: this.formatDate(exp.starts_at),
        endDate: exp.ends_at ? this.formatDate(exp.ends_at) : undefined,
        location: exp.location || '',
        linkedinUrl: exp.company_linkedin_profile_url,
      })),
      education: (data.education || []).map((edu: any) => ({
        school: edu.school || '',
        degree: edu.degree_name || '',
        fieldOfStudy: edu.field_of_study || '',
        startDate: this.formatDate(edu.starts_at),
        endDate: edu.ends_at ? this.formatDate(edu.ends_at) : undefined,
      })),
      skills: data.skills || [],
      certifications: (data.certifications || []).map((cert: any) => ({
        name: cert.name || '',
        authority: cert.authority || '',
        startDate: cert.starts_at ? this.formatDate(cert.starts_at) : undefined,
      })),
      languages: (data.languages || []).map((lang: any) => lang.name || lang),
      connections: data.connections || 0,
      followers: data.follower_count || 0,
    };
  }

  /**
   * Fetch profile from RapidAPI (fallback)
   */
  private async fetchRapidAPIProfile(linkedinUrl: string): Promise<LinkedInProfile> {
    if (!this.rapidApiKey) {
      throw new Error('RapidAPI key not configured');
    }

    const response = await fetch(
      `https://linkedin-api8.p.rapidapi.com/get-profile-data-by-url?url=${encodeURIComponent(linkedinUrl)}`,
      {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'linkedin-api8.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`RapidAPI error: ${response.status}`);
    }

    const data = await response.json();

    return {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      headline: data.headline || '',
      summary: data.summary || '',
      profilePicUrl: data.profilePicture || '',
      publicIdentifier: data.username || '',
      linkedinUrl: linkedinUrl,
      location: data.geo?.full || '',
      country: data.geo?.country || '',
      currentCompany: {
        name: data.position?.[0]?.companyName || '',
        title: data.position?.[0]?.title || '',
        startDate: data.position?.[0]?.start?.year?.toString() || '',
      },
      experiences: (data.position || []).map((pos: any) => ({
        company: pos.companyName || '',
        title: pos.title || '',
        description: pos.description || '',
        startDate: pos.start?.year?.toString() || '',
        endDate: pos.end?.year?.toString(),
        location: pos.location || '',
      })),
      education: (data.educations || []).map((edu: any) => ({
        school: edu.schoolName || '',
        degree: edu.degreeName || '',
        fieldOfStudy: edu.fieldOfStudy || '',
        startDate: edu.start?.year?.toString() || '',
        endDate: edu.end?.year?.toString(),
      })),
      skills: data.skills || [],
      certifications: [],
      languages: data.languages || [],
      connections: data.connectionCount || 0,
      followers: data.followerCount || 0,
    };
  }

  /**
   * Fetch company from Proxycurl API
   */
  private async fetchProxycurlCompany(linkedinUrlOrDomain: string): Promise<LinkedInCompany> {
    // Determine if it's a URL or domain
    const isUrl = linkedinUrlOrDomain.includes('linkedin.com');

    let endpoint: string;
    if (isUrl) {
      endpoint = `${this.baseUrl}/linkedin/company?url=${encodeURIComponent(linkedinUrlOrDomain)}`;
    } else {
      endpoint = `${this.baseUrl}/linkedin/company/resolve?company_domain=${encodeURIComponent(linkedinUrlOrDomain)}`;
    }

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${this.proxycurlApiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Proxycurl API error: ${response.status}`);
    }

    const data = await response.json();

    // If we resolved by domain, fetch full company profile
    let companyData = data;
    if (!isUrl && data.url) {
      const fullResponse = await fetch(
        `${this.baseUrl}/linkedin/company?url=${encodeURIComponent(data.url)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.proxycurlApiKey}`,
          },
        }
      );
      if (fullResponse.ok) {
        companyData = await fullResponse.json();
      }
    }

    return {
      name: companyData.name || '',
      description: companyData.description || '',
      website: companyData.website || '',
      industry: companyData.industry || '',
      companySize: companyData.company_size || '',
      employeeCount: companyData.company_size_on_linkedin || 0,
      headquarters: {
        city: companyData.hq?.city || '',
        country: companyData.hq?.country || '',
        postalCode: companyData.hq?.postal_code || '',
      },
      founded: companyData.founded_year || 0,
      specialties: companyData.specialities || [],
      linkedinUrl: companyData.linkedin_internal_id
        ? `https://www.linkedin.com/company/${companyData.linkedin_internal_id}`
        : '',
      logoUrl: companyData.profile_pic_url || '',
      followerCount: companyData.follower_count || 0,
      type: companyData.company_type || '',
      recentPosts: (companyData.updates || []).slice(0, 5).map((post: any) => ({
        text: post.text || '',
        postedAt: post.posted_on?.day
          ? `${post.posted_on.year}-${post.posted_on.month}-${post.posted_on.day}`
          : '',
        likes: post.num_likes || 0,
        comments: post.num_comments || 0,
      })),
      recentHires: [], // Would need separate API call
      jobPostings: [], // Would need separate API call
    };
  }

  /**
   * Format Proxycurl date object
   */
  private formatDate(dateObj: any): string {
    if (!dateObj) return '';
    const year = dateObj.year || '';
    const month = dateObj.month ? String(dateObj.month).padStart(2, '0') : '01';
    return year ? `${year}-${month}` : '';
  }
}

/**
 * Create LinkedIn connector from team configuration
 */
export async function createLinkedInConnector(teamId: string): Promise<LinkedInConnector | null> {
  const { data: integrations } = await supabase
    .from('team_integrations')
    .select('provider_key, credentials')
    .eq('team_id', teamId)
    .in('provider_key', ['proxycurl', 'rapidapi_linkedin']);

  let proxycurlKey: string | undefined;
  let rapidApiKey: string | undefined;

  for (const integration of integrations || []) {
    if (integration.provider_key === 'proxycurl' && integration.credentials?.api_key) {
      proxycurlKey = integration.credentials.api_key;
    }
    if (integration.provider_key === 'rapidapi_linkedin' && integration.credentials?.api_key) {
      rapidApiKey = integration.credentials.api_key;
    }
  }

  // Also check environment variables
  proxycurlKey = proxycurlKey || process.env.PROXYCURL_API_KEY;
  rapidApiKey = rapidApiKey || process.env.RAPIDAPI_KEY;

  if (!proxycurlKey) {
    console.warn('LinkedIn connector not available - no API key configured');
    return null;
  }

  return new LinkedInConnector(proxycurlKey, rapidApiKey);
}

/**
 * Enrich prospect with LinkedIn data
 */
export async function enrichProspectWithLinkedIn(
  teamId: string,
  prospectId: string,
  linkedinUrl?: string,
  email?: string
): Promise<LinkedInEnrichmentResult> {
  const connector = await createLinkedInConnector(teamId);

  if (!connector) {
    return {
      success: false,
      provider: 'mock',
      error: 'LinkedIn connector not configured',
      metadata: {
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        creditsUsed: 0,
      },
    };
  }

  // Find LinkedIn URL from email if not provided
  let targetUrl = linkedinUrl;
  if (!targetUrl && email) {
    targetUrl = await connector.findLinkedInUrl(email) || undefined;
  }

  if (!targetUrl) {
    return {
      success: false,
      provider: 'proxycurl',
      error: 'No LinkedIn URL available',
      metadata: {
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        creditsUsed: 0,
      },
    };
  }

  const result = await connector.enrichPerson(targetUrl);

  // Update prospect with LinkedIn data if successful
  if (result.success && result.profile) {
    await supabase
      .from('prospects')
      .update({
        linkedin_url: targetUrl,
        linkedin_data: result.profile,
        linkedin_enriched_at: new Date().toISOString(),
        title: result.profile.currentCompany.title || undefined,
        headline: result.profile.headline || undefined,
      })
      .eq('id', prospectId);
  }

  // Log enrichment request
  await supabase.from('enrichment_requests').insert({
    team_id: teamId,
    prospect_id: prospectId,
    provider: result.provider,
    enrichment_type: 'linkedin_profile',
    status: result.success ? 'completed' : 'failed',
    response_data: result.profile || null,
    error_message: result.error || null,
    credits_used: result.metadata.creditsUsed,
    duration_ms: result.metadata.durationMs,
  });

  return result;
}
