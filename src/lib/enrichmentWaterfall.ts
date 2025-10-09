import { supabase } from './supabase';

export interface EnrichmentProvider {
  id: string;
  provider_name: string;
  display_name: string;
  priority_order: number;
  is_enabled: boolean;
  credits_remaining: number;
  config: any;
}

export interface EnrichmentInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  domain?: string;
  linkedinUrl?: string;
}

export interface EnrichmentResult {
  success: boolean;
  data?: any;
  provider?: string;
  attemptsCount: number;
  totalDuration: number;
  creditsConsumed: number;
  waterfallLog: Array<{
    provider: string;
    status: string;
    duration: number;
    error?: string;
  }>;
}

async function getEnabledProviders(): Promise<EnrichmentProvider[]> {
  const { data, error } = await supabase
    .from('enrichment_providers')
    .select('*')
    .eq('is_enabled', true)
    .gt('credits_remaining', 0)
    .order('priority_order', { ascending: true });

  if (error) {
    console.error('Error fetching providers:', error);
    return [];
  }

  return data || [];
}

async function attemptProviderEnrichment(
  provider: EnrichmentProvider,
  input: EnrichmentInput,
  enrichmentRequestId: string,
  attemptOrder: number
): Promise<{ success: boolean; data?: any; duration: number; error?: string }> {
  const startTime = Date.now();

  try {
    const result = await mockProviderCall(provider, input);
    const duration = Date.now() - startTime;

    const dataQualityScore = calculateDataQuality(result.data);

    await supabase.from('enrichment_provider_attempts').insert({
      enrichment_request_id: enrichmentRequestId,
      provider_id: provider.id,
      attempt_order: attemptOrder,
      status: result.success ? 'success' : 'failed',
      response_data: result.data || {},
      error_message: result.error,
      duration_ms: duration,
      credits_used: 1,
      data_quality_score: dataQualityScore,
      fields_enriched: result.success ? Object.keys(result.data || {}) : [],
    });

    if (result.success) {
      await supabase
        .from('enrichment_providers')
        .update({
          credits_remaining: provider.credits_remaining - 1,
          credits_used_this_month: (provider as any).credits_used_this_month + 1,
        })
        .eq('id', provider.id);
    }

    return {
      success: result.success,
      data: result.data,
      duration,
      error: result.error,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    await supabase.from('enrichment_provider_attempts').insert({
      enrichment_request_id: enrichmentRequestId,
      provider_id: provider.id,
      attempt_order: attemptOrder,
      status: 'failed',
      error_message: error.message,
      duration_ms: duration,
      credits_used: 0,
    });

    return {
      success: false,
      duration,
      error: error.message,
    };
  }
}

async function mockProviderCall(
  provider: EnrichmentProvider,
  input: EnrichmentInput
): Promise<{ success: boolean; data?: any; error?: string }> {
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));

  const successRate = Math.random();
  const providerSuccessRates: Record<string, number> = {
    clearbit: 0.85,
    zoominfo: 0.75,
    apollo: 0.80,
    hunter: 0.70,
    pdl: 0.65,
  };

  const threshold = providerSuccessRates[provider.provider_name] || 0.5;

  if (successRate > threshold) {
    return {
      success: false,
      error: 'No data found for this contact',
    };
  }

  const mockData: any = {};

  if (input.email) {
    mockData.email = input.email;
    mockData.email_verified = true;
  }

  if (!input.firstName && Math.random() > 0.3) {
    mockData.first_name = ['John', 'Jane', 'Michael', 'Sarah', 'David'][
      Math.floor(Math.random() * 5)
    ];
  }

  if (!input.lastName && Math.random() > 0.3) {
    mockData.last_name = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][
      Math.floor(Math.random() * 5)
    ];
  }

  if (!input.company && Math.random() > 0.2) {
    mockData.company = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Innovate Co'][
      Math.floor(Math.random() * 4)
    ];
  }

  if (Math.random() > 0.4) {
    mockData.title = [
      'Sales Director',
      'VP of Sales',
      'Account Executive',
      'Business Development Manager',
      'Chief Revenue Officer',
    ][Math.floor(Math.random() * 5)];
  }

  if (Math.random() > 0.5) {
    mockData.phone = `+1-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  if (Math.random() > 0.6) {
    mockData.linkedin_url = `https://linkedin.com/in/${input.firstName?.toLowerCase() || 'user'}-${input.lastName?.toLowerCase() || 'profile'}`;
  }

  if (Math.random() > 0.5) {
    mockData.location = ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA'][
      Math.floor(Math.random() * 4)
    ];
  }

  mockData.seniority = ['VP', 'Director', 'Manager', 'Individual Contributor'][
    Math.floor(Math.random() * 4)
  ];
  mockData.department = ['Sales', 'Marketing', 'Engineering', 'Operations'][
    Math.floor(Math.random() * 4)
  ];
  mockData.data_source = provider.display_name;
  mockData.enriched_at = new Date().toISOString();

  return {
    success: true,
    data: mockData,
  };
}

