# Testing Implementation Guide for AIRevenueOrc

This guide documents the comprehensive testing strategy implemented for the AIRevenueOrc Sales CRM platform, with a specific focus on efficient API connections to Salesforce, ZoomInfo, and other third-party services.

## Overview

The testing infrastructure has been set up using:
- **Vitest** for unit and integration tests
- **React Testing Library** for component testing
- **MSW (Mock Service Worker)** for API mocking
- **jsdom** for DOM simulation

## Test Coverage Areas

### 1. API Rate Limiting and Throttling (`src/test/lib/apiRateLimiter.test.ts`)

Tests comprehensive rate limiting functionality across multiple integrations:

**Key Test Scenarios:**
- Salesforce daily rate limit tracking (15,000 requests per 24 hours)
- HubSpot burst limit handling (100 requests per 10 seconds)
- ZoomInfo rate limit compliance (1,000 requests per minute)
- Automatic request queuing when approaching limits
- Exponential backoff for rate limit errors
- Circuit breaker pattern for cascading failure prevention
- Retry logic with configurable delays
- Rate limit status tracking across endpoints

**Example Usage:**
```typescript
// Rate limiting with automatic retry
const result = await executeWithRateLimitAndRetry(
  'salesforce-integration-id',
  'contacts',
  async () => fetchSalesforceContacts(),
  { max_retries: 3, initial_delay_ms: 1000 }
);
```

### 2. Enrichment Waterfall Optimization (`src/test/lib/enrichmentWaterfall.test.ts`)

Tests intelligent provider selection and failover for contact enrichment:

**Key Test Scenarios:**
- Provider prioritization based on success rates and cost
- Automatic failover when primary provider fails
- Credit consumption tracking
- Data quality scoring
- Performance optimization for large datasets
- Skipping providers with zero remaining credits
- Waterfall logging for audit trails

**Example Usage:**
```typescript
// Enrich contact with automatic provider failover
const result = await enrichContactWithWaterfall(
  'prospect-id',
  'team-id',
  { email: 'john@example.com', firstName: 'John', lastName: 'Doe' },
  'full_profile'
);

console.log(`Enriched using ${result.provider} after ${result.attemptsCount} attempts`);
console.log(`Credits consumed: ${result.creditsConsumed}`);
```

### 3. OAuth Integration and Authentication (`src/test/lib/oauthIntegration.test.ts`)

Tests secure OAuth2 flows for external service authentication:

**Key Test Scenarios:**
- Salesforce OAuth2 authorization URL generation
- HubSpot token exchange with authorization code
- Gmail offline access token acquisition
- Token refresh for expired access tokens
- Token storage and retrieval from Supabase
- Automatic token validation before API calls
- Error handling for expired/invalid tokens

**Example Usage:**
```typescript
// Generate OAuth authorization URL
const authUrl = generateAuthorizationUrl(
  'salesforce',
  'client-id',
  'https://app.example.com/callback',
  'random-state-string'
);

// Exchange code for tokens after user authorization
const tokens = await exchangeCodeForTokens(
  'salesforce',
  'authorization-code',
  'client-id',
  'client-secret',
  'redirect-uri'
);

// Ensure token is valid (auto-refreshes if expired)
const validToken = await ensureValidToken(
  'team-id',
  'provider-id',
  'client-id',
  'client-secret'
);
```

### 4. Integration Sync and Data Transformation (`src/test/lib/integrationSync.test.ts`)

Tests bidirectional data synchronization with external systems:

**Key Test Scenarios:**
- Salesforce to AIRevenueOrc field mapping
- HubSpot to AIRevenueOrc contact transformation
- Custom field transformations (uppercase, lowercase, trim, date conversion)
- Default value assignment for missing fields
- Required field validation
- Batch record processing with partial failure handling
- Conflict resolution for concurrent updates
- Performance optimization for large datasets (1000+ records)

**Example Usage:**
```typescript
// Transform Salesforce contact to local format
const salesforceContact = {
  FirstName: 'John',
  LastName: 'Doe',
  Email: 'john@example.com',
  Company: 'Acme Corp'
};

const transformed = await transformRecord(
  salesforceContact,
  COMMON_FIELD_MAPPINGS.salesforce_to_revorph
);

// Start bidirectional sync job
const jobId = await startSync({
  integration_id: 'salesforce-integration',
  entity_type: 'prospect',
  direction: 'bidirectional',
  sync_mode: 'incremental',
  field_mappings: COMMON_FIELD_MAPPINGS.salesforce_to_revorph
});
```

### 5. Integration Health Monitoring (`src/test/lib/integrationHealthMonitor.test.ts`)

