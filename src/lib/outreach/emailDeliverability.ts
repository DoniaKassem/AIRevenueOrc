/**
 * Email Deliverability System
 * Manages email warming, domain health, spam scoring, and sending reputation
 */

import { supabase } from '../supabase';

export interface SendingDomain {
  id: string;
  domain: string;
  teamId: string;

  // Health metrics
  healthScore: number;        // 0-100
  reputationScore: number;    // 0-100

  // Volume tracking
  dailyLimit: number;
  currentDailyCount: number;
  warmupStage: 'new' | 'warming' | 'warm' | 'established';

  // Authentication
  spfValid: boolean;
  dkimValid: boolean;
  dmarcValid: boolean;

  // Bounce tracking
  hardBounceRate: number;     // %
  softBounceRate: number;     // %
  complaintRate: number;      // %

  // Engagement
  openRate: number;           // %
  clickRate: number;          // %
  replyRate: number;          // %

  lastCheckedAt: string;
  status: 'active' | 'warming' | 'paused' | 'blacklisted';
}

export interface SpamCheckResult {
  score: number;              // 0-10 (lower is better)
  passed: boolean;            // true if score < 5
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    issue: string;
    recommendation: string;
  }>;
  details: {
    subjectLineScore: number;
    bodyContentScore: number;
    linksScore: number;
    imageRatio: number;
    spamWords: string[];
    suspiciousPatterns: string[];
  };
}

export interface WarmupSchedule {
  day: number;
  targetVolume: number;
  actualSent: number;
  openRate: number;
  bounceRate: number;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Email warming schedules by stage
 */
const WARMUP_SCHEDULES = {
  // Days 1-7: Very conservative
  week1: [
    { day: 1, volume: 10 },
    { day: 2, volume: 15 },
    { day: 3, volume: 20 },
    { day: 4, volume: 25 },
    { day: 5, volume: 30 },
    { day: 6, volume: 35 },
    { day: 7, volume: 40 },
  ],
  // Days 8-14: Gradual increase
  week2: [
    { day: 8, volume: 50 },
    { day: 9, volume: 60 },
    { day: 10, volume: 70 },
    { day: 11, volume: 80 },
    { day: 12, volume: 90 },
    { day: 13, volume: 100 },
    { day: 14, volume: 120 },
  ],
  // Days 15-21: Steady growth
  week3: [
    { day: 15, volume: 150 },
    { day: 16, volume: 180 },
    { day: 17, volume: 200 },
    { day: 18, volume: 250 },
    { day: 19, volume: 300 },
    { day: 20, volume: 350 },
    { day: 21, volume: 400 },
  ],
  // Days 22-30: Reach capacity
  week4Plus: [
    { day: 22, volume: 500 },
    { day: 23, volume: 600 },
    { day: 24, volume: 700 },
    { day: 25, volume: 800 },
    { day: 26, volume: 900 },
    { day: 27, volume: 1000 },
    { day: 28, volume: 1000 },
    { day: 29, volume: 1000 },
    { day: 30, volume: 1000 },
  ],
};

/**
 * Spam trigger words and patterns
 */
const SPAM_WORDS = {
  critical: [
    'viagra', 'cialis', 'casino', 'lottery', 'winner', 'congratulations',
    'free money', 'click here now', 'act now', 'limited time', 'urgent',
    'buy now', 'order now', 'cheap', 'discount', 'amazing', 'incredible',
  ],
  warning: [
    'free', 'guarantee', 'no cost', 'risk free', 'satisfaction guaranteed',
    'special promotion', 'dear friend', 'million dollars', 'earned income',
  ],
  financial: [
    'credit card', 'refinance', 'mortgage', 'loan', 'debt', 'investment',
    'earnings', 'extra income', 'work from home',
  ],
};

/**
 * Email Deliverability Manager
 */
export class EmailDeliverabilityManager {
  private teamId: string;

