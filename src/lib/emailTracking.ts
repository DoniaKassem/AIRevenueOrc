export interface EmailEngagement {
  email_send_id: string;
  prospect_id: string;
  event_type: 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed';
  event_data: {
    link_url?: string;
    device?: string;
    location?: string;
    user_agent?: string;
  };
  timestamp: string;
}

export interface EmailTrackingPixel {
  email_send_id: string;
  tracking_url: string;
}

export interface ClickTracking {
  email_send_id: string;
  original_url: string;
  tracked_url: string;
}

export function generateTrackingPixel(emailSendId: string): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${baseUrl}/functions/v1/track-email-open?id=${emailSendId}`;
}

export function generateClickTrackingUrl(emailSendId: string, originalUrl: string): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const encoded = encodeURIComponent(originalUrl);
  return `${baseUrl}/functions/v1/track-email-click?id=${emailSendId}&url=${encoded}`;
}

export function embedTrackingPixel(htmlContent: string, emailSendId: string): string {
  const trackingPixelUrl = generateTrackingPixel(emailSendId);
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;

  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `${trackingPixel}</body>`);
  }

  return `${htmlContent}${trackingPixel}`;
}

export function embedClickTracking(htmlContent: string, emailSendId: string): string {
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;

  return htmlContent.replace(linkRegex, (match, url) => {
    if (url.startsWith('mailto:') || url.startsWith('#') || url.includes('track-email-click')) {
      return match;
    }

    const trackedUrl = generateClickTrackingUrl(emailSendId, url);
    return match.replace(url, trackedUrl);
  });
}

export function getEngagementScore(engagements: EmailEngagement[]): number {
  let score = 0;

  engagements.forEach(event => {
    switch (event.event_type) {
      case 'opened':
        score += 1;
        break;
      case 'clicked':
        score += 3;
        break;
      case 'replied':
        score += 10;
        break;
      case 'bounced':
        score -= 5;
        break;
      case 'unsubscribed':
        score -= 10;
        break;
    }
  });

  return Math.max(0, score);
}

export function calculateOpenRate(totalSent: number, totalOpened: number): number {
  if (totalSent === 0) return 0;
  return (totalOpened / totalSent) * 100;
}

export function calculateClickRate(totalSent: number, totalClicked: number): number {
  if (totalSent === 0) return 0;
  return (totalClicked / totalSent) * 100;
}

export function getBestSendTime(engagements: EmailEngagement[]): { hour: number; day: string } {
  const opensByHour: Record<number, number> = {};
  const opensByDay: Record<string, number> = {};

  engagements
    .filter(e => e.event_type === 'opened')
    .forEach(e => {
      const date = new Date(e.timestamp);
      const hour = date.getHours();
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });

      opensByHour[hour] = (opensByHour[hour] || 0) + 1;
      opensByDay[day] = (opensByDay[day] || 0) + 1;
    });

  const bestHour = Object.entries(opensByHour).sort((a, b) => b[1] - a[1])[0];
  const bestDay = Object.entries(opensByDay).sort((a, b) => b[1] - a[1])[0];

  return {
    hour: bestHour ? parseInt(bestHour[0]) : 10,
    day: bestDay ? bestDay[0] : 'Tuesday',
  };
}