Tests comprehensive health checks for integration reliability:

**Key Test Scenarios:**
- Authentication status validation
- API connectivity checks with response time tracking
- Rate limit utilization monitoring
- Sync job success rate calculation
- Error rate tracking
- Health score calculation (0-100)
- Multi-integration monitoring
- Uptime percentage calculation
- Issue diagnosis with recommendations

**Example Usage:**
```typescript
// Check health of specific integration
const health = await checkIntegrationHealth('integration-id');

console.log(`Status: ${health.status}`); // healthy, degraded, or down
console.log(`Health Score: ${health.health_score}/100`);

health.checks.forEach(check => {
  console.log(`${check.name}: ${check.status} - ${check.message}`);
});

// Get diagnostic recommendations
const diagnosis = await diagnoseIntegrationIssues('integration-id');

if (diagnosis.severity === 'high') {
  console.log('Critical issues found:');
  diagnosis.issues.forEach(issue => console.log(`- ${issue}`));
  console.log('Recommendations:');
  diagnosis.recommendations.forEach(rec => console.log(`- ${rec}`));
}

// Calculate uptime over last 7 days
const since = new Date(Date.now() - 7 * 86400000);
const uptime = await getIntegrationUptime('integration-id', since);

console.log(`Uptime: ${uptime.uptime_percentage}%`);
console.log(`Incidents: ${uptime.incidents}`);
console.log(`Avg Response Time: ${uptime.avg_response_time_ms}ms`);
```

## Running Tests

### Install Dependencies

First, install the testing dependencies:

```bash
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw happy-dom
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests once without watch mode
npm run test:run
```

## Test File Structure

```
src/test/
├── setup.ts                              # Global test setup
├── mocks/
│   ├── apiMocks.ts                       # Mock API responses
│   └── supabaseMock.ts                   # Mock Supabase client
└── lib/
    ├── apiRateLimiter.test.ts            # Rate limiting tests
    ├── enrichmentWaterfall.test.ts       # Enrichment tests
    ├── oauthIntegration.test.ts          # OAuth tests
    ├── integrationSync.test.ts           # Data sync tests
    └── integrationHealthMonitor.test.ts  # Health monitoring tests
```

## Coverage Thresholds

The following coverage thresholds are enforced:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

## Mock Data

All tests use mock data to simulate real API responses without making actual network requests:

- **Salesforce**: Mock OAuth tokens, contact data, SOQL query results
- **ZoomInfo**: Mock contact enrichment data with credit tracking
- **HubSpot**: Mock contact properties and CRM objects
- **Clearbit**: Mock company and person enrichment data

## Integration-Specific Considerations

### Salesforce
- Daily API quota: 15,000 requests per 24 hours
- Supports bulk operations for large data transfers
- OAuth2 with refresh tokens
- SOQL query complexity limits

### ZoomInfo
- Rate limit: 1,000 requests per minute
- Credit-based pricing model
- API key authentication
- High-quality contact data

### HubSpot
- Burst limit: 100 requests per 10 seconds
- Daily limit: 250,000 requests
- OAuth2 with granular scopes
- Real-time webhook support

### Clearbit
- Rate limit: 600 requests per hour
- Company and person enrichment
- API key authentication
- Technology stack detection

## Best Practices

1. **Always mock external API calls** - Never make real API calls in tests
2. **Test error scenarios** - Include tests for rate limits, timeouts, and failures
3. **Use realistic mock data** - Mirror actual API response structures
4. **Test performance** - Ensure operations complete within acceptable timeframes
5. **Verify idempotency** - Ensure operations can be safely retried
6. **Test concurrent operations** - Verify thread safety and race condition handling
7. **Monitor test execution time** - Keep tests fast for rapid feedback

## Continuous Integration

Tests should be run automatically in CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm run test:run

- name: Generate Coverage
  run: npm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Troubleshooting

### Tests Timeout
- Increase timeout in test configuration
- Check for unresolved promises
- Verify mock implementations return promptly

### Mock Data Issues
- Ensure mock data structure matches actual API responses
- Update mocks when API versions change
- Use TypeScript interfaces for type safety

### Flaky Tests
- Avoid time-dependent assertions
- Use deterministic mock data
- Mock Date.now() for consistent timestamps

## Next Steps

1. Add component tests for UI integration forms
2. Add E2E tests with Playwright for critical user workflows
3. Add performance benchmarks for API operations
4. Add security tests for credential handling
5. Add compliance tests for data privacy regulations

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Mock Service Worker](https://mswjs.io/)
- [Salesforce REST API](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [ZoomInfo API](https://api-docs.zoominfo.com/)
- [HubSpot API](https://developers.hubspot.com/)
