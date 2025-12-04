/**
 * Key Resolver Service
 * 
 * Provides a unified interface for retrieving API keys.
 * Currently uses environment variables (Replit secrets).
 * Can be extended later for per-organization encrypted key storage.
 */

export interface KeyResolverResult {
  key: string | null;
  source: 'environment' | 'organization' | 'fallback';
  isConfigured: boolean;
  maskedKey: string | null;
}

/**
 * Get the OpenAI API key
 * @param orgId - Optional organization ID for future multi-tenant support
 * @returns KeyResolverResult with key info
 */
export function getOpenAIKey(orgId?: string): KeyResolverResult {
  const envKey = process.env.OPENAI_API_KEY;
  
  if (envKey) {
    return {
      key: envKey,
      source: 'environment',
      isConfigured: true,
      maskedKey: maskKey(envKey),
    };
  }
  
  return {
    key: null,
    source: 'environment',
    isConfigured: false,
    maskedKey: null,
  };
}

/**
 * Check if OpenAI is configured
 * @param orgId - Optional organization ID
 * @returns boolean indicating if key is available
 */
export function isOpenAIConfigured(orgId?: string): boolean {
  const result = getOpenAIKey(orgId);
  return result.isConfigured;
}

/**
 * Mask an API key for display (show first 3 and last 4 chars)
 * @param key - The full API key
 * @returns Masked key string
 */
function maskKey(key: string): string {
  if (key.length <= 10) {
    return '****';
  }
  const prefix = key.substring(0, 7); // "sk-proj" or similar
  const suffix = key.substring(key.length - 4);
  return `${prefix}...${suffix}`;
}

/**
 * Get configuration status for all AI providers
 * @param orgId - Optional organization ID
 * @returns Object with configuration status for each provider
 */
export function getAIConfigurationStatus(orgId?: string) {
  const openai = getOpenAIKey(orgId);
  
  return {
    openai: {
      isConfigured: openai.isConfigured,
      source: openai.source,
      maskedKey: openai.maskedKey,
    },
    // Add more providers here as needed
  };
}
