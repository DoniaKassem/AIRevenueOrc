/**
 * Multi-Signal Intent Aggregator
 * Combines intent signals from all sources into a unified intent score
 */

import { supabase } from '../supabase';
import type { IntentSignal } from './intentProviders';

export interface CompositeIntentScore {
  overallScore: number; // 0-100
  tier: 'low' | 'warm' | 'hot' | 'burning';
  breakdown: {
    websiteActivity: number;
    emailEngagement: number;
    linkedInActivity: number;
    hiringSignals: number;
    techStackChanges: number;
    thirdPartyIntent: number;
    other: number;
  };
  trend: 'increasing' | 'stable' | 'decreasing';
  topSignals: IntentSignal[];
  lastUpdated: string;
}

export interface IntentAlert {
  type: 'intent_spike' | 'high_intent' | 'new_signal' | 'threshold_crossed';
  severity: 'low' | 'medium' | 'high';
  message: string;
  score: number;
  previousScore?: number;
  detectedAt: string;
}

/**
 * Signal weights for composite scoring
 */
const SIGNAL_WEIGHTS = {
  // Website activity
  website_visit: 15,
  page_view: 10,
  demo_request: 30,
  pricing_view: 25,

  // Email engagement
  email_open: 5,
  email_click: 15,
  email_reply: 25,

  // LinkedIn activity
  linkedin_profile_view: 10,
  linkedin_post_engagement: 8,
  linkedin_connection_request: 12,
  linkedin_message: 20,

  // Hiring signals
  hiring_signal: 15,

  // Tech stack
  tech_adoption: 18,
  tech_removal: 10,

  // Third-party intent
  content_research: 20,
  competitor_research: 25,

  // Other
  default: 10,
};

/**
 * Strength multipliers
 */
const STRENGTH_MULTIPLIERS = {
  low: 0.5,
  medium: 1.0,
  high: 1.5,
};

/**
 * Calculate composite intent score from multiple signals
 */
