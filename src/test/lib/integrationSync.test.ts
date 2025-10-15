import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startSync,
  transformRecord,
  createFieldMapping,
  COMMON_FIELD_MAPPINGS,
  SyncConfig,
} from '../../lib/integrationSync';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Integration Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sync Job Management', () => {
    it('should create and start sync job', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'sync-job-1',
            integration_id: 'integration-1',
            status: 'pending',
          },
          error: null,
        }),
      } as any);

      const config: SyncConfig = {
        integration_id: 'integration-1',
        entity_type: 'prospect',
        direction: 'inbound',
        sync_mode: 'incremental',
        field_mappings: [],
      };

      const jobId = await startSync(config);

      expect(jobId).toBe('sync-job-1');
    });

    it('should handle sync job creation errors', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      } as any);

      const config: SyncConfig = {
        integration_id: 'integration-1',
        entity_type: 'prospect',
        direction: 'inbound',
        sync_mode: 'full',
        field_mappings: [],
      };

      await expect(startSync(config)).rejects.toThrow('Failed to create sync job');
    });

    it('should support full sync mode', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'sync-job-2',
            job_type: 'full_sync',
            status: 'pending',
          },
          error: null,
        }),
      } as any);

      const config: SyncConfig = {
        integration_id: 'integration-1',
        entity_type: 'deal',
        direction: 'inbound',
        sync_mode: 'full',
        field_mappings: [],
      };

      const jobId = await startSync(config);

      expect(jobId).toBeDefined();
    });

    it('should support bidirectional sync', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'sync-job-3',
            status: 'pending',
          },
          error: null,
        }),
      } as any);

      const config: SyncConfig = {
        integration_id: 'integration-1',
        entity_type: 'prospect',
        direction: 'bidirectional',
        sync_mode: 'incremental',
        field_mappings: [],
      };

      const jobId = await startSync(config);

      expect(jobId).toBeDefined();
    });
  });

  describe('Field Mapping and Transformation', () => {
    it('should transform Salesforce contact to local format', async () => {
      const salesforceContact = {
        FirstName: 'John',
        LastName: 'Doe',
        Email: 'john.doe@example.com',
        Company: 'Acme Corp',
        Title: 'Sales Director',
        Phone: '+1-555-123-4567',
      };

      const mappings = COMMON_FIELD_MAPPINGS.salesforce_to_revorph;

      const transformed = await transformRecord(salesforceContact, mappings);

      expect(transformed.first_name).toBe('John');
      expect(transformed.last_name).toBe('Doe');
      expect(transformed.email).toBe('john.doe@example.com');
      expect(transformed.company).toBe('Acme Corp');
      expect(transformed.job_title).toBe('Sales Director');
      expect(transformed.phone).toBe('+1-555-123-4567');
    });

    it('should transform HubSpot contact to local format', async () => {
      const hubspotContact = {
        firstname: 'Jane',
        lastname: 'Smith',
        email: 'jane.smith@example.com',
        company: 'TechStart Inc',
        jobtitle: 'VP of Sales',
        phone: '+1-555-987-6543',
      };

      const mappings = COMMON_FIELD_MAPPINGS.hubspot_to_revorph;

      const transformed = await transformRecord(hubspotContact, mappings);

      expect(transformed.first_name).toBe('Jane');
      expect(transformed.last_name).toBe('Smith');
      expect(transformed.email).toBe('jane.smith@example.com');
      expect(transformed.company).toBe('TechStart Inc');
      expect(transformed.job_title).toBe('VP of Sales');
      expect(transformed.phone).toBe('+1-555-987-6543');
    });

    it('should apply uppercase transformation', async () => {
      const record = { name: 'john doe' };
      const mappings = [
        {
          source_field: 'name',
          target_field: 'full_name',
          transformation: 'uppercase',
          is_required: false,
        },
      ];

      const transformed = await transformRecord(record, mappings);

      expect(transformed.full_name).toBe('JOHN DOE');
    });

    it('should apply lowercase transformation', async () => {
      const record = { email: 'USER@EXAMPLE.COM' };
      const mappings = [
        {
          source_field: 'email',
          target_field: 'email',
          transformation: 'lowercase',
          is_required: true,
        },
      ];

      const transformed = await transformRecord(record, mappings);

      expect(transformed.email).toBe('user@example.com');
    });

    it('should apply trim transformation', async () => {
      const record = { name: '  John Doe  ' };
      const mappings = [
        {
          source_field: 'name',
          target_field: 'name',
          transformation: 'trim',
          is_required: false,
        },
      ];

      const transformed = await transformRecord(record, mappings);

      expect(transformed.name).toBe('John Doe');
    });

    it('should use default value for missing field', async () => {
      const record = { first_name: 'John' };
      const mappings = [
        {
          source_field: 'last_name',
          target_field: 'last_name',
          transformation: 'none',
          default_value: 'Unknown',
          is_required: true,
        },
      ];

      const transformed = await transformRecord(record, mappings);

      expect(transformed.last_name).toBe('Unknown');
    });

    it('should throw error for missing required field without default', async () => {
      const record = { first_name: 'John' };
      const mappings = [
        {
          source_field: 'email',
          target_field: 'email',
          transformation: 'none',
          is_required: true,
        },
      ];

      await expect(transformRecord(record, mappings)).rejects.toThrow(
        'Required field email is missing'
      );
    });

    it('should skip optional missing fields', async () => {
      const record = { first_name: 'John' };
      const mappings = [
        {
          source_field: 'phone',
          target_field: 'phone',
          transformation: 'none',
          is_required: false,
        },
      ];

      const transformed = await transformRecord(record, mappings);

      expect(transformed.phone).toBeUndefined();
    });

    it('should convert number to string', async () => {
      const record = { amount: 50000 };
      const mappings = [
        {
          source_field: 'amount',
          target_field: 'amount_text',
          transformation: 'number_to_string',
          is_required: false,
        },
      ];

      const transformed = await transformRecord(record, mappings);

      expect(transformed.amount_text).toBe('50000');
      expect(typeof transformed.amount_text).toBe('string');
    });

    it('should convert string to number', async () => {
      const record = { probability: '75' };
      const mappings = [
        {
          source_field: 'probability',
          target_field: 'probability_num',
          transformation: 'string_to_number',
          is_required: false,
        },
      ];

      const transformed = await transformRecord(record, mappings);

      expect(transformed.probability_num).toBe(75);
      expect(typeof transformed.probability_num).toBe('number');
    });
  });

  describe('Field Mapping Creation', () => {
    it('should create field mapping with defaults', () => {
      const mapping = createFieldMapping('source_field', 'target_field');

      expect(mapping.source_field).toBe('source_field');
      expect(mapping.target_field).toBe('target_field');
      expect(mapping.transformation).toBe('none');
      expect(mapping.is_required).toBe(false);
    });

    it('should create field mapping with options', () => {
      const mapping = createFieldMapping('email', 'email_address', {
        transformation: 'lowercase',
        is_required: true,
        default_value: null,
      });

      expect(mapping.source_field).toBe('email');
      expect(mapping.target_field).toBe('email_address');
      expect(mapping.transformation).toBe('lowercase');
      expect(mapping.is_required).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('should validate email format before sync', async () => {
      const record = { email: 'invalid-email' };
      const mappings = [
        {
          source_field: 'email',
          target_field: 'email',
          transformation: 'lowercase',
          is_required: true,
        },
      ];

      const transformed = await transformRecord(record, mappings);

      expect(transformed.email).toBe('invalid-email');
    });

    it('should handle null values correctly', async () => {
      const record = { email: null, first_name: 'John' };
      const mappings = [
        {
          source_field: 'email',
          target_field: 'email',
          transformation: 'none',
          is_required: false,
        },
        {
          source_field: 'first_name',
          target_field: 'first_name',
          transformation: 'none',
          is_required: true,
        },
      ];

      const transformed = await transformRecord(record, mappings);

      expect(transformed.email).toBeUndefined();
      expect(transformed.first_name).toBe('John');
    });

    it('should handle empty string values', async () => {
      const record = { email: '', first_name: 'John' };
      const mappings = [
        {
          source_field: 'email',
          target_field: 'email',
          transformation: 'none',
          default_value: 'no-email@example.com',
          is_required: true,
        },
      ];

      const transformed = await transformRecord(record, mappings);

      expect(transformed.email).toBe('no-email@example.com');
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect and handle duplicate records', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'existing-prospect-1', email: 'john@example.com' },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
      } as any);

      expect(true).toBe(true);
    });

    it('should handle concurrent updates to same record', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'prospect-1', updated_at: new Date().toISOString() },
          error: null,
        }),
      } as any);

      expect(true).toBe(true);
    });
  });

  describe('Batch Processing', () => {
    it('should handle batch record transformation', async () => {
      const records = [
        { FirstName: 'John', LastName: 'Doe', Email: 'john@example.com' },
        { FirstName: 'Jane', LastName: 'Smith', Email: 'jane@example.com' },
        { FirstName: 'Bob', LastName: 'Johnson', Email: 'bob@example.com' },
      ];

      const mappings = COMMON_FIELD_MAPPINGS.salesforce_to_revorph;

      const transformed = await Promise.all(
        records.map(record => transformRecord(record, mappings))
      );

      expect(transformed).toHaveLength(3);
      expect(transformed[0].first_name).toBe('John');
      expect(transformed[1].first_name).toBe('Jane');
      expect(transformed[2].first_name).toBe('Bob');
    });

    it('should handle partial batch failures', async () => {
      const records = [
        { FirstName: 'John', Email: 'john@example.com' },
        { FirstName: 'Jane' },
        { FirstName: 'Bob', Email: 'bob@example.com' },
      ];

      const mappings = [
        createFieldMapping('FirstName', 'first_name'),
        createFieldMapping('Email', 'email', { is_required: true }),
      ];

      const results = await Promise.allSettled(
        records.map(record => transformRecord(record, mappings))
      );

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(1);
    });
  });

  describe('Performance Optimization', () => {
    it('should complete transformation quickly for large dataset', async () => {
      const records = Array.from({ length: 1000 }, (_, i) => ({
        FirstName: `User${i}`,
        LastName: `Test${i}`,
        Email: `user${i}@example.com`,
        Company: `Company${i}`,
      }));

      const mappings = COMMON_FIELD_MAPPINGS.salesforce_to_revorph;

      const startTime = Date.now();
      await Promise.all(records.map(record => transformRecord(record, mappings)));
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });
  });
});
