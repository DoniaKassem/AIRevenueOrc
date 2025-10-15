export interface FollowUpRule {
  id: string;
  name: string;
  trigger_type: 'no_response' | 'email_opened' | 'link_clicked' | 'time_based' | 'sentiment_negative';
  trigger_conditions: {
    days_since_last_email?: number;
    engagement_threshold?: number;
    sentiment_threshold?: number;
  };
  action: {
    type: 'send_email' | 'create_task' | 'notify_user' | 'change_cadence_step';
    template_id?: string;
    message?: string;
    delay_hours?: number;
  };
  enabled: boolean;
}

export interface FollowUpSuggestion {
  prospect_id: string;
  prospect_name: string;
  reason: string;
  suggested_action: string;
  priority: 'high' | 'medium' | 'low';
  context: {
    last_contact_date: string;
    last_email_opened: boolean;
    sentiment?: number;
    engagement_score?: number;
  };
}

export function analyzeFollowUpNeeds(
  prospects: any[],
  emails: any[],
  engagements: any[]
): FollowUpSuggestion[] {
  const suggestions: FollowUpSuggestion[] = [];

  prospects.forEach(prospect => {
    const prospectEmails = emails.filter(e => e.prospect_id === prospect.id);
    const prospectEngagements = engagements.filter(e => e.prospect_id === prospect.id);

    if (prospectEmails.length === 0) return;

    const lastEmail = prospectEmails.sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    )[0];

    const daysSinceLastEmail = Math.floor(
      (Date.now() - new Date(lastEmail.sent_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    const wasOpened = prospectEngagements.some(
      e => e.email_send_id === lastEmail.id && e.event_type === 'opened'
    );

    const hadClicks = prospectEngagements.some(
      e => e.email_send_id === lastEmail.id && e.event_type === 'clicked'
    );

    if (daysSinceLastEmail >= 3 && wasOpened && !hadClicks) {
      suggestions.push({
        prospect_id: prospect.id,
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        reason: 'Email opened but no action taken',
        suggested_action: 'Send a gentle reminder with a different value proposition',
        priority: 'medium',
        context: {
          last_contact_date: lastEmail.sent_at,
          last_email_opened: wasOpened,
          engagement_score: prospectEngagements.length,
        },
      });
    }

    if (daysSinceLastEmail >= 5 && !wasOpened) {
      suggestions.push({
        prospect_id: prospect.id,
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        reason: 'No engagement in 5 days',
        suggested_action: 'Try different subject line or phone call',
        priority: 'high',
        context: {
          last_contact_date: lastEmail.sent_at,
          last_email_opened: false,
          engagement_score: prospectEngagements.length,
        },
      });
    }

    if (hadClicks && daysSinceLastEmail >= 2) {
      suggestions.push({
        prospect_id: prospect.id,
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        reason: 'High engagement detected - strike while hot!',
        suggested_action: 'Immediate follow-up or schedule a call',
        priority: 'high',
        context: {
          last_contact_date: lastEmail.sent_at,
          last_email_opened: wasOpened,
          engagement_score: prospectEngagements.length + 5,
        },
      });
    }

    if (daysSinceLastEmail >= 7) {
      suggestions.push({
        prospect_id: prospect.id,
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        reason: 'Been too long since last contact',
        suggested_action: 'Re-engage with new content or case study',
        priority: 'medium',
        context: {
          last_contact_date: lastEmail.sent_at,
          last_email_opened: wasOpened,
          engagement_score: prospectEngagements.length,
        },
      });
    }
  });

  return suggestions.sort((a, b) => {
    const priorityScore = { high: 3, medium: 2, low: 1 };
    return priorityScore[b.priority] - priorityScore[a.priority];
  });
}

export function shouldSendFollowUp(
  lastEmailDate: Date,
  wasOpened: boolean,
  wasClicked: boolean,
  wasReplied: boolean
): { send: boolean; reason: string; delayHours: number } {
  if (wasReplied) {
    return { send: false, reason: 'Prospect already replied', delayHours: 0 };
  }

  const hoursSinceEmail = (Date.now() - lastEmailDate.getTime()) / (1000 * 60 * 60);

  if (wasClicked && hoursSinceEmail >= 24) {
    return {
      send: true,
      reason: 'High engagement - follow up quickly',
      delayHours: 0,
    };
  }

  if (wasOpened && !wasClicked && hoursSinceEmail >= 48) {
    return {
      send: true,
      reason: 'Opened but no action - gentle reminder',
      delayHours: 24,
    };
  }

  if (!wasOpened && hoursSinceEmail >= 72) {
    return {
      send: true,
      reason: 'No engagement - try different approach',
      delayHours: 48,
    };
  }

  return { send: false, reason: 'Too soon to follow up', delayHours: 0 };
}

export function generateFollowUpEmail(
  originalEmail: string,
  engagementLevel: 'high' | 'medium' | 'low' | 'none'
): string {
  const templates = {
    high: `Just wanted to quickly follow up on my previous email. I saw you checked out the information - did you have any questions I can help with?\n\nHappy to jump on a quick call if that's easier.`,

    medium: `I wanted to circle back on my previous message. I shared some insights that I thought might be relevant to your goals.\n\nWould love to hear your thoughts or answer any questions you might have.`,

    low: `I know you're probably busy, so I'll keep this brief.\n\nI reached out earlier about [topic]. If you're interested in learning more, I'd be happy to share some quick wins we've seen with similar companies.\n\nIf now isn't the right time, just let me know when might be better to reconnect.`,

    none: `I tried reaching out a few days ago but wanted to make sure my email didn't get buried.\n\nI have some ideas that could help [pain point]. Worth a 15-minute conversation?\n\nIf you're not interested, no worries - just let me know and I won't follow up again.`,
  };

  return templates[engagementLevel];
}

export function calculateOptimalFollowUpTime(
  prospects: any[],
  engagements: any[]
): { hour: number; dayOfWeek: string } {
  const successfulFollowUps = engagements.filter(
    e => e.event_type === 'replied' || e.event_type === 'clicked'
  );

  const timeAnalysis: Record<number, number> = {};
  const dayAnalysis: Record<string, number> = {};

  successfulFollowUps.forEach(e => {
    const date = new Date(e.timestamp);
    const hour = date.getHours();
    const day = date.toLocaleDateString('en-US', { weekday: 'long' });

    timeAnalysis[hour] = (timeAnalysis[hour] || 0) + 1;
    dayAnalysis[day] = (dayAnalysis[day] || 0) + 1;
  });

  const bestHour = Object.entries(timeAnalysis).sort((a, b) => b[1] - a[1])[0];
  const bestDay = Object.entries(dayAnalysis).sort((a, b) => b[1] - a[1])[0];

  return {
    hour: bestHour ? parseInt(bestHour[0]) : 10,
    dayOfWeek: bestDay ? bestDay[0] : 'Tuesday',
  };
}

export const DEFAULT_FOLLOW_UP_RULES: FollowUpRule[] = [
  {
    id: 'no-response-3-days',
    name: 'No Response After 3 Days',
    trigger_type: 'no_response',
    trigger_conditions: {
      days_since_last_email: 3,
    },
    action: {
      type: 'create_task',
      message: 'Follow up with prospect - no response after 3 days',
    },
    enabled: true,
  },
  {
    id: 'email-opened-high-engagement',
    name: 'Email Opened Multiple Times',
    trigger_type: 'email_opened',
    trigger_conditions: {
      engagement_threshold: 3,
    },
    action: {
      type: 'notify_user',
      message: 'Prospect opened your email 3+ times - high interest!',
    },
    enabled: true,
  },
  {
    id: 'link-clicked',
    name: 'Link Clicked',
    trigger_type: 'link_clicked',
    trigger_conditions: {},
    action: {
      type: 'notify_user',
      message: 'Prospect clicked a link in your email',
      delay_hours: 0,
    },
    enabled: true,
  },
  {
    id: 'negative-sentiment',
    name: 'Negative Sentiment Detected',
    trigger_type: 'sentiment_negative',
    trigger_conditions: {
      sentiment_threshold: -0.3,
    },
    action: {
      type: 'create_task',
      message: 'Negative sentiment detected - personal outreach needed',
    },
    enabled: true,
  },
];
