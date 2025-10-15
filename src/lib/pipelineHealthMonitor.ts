export interface DealHealthMetrics {
  deal_id: string;
  health_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: RiskFactor[];
  recommendations: string[];
  last_calculated: string;
}

export interface RiskFactor {
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  impact_score: number;
}

export function calculateDealHealth(deal: any, activities: any[]): DealHealthMetrics {
  let healthScore = 100;
  const riskFactors: RiskFactor[] = [];
  const recommendations: string[] = [];

  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const dealActivities = activities.filter(a => a.deal_id === deal.id);
  const lastActivity = dealActivities.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  const daysSinceActivity = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : daysSinceCreated;

  if (daysSinceActivity > 14) {
    healthScore -= 30;
    riskFactors.push({
      category: 'Stagnation',
      description: `No activity for ${daysSinceActivity} days`,
      severity: 'high',
      impact_score: 30,
    });
    recommendations.push('Schedule immediate check-in call to re-engage');
  } else if (daysSinceActivity > 7) {
    healthScore -= 15;
    riskFactors.push({
      category: 'Stagnation',
      description: `Limited activity in past ${daysSinceActivity} days`,
      severity: 'medium',
      impact_score: 15,
    });
    recommendations.push('Send follow-up email or schedule next step');
  }

  if (deal.expected_close_date) {
    const daysToClose = Math.floor(
      (new Date(deal.expected_close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysToClose < 7 && deal.stage !== 'negotiation' && deal.stage !== 'proposal') {
      healthScore -= 25;
      riskFactors.push({
        category: 'Timeline Risk',
        description: `Deal closes in ${daysToClose} days but still in ${deal.stage} stage`,
        severity: 'high',
        impact_score: 25,
      });
      recommendations.push('Accelerate deal progression or adjust close date');
    }

    if (daysToClose < 0) {
      healthScore -= 20;
      riskFactors.push({
        category: 'Overdue',
        description: 'Close date has passed',
        severity: 'high',
        impact_score: 20,
      });
      recommendations.push('Update close date and reassess deal viability');
    }
  }

  const emailActivities = dealActivities.filter(a => a.type === 'email');
  const callActivities = dealActivities.filter(a => a.type === 'call');
  const meetingActivities = dealActivities.filter(a => a.type === 'meeting');

  if (emailActivities.length > 5 && callActivities.length === 0) {
    healthScore -= 15;
    riskFactors.push({
      category: 'Engagement Quality',
      description: 'Only email communication - no calls or meetings',
      severity: 'medium',
      impact_score: 15,
    });
    recommendations.push('Schedule a discovery call to deepen relationship');
  }

  if (meetingActivities.length === 0 && daysSinceCreated > 14) {
    healthScore -= 20;
    riskFactors.push({
      category: 'Engagement Quality',
      description: 'No meetings scheduled in 14+ days',
      severity: 'high',
      impact_score: 20,
    });
    recommendations.push('Book demo or discovery meeting to move forward');
  }

  const stakeholderCount = deal.contacts ? deal.contacts.length : 1;
  if (stakeholderCount === 1 && deal.value > 50000) {
    healthScore -= 20;
    riskFactors.push({
      category: 'Single Threading',
      description: 'Only one stakeholder engaged on high-value deal',
      severity: 'high',
      impact_score: 20,
    });
    recommendations.push('Identify and engage additional stakeholders');
  }

  const avgSaleCycleDays = 45;
  if (daysSinceCreated > avgSaleCycleDays * 1.5) {
    healthScore -= 15;
    riskFactors.push({
      category: 'Extended Cycle',
      description: `Deal age (${daysSinceCreated} days) exceeds typical cycle`,
      severity: 'medium',
      impact_score: 15,
    });
    recommendations.push('Assess blockers and create urgency');
  }

  if (deal.stage === 'discovery' && daysSinceCreated > 21) {
    healthScore -= 10;
    riskFactors.push({
      category: 'Stage Stagnation',
      description: 'Stuck in discovery stage for 3+ weeks',
      severity: 'medium',
      impact_score: 10,
    });
    recommendations.push('Move to demo/proposal or qualify out');
  }

  healthScore = Math.max(0, Math.min(100, healthScore));

  let riskLevel: DealHealthMetrics['risk_level'];
  if (healthScore >= 75) riskLevel = 'low';
  else if (healthScore >= 50) riskLevel = 'medium';
  else if (healthScore >= 25) riskLevel = 'high';
  else riskLevel = 'critical';

  return {
    deal_id: deal.id,
    health_score: Math.round(healthScore),
    risk_level: riskLevel,
    risk_factors: riskFactors,
    recommendations: recommendations.slice(0, 3),
    last_calculated: new Date().toISOString(),
  };
}

export function identifyStalledDeals(deals: any[], activities: any[]): any[] {
  return deals
    .filter(deal => {
      if (deal.stage === 'won' || deal.stage === 'lost') return false;

      const dealActivities = activities.filter(a => a.deal_id === deal.id);
      const lastActivity = dealActivities.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      if (!lastActivity) return true;

      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      return daysSinceActivity >= 14;
    })
    .map(deal => ({
      ...deal,
      days_stalled: Math.floor(
        (Date.now() - new Date(deal.updated_at || deal.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    }));
}

export function calculatePipelineCoverage(
  deals: any[],
  quota: number,
  winRate: number = 0.25
): {
  current_pipeline: number;
  needed_pipeline: number;
  coverage_ratio: number;
  gap: number;
} {
  const activeDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
  const currentPipeline = activeDeals.reduce((sum, d) => sum + (d.value || 0), 0);

  const neededPipeline = quota / winRate;
  const coverageRatio = currentPipeline / neededPipeline;
  const gap = Math.max(0, neededPipeline - currentPipeline);

  return {
    current_pipeline: currentPipeline,
    needed_pipeline: neededPipeline,
    coverage_ratio: Number(coverageRatio.toFixed(2)),
    gap,
  };
}

export function predictCloseDate(deal: any, activities: any[]): {
  predicted_date: string;
  confidence: number;
  reasoning: string;
} {
  const dealActivities = activities.filter(a => a.deal_id === deal.id);
  const avgDaysBetweenActivities =
    dealActivities.length > 1
      ? Math.floor(
          (new Date(dealActivities[0].created_at).getTime() -
            new Date(dealActivities[dealActivities.length - 1].created_at).getTime()) /
            (1000 * 60 * 60 * 24) /
            (dealActivities.length - 1)
        )
      : 7;

  const stageProgressDays: Record<string, number> = {
    discovery: 14,
    demo: 7,
    proposal: 7,
    negotiation: 7,
  };

  const currentStage = deal.stage || 'discovery';
  const remainingDays = stageProgressDays[currentStage] || 14;

  const predictedDate = new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000);

  const confidence =
    dealActivities.length > 3 && avgDaysBetweenActivities < 5 ? 0.75 : 0.5;

  const reasoning =
    confidence > 0.7
      ? 'Based on consistent activity pattern'
      : 'Estimate based on typical stage duration';

  return {
    predicted_date: predictedDate.toISOString(),
    confidence,
    reasoning,
  };
}

export function analyzePipelineVelocity(deals: any[]): {
  avg_days_in_stage: Record<string, number>;
  avg_deal_cycle: number;
  conversion_rates: Record<string, number>;
} {
  const wonDeals = deals.filter(d => d.stage === 'won');

  const avgDealCycle =
    wonDeals.length > 0
      ? wonDeals.reduce((sum, d) => {
          const created = new Date(d.created_at).getTime();
          const closed = new Date(d.closed_at || d.updated_at).getTime();
          return sum + (closed - created) / (1000 * 60 * 60 * 24);
        }, 0) / wonDeals.length
      : 45;

  const avgDaysInStage: Record<string, number> = {
    discovery: 14,
    demo: 7,
    proposal: 10,
    negotiation: 7,
  };

  const conversionRates: Record<string, number> = {};
  const stages = ['discovery', 'demo', 'proposal', 'negotiation'];

  stages.forEach((stage, index) => {
    const dealsInStage = deals.filter(d => d.stage === stage).length;
    const dealsPassedStage =
      index < stages.length - 1
        ? deals.filter(d => stages.indexOf(d.stage) > index || d.stage === 'won').length
        : wonDeals.length;

    conversionRates[stage] = dealsInStage > 0 ? dealsPassedStage / dealsInStage : 0;
  });

  return {
    avg_days_in_stage: avgDaysInStage,
    avg_deal_cycle: Math.round(avgDealCycle),
    conversion_rates: conversionRates,
  };
}
