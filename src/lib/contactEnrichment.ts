export interface EnrichmentResult {
  success: boolean;
  source: string;
  data: {
    email?: string;
    phone?: string;
    linkedin_url?: string;
    company_website?: string;
    job_title?: string;
    department?: string;
    seniority?: string;
    company_size?: string;
    industry?: string;
    technologies?: string[];
    funding_stage?: string;
    employee_count?: number;
    annual_revenue?: string;
  };
  confidence_score: number;
  timestamp: string;
}

export interface ValidationResult {
  is_valid: boolean;
  email_status?: 'valid' | 'invalid' | 'risky' | 'unknown';
  phone_status?: 'valid' | 'invalid' | 'unknown';
  details: {
    deliverable?: boolean;
    format_valid?: boolean;
    disposable?: boolean;
    role_based?: boolean;
    phone_type?: 'mobile' | 'landline' | 'voip' | 'unknown';
    carrier?: string;
  };
}

export interface BestContactTime {
  timezone: string;
  best_days: string[];
  best_hours: number[];
  worst_days: string[];
  worst_hours: number[];
  reasoning: string;
}

export async function enrichContact(
  email: string,
  firstName?: string,
  lastName?: string,
  company?: string
): Promise<EnrichmentResult> {
  await new Promise(resolve => setTimeout(resolve, 500));

  const mockData: EnrichmentResult = {
    success: true,
    source: 'clearbit',
    data: {
      email,
      phone: '+1 (555) 123-4567',
      linkedin_url: `https://linkedin.com/in/${firstName?.toLowerCase()}-${lastName?.toLowerCase()}`,
      company_website: company ? `https://${company.toLowerCase().replace(/\s+/g, '')}.com` : undefined,
      job_title: 'VP of Sales',
      department: 'Sales',
      seniority: 'VP',
      company_size: '201-500',
      industry: 'Technology',
      technologies: ['Salesforce', 'HubSpot', 'Outreach'],
      funding_stage: 'Series B',
      employee_count: 350,
      annual_revenue: '$10M-$50M',
    },
    confidence_score: 0.85,
    timestamp: new Date().toISOString(),
  };

  return mockData;
}

export async function validateEmail(email: string): Promise<ValidationResult> {
  await new Promise(resolve => setTimeout(resolve, 300));

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isFormatValid = emailRegex.test(email);

  const disposableDomains = ['tempmail.com', 'guerrillamail.com', '10minutemail.com'];
  const roleBased = ['info@', 'contact@', 'admin@', 'support@', 'sales@'];

  const isDisposable = disposableDomains.some(domain => email.includes(domain));
  const isRoleBased = roleBased.some(role => email.startsWith(role));

  let status: ValidationResult['email_status'] = 'valid';
  if (!isFormatValid) status = 'invalid';
  else if (isDisposable) status = 'risky';
  else if (isRoleBased) status = 'risky';

  return {
    is_valid: isFormatValid && !isDisposable,
    email_status: status,
    details: {
      deliverable: isFormatValid && !isDisposable,
      format_valid: isFormatValid,
      disposable: isDisposable,
      role_based: isRoleBased,
    },
  };
}

export async function validatePhone(phone: string): Promise<ValidationResult> {
  await new Promise(resolve => setTimeout(resolve, 300));

  const phoneRegex = /^[\d\s\+\-\(\)]+$/;
  const isFormatValid = phoneRegex.test(phone);

  const digits = phone.replace(/\D/g, '');
  const isValidLength = digits.length >= 10 && digits.length <= 15;

  return {
    is_valid: isFormatValid && isValidLength,
    phone_status: isFormatValid && isValidLength ? 'valid' : 'invalid',
    details: {
      format_valid: isFormatValid,
      phone_type: 'mobile',
      carrier: 'AT&T',
    },
  };
}