  constructor(teamId: string) {
    this.teamId = teamId;
  }

  /**
   * Check if domain can send (warmup + daily limits)
   */
  async canSend(domain: string): Promise<{ canSend: boolean; reason?: string; waitUntil?: Date }> {
    const domainData = await this.getDomainData(domain);

    if (!domainData) {
      return { canSend: false, reason: 'Domain not configured' };
    }

    if (domainData.status === 'paused') {
      return { canSend: false, reason: 'Domain is paused' };
    }

    if (domainData.status === 'blacklisted') {
      return { canSend: false, reason: 'Domain is blacklisted' };
    }

    // Check daily limit
    if (domainData.currentDailyCount >= domainData.dailyLimit) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      return {
        canSend: false,
        reason: `Daily limit reached (${domainData.dailyLimit})`,
        waitUntil: tomorrow,
      };
    }

    // Check health score
    if (domainData.healthScore < 50) {
      return {
        canSend: false,
        reason: `Domain health too low (${domainData.healthScore}/100)`,
      };
    }

    // Check bounce rate
    if (domainData.hardBounceRate > 5) {
      return {
        canSend: false,
        reason: `Hard bounce rate too high (${domainData.hardBounceRate}%)`,
      };
    }

    return { canSend: true };
  }

  /**
   * Check spam score for email content
   */
  async checkSpamScore(email: {
    subject: string;
    body: string;
    fromName: string;
    fromEmail: string;
    replyTo?: string;
  }): Promise<SpamCheckResult> {
    let score = 0;
    const issues: SpamCheckResult['issues'] = [];

    // 1. Subject line checks
    const subjectScore = this.scoreSubject(email.subject);
    score += subjectScore.score;
    issues.push(...subjectScore.issues);

    // 2. Body content checks
    const bodyScore = this.scoreBody(email.body);
    score += bodyScore.score;
    issues.push(...bodyScore.issues);

    // 3. Links and images
    const mediaScore = this.scoreMediaContent(email.body);
    score += mediaScore.score;
    issues.push(...mediaScore.issues);

    // 4. From/Reply-To checks
    const senderScore = this.scoreSender(email.fromEmail, email.replyTo);
    score += senderScore.score;
    issues.push(...senderScore.issues);

    // 5. Overall structure
    const structureScore = this.scoreStructure(email.body);
    score += structureScore.score;
    issues.push(...structureScore.issues);

    return {
      score: Math.min(10, score),
      passed: score < 5,
      issues,
      details: {
        subjectLineScore: subjectScore.score,
        bodyContentScore: bodyScore.score,
        linksScore: mediaScore.linkCount,
        imageRatio: mediaScore.imageRatio,
        spamWords: subjectScore.spamWords.concat(bodyScore.spamWords),
        suspiciousPatterns: bodyScore.suspiciousPatterns,
      },
    };
  }

  /**
   * Verify domain authentication (SPF, DKIM, DMARC)
   */
  async verifyDomainAuthentication(domain: string): Promise<{
    spf: { valid: boolean; record?: string; error?: string };
    dkim: { valid: boolean; record?: string; error?: string };
    dmarc: { valid: boolean; record?: string; error?: string };
  }> {
    // Check SPF
    const spf = await this.checkSPF(domain);

    // Check DKIM
    const dkim = await this.checkDKIM(domain);

    // Check DMARC
    const dmarc = await this.checkDMARC(domain);

    // Update database
    await supabase
      .from('sending_domains')
      .update({
        spf_valid: spf.valid,
        dkim_valid: dkim.valid,
        dmarc_valid: dmarc.valid,
        last_checked_at: new Date().toISOString(),
      })
      .eq('domain', domain)
      .eq('team_id', this.teamId);

    return { spf, dkim, dmarc };
  }

