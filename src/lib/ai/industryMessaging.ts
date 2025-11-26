/**
 * Industry-Specific Messaging Engine
 * Generates highly relevant messaging using industry terminology,
 * pain points, and value propositions
 */

import OpenAI from 'openai';
import { ProspectSignals } from '../enrichment/multiSourcePipeline';

// =============================================
// INDUSTRY KNOWLEDGE BASE
// =============================================

export interface IndustryProfile {
  industry: string;
  subVerticals: string[];
  commonRoles: Array<{
    title: string;
    priorities: string[];
    painPoints: string[];
    kpis: string[];
  }>;
  terminology: string[];
  trendTopics: string[];
  commonChallenges: string[];
  regulatoryConsiderations: string[];
  buyingCycle: {
    avgLength: string;
    stakeholders: string[];
    evaluationCriteria: string[];
  };
  seasonality: {
    budgetCycles: string[];
    busyPeriods: string[];
    bestOutreachTimes: string[];
  };
}

const INDUSTRY_PROFILES: Record<string, IndustryProfile> = {
  'Technology': {
    industry: 'Technology',
    subVerticals: ['SaaS', 'Enterprise Software', 'Fintech', 'Healthtech', 'Cybersecurity', 'AI/ML', 'DevTools'],
    commonRoles: [
      {
        title: 'VP of Sales',
        priorities: ['Pipeline growth', 'Team efficiency', 'Quota attainment', 'Sales velocity'],
        painPoints: ['Long sales cycles', 'Low response rates', 'CRM adoption', 'Forecast accuracy'],
        kpis: ['Revenue', 'Win rate', 'Average deal size', 'Sales cycle length'],
      },
      {
        title: 'CTO/VP Engineering',
        priorities: ['Technical excellence', 'Team productivity', 'System reliability', 'Innovation'],
        painPoints: ['Technical debt', 'Hiring challenges', 'Tool sprawl', 'Security concerns'],
        kpis: ['Deployment frequency', 'System uptime', 'Developer productivity', 'Time to market'],
      },
      {
        title: 'CMO/VP Marketing',
        priorities: ['Pipeline contribution', 'Brand awareness', 'Lead quality', 'Attribution'],
        painPoints: ['Proving ROI', 'Channel effectiveness', 'Content scale', 'Marketing-sales alignment'],
        kpis: ['MQLs', 'Cost per lead', 'Marketing sourced revenue', 'Brand metrics'],
      },
    ],
    terminology: ['ARR', 'MRR', 'churn', 'NRR', 'CAC', 'LTV', 'PLG', 'land and expand', 'product-market fit'],
    trendTopics: ['AI integration', 'vertical SaaS', 'usage-based pricing', 'product-led growth', 'platform consolidation'],
    commonChallenges: ['Competitive market', 'Long enterprise sales cycles', 'Technical evaluation hurdles', 'Security requirements'],
    regulatoryConsiderations: ['SOC 2', 'GDPR', 'CCPA', 'HIPAA (for healthtech)'],
    buyingCycle: {
      avgLength: '3-6 months',
      stakeholders: ['Executive sponsor', 'Technical evaluator', 'End users', 'Procurement', 'Security/IT'],
      evaluationCriteria: ['Functionality', 'Integration', 'Security', 'Scalability', 'Support', 'Price'],
    },
    seasonality: {
      budgetCycles: ['Q4 budget planning', 'Q1 new budget'],
      busyPeriods: ['End of quarter pushes', 'Major product launches'],
      bestOutreachTimes: ['January-February', 'September-October'],
    },
  },
  'Financial Services': {
    industry: 'Financial Services',
    subVerticals: ['Banking', 'Insurance', 'Asset Management', 'Fintech', 'Payments', 'Wealth Management'],
    commonRoles: [
      {
        title: 'Chief Revenue Officer',
        priorities: ['Revenue growth', 'Client acquisition', 'Relationship deepening', 'Cross-selling'],
        painPoints: ['Client engagement', 'Digital transformation', 'Competitive pressure', 'Talent retention'],
        kpis: ['AUM growth', 'Client retention', 'Revenue per advisor', 'NPS'],
      },
      {
        title: 'Chief Compliance Officer',
        priorities: ['Regulatory compliance', 'Risk management', 'Audit readiness', 'Policy enforcement'],
        painPoints: ['Regulatory changes', 'Manual processes', 'Documentation burden', 'Training gaps'],
        kpis: ['Compliance incidents', 'Audit findings', 'Training completion', 'Policy violations'],
      },
    ],
    terminology: ['AUM', 'fiduciary', 'KYC', 'AML', 'Basel III', 'Dodd-Frank', 'book of business', 'wallet share'],
    trendTopics: ['Digital banking', 'Open banking', 'Embedded finance', 'RegTech', 'ESG investing'],
    commonChallenges: ['Regulatory compliance', 'Legacy systems', 'Customer experience', 'Competition from fintechs'],
    regulatoryConsiderations: ['SEC', 'FINRA', 'OCC', 'GDPR', 'PCI-DSS', 'SOX'],
    buyingCycle: {
      avgLength: '6-12 months',
      stakeholders: ['Business sponsor', 'Compliance', 'IT/Security', 'Procurement', 'Legal'],
      evaluationCriteria: ['Compliance', 'Security', 'Integration', 'Vendor stability', 'References'],
    },
    seasonality: {
      budgetCycles: ['October-November planning', 'January approvals'],
      busyPeriods: ['Tax season', 'Quarter-end reporting', 'Audit periods'],
      bestOutreachTimes: ['February-March', 'September'],
    },
  },
  'Healthcare': {
    industry: 'Healthcare',
    subVerticals: ['Health Systems', 'Pharma', 'Medical Devices', 'Payers', 'Digital Health', 'Life Sciences'],
    commonRoles: [
      {
        title: 'Chief Medical Officer',
        priorities: ['Patient outcomes', 'Clinical excellence', 'Safety', 'Evidence-based practice'],
        painPoints: ['Clinician burnout', 'Administrative burden', 'Care coordination', 'Data silos'],
        kpis: ['Patient outcomes', 'Readmission rates', 'Safety incidents', 'Patient satisfaction'],
      },
      {
        title: 'VP of Operations',
        priorities: ['Operational efficiency', 'Cost management', 'Staff productivity', 'Resource optimization'],
        painPoints: ['Staffing challenges', 'Supply chain', 'Capacity management', 'Revenue cycle'],
        kpis: ['Operating margin', 'Throughput', 'Staff turnover', 'Days in AR'],
      },
    ],
    terminology: ['EHR', 'EMR', 'HIPAA', 'value-based care', 'population health', 'care continuum', 'clinical workflow'],
    trendTopics: ['Telehealth', 'AI diagnostics', 'Interoperability', 'Patient engagement', 'Value-based care'],
    commonChallenges: ['HIPAA compliance', 'EHR integration', 'Clinician adoption', 'Budget constraints'],
    regulatoryConsiderations: ['HIPAA', 'HITECH', 'FDA', 'CMS regulations', 'State licensing'],
    buyingCycle: {
      avgLength: '9-18 months',
      stakeholders: ['Clinical leadership', 'IT', 'Compliance', 'Finance', 'End users', 'Procurement'],
      evaluationCriteria: ['Clinical validation', 'HIPAA compliance', 'EHR integration', 'ROI', 'Support'],
    },
    seasonality: {
      budgetCycles: ['July-August planning (fiscal year)', 'Calendar year budgets'],
      busyPeriods: ['Flu season', 'Year-end', 'Open enrollment'],
      bestOutreachTimes: ['April-May', 'October'],
    },
  },
  'Manufacturing': {
    industry: 'Manufacturing',
    subVerticals: ['Industrial', 'Automotive', 'Aerospace', 'Consumer Goods', 'Electronics', 'Food & Beverage'],
    commonRoles: [
      {
        title: 'VP of Operations',
        priorities: ['Production efficiency', 'Quality', 'Safety', 'Cost reduction'],
        painPoints: ['Supply chain disruption', 'Labor shortages', 'Equipment downtime', 'Quality issues'],
        kpis: ['OEE', 'Defect rate', 'On-time delivery', 'Production cost per unit'],
      },
      {
        title: 'Supply Chain Director',
        priorities: ['Supply continuity', 'Cost optimization', 'Inventory management', 'Supplier relationships'],
        painPoints: ['Visibility', 'Demand forecasting', 'Supplier risk', 'Lead times'],
        kpis: ['Inventory turns', 'OTIF', 'Supply chain costs', 'Supplier performance'],
      },
    ],
    terminology: ['OEE', 'lean manufacturing', 'just-in-time', 'Industry 4.0', 'IIoT', 'MES', 'ERP', 'supply chain resilience'],
    trendTopics: ['Smart manufacturing', 'Sustainability', 'Reshoring', 'Automation', 'Digital twins'],
    commonChallenges: ['Supply chain visibility', 'Legacy systems', 'Skilled labor shortage', 'Sustainability requirements'],
    regulatoryConsiderations: ['ISO standards', 'OSHA', 'EPA', 'Industry-specific regulations'],
    buyingCycle: {
      avgLength: '6-12 months',
      stakeholders: ['Operations', 'Engineering', 'IT', 'Finance', 'Procurement'],
      evaluationCriteria: ['Reliability', 'Integration', 'Support', 'Total cost of ownership', 'References'],
    },
    seasonality: {
      budgetCycles: ['October-November planning', 'Capital expenditure cycles'],
      busyPeriods: ['Production peaks', 'Year-end'],
      bestOutreachTimes: ['January-March', 'August-September'],
    },
  },
};

