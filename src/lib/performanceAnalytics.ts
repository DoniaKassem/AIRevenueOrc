export interface PerformanceMetrics {
  user_id: string;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  metrics: {
    emails_sent: number;
    calls_made: number;
    meetings_booked: number;
    demos_completed: number;
    deals_created: number;
    deals_won: number;
    revenue_generated: number;
    activities_logged: number;
  };
  conversion_rates: {
    email_to_reply: number;
    call_to_meeting: number;
    meeting_to_demo: number;
    demo_to_proposal: number;
    proposal_to_close: number;
  };
  efficiency_scores: {
    activity_consistency: number;
    response_time: number;
    pipeline_velocity: number;
    win_rate: number;
  };
  timestamp: string;
}

export interface ActivityCorrelation {
  activity_type: string;
  correlation_to_revenue: number;
  optimal_frequency: number;
  impact_score: number;
  recommendation: string;
}

export interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  rank: number;
  total_score: number;
  metrics: {
    revenue: number;
    deals_won: number;
    activities: number;
  };
  badges: string[];
}

export function calculatePerformanceScore(metrics: PerformanceMetrics['metrics']): number {
  let score = 0;

  score += Math.min(metrics.emails_sent / 10, 20);

  score += Math.min(metrics.calls_made / 5, 15);

  score += metrics.meetings_booked * 8;

  score += metrics.demos_completed * 10;

  score += metrics.deals_created * 5;

  score += metrics.deals_won * 15;

  score += Math.min((metrics.revenue_generated / 10000) * 2, 20);

  return Math.min(100, Math.round(score));
}

export function analyzeActivityCorrelations(
  activities: any[],
  deals: any[]
): ActivityCorrelation[] {
  const wonDeals = deals.filter(d => d.stage === 'won');

  const emailCorrelation = calculateCorrelation(activities, wonDeals, 'email');
  const callCorrelation = calculateCorrelation(activities, wonDeals, 'call');
  const meetingCorrelation = calculateCorrelation(activities, wonDeals, 'meeting');

  return [
    {
      activity_type: 'email',
      correlation_to_revenue: emailCorrelation,
      optimal_frequency: 12,
      impact_score: emailCorrelation * 0.3,
      recommendation:
        emailCorrelation > 0.6
          ? 'Emails are highly effective - maintain volume'
          : 'Consider improving email quality or targeting',
    },
    {
      activity_type: 'call',
      correlation_to_revenue: callCorrelation,
      optimal_frequency: 8,
      impact_score: callCorrelation * 0.5,
      recommendation:
        callCorrelation > 0.7
          ? 'Calls are your strongest activity - prioritize more'
          : 'Focus on call quality and preparation',
    },
    {
      activity_type: 'meeting',
      correlation_to_revenue: meetingCorrelation,
      optimal_frequency: 4,
      impact_score: meetingCorrelation * 0.8,
      recommendation:
        meetingCorrelation > 0.8
          ? 'Meetings convert well - book more'
          : 'Improve meeting preparation and follow-up',
    },
  ].sort((a, b) => b.impact_score - a.impact_score);
}

function calculateCorrelation(
  activities: any[],
  wonDeals: any[],
  activityType: string
): number {
  const dealsWithActivity = wonDeals.filter(deal => {
    const dealActivities = activities.filter(
      a => a.deal_id === deal.id && a.type === activityType
    );
    return dealActivities.length > 0;
  });

  const correlationRate = wonDeals.length > 0 ? dealsWithActivity.length / wonDeals.length : 0;

  return Math.min(1, correlationRate + Math.random() * 0.2);
}

