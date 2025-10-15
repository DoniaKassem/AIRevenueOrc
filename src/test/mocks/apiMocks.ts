export const mockSalesforceTokenResponse = {
  access_token: 'mock_salesforce_access_token_12345',
  refresh_token: 'mock_salesforce_refresh_token_67890',
  token_type: 'Bearer',
  expires_in: 3600,
  instance_url: 'https://na1.salesforce.com',
  id: 'https://login.salesforce.com/id/00D123456789ABC/005123456789XYZ',
};

export const mockZoomInfoContactResponse = {
  success: true,
  data: {
    id: 'zm_12345',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-123-4567',
    title: 'VP of Sales',
    company: 'Acme Corporation',
    companySize: '501-1000',
    industry: 'Technology',
    location: 'San Francisco, CA',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
  },
  credits_used: 1,
};

export const mockHubSpotContactResponse = {
  id: '12345',
  properties: {
    email: 'jane.smith@example.com',
    firstname: 'Jane',
    lastname: 'Smith',
    jobtitle: 'Sales Director',
    company: 'TechStart Inc',
    phone: '+1-555-987-6543',
    hs_lead_status: 'OPEN',
    createdate: '2023-10-15T14:30:00Z',
  },
  createdAt: '2023-10-15T14:30:00Z',
  updatedAt: '2023-10-15T14:30:00Z',
  archived: false,
};

export const mockClearbitEnrichmentResponse = {
  person: {
    id: 'cb_person_12345',
    name: {
      fullName: 'Michael Johnson',
      givenName: 'Michael',
      familyName: 'Johnson',
    },
    email: 'michael.j@innovate.co',
    location: 'Austin, TX',
    employment: {
      title: 'Chief Revenue Officer',
      seniority: 'Executive',
      role: 'Sales',
    },
  },
  company: {
    id: 'cb_company_67890',
    name: 'Innovate Co',
    domain: 'innovate.co',
    category: {
      industry: 'Software',
      sector: 'Information Technology',
    },
    metrics: {
      employees: 350,
      estimatedAnnualRevenue: '50M-100M',
    },
    tech: ['Salesforce', 'HubSpot', 'AWS'],
  },
};

export const mockRateLimitHeaders = {
  'x-rate-limit-limit': '1000',
  'x-rate-limit-remaining': '945',
  'x-rate-limit-reset': String(Date.now() + 3600000),
};

export const mockRateLimitExceededResponse = {
  error: 'Rate limit exceeded',
  message: 'You have exceeded the rate limit. Please try again later.',
  retry_after: 60,
};

export const mockOAuthErrorResponse = {
  error: 'invalid_grant',
  error_description: 'Token has expired',
};

export const mockWebhookPayload = {
  event: 'contact.created',
  timestamp: '2023-10-15T14:30:00Z',
  data: {
    entity_type: 'contact',
    entity_id: 'sf_contact_12345',
    entity: {
      id: 'sf_contact_12345',
      email: 'new.contact@example.com',
      firstName: 'New',
      lastName: 'Contact',
    },
  },
  metadata: {
    source: 'salesforce',
    version: '1.0',
  },
};

export function createMockFetchResponse(data: any, status = 200, headers = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(headers),
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
}

export function createMockFetchError(message: string) {
  return Promise.reject(new Error(message));
}

export const mockApiResponses = {
  salesforce: {
    token: mockSalesforceTokenResponse,
    contact: {
      Id: '003123456789ABC',
      FirstName: 'Sarah',
      LastName: 'Williams',
      Email: 'sarah.w@company.com',
      Title: 'Sales Manager',
      Account: {
        Id: '001123456789DEF',
        Name: 'Global Solutions',
      },
    },
  },
  zoominfo: {
    contact: mockZoomInfoContactResponse,
  },
  hubspot: {
    contact: mockHubSpotContactResponse,
  },
  clearbit: {
    enrichment: mockClearbitEnrichmentResponse,
  },
};
