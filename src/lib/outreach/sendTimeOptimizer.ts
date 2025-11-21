/**
 * Send Time Optimization Engine
 * Determines the best time to send emails based on recipient behavior and patterns
 */

import { supabase } from '../supabase';

export interface OptimalSendTime {
  timestamp: Date;
  dayOfWeek: number;        // 0 = Sunday, 6 = Saturday
  hourOfDay: number;         // 0-23
  confidence: number;        // 0-1
  reasoning: string;
  factors: {
    recipientPattern: number;      // Weight: 0-1
    industryPattern: number;       // Weight: 0-1
    personaPattern: number;        // Weight: 0-1
    generalBestPractice: number;   // Weight: 0-1
    timezoneAdjustment: number;    // Weight: 0-1
  };
}

export interface SendTimeAnalytics {
  totalEmails: number;
  emailsByHour: Record<number, { sent: number; opened: number; replied: number }>;
  emailsByDay: Record<number, { sent: number; opened: number; replied: number }>;
  bestHours: number[];
  bestDays: number[];
  worstHours: number[];
  worstDays: number[];
  averageOpenRate: number;
  averageReplyRate: number;
}

/**
 * Best practice send times by persona
 */
const PERSONA_BEST_TIMES = {
  'C-Level': {
    hours: [6, 7, 8, 17, 18, 19],     // Early morning or evening
    days: [1, 2, 3, 4],                 // Mon-Thu
    reasoning: 'Executives often check email early morning or after hours',
  },
  'VP/Director': {
    hours: [8, 9, 10, 14, 15, 16],
    days: [1, 2, 3, 4, 5],
    reasoning: 'Mid-level management active during business hours',
  },
  'Manager': {
    hours: [9, 10, 11, 13, 14, 15],
    days: [1, 2, 3, 4, 5],
    reasoning: 'Managers check email throughout the workday',
  },
  'Individual Contributor': {
    hours: [10, 11, 13, 14, 15, 16],
    days: [1, 2, 3, 4, 5],
    reasoning: 'ICs typically engage mid-morning and afternoon',
  },
  'Technical': {
    hours: [10, 11, 14, 15, 16, 17],
    days: [1, 2, 3, 4],
    reasoning: 'Developers and technical roles focus in afternoon',
  },
};

/**
 * Best practice send times by industry
 */
const INDUSTRY_BEST_TIMES = {
  'Technology': {
    hours: [9, 10, 14, 15],
    days: [2, 3, 4],           // Tue-Thu
  },
  'Finance': {
    hours: [7, 8, 9],
    days: [2, 3, 4],           // Early, avoid Monday/Friday
  },
  'Healthcare': {
    hours: [11, 12, 13],
    days: [2, 3, 4],
  },
  'Retail': {
    hours: [8, 9, 10],
    days: [1, 2, 3],
  },
  'Manufacturing': {
    hours: [7, 8, 9],
    days: [2, 3, 4],
  },
  'Education': {
    hours: [9, 10, 14],
    days: [2, 3, 4],
  },
  'Marketing': {
    hours: [9, 10, 11],
    days: [1, 2, 3, 4],
  },
};

/**
 * Times to avoid
 */
const AVOID_TIMES = {
  hours: [0, 1, 2, 3, 4, 5, 22, 23],  // Late night/very early
  days: [0, 6],                         // Weekends
  specificTimes: [
    { day: 1, hours: [7, 8, 9] },      // Monday morning (inbox overflow)
    { day: 5, hours: [15, 16, 17] },   // Friday afternoon (weekend mode)
  ],
};

/**
 * Calculate optimal send time for a prospect
 */