export async function calculateCompositeIntentScore(
  companyId: string,
  prospectId?: string
): Promise<CompositeIntentScore> {
  // Fetch all recent signals (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('intent_signals')
    .select('*')
    .gte('detected_at', ninetyDaysAgo)
    .order('detected_at', { ascending: false });

  if (prospectId) {
    query = query.eq('prospect_id', prospectId);
  } else if (companyId) {
    query = query.eq('company_profile_id', companyId);
  }

  const { data: signals } = await query;

  if (!signals || signals.length === 0) {
    return {
      overallScore: 0,
      tier: 'low',
      breakdown: {
        websiteActivity: 0,
        emailEngagement: 0,
        linkedInActivity: 0,
        hiringSignals: 0,
        techStackChanges: 0,
        thirdPartyIntent: 0,
        other: 0,
      },
      trend: 'stable',
      topSignals: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  // Calculate scores by category
  const breakdown = calculateBreakdown(signals);

  // Calculate overall weighted score
  const overallScore = Math.min(
    100,
    Math.round(
      breakdown.websiteActivity * 0.20 +
      breakdown.emailEngagement * 0.15 +
      breakdown.linkedInActivity * 0.15 +
      breakdown.hiringSignals * 0.10 +
      breakdown.techStackChanges * 0.10 +
      breakdown.thirdPartyIntent * 0.20 +
      breakdown.other * 0.10
    )
  );

  // Determine tier
  const tier = determineIntentTier(overallScore);

  // Calculate trend
  const trend = await calculateTrend(companyId, prospectId);

  // Get top signals
  const topSignals = getTopSignals(signals, 5);

  return {
    overallScore,
    tier,
    breakdown,
    trend,
    topSignals,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Calculate breakdown scores by category
 */
function calculateBreakdown(signals: any[]): CompositeIntentScore['breakdown'] {
  const categories = {
    websiteActivity: ['website_visit', 'page_view', 'demo_request', 'pricing_view'],
    emailEngagement: ['email_open', 'email_click', 'email_reply'],
    linkedInActivity: ['linkedin_profile_view', 'linkedin_post_engagement', 'linkedin_connection_request', 'linkedin_message'],
    hiringSignals: ['hiring_signal'],
    techStackChanges: ['tech_adoption', 'tech_removal'],
    thirdPartyIntent: ['content_research', 'competitor_research'],
  };

  const breakdown: any = {
    websiteActivity: 0,
    emailEngagement: 0,
    linkedInActivity: 0,
    hiringSignals: 0,
    techStackChanges: 0,
    thirdPartyIntent: 0,
    other: 0,
  };

  // Calculate weighted score for each category
  Object.entries(categories).forEach(([category, signalTypes]) => {
    const categorySignals = signals.filter(s => signalTypes.includes(s.signal_type));
    breakdown[category] = calculateCategoryScore(categorySignals);
  });

  // Handle uncategorized signals
  const categorizedTypes = Object.values(categories).flat();
  const otherSignals = signals.filter(s => !categorizedTypes.includes(s.signal_type));
  breakdown.other = calculateCategoryScore(otherSignals);

  return breakdown;
}

/**
 * Calculate score for a category
 */
function calculateCategoryScore(signals: any[]): number {
  if (signals.length === 0) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  signals.forEach(signal => {
    const weight = SIGNAL_WEIGHTS[signal.signal_type as keyof typeof SIGNAL_WEIGHTS] || SIGNAL_WEIGHTS.default;
    const strengthMultiplier = STRENGTH_MULTIPLIERS[signal.signal_strength as keyof typeof STRENGTH_MULTIPLIERS] || 1.0;
    const confidence = signal.confidence || 0.8;

    // Apply decay based on age
    const ageInDays = (Date.now() - new Date(signal.detected_at).getTime()) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.max(0.3, 1 - (ageInDays / 90)); // Decay over 90 days

    const signalScore = weight * strengthMultiplier * confidence * decayFactor;
    totalScore += signalScore;
    totalWeight += weight;
  });

  // Normalize to 0-100 scale
  return totalWeight > 0 ? Math.min(100, (totalScore / totalWeight) * 100) : 0;
}

/**
 * Determine intent tier based on score
 */
function determineIntentTier(score: number): 'low' | 'warm' | 'hot' | 'burning' {
  if (score >= 75) return 'burning';
  if (score >= 50) return 'hot';
  if (score >= 25) return 'warm';
  return 'low';
}

/**
 * Calculate trend (increasing, stable, decreasing)
 */
async function calculateTrend(
  companyId: string,
  prospectId?: string
): Promise<'increasing' | 'stable' | 'decreasing'> {
  // Get scores from last 7 and 14 days for comparison
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  let recentQuery = supabase
    .from('intent_signals')
    .select('*')
    .gte('detected_at', sevenDaysAgo);

  let previousQuery = supabase
    .from('intent_signals')
    .select('*')
    .gte('detected_at', fourteenDaysAgo)
    .lt('detected_at', sevenDaysAgo);

  if (prospectId) {
    recentQuery = recentQuery.eq('prospect_id', prospectId);
    previousQuery = previousQuery.eq('prospect_id', prospectId);
  } else if (companyId) {
    recentQuery = recentQuery.eq('company_profile_id', companyId);
    previousQuery = previousQuery.eq('company_profile_id', companyId);
  }

  const [recentData, previousData] = await Promise.all([
    recentQuery,
    previousQuery,
  ]);

  const recentScore = calculateQuickScore(recentData.data || []);
  const previousScore = calculateQuickScore(previousData.data || []);

  const difference = recentScore - previousScore;

  if (difference > 10) return 'increasing';
  if (difference < -10) return 'decreasing';
  return 'stable';
}

/**
 * Calculate quick score for trend analysis
 */
function calculateQuickScore(signals: any[]): number {
  if (signals.length === 0) return 0;

  let total = 0;
  signals.forEach(signal => {
    const weight = SIGNAL_WEIGHTS[signal.signal_type as keyof typeof SIGNAL_WEIGHTS] || SIGNAL_WEIGHTS.default;
    const strengthMultiplier = STRENGTH_MULTIPLIERS[signal.signal_strength as keyof typeof STRENGTH_MULTIPLIERS] || 1.0;
    total += weight * strengthMultiplier;
  });

  return total / signals.length;
}

/**
 * Get top N signals by importance
 */
function getTopSignals(signals: any[], count: number): IntentSignal[] {
  return signals
    .map(s => ({
      type: s.signal_type,
      source: s.signal_source,
      strength: s.signal_strength,
      description: s.signal_description,
      data: s.signal_data,
      confidence: s.confidence,
      detectedAt: s.detected_at,
      expiresAt: s.expires_at,
    }))
    .sort((a, b) => {
      const scoreA = (SIGNAL_WEIGHTS[a.type as keyof typeof SIGNAL_WEIGHTS] || 10) *
        (STRENGTH_MULTIPLIERS[a.strength] || 1);
      const scoreB = (SIGNAL_WEIGHTS[b.type as keyof typeof SIGNAL_WEIGHTS] || 10) *
        (STRENGTH_MULTIPLIERS[b.strength] || 1);
      return scoreB - scoreA;
    })
    .slice(0, count);
}

/**
 * Detect intent spikes
 */
export async function detectIntentSpikes(
  companyId: string,
  prospectId?: string
): Promise<IntentAlert[]> {
  const alerts: IntentAlert[] = [];

  // Get current score
  const currentScore = await calculateCompositeIntentScore(companyId, prospectId);

  // Get score from 7 days ago
  const { data: historicalScores } = await supabase
    .from('intent_score_history')
    .select('*')
    .eq(prospectId ? 'prospect_id' : 'company_profile_id', prospectId || companyId)
    .gte('recorded_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('recorded_at', { ascending: false })
    .limit(1);

  const previousScore = historicalScores?.[0]?.overall_score || 0;
  const scoreDelta = currentScore.overallScore - previousScore;

  // Spike detection: >20 point increase in 7 days
  if (scoreDelta > 20) {
    alerts.push({
      type: 'intent_spike',
      severity: 'high',
      message: `Intent score spiked by ${scoreDelta} points!`,
      score: currentScore.overallScore,
      previousScore,
      detectedAt: new Date().toISOString(),
    });
  }

  // High intent threshold
  if (currentScore.overallScore >= 75 && previousScore < 75) {
    alerts.push({
      type: 'threshold_crossed',
      severity: 'high',
      message: 'Entered "burning" intent tier',
      score: currentScore.overallScore,
      previousScore,
      detectedAt: new Date().toISOString(),
    });
  } else if (currentScore.overallScore >= 50 && previousScore < 50) {
    alerts.push({
      type: 'threshold_crossed',
      severity: 'medium',
      message: 'Entered "hot" intent tier',
      score: currentScore.overallScore,
      previousScore,
      detectedAt: new Date().toISOString(),
    });
  }

  // New high-value signal
  const recentHighSignals = currentScore.topSignals.filter(s => {
    const age = Date.now() - new Date(s.detectedAt).getTime();
    return age < 24 * 60 * 60 * 1000 && s.strength === 'high'; // Last 24 hours
  });

  if (recentHighSignals.length > 0) {
    alerts.push({
      type: 'new_signal',
      severity: 'medium',
      message: `${recentHighSignals.length} new high-value signals detected`,
      score: currentScore.overallScore,
      detectedAt: new Date().toISOString(),
    });
  }

  // Store alerts in database
  for (const alert of alerts) {
    await supabase.from('intent_alerts').insert({
      [prospectId ? 'prospect_id' : 'company_profile_id']: prospectId || companyId,
      team_id: await getTeamId(companyId, prospectId),
      alert_type: alert.type,
      alert_severity: alert.severity,
      message: alert.message,
      current_score: alert.score,
      previous_score: alert.previousScore,
      is_read: false,
      created_at: alert.detectedAt,
    });
  }

  return alerts;
}

/**
 * Store intent score history for trend analysis
 */
export async function storeIntentScore(
  companyId: string,
  prospectId: string | undefined,
  score: CompositeIntentScore
): Promise<void> {
  await supabase.from('intent_score_history').insert({
    company_profile_id: companyId,
    prospect_id: prospectId,
    overall_score: score.overallScore,
    tier: score.tier,
    score_breakdown: score.breakdown,
    trend: score.trend,
    recorded_at: score.lastUpdated,
  });
}

/**
 * Get intent score trends over time
 */
export async function getIntentTrends(
  companyId: string,
  prospectId?: string,
  daysBack: number = 30
): Promise<Array<{ date: string; score: number; tier: string }>> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('intent_score_history')
    .select('recorded_at, overall_score, tier')
    .eq(prospectId ? 'prospect_id' : 'company_profile_id', prospectId || companyId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });

  return (data || []).map(record => ({
    date: record.recorded_at,
    score: record.overall_score,
    tier: record.tier,
  }));
}

/**
 * Get team ID from company or prospect
 */
async function getTeamId(companyId: string, prospectId?: string): Promise<string> {
  if (prospectId) {
    const { data } = await supabase
      .from('prospects')
      .select('team_id')
      .eq('id', prospectId)
      .single();
    return data?.team_id || '';
  } else {
    const { data } = await supabase
      .from('company_profiles')
      .select('team_id')
      .eq('id', companyId)
      .single();
    return data?.team_id || '';
  }
}

/**
 * Get all unread intent alerts for a team
 */
export async function getUnreadIntentAlerts(teamId: string): Promise<IntentAlert[]> {
  const { data } = await supabase
    .from('intent_alerts')
    .select('*')
    .eq('team_id', teamId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(50);

  return (data || []).map(record => ({
    type: record.alert_type,
    severity: record.alert_severity,
    message: record.message,
    score: record.current_score,
    previousScore: record.previous_score,
    detectedAt: record.created_at,
  }));
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  await supabase
    .from('intent_alerts')
    .update({ is_read: true })
    .eq('id', alertId);
}