export function calculateBestContactTime(
  timezone: string,
  industry?: string,
  jobTitle?: string
): BestContactTime {
  const isCLevel = jobTitle?.toLowerCase().includes('ceo') ||
    jobTitle?.toLowerCase().includes('cto') ||
    jobTitle?.toLowerCase().includes('cfo');

  const isManager = jobTitle?.toLowerCase().includes('manager') ||
    jobTitle?.toLowerCase().includes('director');

  let bestHours: number[];
  let worstHours: number[];
  let reasoning: string;

  if (isCLevel) {
    bestHours = [7, 8, 17, 18];
    worstHours = [12, 13, 14, 15, 16];
    reasoning = 'C-level executives are typically available early morning or after business hours';
  } else if (isManager) {
    bestHours = [9, 10, 11, 14, 15];
    worstHours = [12, 13, 17, 18];
    reasoning = 'Managers are most available mid-morning or mid-afternoon, avoiding lunch and end of day';
  } else {
    bestHours = [10, 11, 14, 15, 16];
    worstHours = [8, 9, 12, 13, 17, 18];
    reasoning = 'Individual contributors are most available mid-morning and afternoon';
  }

  const bestDays = ['Tuesday', 'Wednesday', 'Thursday'];
  const worstDays = ['Monday', 'Friday'];

  return {
    timezone,
    best_days: bestDays,
    best_hours: bestHours,
    worst_days: worstDays,
    worst_hours: worstHours,
    reasoning,
  };
}

export async function enrichFromLinkedIn(linkedinUrl: string): Promise<EnrichmentResult> {
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    success: true,
    source: 'linkedin',
    data: {
      linkedin_url: linkedinUrl,
      job_title: 'Senior Sales Manager',
      department: 'Sales',
      seniority: 'Senior',
      company_size: '51-200',
      industry: 'SaaS',
    },
    confidence_score: 0.9,
    timestamp: new Date().toISOString(),
  };
}

export async function findCompanyTechnologies(domain: string): Promise<string[]> {
  await new Promise(resolve => setTimeout(resolve, 600));

  const commonTechStacks = [
    ['Salesforce', 'Outreach', 'ZoomInfo', 'LinkedIn Sales Navigator'],
    ['HubSpot', 'Intercom', 'Drift', 'Calendly'],
    ['AWS', 'MongoDB', 'React', 'Node.js'],
    ['Google Workspace', 'Slack', 'Zoom', 'Asana'],
  ];

  return commonTechStacks[Math.floor(Math.random() * commonTechStacks.length)];
}

export function scoreEnrichmentQuality(enrichment: EnrichmentResult): {
  score: number;
  missing_fields: string[];
  quality: 'excellent' | 'good' | 'fair' | 'poor';
} {
  const requiredFields = [
    'email',
    'phone',
    'job_title',
    'company_size',
    'industry',
  ];

  const optionalFields = [
    'linkedin_url',
    'company_website',
    'department',
    'seniority',
    'technologies',
    'annual_revenue',
  ];

  let score = 0;
  const missingFields: string[] = [];

  requiredFields.forEach(field => {
    if (enrichment.data[field as keyof typeof enrichment.data]) {
      score += 15;
    } else {
      missingFields.push(field);
    }
  });

  optionalFields.forEach(field => {
    if (enrichment.data[field as keyof typeof enrichment.data]) {
      score += 5;
    }
  });

  score = Math.min(100, score + enrichment.confidence_score * 10);

  let quality: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 85) quality = 'excellent';
  else if (score >= 65) quality = 'good';
  else if (score >= 45) quality = 'fair';
  else quality = 'poor';

  return {
    score: Math.round(score),
    missing_fields: missingFields,
    quality,
  };
}

export const ENRICHMENT_PROVIDERS = [
  {
    name: 'Clearbit',
    supports: ['email', 'company', 'technology'],
    cost_per_lookup: 0.10,
    accuracy: 0.85,
  },
  {
    name: 'ZoomInfo',
    supports: ['email', 'phone', 'company', 'linkedin'],
    cost_per_lookup: 0.50,
    accuracy: 0.90,
  },
  {
    name: 'Apollo',
    supports: ['email', 'phone', 'linkedin'],
    cost_per_lookup: 0.25,
    accuracy: 0.80,
  },
  {
    name: 'Hunter',
    supports: ['email'],
    cost_per_lookup: 0.05,
    accuracy: 0.75,
  },
];

export function selectBestEnrichmentProvider(
  requiredData: string[],
  budget?: number
): string {
  const providers = ENRICHMENT_PROVIDERS.filter(p =>
    requiredData.every(req => p.supports.includes(req))
  );

  if (providers.length === 0) return 'clearbit';

  if (budget) {
    const affordable = providers.filter(p => p.cost_per_lookup <= budget);
    if (affordable.length > 0) {
      return affordable.sort((a, b) => b.accuracy - a.accuracy)[0].name;
    }
  }

  return providers.sort((a, b) => b.accuracy - a.accuracy)[0].name;
}
