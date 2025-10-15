export interface LeadScore {
  composite_score: number;
  engagement_score: number;
  fit_score: number;
  intent_score: number;
  recency_score: number;
  conversion_probability: number;
  score_tier: 'cold' | 'warm' | 'hot' | 'burning';
  factors: {
    email_count: number;
    call_count: number;
    open_rate: number;
    reply_rate: number;
    avg_sentiment: number;
  };
}

interface ProspectData {
  title?: string;
  company?: string;
  emails: Array<{ opened_at?: string; replied_at?: string; created_at: string }>;
  calls: Array<{ created_at: string }>;
  sentiments: Array<{ sentiment_score: number }>;
}

export function calculateLeadScore(prospectData: ProspectData): LeadScore {
  let engagementScore = 0;
  let fitScore = 0;
  let intentScore = 0;
  let recencyScore = 0;

  const { emails, calls, sentiments, title, company } = prospectData;

  const emailCount = emails.length;
  const callCount = calls.length;
  const openRate = emails.filter(e => e.opened_at).length / Math.max(emailCount, 1);
  const replyRate = emails.filter(e => e.replied_at).length / Math.max(emailCount, 1);

  engagementScore = Math.min(
    100,
    emailCount * 5 + callCount * 10 + openRate * 30 + replyRate * 40
  );

  const titleScore =
    title?.toLowerCase().includes('director') ||
    title?.toLowerCase().includes('vp') ||
    title?.toLowerCase().includes('head') ||
    title?.toLowerCase().includes('ceo') ||
    title?.toLowerCase().includes('cto')
      ? 80
      : 50;

  const companyScore = company ? 70 : 30;
  fitScore = Math.round((titleScore + companyScore) / 2);

  const avgSentiment =
    sentiments.length > 0
      ? sentiments.reduce((sum, s) => sum + s.sentiment_score, 0) / sentiments.length
      : 0;

  const positiveSentiments = sentiments.filter(s => s.sentiment_score > 0.3).length;

  intentScore = Math.min(
    100,
    ((avgSentiment + 1) / 2) * 50 + positiveSentiments * 15 + replyRate * 30
  );

  const lastActivity = [...emails, ...calls]
    .map(item => new Date(item.created_at).getTime())
    .sort((a, b) => b - a)[0];

  if (lastActivity) {
    const daysSinceActivity = (Date.now() - lastActivity) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity < 1) recencyScore = 100;
    else if (daysSinceActivity < 3) recencyScore = 80;
    else if (daysSinceActivity < 7) recencyScore = 60;
    else if (daysSinceActivity < 14) recencyScore = 40;
    else if (daysSinceActivity < 30) recencyScore = 20;
    else recencyScore = 10;
  }

  const compositeScore = Math.round(
    engagementScore * 0.35 +
    fitScore * 0.25 +
    intentScore * 0.3 +
    recencyScore * 0.1
  );

  const conversionProbability = compositeScore / 100;

  let scoreTier: LeadScore['score_tier'];
  if (compositeScore >= 80) scoreTier = 'burning';
  else if (compositeScore >= 60) scoreTier = 'hot';
  else if (compositeScore >= 40) scoreTier = 'warm';
  else scoreTier = 'cold';

  return {
    composite_score: compositeScore,
    engagement_score: Math.round(engagementScore),
    fit_score: fitScore,
    intent_score: Math.round(intentScore),
    recency_score: recencyScore,
    conversion_probability: Number(conversionProbability.toFixed(2)),
    score_tier: scoreTier,
    factors: {
      email_count: emailCount,
      call_count: callCount,
      open_rate: Number(openRate.toFixed(2)),
      reply_rate: Number(replyRate.toFixed(2)),
      avg_sentiment: Number(avgSentiment.toFixed(2)),
    },
  };
}