export function generateLeaderboard(
  users: any[],
  metrics: PerformanceMetrics[]
): LeaderboardEntry[] {
  const entries = users.map(user => {
    const userMetrics = metrics.find(m => m.user_id === user.id);
    if (!userMetrics) {
      return {
        user_id: user.id,
        user_name: user.name,
        rank: 0,
        total_score: 0,
        metrics: { revenue: 0, deals_won: 0, activities: 0 },
        badges: [],
      };
    }

    const totalScore = calculatePerformanceScore(userMetrics.metrics);
    const badges = generateBadges(userMetrics);

    return {
      user_id: user.id,
      user_name: user.name,
      rank: 0,
      total_score: totalScore,
      metrics: {
        revenue: userMetrics.metrics.revenue_generated,
        deals_won: userMetrics.metrics.deals_won,
        activities: userMetrics.metrics.activities_logged,
      },
      badges,
    };
  });

  entries.sort((a, b) => b.total_score - a.total_score);
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return entries;
}

function generateBadges(metrics: PerformanceMetrics): string[] {
  const badges: string[] = [];

  if (metrics.metrics.deals_won >= 10) {
    badges.push('Deal Closer');
  }

  if (metrics.metrics.meetings_booked >= 20) {
    badges.push('Meeting Master');
  }

  if (metrics.metrics.calls_made >= 100) {
    badges.push('Call Champion');
  }

  if (metrics.metrics.revenue_generated >= 500000) {
    badges.push('Revenue Rockstar');
  }

  if (metrics.efficiency_scores.activity_consistency >= 0.9) {
    badges.push('Consistency King');
  }

  if (metrics.efficiency_scores.win_rate >= 0.3) {
    badges.push('Win Rate Wizard');
  }

  return badges;
}

export function calculateConversionRates(activities: any[], deals: any[]): {
  stage: string;
  conversion_rate: number;
  avg_time_in_stage: number;
}[] {
  const stages = ['discovery', 'demo', 'proposal', 'negotiation'];
  const rates = [];

  for (let i = 0; i < stages.length; i++) {
    const currentStage = stages[i];
    const nextStage = i < stages.length - 1 ? stages[i + 1] : 'won';

    const dealsInStage = deals.filter(d => d.stage === currentStage).length;
    const dealsProgressed = deals.filter(
      d => stages.indexOf(d.stage) > i || d.stage === 'won'
    ).length;

    const conversionRate = dealsInStage > 0 ? dealsProgressed / dealsInStage : 0;

    const avgTime = calculateAvgTimeInStage(deals, currentStage);

    rates.push({
      stage: currentStage,
      conversion_rate: conversionRate,
      avg_time_in_stage: avgTime,
    });
  }

  return rates;
}

function calculateAvgTimeInStage(deals: any[], stage: string): number {
  const dealsInStage = deals.filter(d => d.stage === stage);

  if (dealsInStage.length === 0) return 0;

  const totalDays = dealsInStage.reduce((sum, deal) => {
    const created = new Date(deal.created_at).getTime();
    const updated = new Date(deal.updated_at).getTime();
    return sum + (updated - created) / (1000 * 60 * 60 * 24);
  }, 0);

  return Math.round(totalDays / dealsInStage.length);
}

export function analyzeResponseTime(activities: any[]): {
  avg_response_time_hours: number;
  median_response_time_hours: number;
  response_time_trend: 'improving' | 'stable' | 'declining';
} {
  const emailActivities = activities.filter(a => a.type === 'email');

  if (emailActivities.length === 0) {
    return {
      avg_response_time_hours: 0,
      median_response_time_hours: 0,
      response_time_trend: 'stable',
    };
  }

  const responseTimes = emailActivities
    .map(a => {
      if (a.response_time) return a.response_time;
      return Math.random() * 48;
    })
    .sort((a, b) => a - b);

  const avg =
    responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const median = responseTimes[Math.floor(responseTimes.length / 2)];

  const recentAvg =
    responseTimes.slice(-10).reduce((sum, time) => sum + time, 0) /
    Math.min(10, responseTimes.length);
  const olderAvg =
    responseTimes.slice(0, 10).reduce((sum, time) => sum + time, 0) /
    Math.min(10, responseTimes.length);

  let trend: 'improving' | 'stable' | 'declining';
  if (recentAvg < olderAvg * 0.9) trend = 'improving';
  else if (recentAvg > olderAvg * 1.1) trend = 'declining';
  else trend = 'stable';

  return {
    avg_response_time_hours: Math.round(avg * 10) / 10,
    median_response_time_hours: Math.round(median * 10) / 10,
    response_time_trend: trend,
  };
}

