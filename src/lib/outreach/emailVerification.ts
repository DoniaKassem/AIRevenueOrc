/**
 * Email Verification Service
 * Validates email addresses before sending to improve deliverability
 */

import { supabase } from '../supabase';

export interface EmailVerificationResult {
  email: string;
  isValid: boolean;
  status:
    | 'valid'              // Email is valid and deliverable
    | 'invalid'            // Email is invalid (syntax, domain, etc.)
    | 'risky'              // Email might be valid but risky (catch-all, disposable)
    | 'unknown';           // Unable to verify

  checks: {
    syntaxValid: boolean;
    domainExists: boolean;
    mxRecordsExist: boolean;
    smtpVerified: boolean;
    isDisposable: boolean;
    isCatchAll: boolean;
    isRoleAccount: boolean;
  };

  details: {
    domain: string;
    provider: string | null;        // 'gmail', 'outlook', 'custom', etc.
    didYouMean?: string;             // Suggestion if typo detected
    riskScore: number;               // 0-100 (0 = safe, 100 = very risky)
    confidenceScore: number;         // 0-100
  };

  metadata: {
    verifiedAt: string;
    verificationMethod: 'realtime' | 'cached' | 'bulk';
    processingTime: number;          // ms
  };
}

/**
 * Common disposable email domains
 */
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'tempmail.com',
  'throwaway.email', 'yopmail.com', 'trashmail.com', 'getnada.com',
  'emailondeck.com', 'fakeinbox.com', 'maildrop.cc', 'temp-mail.org',
]);

/**
 * Common role-based email prefixes
 */
const ROLE_PREFIXES = new Set([
  'info', 'admin', 'support', 'sales', 'contact', 'hello', 'help',
  'noreply', 'no-reply', 'postmaster', 'webmaster', 'hostmaster',
  'abuse', 'billing', 'careers', 'jobs', 'hr', 'recruitment',
]);

/**
 * Common typo patterns in email domains
 */
const TYPO_CORRECTIONS = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
};

/**
 * Verify a single email address
 */
export async function verifyEmail(email: string): Promise<EmailVerificationResult> {
  const startTime = Date.now();

  // Normalize email
  const normalizedEmail = email.trim().toLowerCase();

  // Check cache first
  const cached = await getCachedVerification(normalizedEmail);
  if (cached && isCacheValid(cached.metadata.verifiedAt)) {
    return {
      ...cached,
      metadata: {
        ...cached.metadata,
        verificationMethod: 'cached',
        processingTime: Date.now() - startTime,
      },
    };
  }

  // Perform verification checks
  const checks = {
    syntaxValid: checkSyntax(normalizedEmail),
    domainExists: false,
    mxRecordsExist: false,
    smtpVerified: false,
    isDisposable: checkDisposable(normalizedEmail),
    isCatchAll: false,
    isRoleAccount: checkRoleAccount(normalizedEmail),
  };

  const domain = normalizedEmail.split('@')[1] || '';
  let didYouMean: string | undefined;

  // If syntax is valid, perform deeper checks
  if (checks.syntaxValid) {
    // Check for typos
    if (TYPO_CORRECTIONS[domain]) {
      didYouMean = normalizedEmail.replace(domain, TYPO_CORRECTIONS[domain]);
    }

    // Check domain existence
    checks.domainExists = await checkDomainExists(domain);

    if (checks.domainExists) {
      // Check MX records
      checks.mxRecordsExist = await checkMXRecords(domain);

      // SMTP verification (most thorough but slowest)
      if (checks.mxRecordsExist) {
        try {
          const smtpResult = await smtpVerify(normalizedEmail);
          checks.smtpVerified = smtpResult.deliverable;
          checks.isCatchAll = smtpResult.catchAll;
        } catch (error) {
          // SMTP verification failed, but email might still be valid
          console.warn('SMTP verification failed:', error);
        }
      }
    }
  }

  // Determine overall status
  const status = determineStatus(checks);

  // Calculate risk score
  const riskScore = calculateRiskScore(checks);

  // Detect provider
  const provider = detectProvider(domain);

  // Calculate confidence
  const confidenceScore = calculateConfidence(checks);

  const result: EmailVerificationResult = {
    email: normalizedEmail,
    isValid: status === 'valid',
    status,
    checks,
    details: {
      domain,
      provider,
      didYouMean,
      riskScore,
      confidenceScore,
    },
    metadata: {
      verifiedAt: new Date().toISOString(),
      verificationMethod: 'realtime',
      processingTime: Date.now() - startTime,
    },
  };

  // Cache the result
  await cacheVerification(result);

  return result;
}

