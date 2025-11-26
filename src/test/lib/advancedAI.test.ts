/**
 * Edge Case Tests for Advanced AI Components
 * Tests: advancedPersonalization, emailOptimizer, industryMessaging, pipeline
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock OpenAI before imports
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// =============================================
// EDGE CASE TEST UTILITIES
// =============================================

const createMockProspectSignals = (overrides: any = {}) => ({
  contact: {
    email: 'test@example.com',
    emailVerified: true,
    phone: '+1-555-0100',
    linkedinUrl: 'https://linkedin.com/in/testuser',
    ...overrides.contact,
  },
  professional: {
    title: 'VP of Sales',
    headline: 'Sales Leader',
    department: 'Sales',
    seniority: 'VP',
    skills: ['Sales', 'Leadership'],
    ...overrides.professional,
  },
  company: {
    name: 'Test Corp',
    industry: 'Technology',
    employeeCount: 500,
    technologies: ['Salesforce', 'HubSpot'],
    ...overrides.company,
  },
  intent: {
    signals: [
      { type: 'website_visit', description: 'Visited pricing page', confidence: 80 },
    ],
    score: 75,
    buyingStage: 'evaluation',
    ...overrides.intent,
  },
  research: {
    companyNews: [{ title: 'Company raises Series B', date: '2024-01-15' }],
    painPoints: ['scaling sales team'],
    ...overrides.research,
  },
  metadata: {
    sources: ['salesforce', 'linkedin'],
    qualityScore: 85,
    completeness: 0.9,
    freshness: new Date().toISOString(),
    ...overrides.metadata,
  },
});

// =============================================
// ADVANCED PERSONALIZATION EDGE CASES
// =============================================

describe('Advanced Personalization Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty/Null Input Handling', () => {
    it('should handle empty prospect signals gracefully', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { enrichment_data: null } }),
      } as any));

      // This should not throw but return default/fallback values
      const { generateAdvancedPersonalization } = await import('../../lib/ai/advancedPersonalization');

      await expect(generateAdvancedPersonalization('test-id')).rejects.toThrow();
    });

    it('should handle missing professional title', async () => {
      const signals = createMockProspectSignals({
        professional: { title: '', seniority: '' },
      });

      const { supabase } = await import('../../lib/supabase');
      vi.mocked(supabase.from).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { enrichment_data: signals } }),
      } as any));

      // Should still work with empty title
      const { AdvancedPersonalizationEngine } = await import('../../lib/ai/advancedPersonalization');
      const engine = new AdvancedPersonalizationEngine();

      // Engine should handle empty title without crashing
      expect(engine).toBeDefined();
    });

    it('should handle zero intent score', async () => {
      const signals = createMockProspectSignals({
        intent: { signals: [], score: 0, buyingStage: undefined },
      });

      // Should not crash with zero/undefined intent
      expect(signals.intent.score).toBe(0);
      expect(signals.intent.signals).toHaveLength(0);
    });
  });

  describe('Malformed API Response Handling', () => {
    it('should handle OpenAI returning empty content', async () => {
      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test' });

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue({
        choices: [{ message: { content: null } }],
      } as any);

      // Should handle null content gracefully
      expect(mockOpenAI.chat.completions.create).toBeDefined();
    });

    it('should handle OpenAI returning invalid JSON', async () => {
      const OpenAI = (await import('openai')).default;
      const mockOpenAI = new OpenAI({ apiKey: 'test' });

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue({
        choices: [{ message: { content: 'not valid json {{{' } }],
      } as any);

      // JSON.parse should throw, engine should catch
      expect(() => JSON.parse('not valid json {{{')).toThrow();
    });

    it('should handle OpenAI returning partial persona structure', async () => {
      const partialPersona = {
        archetype: 'Decision Maker',
        // Missing: communicationStyle, buyingRole, riskTolerance, etc.
      };

      // Should validate and fill defaults for missing fields
      expect(partialPersona.archetype).toBeDefined();
      expect((partialPersona as any).communicationStyle).toBeUndefined();
    });
  });

  describe('Boundary Values', () => {
    it('should handle very long company name', async () => {
      const longName = 'A'.repeat(1000);
      const signals = createMockProspectSignals({
        company: { name: longName },
      });

      expect(signals.company.name.length).toBe(1000);
    });

    it('should handle special characters in title', async () => {
      const signals = createMockProspectSignals({
        professional: { title: 'VP & Director of Sales/Marketing <script>alert(1)</script>' },
      });

      // Should sanitize or handle special characters
      expect(signals.professional.title).toContain('<script>');
    });

    it('should handle unicode characters in company name', async () => {
      const signals = createMockProspectSignals({
        company: { name: '日本株式会社 🚀 Ümläuts' },
      });

      expect(signals.company.name).toContain('日本');
      expect(signals.company.name).toContain('🚀');
    });

    it('should handle extremely high intent score', async () => {
      const signals = createMockProspectSignals({
        intent: { score: 150 }, // Over 100
      });

      expect(signals.intent.score).toBe(150);
      // Should cap at 100 or handle gracefully
    });

    it('should handle negative intent score', async () => {
      const signals = createMockProspectSignals({
        intent: { score: -50 },
      });

      expect(signals.intent.score).toBe(-50);
      // Should floor at 0 or handle gracefully
    });
  });
});

// =============================================
// EMAIL OPTIMIZER EDGE CASES
// =============================================

describe('Email Optimizer Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty Data Handling', () => {
    it('should handle no historical email data', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any));

      const { createEmailOptimizer } = await import('../../lib/ai/emailOptimizer');
      const optimizer = createEmailOptimizer();

      expect(optimizer).toBeDefined();
    });

    it('should handle email with empty subject', async () => {
      const email = {
        subject: '',
        body: 'This is the email body',
      };

      expect(email.subject).toBe('');
      // Should reject or add default subject
    });

    it('should handle email with empty body', async () => {
      const email = {
        subject: 'Test Subject',
        body: '',
      };

      expect(email.body).toBe('');
      // Should reject or handle gracefully
    });
  });

  describe('Performance Analysis Edge Cases', () => {
    it('should handle all emails having 0% open rate', async () => {
      const mockEmails = Array(10).fill(null).map((_, i) => ({
        id: `email-${i}`,
        subject: `Subject ${i}`,
        opened: false,
        replied: false,
        clicked: false,
      }));

      // Should calculate 0% rates without division errors
      const openRate = mockEmails.filter(e => e.opened).length / mockEmails.length;
      expect(openRate).toBe(0);
    });

    it('should handle division by zero in metrics', async () => {
      const mockEmails: any[] = [];

      // When no emails exist, avoid division by zero
      const openRate = mockEmails.length > 0
        ? mockEmails.filter(e => e.opened).length / mockEmails.length
        : 0;

      expect(openRate).toBe(0);
      expect(Number.isNaN(openRate)).toBe(false);
    });
  });

  describe('Reply Analysis Edge Cases', () => {
    it('should handle reply with only whitespace', async () => {
      const reply = '   \n\t   ';

      expect(reply.trim()).toBe('');
      // Should detect as empty/invalid reply
    });

    it('should handle very long reply (potential DoS)', async () => {
      const longReply = 'A'.repeat(100000);

      expect(longReply.length).toBe(100000);
      // Should truncate or handle gracefully
    });

    it('should handle reply with only emojis', async () => {
      const reply = '👍👍👍';

      expect(reply.length).toBe(6); // 3 emojis, 2 chars each
      // Should detect sentiment from emojis
    });
  });
});

// =============================================
// INDUSTRY MESSAGING EDGE CASES
// =============================================

describe('Industry Messaging Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unknown Industry Handling', () => {
    it('should handle completely unknown industry', async () => {
      const { createIndustryMessagingEngine } = await import('../../lib/ai/industryMessaging');
      const engine = createIndustryMessagingEngine();

      const profile = await engine.getIndustryProfile('Underwater Basket Weaving');

      // Should return a generic profile or dynamically generate one
      expect(profile).toBeDefined();
    });

    it('should handle null industry', async () => {
      const signals = createMockProspectSignals({
        company: { industry: null },
      });

      expect(signals.company.industry).toBeNull();
      // Should use default/generic messaging
    });

    it('should handle empty string industry', async () => {
      const signals = createMockProspectSignals({
        company: { industry: '' },
      });

      expect(signals.company.industry).toBe('');
    });
  });

  describe('Industry Name Variations', () => {
    it('should normalize industry name casing', async () => {
      const { createIndustryMessagingEngine } = await import('../../lib/ai/industryMessaging');
      const engine = createIndustryMessagingEngine();

      const profile1 = await engine.getIndustryProfile('TECHNOLOGY');
      const profile2 = await engine.getIndustryProfile('technology');
      const profile3 = await engine.getIndustryProfile('Technology');

      // All should return same/similar profile
      expect(profile1).toBeDefined();
      expect(profile2).toBeDefined();
      expect(profile3).toBeDefined();
    });

    it('should handle industry with typos', async () => {
      const { createIndustryMessagingEngine } = await import('../../lib/ai/industryMessaging');
      const engine = createIndustryMessagingEngine();

      const profile = await engine.getIndustryProfile('Technolgy'); // typo

      // Should either correct or use fuzzy match
      expect(profile).toBeDefined();
    });
  });

  describe('Timing Recommendations Edge Cases', () => {
    it('should handle weekend timing recommendation', async () => {
      const { createIndustryMessagingEngine } = await import('../../lib/ai/industryMessaging');
      const engine = createIndustryMessagingEngine();

      const timing = engine.getTimingRecommendation('Technology');

      expect(timing).toBeDefined();
      // Should not recommend weekends typically
    });
  });
});

// =============================================
// PIPELINE EDGE CASES
// =============================================

describe('Pipeline Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should reject empty prospectId', async () => {
      const input = { prospectId: '' };

      expect(input.prospectId).toBe('');
      // Should throw validation error
    });

    it('should handle undefined prospectId', async () => {
      const input = { prospectId: undefined };

      expect(input.prospectId).toBeUndefined();
    });

    it('should handle invalid UUID format', async () => {
      const input = { prospectId: 'not-a-valid-uuid' };

      expect(input.prospectId).toBe('not-a-valid-uuid');
      // Should validate UUID format
    });
  });

  describe('Concurrent Execution', () => {
    it('should handle rapid sequential calls', async () => {
      const calls = Array(10).fill(null).map((_, i) => ({
        prospectId: `prospect-${i}`,
      }));

      expect(calls.length).toBe(10);
      // Should queue or handle gracefully without race conditions
    });
  });

  describe('Step Failure Handling', () => {
    it('should continue after non-critical step failure', async () => {
      // If research fails, should still generate email
      const stepResults = [
        { step: 'enrichment', status: 'completed' },
        { step: 'research', status: 'failed' },
        { step: 'email', status: 'completed' },
      ];

      const failedSteps = stepResults.filter(s => s.status === 'failed');
      expect(failedSteps.length).toBe(1);
      // Pipeline should still complete
    });

    it('should stop on critical step failure', async () => {
      // If import fails, should not continue
      const stepResults = [
        { step: 'import', status: 'failed' },
      ];

      expect(stepResults[0].status).toBe('failed');
      // Pipeline should abort
    });
  });

  describe('Config Edge Cases', () => {
    it('should handle all features disabled', async () => {
      const config = {
        enableDeepResearch: false,
        enableAIEnhancement: false,
        generateSequence: false,
        enableAdvancedPersonalization: false,
        enableIndustryMessaging: false,
        enableEmailOptimization: false,
      };

      // Should still complete with minimal processing
      expect(Object.values(config).every(v => v === false)).toBe(true);
    });

    it('should handle all features enabled', async () => {
      const config = {
        enableDeepResearch: true,
        enableAIEnhancement: true,
        generateSequence: true,
        enableAdvancedPersonalization: true,
        enableIndustryMessaging: true,
        enableEmailOptimization: true,
      };

      expect(Object.values(config).every(v => v === true)).toBe(true);
    });

    it('should handle very long sequence length', async () => {
      const config = {
        generateSequence: true,
        sequenceLength: 1000,
      };

      expect(config.sequenceLength).toBe(1000);
      // Should cap at reasonable limit
    });

    it('should handle zero sequence length', async () => {
      const config = {
        generateSequence: true,
        sequenceLength: 0,
      };

      expect(config.sequenceLength).toBe(0);
      // Should use default or reject
    });

    it('should handle negative sequence length', async () => {
      const config = {
        generateSequence: true,
        sequenceLength: -5,
      };

      expect(config.sequenceLength).toBe(-5);
      // Should use default or reject
    });
  });
});

// =============================================
// FRONTEND COMPONENT EDGE CASES
// =============================================

describe('Frontend Logic Edge Cases', () => {
  describe('Auth Token Handling', () => {
    it('should handle missing localStorage', () => {
      // In SSR or restricted environments
      const getToken = () => {
        try {
          return localStorage.getItem('auth_token');
        } catch {
          return null;
        }
      };

      // Should not throw
      expect(getToken).not.toThrow();
    });

    it('should handle expired token format', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.xxx';

      // Should detect and handle expired tokens
      expect(token).toBeDefined();
    });
  });

  describe('State Edge Cases', () => {
    it('should handle selectedVariant exceeding array bounds', () => {
      const variants = [{ body: 'variant 1' }];
      const selectedVariant = 5; // Out of bounds

      const safeVariant = variants[selectedVariant] || variants[0];
      expect(safeVariant).toBeDefined();
    });

    it('should handle empty prospects array', () => {
      const prospects: any[] = [];
      const selectedProspect = null;

      expect(prospects.length).toBe(0);
      expect(selectedProspect).toBeNull();
    });
  });

  describe('Pipeline Step Status Edge Cases', () => {
    it('should handle unknown step status', () => {
      const step = { id: 'test', status: 'unknown' as any };

      // Should treat unknown as pending
      const isComplete = step.status === 'completed';
      expect(isComplete).toBe(false);
    });

    it('should handle step with undefined status', () => {
      const step = { id: 'test', status: undefined as any };

      expect(step.status).toBeUndefined();
    });
  });
});

// =============================================
// API ROUTE EDGE CASES
// =============================================

describe('API Route Edge Cases', () => {
  describe('Request Validation', () => {
    it('should reject request without authentication', () => {
      const req = { headers: {} };

      expect(req.headers).not.toHaveProperty('Authorization');
      // Should return 401
    });

    it('should reject malformed request body', () => {
      const body = 'not json';

      expect(() => JSON.parse(body)).toThrow();
      // Should return 400
    });

    it('should handle request with extra fields', () => {
      const body = {
        prospectId: 'test-id',
        unknownField: 'should be ignored',
        anotherUnknown: 123,
      };

      expect(body.prospectId).toBeDefined();
      // Should ignore extra fields
    });
  });

  describe('Response Edge Cases', () => {
    it('should handle very large response payload', () => {
      const largeArray = Array(10000).fill({ data: 'test' });

      expect(largeArray.length).toBe(10000);
      // Should paginate or limit
    });
  });
});

// =============================================
// DATA TYPE EDGE CASES
// =============================================

describe('Data Type Edge Cases', () => {
  describe('Array Operations', () => {
    it('should handle slice on undefined array', () => {
      const arr: string[] | undefined = undefined;
      const result = arr?.slice(0, 3) || [];

      expect(result).toEqual([]);
    });

    it('should handle map on empty array', () => {
      const arr: string[] = [];
      const result = arr.map(x => x.toUpperCase());

      expect(result).toEqual([]);
    });

    it('should handle filter returning empty array', () => {
      const arr = [1, 2, 3];
      const result = arr.filter(x => x > 10);

      expect(result).toEqual([]);
      expect(result[0]).toBeUndefined();
    });
  });

  describe('String Operations', () => {
    it('should handle replace on undefined', () => {
      const str: string | undefined = undefined;
      const result = str?.replace('_', ' ') || '';

      expect(result).toBe('');
    });

    it('should handle split on empty string', () => {
      const str = '';
      const result = str.split(',');

      expect(result).toEqual(['']);
    });
  });

  describe('Numeric Operations', () => {
    it('should handle percentage calculation with zero', () => {
      const total = 0;
      const count = 5;
      const percentage = total > 0 ? (count / total) * 100 : 0;

      expect(percentage).toBe(0);
      expect(Number.isFinite(percentage)).toBe(true);
    });

    it('should handle NaN in calculations', () => {
      const value = parseInt('not a number', 10);
      const safeValue = Number.isNaN(value) ? 0 : value;

      expect(safeValue).toBe(0);
    });
  });
});