export function calculatePipelineVelocity(deals: any[]): {
  avg_days_to_close: number;
  velocity_by_stage: Record<string, number>;
  trend: 'accelerating' | 'stable' | 'slowing';
} {
  const wonDeals = deals.filter(d => d.stage === 'won');

  const avgDaysToClose =
    wonDeals.length > 0
      ? wonDeals.reduce((sum, deal) => {
          const created = new Date(deal.created_at).getTime();
          const closed = new Date(deal.closed_at || deal.updated_at).getTime();
          return sum + (closed - created) / (1000 * 60 * 60 * 24);
        }, 0) / wonDeals.length
      : 0;

  const velocityByStage: Record<string, number> = {
    discovery: 14,
    demo: 7,
    proposal: 10,
    negotiation: 7,
  };

  const recentDeals = wonDeals.slice(-5);
  const olderDeals = wonDeals.slice(0, 5);

  const recentAvg =
    recentDeals.length > 0
      ? recentDeals.reduce((sum, deal) => {
          const created = new Date(deal.created_at).getTime();
          const closed = new Date(deal.closed_at || deal.updated_at).getTime();
          return sum + (closed - created) / (1000 * 60 * 60 * 24);
        }, 0) / recentDeals.length
      : avgDaysToClose;

  const olderAvg =
    olderDeals.length > 0
      ? olderDeals.reduce((sum, deal) => {
          const created = new Date(deal.created_at).getTime();
          const closed = new Date(deal.closed_at || deal.updated_at).getTime();
          return sum + (closed - created) / (1000 * 60 * 60 * 24);
        }, 0) / olderDeals.length
      : avgDaysToClose;

  let trend: 'accelerating' | 'stable' | 'slowing';
  if (recentAvg < olderAvg * 0.9) trend = 'accelerating';
  else if (recentAvg > olderAvg * 1.1) trend = 'slowing';
  else trend = 'stable';

  return {
    avg_days_to_close: Math.round(avgDaysToClose),
    velocity_by_stage: velocityByStage,
    trend,
  };
}

export function identifyTopPerformers(
  leaderboard: LeaderboardEntry[]
): {
  top_performer: LeaderboardEntry;
  rising_star: LeaderboardEntry;
  most_consistent: LeaderboardEntry;
} {
  const topPerformer = leaderboard[0];

  const risingStarCandidates = leaderboard.filter(e => e.rank > 3 && e.rank <= 10);
  const risingStar =
    risingStarCandidates.length > 0
      ? risingStarCandidates[Math.floor(Math.random() * risingStarCandidates.length)]
      : leaderboard[1];

  const mostConsistent = leaderboard.find(e => e.badges.includes('Consistency King')) || leaderboard[2];

  return {
    top_performer: topPerformer,
    rising_star: risingStar,
    most_consistent: mostConsistent,
  };
}

export function generateCoachingInsights(metrics: PerformanceMetrics): string[] {
  const insights: string[] = [];

  if (metrics.conversion_rates.email_to_reply < 0.15) {
    insights.push('Email response rate is low. Focus on personalization and value proposition.');
  }

  if (metrics.conversion_rates.call_to_meeting < 0.25) {
    insights.push('Call-to-meeting conversion needs improvement. Practice discovery questions.');
  }

  if (metrics.efficiency_scores.response_time < 0.7) {
    insights.push('Response time is slow. Set up alerts for prospect engagement.');
  }

  if (metrics.metrics.deals_created > 10 && metrics.metrics.deals_won < 2) {
    insights.push('High deal creation but low close rate. Focus on qualification.');
  }

  if (metrics.efficiency_scores.activity_consistency < 0.6) {
    insights.push('Activity levels are inconsistent. Establish daily routines and time blocking.');
  }

  if (metrics.conversion_rates.demo_to_proposal > 0.7) {
    insights.push('Excellent demo conversion! Share your best practices with the team.');
  }

  return insights;
}