// =============================================
// INDUSTRY MESSAGING ENGINE
// =============================================

export class IndustryMessagingEngine {
  private openai: OpenAI;
  private model = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Get industry profile with AI enrichment if not in knowledge base
   */
  async getIndustryProfile(industry: string): Promise<IndustryProfile> {
    // Check knowledge base first
    const normalizedIndustry = this.normalizeIndustry(industry);
    if (INDUSTRY_PROFILES[normalizedIndustry]) {
      return INDUSTRY_PROFILES[normalizedIndustry];
    }

    // Generate with AI
    return this.generateIndustryProfile(industry);
  }

  /**
   * Generate industry-specific messaging
   */
  async generateIndustryMessaging(
    signals: ProspectSignals,
    valueProposition: string
  ): Promise<{
    industryRelevantOpener: string;
    industryPainPoint: string;
    industryValueProp: string;
    industryProof: string;
    industryCTA: string;
    industryTermsUsed: string[];
    industryTrend: string;
  }> {
    const industry = signals.company.industry || 'Technology';
    const profile = await this.getIndustryProfile(industry);

    // Find role-specific context
    const roleContext = this.findRoleContext(signals.professional.title || '', profile);

    const prompt = `Generate industry-specific messaging for this prospect.

PROSPECT:
- Title: ${signals.professional.title}
- Company: ${signals.company.name}
- Industry: ${industry}
- Seniority: ${signals.professional.seniority || 'Unknown'}

INDUSTRY PROFILE:
- Sub-verticals: ${profile.subVerticals.join(', ')}
- Common terminology: ${profile.terminology.join(', ')}
- Current trends: ${profile.trendTopics.join(', ')}
- Common challenges: ${profile.commonChallenges.join(', ')}

ROLE CONTEXT:
${roleContext ? `
- Priorities: ${roleContext.priorities.join(', ')}
- Pain Points: ${roleContext.painPoints.join(', ')}
- KPIs: ${roleContext.kpis.join(', ')}
` : 'Unknown role context'}

VALUE PROPOSITION TO ADAPT:
${valueProposition}

Generate industry-specific messaging:
1. OPENER: A compelling first line that references their industry context
2. PAIN POINT: An industry-specific pain point they likely face
3. VALUE PROP: The value proposition reframed for their industry
4. PROOF: Type of social proof that would resonate (be specific)
5. CTA: An industry-appropriate call to action
6. TERMS: List of industry terms to naturally include
7. TREND: A relevant industry trend to reference

Return as JSON:
{
  "industryRelevantOpener": "...",
  "industryPainPoint": "...",
  "industryValueProp": "...",
  "industryProof": "...",
  "industryCTA": "...",
  "industryTermsUsed": [...],
  "industryTrend": "..."
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert in ${industry} sales messaging. Use authentic industry language and reference real challenges. Return only valid JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return {
        industryRelevantOpener: `As someone in ${industry}, you're likely focused on...`,
        industryPainPoint: profile.commonChallenges?.[0] || 'efficiency',
        industryValueProp: valueProposition,
        industryProof: 'Case study from similar company',
        industryCTA: 'Brief call to discuss?',
        industryTermsUsed: profile.terminology?.slice(0, 3) || [],
        industryTrend: profile.trendTopics?.[0] || 'digital transformation',
      };
    }
  }

  /**
   * Generate complete industry-tailored email
   */
  async generateIndustryEmail(
    signals: ProspectSignals,
    emailType: 'cold_outreach' | 'follow_up' | 'trigger_based',
    valueProposition: string
  ): Promise<{
    subject: string;
    body: string;
    industryScore: number;
    elementsUsed: string[];
  }> {
    const industry = signals.company.industry || 'Technology';
    const profile = await this.getIndustryProfile(industry);
    const roleContext = this.findRoleContext(signals.professional.title || '', profile);
    const messaging = await this.generateIndustryMessaging(signals, valueProposition);

    const prompt = `Write a ${emailType} email for this ${industry} prospect.

PROSPECT:
- Name: ${signals.contact.email.split('@')[0].replace(/[._]/g, ' ')}
- Title: ${signals.professional.title}
- Company: ${signals.company.name}
- Industry: ${industry}

INDUSTRY-SPECIFIC MESSAGING:
- Opener: ${messaging.industryRelevantOpener}
- Pain Point: ${messaging.industryPainPoint}
- Value Prop: ${messaging.industryValueProp}
- Proof to Reference: ${messaging.industryProof}
- CTA: ${messaging.industryCTA}
- Terms to Use: ${messaging.industryTermsUsed.join(', ')}
- Trend to Reference: ${messaging.industryTrend}

${roleContext ? `
ROLE-SPECIFIC CONTEXT:
- Their Priorities: ${roleContext.priorities.join(', ')}
- Their Pain Points: ${roleContext.painPoints.join(', ')}
- Their KPIs: ${roleContext.kpis.join(', ')}
` : ''}

BUYING CYCLE INFO:
- Typical Length: ${profile.buyingCycle.avgLength}
- Key Stakeholders: ${profile.buyingCycle.stakeholders.join(', ')}

RULES:
1. Use industry terminology naturally (don't force it)
2. Reference their specific role priorities
3. Connect to a relevant industry trend
4. Keep it concise (80-120 words)
5. Sound like an insider, not an outsider selling in
6. Include ONE clear call-to-action

Return as JSON:
{
  "subject": "...",
  "body": "...",
  "industryScore": 85,
  "elementsUsed": ["industry term X", "role priority Y", "trend Z"]
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a ${industry} industry expert writing highly relevant sales emails. Return only valid JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return {
        subject: `Quick question about ${signals.company.name}`,
        body: `Hi,\n\n${messaging.industryRelevantOpener}\n\n${messaging.industryValueProp}\n\n${messaging.industryCTA}`,
        industryScore: 50,
        elementsUsed: [],
      };
    }
  }

  /**
   * Get timing recommendation based on industry
   */
  getTimingRecommendation(industry: string): {
    bestDays: string[];
    bestTimes: string[];
    avoidPeriods: string[];
    budgetCycles: string[];
  } {
    const normalizedIndustry = this.normalizeIndustry(industry);
    const profile = INDUSTRY_PROFILES[normalizedIndustry];

    if (!profile) {
      return {
        bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
        bestTimes: ['9:00 AM', '2:00 PM'],
        avoidPeriods: ['Holidays', 'Quarter-end'],
        budgetCycles: ['Q4 planning', 'Q1'],
      };
    }

    return {
      bestDays: ['Tuesday', 'Wednesday'],
      bestTimes: ['9:00 AM', '10:00 AM'],
      avoidPeriods: profile.seasonality.busyPeriods,
      budgetCycles: profile.seasonality.budgetCycles,
    };
  }

  /**
   * Normalize industry name
   */
  private normalizeIndustry(industry: string): string {
    const normalized = industry.toLowerCase();

    if (normalized.includes('tech') || normalized.includes('software') || normalized.includes('saas')) {
      return 'Technology';
    }
    if (normalized.includes('financ') || normalized.includes('bank') || normalized.includes('insurance')) {
      return 'Financial Services';
    }
    if (normalized.includes('health') || normalized.includes('medical') || normalized.includes('pharma')) {
      return 'Healthcare';
    }
    if (normalized.includes('manufactur') || normalized.includes('industrial')) {
      return 'Manufacturing';
    }

    return industry;
  }

  /**
   * Find role context from industry profile
   */
  private findRoleContext(title: string, profile: IndustryProfile) {
    const normalizedTitle = title.toLowerCase();

    for (const role of profile.commonRoles) {
      if (normalizedTitle.includes(role.title.toLowerCase().split(' ')[0])) {
        return role;
      }
    }

    // Try partial matches
    for (const role of profile.commonRoles) {
      const titleWords = role.title.toLowerCase().split(' ');
      if (titleWords.some(word => normalizedTitle.includes(word))) {
        return role;
      }
    }

    return null;
  }

  /**
   * Generate industry profile with AI
   */
  private async generateIndustryProfile(industry: string): Promise<IndustryProfile> {
    const prompt = `Create a detailed industry profile for ${industry} for B2B sales purposes.

Include:
1. Sub-verticals within this industry
2. Common executive roles with their priorities, pain points, and KPIs
3. Industry-specific terminology
4. Current trend topics
5. Common challenges
6. Regulatory considerations
7. Typical buying cycle info
8. Seasonality patterns

Return as JSON matching this structure:
{
  "industry": "${industry}",
  "subVerticals": [...],
  "commonRoles": [{ "title": "...", "priorities": [...], "painPoints": [...], "kpis": [...] }],
  "terminology": [...],
  "trendTopics": [...],
  "commonChallenges": [...],
  "regulatoryConsiderations": [...],
  "buyingCycle": { "avgLength": "...", "stakeholders": [...], "evaluationCriteria": [...] },
  "seasonality": { "budgetCycles": [...], "busyPeriods": [...], "bestOutreachTimes": [...] }
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an industry research expert. Provide accurate, detailed information. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return INDUSTRY_PROFILES['Technology']; // Default fallback
    }
  }
}

/**
 * Create industry messaging engine
 */
export function createIndustryMessagingEngine(): IndustryMessagingEngine {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new IndustryMessagingEngine(apiKey);
}

/**
 * Generate industry-tailored email
 */
export async function generateIndustryTailoredEmail(
  signals: ProspectSignals,
  valueProposition: string,
  emailType: 'cold_outreach' | 'follow_up' | 'trigger_based' = 'cold_outreach'
) {
  const engine = createIndustryMessagingEngine();
  return engine.generateIndustryEmail(signals, emailType, valueProposition);
}
