export interface LinkedInMessage {
  type: 'connection_request' | 'follow_up' | 'value_share' | 'meeting_request';
  subject?: string;
  message: string;
  timing: string;
  best_practices: string[];
}

export interface SocialPlaybook {
  name: string;
  description: string;
  target_persona: string;
  steps: PlaybookStep[];
  success_metrics: string[];
}

export interface PlaybookStep {
  step_number: number;
  action: string;
  platform: 'linkedin' | 'twitter' | 'email' | 'phone';
  timing: string;
  template?: string;
  tips: string[];
}

export function generateLinkedInConnectionRequest(
  firstName: string,
  company: string,
  commonality?: string
): LinkedInMessage {
  let message = `Hi ${firstName},\n\n`;

  if (commonality) {
    message += `I noticed ${commonality} and thought we might have some interesting insights to share.\n\n`;
  } else {
    message += `I came across your profile and was impressed by your work at ${company}.\n\n`;
  }

  message += `I'd love to connect and learn more about your role. Looking forward to staying in touch!`;

  return {
    type: 'connection_request',
    message,
    timing: 'Send during business hours (9am-5pm their timezone)',
    best_practices: [
      'Keep it under 300 characters',
      'Mention a commonality if possible',
      'Be genuine and specific',
      'Avoid sales pitches in connection requests',
    ],
  };
}

export function generateValueShareMessage(
  firstName: string,
  industry: string,
  painPoint?: string
): LinkedInMessage {
  const subject = `Thought this might interest you`;

  let message = `Hi ${firstName},\n\n`;
  message += `I recently came across this article/resource about ${painPoint || 'trends in ' + industry} and thought of you.\n\n`;
  message += `[Link to relevant content]\n\n`;
  message += `It has some interesting insights on [key takeaway]. Would love to hear your thoughts if you get a chance to check it out.\n\n`;
  message += `Hope you're having a great week!`;

  return {
    type: 'value_share',
    subject,
    message,
    timing: 'Wait 3-5 days after connection acceptance',
    best_practices: [
      'Share genuinely valuable content',
      'No ask or pitch - just providing value',
      'Make it relevant to their role',
      'Keep it conversational',
    ],
  };
}

export function generateMeetingRequestMessage(
  firstName: string,
  company: string,
  valueProposition: string
): LinkedInMessage {
  const subject = `Quick chat about ${company}?`;

  let message = `Hi ${firstName},\n\n`;
  message += `I've been following your work at ${company} and noticed [specific observation about their company/role].\n\n`;
  message += `We've been helping similar companies ${valueProposition}, and I thought it might be worth a brief conversation.\n\n`;
  message += `Would you be open to a 15-minute call next week? I promise to keep it focused and valuable.\n\n`;
  message += `Let me know what works for you!`;

  return {
    type: 'meeting_request',
    subject,
    message,
    timing: 'After 2-3 value-sharing interactions',
    best_practices: [
      'Reference previous interactions',
      'Be specific about the value',
      'Keep the ask small (15 minutes)',
      'Make it easy to say yes',
    ],
  };
}

export const SOCIAL_SELLING_PLAYBOOKS: SocialPlaybook[] = [
  {
    name: 'Warm Introduction Playbook',
    description: 'Build relationships before making any sales pitch',
    target_persona: 'C-Level Executives',
    steps: [
      {
        step_number: 1,
        action: 'Follow their company page and engage with content',
        platform: 'linkedin',
        timing: 'Day 1',
        tips: [
          'Like and thoughtfully comment on their posts',
          'Share relevant company updates',
          'Show genuine interest in their business',
        ],
      },
      {
        step_number: 2,
        action: 'Send personalized connection request',
        platform: 'linkedin',
        timing: 'Day 3-5',
        template: 'Use generateLinkedInConnectionRequest()',
        tips: [
          'Mention specific content they shared',
          'Reference mutual connections if any',
          'Keep it brief and professional',
        ],
      },
      {
        step_number: 3,
        action: 'Share valuable content',
        platform: 'linkedin',
        timing: 'Day 8-10 (after connection)',
        template: 'Use generateValueShareMessage()',
        tips: [
          'Industry report or case study',
          'No sales pitch',
          'Focus on education',
        ],
      },
      {
        step_number: 4,
        action: 'Engage with their content',
        platform: 'linkedin',
        timing: 'Ongoing',
        tips: [
          'Comment thoughtfully on their posts',
          'Add insights from your experience',
          'Build credibility',
        ],
      },
      {
        step_number: 5,
        action: 'Request meeting',
        platform: 'linkedin',
        timing: 'Day 15-20',
        template: 'Use generateMeetingRequestMessage()',
        tips: [
          'Reference previous interactions',
          'Clear value proposition',
          'Specific time commitment',
        ],
      },
    ],
    success_metrics: [
      'Connection acceptance rate > 40%',
      'Response rate > 25%',
      'Meeting booking rate > 15%',
    ],
  },
  {
    name: 'Trigger Event Playbook',
    description: 'Reach out based on company events (funding, hiring, expansion)',
    target_persona: 'VPs and Directors',
    steps: [
      {
        step_number: 1,
        action: 'Identify trigger event',
        platform: 'linkedin',
        timing: 'Day 1',
        tips: [
          'Monitor company news',
          'Track job postings',
          'Watch for funding announcements',
        ],
      },
      {
        step_number: 2,
        action: 'Send congratulatory message',
        platform: 'linkedin',
        timing: 'Day 1-2 (while news is fresh)',
        tips: [
          'Acknowledge the event',
          'Show genuine excitement',
          'No immediate ask',
        ],
      },
      {
        step_number: 3,
        action: 'Share relevant case study',
        platform: 'email',
        timing: 'Day 5-7',
        tips: [
          'Show how you helped similar company',
          'Tie to their trigger event',
          'Soft call-to-action',
        ],
      },
      {
        step_number: 4,
        action: 'Request quick call',
        platform: 'linkedin',
        timing: 'Day 10-12',
        tips: [
          'Reference the trigger event',
          'Offer specific insights',
          'Time-bound offer',
        ],
      },
    ],
    success_metrics: [
      'Response rate > 35%',
      'Meeting booking rate > 20%',
      'Faster sales cycle',
    ],
  },
  {
    name: 'Content Engagement Playbook',
    description: 'Build authority by consistently sharing valuable content',
    target_persona: 'All personas',
    steps: [
      {
        step_number: 1,
        action: 'Create and share weekly content',
        platform: 'linkedin',
        timing: 'Every Tuesday and Thursday',
        tips: [
          'Industry insights',
          'Customer success stories',
          'Thought leadership',
        ],
      },
      {
        step_number: 2,
        action: 'Engage with prospect content',
        platform: 'linkedin',
        timing: 'Daily',
        tips: [
          'Thoughtful comments',
          'Add unique perspective',
          'Be helpful, not salesy',
        ],
      },
      {
        step_number: 3,
        action: 'Share prospect content',
        platform: 'linkedin',
        timing: 'When relevant',
        tips: [
          'Amplify their voice',
          'Add your commentary',
          'Tag them appropriately',
        ],
      },
      {
        step_number: 4,
        action: 'Send warm message',
        platform: 'linkedin',
        timing: 'After multiple interactions',
        tips: [
          'Reference your interactions',
          'Natural conversation starter',
          'Low-pressure approach',
        ],
      },
    ],
    success_metrics: [
      'Profile views increase',
      'Inbound connection requests',
      'Prospects reach out first',
    ],
  },
];