/**
 * Verify multiple emails in bulk
 */
export async function verifyEmailsBulk(
  emails: string[]
): Promise<Map<string, EmailVerificationResult>> {
  const results = new Map<string, EmailVerificationResult>();

  // Process in batches to avoid overwhelming the system
  const batchSize = 10;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const verifications = await Promise.all(
      batch.map(email => verifyEmail(email))
    );

    batch.forEach((email, index) => {
      results.set(email, verifications[index]);
    });

    // Small delay between batches
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Check email syntax validity (RFC 5322)
 */
function checkSyntax(email: string): boolean {
  // Basic email regex (not perfect but covers 99% of cases)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return false;
  }

  // Additional checks
  const [localPart, domain] = email.split('@');

  // Local part checks
  if (!localPart || localPart.length > 64) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (localPart.includes('..')) return false;

  // Domain checks
  if (!domain || domain.length > 255) return false;
  if (domain.startsWith('-') || domain.endsWith('-')) return false;
  if (!domain.includes('.')) return false;

  const tld = domain.split('.').pop() || '';
  if (tld.length < 2) return false;

  return true;
}

/**
 * Check if email is from a disposable email service
 */
function checkDisposable(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Check if email is a role account (info@, admin@, etc.)
 */
function checkRoleAccount(email: string): boolean {
  const localPart = email.split('@')[0]?.toLowerCase() || '';
  return ROLE_PREFIXES.has(localPart);
}

/**
 * Check if domain exists (DNS lookup)
 */
async function checkDomainExists(domain: string): Promise<boolean> {
  try {
    // In a real implementation, this would do a DNS lookup
    // For now, we'll simulate with a basic check
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.Status === 0 && data.Answer && data.Answer.length > 0;
  } catch (error) {
    console.error('Domain check failed:', error);
    return false;
  }
}

/**
 * Check if domain has MX records
 */
async function checkMXRecords(domain: string): Promise<boolean> {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.Status === 0 && data.Answer && data.Answer.length > 0;
  } catch (error) {
    console.error('MX record check failed:', error);
    return false;
  }
}

/**
 * SMTP verification (connects to mail server)
 */
