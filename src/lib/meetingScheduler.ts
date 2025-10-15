export interface MeetingRequest {
  parsed_intent: string;
  suggested_times: Date[];
  duration_minutes: number;
  meeting_type: 'discovery' | 'demo' | 'follow_up' | 'negotiation' | 'general';
  confidence_score: number;
}

export function parseMeetingRequest(text: string): MeetingRequest | null {
  const lowerText = text.toLowerCase();

  const meetingKeywords = [
    'schedule', 'meeting', 'call', 'chat', 'discuss', 'talk',
    'available', 'connect', 'catch up', 'demo', 'presentation'
  ];

  const hasMeetingIntent = meetingKeywords.some(keyword => lowerText.includes(keyword));

  if (!hasMeetingIntent) {
    return null;
  }

  let meetingType: MeetingRequest['meeting_type'] = 'general';
  if (lowerText.includes('demo') || lowerText.includes('demonstration')) {
    meetingType = 'demo';
  } else if (lowerText.includes('discovery') || lowerText.includes('introductory')) {
    meetingType = 'discovery';
  } else if (lowerText.includes('follow up') || lowerText.includes('follow-up')) {
    meetingType = 'follow_up';
  } else if (lowerText.includes('negotiate') || lowerText.includes('pricing')) {
    meetingType = 'negotiation';
  }

  let durationMinutes = 30;
  if (lowerText.includes('15 min') || lowerText.includes('15-min')) {
    durationMinutes = 15;
  } else if (lowerText.includes('hour') || lowerText.includes('60 min')) {
    durationMinutes = 60;
  } else if (lowerText.includes('45 min') || lowerText.includes('45-min')) {
    durationMinutes = 45;
  }

  const suggestedTimes = generateSuggestedTimes();

  const explicitTimePatterns = [
    /tomorrow/i,
    /next week/i,
    /this week/i,
    /today/i,
    /monday|tuesday|wednesday|thursday|friday/i,
  ];

  const hasExplicitTime = explicitTimePatterns.some(pattern => pattern.test(text));
  const confidenceScore = hasExplicitTime ? 0.85 : 0.65;

  let parsedIntent = 'Prospect expressed interest in scheduling a meeting';
  if (lowerText.includes('when') || lowerText.includes('available')) {
    parsedIntent = 'Prospect is asking about availability for a meeting';
  } else if (lowerText.includes('calendar') || lowerText.includes('link')) {
    parsedIntent = 'Prospect wants a calendar link to schedule';
  }

  return {
    parsed_intent: parsedIntent,
    suggested_times: suggestedTimes,
    duration_minutes: durationMinutes,
    meeting_type: meetingType,
    confidence_score: confidenceScore,
  };
}

function generateSuggestedTimes(): Date[] {
  const times: Date[] = [];
  const now = new Date();

  for (let daysAhead = 1; daysAhead <= 5; daysAhead++) {
    const date = new Date(now);
    date.setDate(date.getDate() + daysAhead);

    if (date.getDay() !== 0 && date.getDay() !== 6) {
      const morning = new Date(date);
      morning.setHours(10, 0, 0, 0);
      times.push(morning);

      const afternoon = new Date(date);
      afternoon.setHours(14, 0, 0, 0);
      times.push(afternoon);
    }
  }

  return times.slice(0, 6);
}

export function formatMeetingTimes(times: Date[]): string {
  return times.map(time => {
    const day = time.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const hour = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${day} at ${hour}`;
  }).join('\n');
}