  /**
   * Track email send for warmup and volume management
   */
  async trackEmailSend(domain: string, recipient: string): Promise<void> {
    // Increment daily count
    await supabase.rpc('increment_domain_daily_count', {
      p_domain: domain,
      p_team_id: this.teamId,
    });

    // Log for warmup tracking
    await supabase.from('email_send_log').insert({
      team_id: this.teamId,
      domain,
      recipient,
      sent_at: new Date().toISOString(),
    });
  }

  /**
   * Track email bounce
   */
  async trackBounce(
    domain: string,
    recipient: string,
    bounceType: 'hard' | 'soft',
    reason: string
  ): Promise<void> {
    // Log bounce
    await supabase.from('email_bounces').insert({
      team_id: this.teamId,
      domain,
      recipient,
      bounce_type: bounceType,
      reason,
      bounced_at: new Date().toISOString(),
    });

    // Update domain metrics
    await this.updateDomainMetrics(domain);

    // Add to suppression list if hard bounce
    if (bounceType === 'hard') {
      await supabase.from('email_suppression_list').insert({
        team_id: this.teamId,
        email: recipient,
        suppression_type: 'bounce',
        reason: `Hard bounce: ${reason}`,
        source: 'bounce',
        suppressed_at: new Date().toISOString(),
      });
    }
  }

  /**
   * Track spam complaint
   */
  async trackComplaint(domain: string, recipient: string): Promise<void> {
    await supabase.from('email_complaints').insert({
      team_id: this.teamId,
      domain,
      recipient,
      complained_at: new Date().toISOString(),
    });

    // Add to suppression list
    await supabase.from('email_suppression_list').insert({
      team_id: this.teamId,
      email: recipient,
      suppression_type: 'complaint',
      reason: 'Spam complaint',
      source: 'complaint',
      suppressed_at: new Date().toISOString(),
    });

    // Update domain metrics
    await this.updateDomainMetrics(domain);
  }

  /**
   * Get warmup progress for domain
   */
  async getWarmupProgress(domain: string): Promise<{
    currentDay: number;
    currentStage: SendingDomain['warmupStage'];
    todayLimit: number;
    todaySent: number;
    schedule: WarmupSchedule[];
  }> {
    const domainData = await this.getDomainData(domain);
    if (!domainData) {
      throw new Error('Domain not found');
    }

    const { data: warmupData } = await supabase
      .from('domain_warmup_log')
      .select('*')
      .eq('domain', domain)
      .eq('team_id', this.teamId)
      .order('day', { ascending: true });

    const currentDay = warmupData?.length || 1;
    const todaySchedule = this.getScheduleForDay(currentDay);

    return {
      currentDay,
      currentStage: domainData.warmupStage,
      todayLimit: todaySchedule.volume,
      todaySent: domainData.currentDailyCount,
      schedule: warmupData || [],
    };
  }

  /**
   * Check blacklist status
   */
  async checkBlacklists(domain: string): Promise<{
    isBlacklisted: boolean;
    blacklists: Array<{
      name: string;
      listed: boolean;
      delistUrl?: string;
    }>;
  }> {
    const blacklistsToCheck = [
      { name: 'Spamhaus', url: 'zen.spamhaus.org' },
      { name: 'Barracuda', url: 'b.barracudacentral.org' },
      { name: 'SpamCop', url: 'bl.spamcop.net' },
      { name: 'SORBS', url: 'dnsbl.sorbs.net' },
    ];

    const results = await Promise.all(
      blacklistsToCheck.map(async (bl) => {
        const listed = await this.checkDNSBL(domain, bl.url);
        return {
          name: bl.name,
          listed,
          delistUrl: listed ? `https://${bl.url}/delist` : undefined,
        };
      })
    );

    const isBlacklisted = results.some(r => r.listed);

    return {
      isBlacklisted,
      blacklists: results,
    };
  }

