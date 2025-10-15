export function createMockSupabaseClient() {
  const mockData: Record<string, any[]> = {
    integration_providers: [
      {
        id: 'provider-1',
        name: 'Salesforce',
        category: 'CRM',
        auth_type: 'oauth2',
        is_active: true,
      },
      {
        id: 'provider-2',
        name: 'ZoomInfo',
        category: 'Enrichment',
        auth_type: 'api_key',
        is_active: true,
      },
      {
        id: 'provider-3',
        name: 'HubSpot',
        category: 'CRM',
        auth_type: 'oauth2',
        is_active: true,
      },
    ],
    team_integrations: [],
    enrichment_providers: [
      {
        id: 'enrich-1',
        provider_name: 'zoominfo',
        display_name: 'ZoomInfo',
        priority_order: 1,
        is_enabled: true,
        credits_remaining: 1000,
        credits_used_this_month: 50,
      },
      {
        id: 'enrich-2',
        provider_name: 'clearbit',
        display_name: 'Clearbit',
        priority_order: 2,
        is_enabled: true,
        credits_remaining: 500,
        credits_used_this_month: 25,
      },
    ],
    api_rate_limits: [],
    sync_jobs: [],
    webhook_endpoints: [],
  };

  const createQueryBuilder = (table: string) => {
    let query: any = {
      data: mockData[table] || [],
      error: null,
    };

    const builder = {
      select: (columns = '*') => {
        return builder;
      },
      insert: (data: any) => {
        const record = Array.isArray(data) ? data : [data];
        record.forEach(r => {
          const newRecord = {
            id: `${table}-${Date.now()}-${Math.random()}`,
            created_at: new Date().toISOString(),
            ...r,
          };
          if (!mockData[table]) mockData[table] = [];
          mockData[table].push(newRecord);
          query.data = newRecord;
        });
        return builder;
      },
      update: (data: any) => {
        query.data = { ...query.data, ...data, updated_at: new Date().toISOString() };
        return builder;
      },
      delete: () => {
        return builder;
      },
      eq: (column: string, value: any) => {
        query.data = (Array.isArray(query.data) ? query.data : [query.data]).filter(
          (item: any) => item[column] === value
        );
        return builder;
      },
      neq: (column: string, value: any) => {
        query.data = (Array.isArray(query.data) ? query.data : [query.data]).filter(
          (item: any) => item[column] !== value
        );
        return builder;
      },
      gt: (column: string, value: any) => {
        query.data = (Array.isArray(query.data) ? query.data : [query.data]).filter(
          (item: any) => item[column] > value
        );
        return builder;
      },
      gte: (column: string, value: any) => {
        query.data = (Array.isArray(query.data) ? query.data : [query.data]).filter(
          (item: any) => item[column] >= value
        );
        return builder;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        if (Array.isArray(query.data)) {
          query.data.sort((a: any, b: any) => {
            const aVal = a[column];
            const bVal = b[column];
            const ascending = options?.ascending ?? true;
            return ascending ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
          });
        }
        return builder;
      },
      limit: (count: number) => {
        if (Array.isArray(query.data)) {
          query.data = query.data.slice(0, count);
        }
        return builder;
      },
      single: () => {
        if (Array.isArray(query.data)) {
          query.data = query.data[0] || null;
        }
        return Promise.resolve(query);
      },
      maybeSingle: () => {
        if (Array.isArray(query.data)) {
          query.data = query.data.length > 0 ? query.data[0] : null;
        }
        return Promise.resolve(query);
      },
      then: (resolve: (value: any) => void) => {
        return Promise.resolve(query).then(resolve);
      },
    };

    return builder;
  };

  return {
    from: (table: string) => createQueryBuilder(table),
    auth: {
      signUp: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }),
      signInWithPassword: () =>
        Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }),
    },
  };
}

export const mockSupabase = createMockSupabaseClient();
