export interface ProspectProfile {
  id: string;
  company_size?: string;
  industry?: string;
  revenue_range?: string;
  technologies?: string[];
  geographic_region?: string;
  job_title?: string;
  seniority_level?: string;
  department?: string;
}

export interface IdealCustomerProfile {
  company_size_weights: Record<string, number>;
  industry_weights: Record<string, number>;
  revenue_weights: Record<string, number>;
  technology_weights: Record<string, number>;
  region_weights: Record<string, number>;
  title_weights: Record<string, number>;
  seniority_weights: Record<string, number>;
}

export interface LookAlikeScore {
  prospect_id: string;
  similarity_score: number;
  match_reasons: string[];
  fit_rating: 'excellent' | 'good' | 'fair' | 'poor';
  recommended_actions: string[];
}

export function buildICPFromWonDeals(wonDeals: any[], prospects: any[]): IdealCustomerProfile {
  const icp: IdealCustomerProfile = {
    company_size_weights: {},
    industry_weights: {},
    revenue_weights: {},
    technology_weights: {},
    region_weights: {},
    title_weights: {},
    seniority_weights: {},
  };

  wonDeals.forEach(deal => {
    const prospect = prospects.find(p => p.id === deal.prospect_id);
    if (!prospect) return;

    if (prospect.company_size) {
      icp.company_size_weights[prospect.company_size] =
        (icp.company_size_weights[prospect.company_size] || 0) + 1;
    }

    if (prospect.industry) {
      icp.industry_weights[prospect.industry] =
        (icp.industry_weights[prospect.industry] || 0) + 1;
    }

    if (prospect.revenue_range) {
      icp.revenue_weights[prospect.revenue_range] =
        (icp.revenue_weights[prospect.revenue_range] || 0) + 1;
    }

    if (prospect.geographic_region) {
      icp.region_weights[prospect.geographic_region] =
        (icp.region_weights[prospect.geographic_region] || 0) + 1;
    }

    if (prospect.job_title) {
      icp.title_weights[prospect.job_title] =
        (icp.title_weights[prospect.job_title] || 0) + 1;
    }

    if (prospect.seniority_level) {
      icp.seniority_weights[prospect.seniority_level] =
        (icp.seniority_weights[prospect.seniority_level] || 0) + 1;
    }

    if (prospect.technologies) {
      prospect.technologies.forEach((tech: string) => {
        icp.technology_weights[tech] = (icp.technology_weights[tech] || 0) + 1;
      });
    }
  });

  const normalize = (weights: Record<string, number>) => {
    const total = Object.values(weights).reduce((sum, val) => sum + val, 0);
    const normalized: Record<string, number> = {};
    Object.entries(weights).forEach(([key, val]) => {
      normalized[key] = total > 0 ? val / total : 0;
    });
    return normalized;
  };

  return {
    company_size_weights: normalize(icp.company_size_weights),
    industry_weights: normalize(icp.industry_weights),
    revenue_weights: normalize(icp.revenue_weights),
    technology_weights: normalize(icp.technology_weights),
    region_weights: normalize(icp.region_weights),
    title_weights: normalize(icp.title_weights),
    seniority_weights: normalize(icp.seniority_weights),
  };
}