export async function calculateOptimalSendTime(
  prospectId: string,
  teamId: string,
  options?: {
    urgency?: 'low' | 'medium' | 'high';
    minHoursFromNow?: number;
    maxHoursFromNow?: number;
  }
): Promise<OptimalSendTime> {
  // Get prospect data
  const { data: prospect } = await supabase
    .from('prospects')
    .select('*, company_profiles(*)')
    .eq('id', prospectId)
    .single();

  if (!prospect) {
    throw new Error('Prospect not found');
  }

  // Get recipient's historical engagement patterns
  const recipientPattern = await getRecipientEngagementPattern(prospectId);

  // Get industry patterns
  const industry = prospect.company_profiles?.industry || 'Technology';
  const industryPattern = INDUSTRY_BEST_TIMES[industry as keyof typeof INDUSTRY_BEST_TIMES] ||
    INDUSTRY_BEST_TIMES.Technology;

  // Get persona patterns
  const persona = detectPersona(prospect.title || '');
  const personaPattern = PERSONA_BEST_TIMES[persona];

  // Get timezone
  const timezone = prospect.company_profiles?.timezone || 'America/New_York';

  // Calculate scores for each hour of the next 7 days
  const candidates = generateCandidateTimes(
    options?.minHoursFromNow || 1,
    options?.maxHoursFromNow || 168 // 7 days
  );

  let bestCandidate = candidates[0];
  let highestScore = 0;

  for (const candidate of candidates) {
    const score = scoreCandidate(
      candidate,
      recipientPattern,
      industryPattern,
      personaPattern,
      timezone,
      options?.urgency || 'medium'
    );

    if (score.total > highestScore) {
      highestScore = score.total;
      bestCandidate = candidate;
    }
  }

  // Adjust for timezone
  const adjustedTime = adjustForTimezone(bestCandidate, timezone);

  return {
    timestamp: adjustedTime,
    dayOfWeek: adjustedTime.getDay(),
    hourOfDay: adjustedTime.getHours(),
    confidence: highestScore,
    reasoning: generateReasoning(persona, industry, recipientPattern),
    factors: {
      recipientPattern: recipientPattern ? 0.4 : 0,
      industryPattern: 0.2,
      personaPattern: 0.2,
      generalBestPractice: 0.15,
      timezoneAdjustment: 0.05,
    },
  };
}

/**
 * Get recipient's historical engagement pattern
 */
async function getRecipientEngagementPattern(
  prospectId: string
): Promise<Record<string, any> | null> {
  const { data: activities } = await supabase
    .from('bdr_activities')
    .select('*')
    .eq('prospect_id', prospectId)
    .in('activity_type', ['email_opened', 'email_clicked', 'email_received'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (!activities || activities.length < 5) {
    return null; // Not enough data
  }

  // Analyze engagement by hour and day
  const engagementByHour: Record<number, number> = {};
  const engagementByDay: Record<number, number> = {};

  for (const activity of activities) {
    const date = new Date(activity.created_at);
    const hour = date.getHours();
    const day = date.getDay();

    engagementByHour[hour] = (engagementByHour[hour] || 0) + 1;
    engagementByDay[day] = (engagementByDay[day] || 0) + 1;
  }

  // Find best hours and days
  const bestHours = Object.entries(engagementByHour)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  const bestDays = Object.entries(engagementByDay)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day]) => parseInt(day));

  return {
    bestHours,
    bestDays,
    totalEngagements: activities.length,
  };
}

/**
 * Detect persona from title
 */
function detectPersona(title: string): keyof typeof PERSONA_BEST_TIMES {
  const titleLower = title.toLowerCase();

  if (/(ceo|cto|cfo|coo|chief|founder|president)/i.test(titleLower)) {
    return 'C-Level';
  }
  if (/(vp|vice president|director)/i.test(titleLower)) {
    return 'VP/Director';
  }
  if (/(manager|lead|head of)/i.test(titleLower)) {
    return 'Manager';
  }
  if (/(developer|engineer|architect|designer)/i.test(titleLower)) {
    return 'Technical';
  }
  return 'Individual Contributor';
}

/**
 * Generate candidate send times
 */
function generateCandidateTimes(
  minHoursFromNow: number,
  maxHoursFromNow: number
): Date[] {
  const candidates: Date[] = [];
  const now = new Date();
  const start = new Date(now.getTime() + minHoursFromNow * 60 * 60 * 1000);
  const end = new Date(now.getTime() + maxHoursFromNow * 60 * 60 * 1000);

  // Generate hourly candidates
  for (let d = new Date(start); d <= end; d.setHours(d.getHours() + 1)) {
    candidates.push(new Date(d));
  }

  return candidates;
}

/**
 * Score a candidate time
 */