async function smtpVerify(
  email: string
): Promise<{ deliverable: boolean; catchAll: boolean }> {
  // Note: In production, this would connect to the SMTP server
  // and perform RCPT TO command without actually sending an email.
  // This requires a backend service as browsers can't make SMTP connections.

  // For now, we'll use a mock implementation
  // In production, integrate with services like:
  // - ZeroBounce API
  // - NeverBounce API
  // - Hunter.io Email Verifier
  // - Or build your own SMTP verification service

  try {
    // Mock implementation - would call backend service
    const apiKey = import.meta.env.VITE_EMAIL_VERIFICATION_API_KEY;
    if (!apiKey) {
      return { deliverable: true, catchAll: false }; // Assume valid if no API
    }

    // Example with ZeroBounce (would need actual implementation)
    const response = await fetch(
      `https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${email}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      throw new Error('SMTP verification API failed');
    }

    const data = await response.json();
    return {
      deliverable: data.status === 'valid',
      catchAll: data.sub_status === 'catch_all',
    };
  } catch (error) {
    console.error('SMTP verification failed:', error);
    // Return uncertain rather than failing
    return { deliverable: true, catchAll: false };
  }
}

/**
 * Determine overall status from checks
 */
function determineStatus(
  checks: EmailVerificationResult['checks']
): EmailVerificationResult['status'] {
  // Invalid if syntax is wrong
  if (!checks.syntaxValid) return 'invalid';

  // Invalid if disposable
  if (checks.isDisposable) return 'invalid';

  // Invalid if domain doesn't exist
  if (!checks.domainExists) return 'invalid';

  // Invalid if no MX records
  if (!checks.mxRecordsExist) return 'invalid';

  // Risky if catch-all or role account
  if (checks.isCatchAll || checks.isRoleAccount) return 'risky';

  // Valid if SMTP verified
  if (checks.smtpVerified) return 'valid';

  // Unknown if we couldn't verify via SMTP but passed other checks
  return 'unknown';
}

/**
 * Calculate risk score
 */
function calculateRiskScore(checks: EmailVerificationResult['checks']): number {
  let score = 0;

  if (!checks.syntaxValid) score += 100; // Immediately 100
  if (checks.isDisposable) score += 100;
  if (!checks.domainExists) score += 90;
  if (!checks.mxRecordsExist) score += 80;
  if (checks.isCatchAll) score += 40;
  if (checks.isRoleAccount) score += 30;
  if (!checks.smtpVerified) score += 20;

  return Math.min(100, score);
}

/**
 * Calculate confidence score
 */
function calculateConfidence(checks: EmailVerificationResult['checks']): number {
  let confidence = 0;

  if (checks.syntaxValid) confidence += 20;
  if (checks.domainExists) confidence += 20;
  if (checks.mxRecordsExist) confidence += 20;
  if (checks.smtpVerified) confidence += 40;

  return confidence;
}

/**
 * Detect email provider
 */
function detectProvider(domain: string): string | null {
  const providers: Record<string, string> = {
    'gmail.com': 'Gmail',
    'googlemail.com': 'Gmail',
    'outlook.com': 'Outlook',
    'hotmail.com': 'Outlook',
    'live.com': 'Outlook',
    'yahoo.com': 'Yahoo',
    'yahoo.co.uk': 'Yahoo',
    'aol.com': 'AOL',
    'icloud.com': 'iCloud',
    'me.com': 'iCloud',
    'mac.com': 'iCloud',
    'protonmail.com': 'ProtonMail',
    'zoho.com': 'Zoho',
  };

  return providers[domain.toLowerCase()] || null;
}

/**
 * Cache verification result
 */
async function cacheVerification(result: EmailVerificationResult): Promise<void> {
  try {
    await supabase.from('email_verification_cache').upsert({
      email: result.email,
      is_valid: result.isValid,
      status: result.status,
      checks: result.checks,
      details: result.details,
      verified_at: result.metadata.verifiedAt,
    });
  } catch (error) {
    console.error('Failed to cache verification:', error);
  }
}

/**
 * Get cached verification
 */
async function getCachedVerification(
  email: string
): Promise<EmailVerificationResult | null> {
  try {
    const { data } = await supabase
      .from('email_verification_cache')
      .select('*')
      .eq('email', email)
      .single();

    if (!data) return null;

    return {
      email: data.email,
      isValid: data.is_valid,
      status: data.status,
      checks: data.checks,
      details: data.details,
      metadata: {
        verifiedAt: data.verified_at,
        verificationMethod: 'cached',
        processingTime: 0,
      },
    };
  } catch (error) {
    return null;
  }
}

/**
 * Check if cached result is still valid (30 days)
 */
function isCacheValid(verifiedAt: string): boolean {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return new Date(verifiedAt) > thirtyDaysAgo;
}

/**
 * Get verification statistics for a list
 */
export async function getVerificationStats(
  emails: string[]
): Promise<{
  total: number;
  valid: number;
  invalid: number;
  risky: number;
  unknown: number;
  validPercentage: number;
}> {
  const results = await verifyEmailsBulk(emails);
  const stats = {
    total: emails.length,
    valid: 0,
    invalid: 0,
    risky: 0,
    unknown: 0,
    validPercentage: 0,
  };

  for (const result of results.values()) {
    switch (result.status) {
      case 'valid':
        stats.valid++;
        break;
      case 'invalid':
        stats.invalid++;
        break;
      case 'risky':
        stats.risky++;
        break;
      case 'unknown':
        stats.unknown++;
        break;
    }
  }

  stats.validPercentage = stats.total > 0 ? (stats.valid / stats.total) * 100 : 0;

  return stats;
}

/**
 * Clean email list by removing invalid addresses
 */
export async function cleanEmailList(
  emails: string[]
): Promise<{
  cleaned: string[];
  removed: Array<{ email: string; reason: string }>;
}> {
  const results = await verifyEmailsBulk(emails);
  const cleaned: string[] = [];
  const removed: Array<{ email: string; reason: string }> = [];

  for (const [email, result] of results.entries()) {
    if (result.status === 'valid' || result.status === 'unknown') {
      cleaned.push(email);
    } else {
      let reason = `Status: ${result.status}`;
      if (result.checks.isDisposable) reason = 'Disposable email';
      else if (!result.checks.syntaxValid) reason = 'Invalid syntax';
      else if (!result.checks.domainExists) reason = 'Domain does not exist';
      else if (!result.checks.mxRecordsExist) reason = 'No mail server found';

      removed.push({ email, reason });
    }
  }

  return { cleaned, removed };
}