export function getPlaybookForPersona(persona: string): SocialPlaybook {
  const matchingPlaybook = SOCIAL_SELLING_PLAYBOOKS.find(p =>
    p.target_persona.toLowerCase().includes(persona.toLowerCase())
  );

  return matchingPlaybook || SOCIAL_SELLING_PLAYBOOKS[0];
}

export function generatePersonalizedOutreach(
  firstName: string,
  lastName: string,
  company: string,
  jobTitle: string,
  recentActivity?: string
): {
  connection_request: string;
  follow_up_1: string;
  follow_up_2: string;
  meeting_request: string;
} {
  const connectionRequest = recentActivity
    ? `Hi ${firstName}, I saw your recent post about ${recentActivity} and found it really insightful. Would love to connect and learn more about your work at ${company}.`
    : `Hi ${firstName}, I've been impressed by the work you're doing at ${company} as ${jobTitle}. Would love to connect and exchange ideas.`;

  const followUp1 = `Hi ${firstName},\n\nThanks for connecting! I wanted to share this article I came across about [relevant topic for their role]. It has some interesting insights that reminded me of the work you're doing at ${company}.\n\n[Link]\n\nWould love to hear your thoughts!`;

  const followUp2 = `Hi ${firstName},\n\nI've been thinking about the challenges that ${jobTitle}s at companies like ${company} are facing right now, particularly around [pain point].\n\nWe recently worked with [similar company] on this and saw some interesting results. Would you be open to a brief chat about how they approached it?\n\nNo pressure - just thought it might be valuable given your role.`;

  const meetingRequest = `Hi ${firstName},\n\nI've really enjoyed our conversation so far. Based on what you've shared about ${company}, I think there might be some interesting ways we could help with [specific challenge].\n\nWould you be open to a 15-minute call next week? I can share some specific examples of how we've helped companies like yours.\n\nHere's my calendar: [Link]\n\nLooking forward to it!`;

  return {
    connection_request: connectionRequest,
    follow_up_1: followUp1,
    follow_up_2: followUp2,
    meeting_request: meetingRequest,
  };
}

export function scoreSocialEngagement(
  profile_views: number,
  connection_rate: number,
  response_rate: number,
  content_interactions: number
): {
  score: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  recommendations: string[];
} {
  let score = 0;

  score += Math.min(profile_views / 10, 25);

  score += connection_rate * 25;

  score += response_rate * 30;

  score += Math.min(content_interactions / 5, 20);

  let level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  if (score >= 80) level = 'expert';
  else if (score >= 60) level = 'advanced';
  else if (score >= 40) level = 'intermediate';
  else level = 'beginner';

  const recommendations: string[] = [];

  if (profile_views < 50) {
    recommendations.push('Increase profile visibility by posting more content');
  }

  if (connection_rate < 0.3) {
    recommendations.push('Personalize connection requests more');
  }

  if (response_rate < 0.2) {
    recommendations.push('Lead with value, not sales pitch');
  }

  if (content_interactions < 10) {
    recommendations.push('Engage more with prospect content');
  }

  return {
    score: Math.round(score),
    level,
    recommendations,
  };
}

export const LINKEDIN_BEST_PRACTICES = [
  'Optimize your profile with professional photo and compelling headline',
  'Post consistently (2-3 times per week minimum)',
  'Engage with content before sending connection requests',
  'Personalize every connection request',
  'Wait 3-5 days after connection before pitching',
  'Share valuable content with no strings attached',
  'Comment thoughtfully on prospect posts',
  'Use LinkedIn Sales Navigator for advanced search',
  'Track all interactions in your CRM',
  'Follow up on every engagement within 24 hours',
];