  /**
   * Calculate domain health score
   */
  async calculateHealthScore(domain: string): Promise<number> {
    const domainData = await this.getDomainData(domain);
    if (!domainData) return 0;

    let score = 100;

    // Authentication (30 points)
    if (!domainData.spfValid) score -= 10;
    if (!domainData.dkimValid) score -= 10;
    if (!domainData.dmarcValid) score -= 10;

    // Bounce rates (30 points)
    score -= Math.min(30, domainData.hardBounceRate * 6);  // -6 per 1%
    score -= Math.min(10, domainData.softBounceRate * 2);  // -2 per 1%

    // Complaint rate (20 points)
    score -= Math.min(20, domainData.complaintRate * 20); // -20 per 1%

    // Engagement (20 points)
    const engagementScore = (
      domainData.openRate * 0.3 +
      domainData.clickRate * 0.3 +
      domainData.replyRate * 0.4
    );
    score += engagementScore * 0.2;

    return Math.max(0, Math.min(100, score));
  }

  // Private helper methods

  private async getDomainData(domain: string): Promise<SendingDomain | null> {
    const { data } = await supabase
      .from('sending_domains')
      .select('*')
      .eq('domain', domain)
      .eq('team_id', this.teamId)
      .single();

    return data as SendingDomain | null;
  }

  private scoreSubject(subject: string): {
    score: number;
    issues: SpamCheckResult['issues'];
    spamWords: string[];
  } {
    let score = 0;
    const issues: SpamCheckResult['issues'] = [];
    const spamWords: string[] = [];

    // Check length
    if (subject.length > 70) {
      score += 0.5;
      issues.push({
        severity: 'warning',
        issue: 'Subject line too long',
        recommendation: 'Keep subject lines under 70 characters',
      });
    }

    // Check for ALL CAPS
    if (subject === subject.toUpperCase() && subject.length > 5) {
      score += 1;
      issues.push({
        severity: 'critical',
        issue: 'Subject line in all caps',
        recommendation: 'Use normal capitalization',
      });
    }

    // Check for excessive punctuation
    const exclamationCount = (subject.match(/!/g) || []).length;
    if (exclamationCount > 1) {
      score += 0.5 * exclamationCount;
      issues.push({
        severity: 'warning',
        issue: 'Too many exclamation marks',
        recommendation: 'Use at most one exclamation mark',
      });
    }

    // Check for spam words
    const lowerSubject = subject.toLowerCase();
    for (const word of SPAM_WORDS.critical) {
      if (lowerSubject.includes(word)) {
        score += 2;
        spamWords.push(word);
        issues.push({
          severity: 'critical',
          issue: `Spam trigger word: "${word}"`,
          recommendation: 'Remove or rephrase this word',
        });
      }
    }

    for (const word of SPAM_WORDS.warning) {
      if (lowerSubject.includes(word)) {
        score += 0.5;
        spamWords.push(word);
      }
    }

    return { score, issues, spamWords };
  }