function scoreCandidate(
  candidate: Date,
  recipientPattern: Record<string, any> | null,
  industryPattern: Record<string, any>,
  personaPattern: Record<string, any>,
  timezone: string,
  urgency: 'low' | 'medium' | 'high'
): { total: number; breakdown: Record<string, number> } {
  const hour = candidate.getHours();
  const day = candidate.getDay();

  let score = 0;
  const breakdown: Record<string, number> = {};

  // 1. Recipient pattern (40% weight if available)
  if (recipientPattern) {
    if (recipientPattern.bestHours.includes(hour)) {
      breakdown.recipientPattern = 0.4;
      score += 0.4;
    } else if (recipientPattern.bestDays.includes(day)) {
      breakdown.recipientPattern = 0.2;
      score += 0.2;
    }
  }

  // 2. Persona pattern (20% weight)
  if (personaPattern.hours.includes(hour)) {
    breakdown.personaPattern = 0.15;
    score += 0.15;
  }
  if (personaPattern.days.includes(day)) {
    breakdown.personaPattern = (breakdown.personaPattern || 0) + 0.05;
    score += 0.05;
  }

  // 3. Industry pattern (20% weight)
  if (industryPattern.hours.includes(hour)) {
    breakdown.industryPattern = 0.15;
    score += 0.15;
  }
  if (industryPattern.days.includes(day)) {
    breakdown.industryPattern = (breakdown.industryPattern || 0) + 0.05;
    score += 0.05;
  }

  // 4. General best practices (15% weight)
  if (!AVOID_TIMES.hours.includes(hour)) {
    breakdown.generalBestPractice = 0.05;
    score += 0.05;
  }
  if (!AVOID_TIMES.days.includes(day)) {
    breakdown.generalBestPractice = (breakdown.generalBestPractice || 0) + 0.05;
    score += 0.05;
  }

  // Penalty for specific avoid times
  for (const avoid of AVOID_TIMES.specificTimes) {
    if (day === avoid.day && avoid.hours.includes(hour)) {
      score -= 0.2;
    }
  }

  // 5. Urgency adjustment (5% weight)
  if (urgency === 'high') {
    // Prefer sending sooner
    const hoursFromNow = (candidate.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursFromNow < 24) {
      breakdown.urgency = 0.05;
      score += 0.05;
    }
  } else if (urgency === 'low') {
    // Prefer optimal time even if further out
    const hoursFromNow = (candidate.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursFromNow > 24) {
      breakdown.urgency = 0.05;
      score += 0.05;
    }
  }

  return { total: Math.max(0, Math.min(1, score)), breakdown };
}

/**
 * Adjust time for timezone
 */
function adjustForTimezone(time: Date, timezone: string): Date {
  try {
    // Convert to recipient's timezone
    const formatted = time.toLocaleString('en-US', { timeZone: timezone });
    return new Date(formatted);
  } catch (error) {
    console.error('Timezone adjustment failed:', error);
    return time;
  }
}

/**
 * Generate reasoning for the selected time
 */
function generateReasoning(
  persona: string,
  industry: string,
  recipientPattern: Record<string, any> | null
): string {
  let reasoning = `Based on ${persona} persona patterns`;

  if (recipientPattern) {
    reasoning += ` and ${recipientPattern.totalEngagements} historical engagement points`;
  }

  reasoning += `, optimal for ${industry} industry.`;

  return reasoning;
}

/**
 * Get send time analytics for a team
 */