function calculateDataQuality(data: any): number {
  if (!data) return 0;

  const importantFields = [
    'email',
    'first_name',
    'last_name',
    'company',
    'title',
    'phone',
    'linkedin_url',
  ];

  const filledFields = importantFields.filter(
    (field) => data[field] && data[field].toString().trim().length > 0
  );

  return Math.round((filledFields.length / importantFields.length) * 100);
}

export async function enrichContactWithWaterfall(
  prospectId: string,
  teamId: string,
  input: EnrichmentInput,
  enrichmentType: 'email' | 'phone' | 'company' | 'full_profile' = 'full_profile'
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const waterfallLog: EnrichmentResult['waterfallLog'] = [];
  let totalCredits = 0;

  const { data: enrichmentRequest, error: createError } = await supabase
    .from('enrichment_requests')
    .insert({
      prospect_id: prospectId,
      team_id: teamId,
      enrichment_type: enrichmentType,
      input_data: input,
      waterfall_status: 'in_progress',
    })
    .select()
    .single();

  if (createError || !enrichmentRequest) {
    throw new Error('Failed to create enrichment request');
  }

  const providers = await getEnabledProviders();

  if (providers.length === 0) {
    await supabase
      .from('enrichment_requests')
      .update({
        waterfall_status: 'failed',
        waterfall_log: [{ error: 'No enabled providers available' }],
        completed_at: new Date().toISOString(),
      })
      .eq('id', enrichmentRequest.id);

    return {
      success: false,
      attemptsCount: 0,
      totalDuration: Date.now() - startTime,
      creditsConsumed: 0,
      waterfallLog: [
        {
          provider: 'system',
          status: 'failed',
          duration: 0,
          error: 'No enabled providers available',
        },
      ],
    };
  }

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];

    const attempt = await attemptProviderEnrichment(provider, input, enrichmentRequest.id, i + 1);

    waterfallLog.push({
      provider: provider.display_name,
      status: attempt.success ? 'success' : 'failed',
      duration: attempt.duration,
      error: attempt.error,
    });

    if (attempt.success && attempt.data) {
      totalCredits += 1;
      const totalDuration = Date.now() - startTime;

      await supabase
        .from('enrichment_requests')
        .update({
          waterfall_status: 'completed',
          attempts_count: i + 1,
          final_provider_used: provider.provider_name,
          enriched_data: attempt.data,
          waterfall_log: waterfallLog,
          total_duration_ms: totalDuration,
          credits_consumed: totalCredits,
          completed_at: new Date().toISOString(),
        })
        .eq('id', enrichmentRequest.id);

      await supabase
        .from('prospects')
        .update({
          enrichment_data: attempt.data,
          first_name: attempt.data.first_name || input.firstName,
          last_name: attempt.data.last_name || input.lastName,
          title: attempt.data.title,
          company: attempt.data.company || input.company,
          phone: attempt.data.phone,
          linkedin_url: attempt.data.linkedin_url || input.linkedinUrl,
        })
        .eq('id', prospectId);

      return {
        success: true,
        data: attempt.data,
        provider: provider.display_name,
        attemptsCount: i + 1,
        totalDuration,
        creditsConsumed: totalCredits,
        waterfallLog,
      };
    }

    if (attempt.error && !attempt.error.includes('No data found')) {
      totalCredits += 1;
    }
  }

  const totalDuration = Date.now() - startTime;

  await supabase
    .from('enrichment_requests')
    .update({
      waterfall_status: 'failed',
      attempts_count: providers.length,
      waterfall_log: waterfallLog,
      total_duration_ms: totalDuration,
      credits_consumed: totalCredits,
      completed_at: new Date().toISOString(),
    })
    .eq('id', enrichmentRequest.id);

  return {
    success: false,
    attemptsCount: providers.length,
    totalDuration,
    creditsConsumed: totalCredits,
    waterfallLog,
  };
}

export async function getEnrichmentHistory(prospectId: string) {
  const { data, error } = await supabase
    .from('enrichment_requests')
    .select(
      `
      *,
      enrichment_provider_attempts (
        *,
        enrichment_providers (display_name)
      )
    `
    )
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching enrichment history:', error);
    return [];
  }

  return data;
}

export async function getProviderStats() {
  const { data, error } = await supabase
    .from('enrichment_providers')
    .select('*')
    .order('priority_order', { ascending: true });

  if (error) {
    console.error('Error fetching provider stats:', error);
    return [];
  }

  return data;
}