  private scoreBody(body: string): {
    score: number;
    issues: SpamCheckResult['issues'];
    spamWords: string[];
    suspiciousPatterns: string[];
  } {
    let score = 0;
    const issues: SpamCheckResult['issues'] = [];
    const spamWords: string[] = [];
    const suspiciousPatterns: string[] = [];

    const lowerBody = body.toLowerCase();

    // Check for spam words in body
    for (const word of SPAM_WORDS.critical) {
      if (lowerBody.includes(word)) {
        score += 1;
        spamWords.push(word);
      }
    }

    // Check for suspicious patterns
    if (/\$[\d,]+/g.test(body)) {
      suspiciousPatterns.push('dollar_amounts');
      score += 0.3;
    }

    // Check for too many links
    const linkCount = (body.match(/https?:\/\//g) || []).length;
    if (linkCount > 5) {
      score += 1;
      issues.push({
        severity: 'warning',
        issue: `Too many links (${linkCount})`,
        recommendation: 'Keep links to 3 or fewer',
      });
    }

    // Check text-to-HTML ratio
    const textLength = body.replace(/<[^>]*>/g, '').length;
    const htmlLength = body.length;
    const ratio = textLength / htmlLength;

    if (ratio < 0.3 && htmlLength > textLength) {
      score += 0.5;
      issues.push({
        severity: 'info',
        issue: 'Low text-to-HTML ratio',
        recommendation: 'Reduce HTML markup or add more text',
      });
    }

    return { score, issues, spamWords, suspiciousPatterns };
  }

  private scoreMediaContent(body: string): {
    score: number;
    issues: SpamCheckResult['issues'];
    linkCount: number;
    imageRatio: number;
  } {
    let score = 0;
    const issues: SpamCheckResult['issues'] = [];

    const linkCount = (body.match(/https?:\/\//g) || []).length;
    const imageCount = (body.match(/<img/g) || []).length;
    const textLength = body.replace(/<[^>]*>/g, '').length;

    const imageRatio = imageCount / Math.max(1, textLength / 100);

    // Too many images relative to text
    if (imageRatio > 1) {
      score += 1;
      issues.push({
        severity: 'warning',
        issue: 'Too many images',
        recommendation: 'Balance images with text content',
      });
    }

    // Shortened URLs (suspicious)
    if (/bit\.ly|tinyurl|goo\.gl/i.test(body)) {
      score += 1.5;
      issues.push({
        severity: 'critical',
        issue: 'Shortened URLs detected',
        recommendation: 'Use full URLs instead of URL shorteners',
      });
    }

    return { score, issues, linkCount, imageRatio };
  }

  private scoreSender(fromEmail: string, replyTo?: string): {
    score: number;
    issues: SpamCheckResult['issues'];
  } {
    let score = 0;
    const issues: SpamCheckResult['issues'] = [];

    // Reply-To different from From
    if (replyTo && replyTo !== fromEmail) {
      score += 0.5;
      issues.push({
        severity: 'info',
        issue: 'Reply-To differs from From address',
        recommendation: 'Use the same address for both',
      });
    }

    // Check for suspicious TLDs
    const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq'];
    const domain = fromEmail.split('@')[1] || '';
    if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
      score += 2;
      issues.push({
        severity: 'critical',
        issue: 'Suspicious domain TLD',
        recommendation: 'Use a reputable domain',
      });
    }

    return { score, issues };
  }

  private scoreStructure(body: string): {
    score: number;
    issues: SpamCheckResult['issues'];
  } {
    let score = 0;
    const issues: SpamCheckResult['issues'] = [];

    // Check for unsubscribe link
    if (!/unsubscribe/i.test(body)) {
      score += 1;
      issues.push({
        severity: 'critical',
        issue: 'No unsubscribe link found',
        recommendation: 'Include an unsubscribe link (required by law)',
      });
    }

    // Very short email (suspicious)
    const textContent = body.replace(/<[^>]*>/g, '');
    if (textContent.length < 50) {
      score += 0.5;
      issues.push({
        severity: 'warning',
        issue: 'Email too short',
        recommendation: 'Add more meaningful content',
      });
    }

    return { score, issues };
  }

  private async checkSPF(domain: string): Promise<{ valid: boolean; record?: string; error?: string }> {
    try {
      const response = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`);
      const data = await response.json();

      const spfRecord = data.Answer?.find((a: any) => a.data.includes('v=spf1'));

      return {
        valid: !!spfRecord,
        record: spfRecord?.data,
      };
    } catch (error) {
      return { valid: false, error: 'Failed to check SPF' };
    }
  }

  private async checkDKIM(domain: string): Promise<{ valid: boolean; record?: string; error?: string }> {
    // DKIM records are at specific selectors, common ones:
    const selectors = ['default', 'google', 'k1', 'dkim', 'selector1', 'selector2'];

    for (const selector of selectors) {
      try {
        const response = await fetch(`https://dns.google/resolve?name=${selector}._domainkey.${domain}&type=TXT`);
        const data = await response.json();

        if (data.Answer && data.Answer.length > 0) {
          return {
            valid: true,
            record: data.Answer[0].data,
          };
        }
      } catch (error) {
        continue;
      }
    }

    return { valid: false, error: 'No DKIM record found' };
  }

  private async checkDMARC(domain: string): Promise<{ valid: boolean; record?: string; error?: string }> {
    try {
      const response = await fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`);
      const data = await response.json();

      const dmarcRecord = data.Answer?.[0];

      return {
        valid: !!dmarcRecord,
        record: dmarcRecord?.data,
      };
    } catch (error) {
      return { valid: false, error: 'Failed to check DMARC' };
    }
  }

  private async checkDNSBL(domain: string, blacklist: string): Promise<boolean> {
    try {
      const response = await fetch(`https://dns.google/resolve?name=${domain}.${blacklist}&type=A`);
      const data = await response.json();

      return data.Status === 0 && data.Answer && data.Answer.length > 0;
    } catch (error) {
      return false;
    }
  }

  private getScheduleForDay(day: number): { volume: number } {
    const allSchedules = [
      ...WARMUP_SCHEDULES.week1,
      ...WARMUP_SCHEDULES.week2,
      ...WARMUP_SCHEDULES.week3,
      ...WARMUP_SCHEDULES.week4Plus,
    ];

    const schedule = allSchedules.find(s => s.day === day);
    return schedule || { volume: 1000 }; // Default to max after warmup
  }

  private async updateDomainMetrics(domain: string): Promise<void> {
    // Calculate bounce rates, complaint rates, etc.
    // This would query the bounces and complaints tables
    // and update the sending_domains table

    const healthScore = await this.calculateHealthScore(domain);

    await supabase
      .from('sending_domains')
      .update({
        health_score: healthScore,
        last_checked_at: new Date().toISOString(),
      })
      .eq('domain', domain)
      .eq('team_id', this.teamId);
  }
}

/**
 * Initialize domain for warmup
 */
export async function initializeDomainWarmup(
  teamId: string,
  domain: string,
  startingLimit: number = 10
): Promise<SendingDomain> {
  const { data } = await supabase
    .from('sending_domains')
    .insert({
      team_id: teamId,
      domain,
      daily_limit: startingLimit,
      warmup_stage: 'new',
      status: 'warming',
      health_score: 50,
      reputation_score: 50,
    })
    .select()
    .single();

  return data as SendingDomain;
}

/**
 * Get deliverability report
 */
export async function getDeliverabilityReport(
  teamId: string,
  daysBack: number = 30
): Promise<{
  overallHealth: number;
  domains: SendingDomain[];
  totalSent: number;
  bounceRate: number;
  complaintRate: number;
  openRate: number;
  recommendations: string[];
}> {
  const { data: domains } = await supabase
    .from('sending_domains')
    .select('*')
    .eq('team_id', teamId);

  const overallHealth = domains && domains.length > 0
    ? domains.reduce((sum, d) => sum + d.health_score, 0) / domains.length
    : 0;

  // Generate recommendations
  const recommendations: string[] = [];

  if (overallHealth < 70) {
    recommendations.push('Overall domain health is low. Review bounce and complaint rates.');
  }

  domains?.forEach(domain => {
    if (!domain.spf_valid || !domain.dkim_valid || !domain.dmarc_valid) {
      recommendations.push(`Configure email authentication for ${domain.domain}`);
    }
    if (domain.hard_bounce_rate > 2) {
      recommendations.push(`High bounce rate on ${domain.domain}. Clean your email list.`);
    }
  });

  return {
    overallHealth,
    domains: domains || [],
    totalSent: 0,  // Would calculate from send log
    bounceRate: 0,  // Would calculate from bounces
    complaintRate: 0,
    openRate: 0,
    recommendations,
  };
}