export function calculateLookAlikeScore(
  prospect: ProspectProfile,
  icp: IdealCustomerProfile
): LookAlikeScore {
  let score = 0;
  const matchReasons: string[] = [];
  const maxScore = 100;

  if (prospect.company_size && icp.company_size_weights[prospect.company_size]) {
    const weight = icp.company_size_weights[prospect.company_size];
    const points = weight * 15;
    score += points;
    if (weight > 0.3) {
      matchReasons.push(`Company size (${prospect.company_size}) matches best customers`);
    }
  }

  if (prospect.industry && icp.industry_weights[prospect.industry]) {
    const weight = icp.industry_weights[prospect.industry];
    const points = weight * 20;
    score += points;
    if (weight > 0.2) {
      matchReasons.push(`Industry (${prospect.industry}) is a top vertical`);
    }
  }

  if (prospect.revenue_range && icp.revenue_weights[prospect.revenue_range]) {
    const weight = icp.revenue_weights[prospect.revenue_range];
    const points = weight * 15;
    score += points;
    if (weight > 0.3) {
      matchReasons.push(`Revenue range (${prospect.revenue_range}) aligns with ICP`);
    }
  }

  if (prospect.geographic_region && icp.region_weights[prospect.geographic_region]) {
    const weight = icp.region_weights[prospect.geographic_region];
    const points = weight * 10;
    score += points;
    if (weight > 0.3) {
      matchReasons.push(`Geographic region (${prospect.geographic_region}) is a strong fit`);
    }
  }

  if (prospect.job_title && icp.title_weights[prospect.job_title]) {
    const weight = icp.title_weights[prospect.job_title];
    const points = weight * 15;
    score += points;
    if (weight > 0.2) {
      matchReasons.push(`Job title (${prospect.job_title}) matches buyer persona`);
    }
  }

  if (prospect.seniority_level && icp.seniority_weights[prospect.seniority_level]) {
    const weight = icp.seniority_weights[prospect.seniority_level];
    const points = weight * 10;
    score += points;
    if (weight > 0.3) {
      matchReasons.push(`Seniority level (${prospect.seniority_level}) is ideal`);
    }
  }

  if (prospect.technologies && prospect.technologies.length > 0) {
    let techScore = 0;
    const matchedTechs: string[] = [];
    prospect.technologies.forEach(tech => {
      if (icp.technology_weights[tech]) {
        techScore += icp.technology_weights[tech] * 15;
        matchedTechs.push(tech);
      }
    });
    score += Math.min(techScore, 15);
    if (matchedTechs.length > 0) {
      matchReasons.push(`Uses technologies: ${matchedTechs.join(', ')}`);
    }
  }

  score = Math.min(maxScore, Math.round(score));

  let fitRating: LookAlikeScore['fit_rating'];
  if (score >= 75) fitRating = 'excellent';
  else if (score >= 55) fitRating = 'good';
  else if (score >= 35) fitRating = 'fair';
  else fitRating = 'poor';

  const recommendedActions: string[] = [];
  if (score >= 75) {
    recommendedActions.push('High-priority prospect - schedule call ASAP');
    recommendedActions.push('Personalize outreach with industry-specific case studies');
    recommendedActions.push('Consider multi-channel approach (email + LinkedIn + phone)');
  } else if (score >= 55) {
    recommendedActions.push('Strong fit - add to high-priority cadence');
    recommendedActions.push('Research recent company news for personalization');
    recommendedActions.push('Start with value-focused email sequence');
  } else if (score >= 35) {
    recommendedActions.push('Moderate fit - add to nurture campaign');
    recommendedActions.push('Share relevant content to build relationship');
    recommendedActions.push('Monitor for trigger events');
  } else {
    recommendedActions.push('Low fit - consider disqualifying');
    recommendedActions.push('If pursuing, focus on education and long-term nurture');
  }

  return {
    prospect_id: prospect.id,
    similarity_score: score,
    match_reasons: matchReasons,
    fit_rating: fitRating,
    recommended_actions: recommendedActions,
  };
}

export function findLookAlikeProspects(
  prospects: ProspectProfile[],
  icp: IdealCustomerProfile,
  minScore: number = 55
): LookAlikeScore[] {
  return prospects
    .map(prospect => calculateLookAlikeScore(prospect, icp))
    .filter(score => score.similarity_score >= minScore)
    .sort((a, b) => b.similarity_score - a.similarity_score);
}

export function compareProspects(
  prospect1: ProspectProfile,
  prospect2: ProspectProfile
): number {
  let similarityScore = 0;
  let maxScore = 0;

  maxScore += 20;
  if (prospect1.industry === prospect2.industry && prospect1.industry) {
    similarityScore += 20;
  }

  maxScore += 15;
  if (prospect1.company_size === prospect2.company_size && prospect1.company_size) {
    similarityScore += 15;
  }

  maxScore += 15;
  if (prospect1.revenue_range === prospect2.revenue_range && prospect1.revenue_range) {
    similarityScore += 15;
  }

  maxScore += 10;
  if (prospect1.seniority_level === prospect2.seniority_level && prospect1.seniority_level) {
    similarityScore += 10;
  }

  maxScore += 10;
  if (prospect1.geographic_region === prospect2.geographic_region && prospect1.geographic_region) {
    similarityScore += 10;
  }

  maxScore += 30;
  if (prospect1.technologies && prospect2.technologies) {
    const tech1 = new Set(prospect1.technologies);
    const tech2 = new Set(prospect2.technologies);
    const intersection = [...tech1].filter(t => tech2.has(t));
    const union = new Set([...tech1, ...tech2]);
    const jaccardIndex = union.size > 0 ? intersection.length / union.size : 0;
    similarityScore += jaccardIndex * 30;
  }

  return maxScore > 0 ? (similarityScore / maxScore) * 100 : 0;
}

export const COMMON_INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail',
  'Education',
  'Real Estate',
  'Consulting',
  'Marketing',
  'E-commerce',
];

export const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5000+',
];

export const REVENUE_RANGES = [
  '$0-$1M',
  '$1M-$5M',
  '$5M-$10M',
  '$10M-$50M',
  '$50M-$100M',
  '$100M-$500M',
  '$500M+',
];

export const SENIORITY_LEVELS = [
  'Entry',
  'Mid-Level',
  'Senior',
  'Manager',
  'Director',
  'VP',
  'C-Level',
];