export async function getSendTimeAnalytics(
  teamId: string,
  daysBack: number = 30
): Promise<SendTimeAnalytics> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const { data: activities } = await supabase
    .from('bdr_activities')
    .select('*')
    .eq('team_id', teamId)
    .gte('created_at', since.toISOString());

  const emailsByHour: Record<number, { sent: number; opened: number; replied: number }> = {};
  const emailsByDay: Record<number, { sent: number; opened: number; replied: number }> = {};

  // Initialize
  for (let i = 0; i < 24; i++) {
    emailsByHour[i] = { sent: 0, opened: 0, replied: 0 };
  }
  for (let i = 0; i < 7; i++) {
    emailsByDay[i] = { sent: 0, opened: 0, replied: 0 };
  }

  let totalOpens = 0;
  let totalReplies = 0;
  let totalSent = 0;

  // Aggregate data
  for (const activity of activities || []) {
    const date = new Date(activity.created_at);
    const hour = date.getHours();
    const day = date.getDay();

    if (activity.activity_type === 'email_sent') {
      emailsByHour[hour].sent++;
      emailsByDay[day].sent++;
      totalSent++;
    } else if (activity.activity_type === 'email_opened') {
      emailsByHour[hour].opened++;
      emailsByDay[day].opened++;
      totalOpens++;
    } else if (activity.activity_type === 'email_received') {
      emailsByHour[hour].replied++;
      emailsByDay[day].replied++;
      totalReplies++;
    }
  }

  // Calculate best/worst times
  const hourScores = Object.entries(emailsByHour).map(([hour, stats]) => ({
    hour: parseInt(hour),
    openRate: stats.sent > 0 ? stats.opened / stats.sent : 0,
    replyRate: stats.sent > 0 ? stats.replied / stats.sent : 0,
  }));

  const dayScores = Object.entries(emailsByDay).map(([day, stats]) => ({
    day: parseInt(day),
    openRate: stats.sent > 0 ? stats.opened / stats.sent : 0,
    replyRate: stats.sent > 0 ? stats.replied / stats.sent : 0,
  }));

  hourScores.sort((a, b) => b.replyRate - a.replyRate);
  dayScores.sort((a, b) => b.replyRate - a.replyRate);

  return {
    totalEmails: totalSent,
    emailsByHour,
    emailsByDay,
    bestHours: hourScores.slice(0, 5).map(s => s.hour),
    bestDays: dayScores.slice(0, 3).map(s => s.day),
    worstHours: hourScores.slice(-3).map(s => s.hour),
    worstDays: dayScores.slice(-2).map(s => s.day),
    averageOpenRate: totalSent > 0 ? (totalOpens / totalSent) * 100 : 0,
    averageReplyRate: totalSent > 0 ? (totalReplies / totalSent) * 100 : 0,
  };
}

/**
 * Batch calculate optimal send times for multiple prospects
 */
export async function batchCalculateOptimalSendTimes(
  prospectIds: string[],
  teamId: string
): Promise<Map<string, OptimalSendTime>> {
  const results = new Map<string, OptimalSendTime>();

  // Process in batches
  const batchSize = 10;
  for (let i = 0; i < prospectIds.length; i += batchSize) {
    const batch = prospectIds.slice(i, i + batchSize);
    const times = await Promise.all(
      batch.map(id => calculateOptimalSendTime(id, teamId))
    );

    batch.forEach((id, index) => {
      results.set(id, times[index]);
    });
  }

  return results;
}

/**
 * Schedule email with optimal timing
 */
export async function scheduleEmailWithOptimalTiming(
  prospectId: string,
  teamId: string,
  emailContent: { subject: string; body: string },
  urgency: 'low' | 'medium' | 'high' = 'medium'
): Promise<{ scheduledFor: Date; confidence: number }> {
  const optimalTime = await calculateOptimalSendTime(prospectId, teamId, {
    urgency,
    minHoursFromNow: urgency === 'high' ? 0 : 1,
    maxHoursFromNow: urgency === 'high' ? 24 : 168,
  });

  // Create scheduled task
  await supabase.from('bdr_tasks').insert({
    team_id: teamId,
    prospect_id: prospectId,
    task_type: 'engage',
    status: 'pending',
    scheduled_for: optimalTime.timestamp.toISOString(),
    config: {
      ...emailContent,
      sendTimeOptimized: true,
      confidence: optimalTime.confidence,
      reasoning: optimalTime.reasoning,
    },
  });

  return {
    scheduledFor: optimalTime.timestamp,
    confidence: optimalTime.confidence,
  };
}

/**
 * Get day name from number
 */
export function getDayName(dayNumber: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || 'Unknown';
}

/**
 * Format optimal send time for display
 */
export function formatOptimalSendTime(optimalTime: OptimalSendTime): string {
  const dayName = getDayName(optimalTime.dayOfWeek);
  const hour = optimalTime.hourOfDay;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${dayName} at ${displayHour}:00 ${ampm} (${(optimalTime.confidence * 100).toFixed(0)}% confidence)`;
}
