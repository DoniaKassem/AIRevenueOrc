import { LeadScore } from './leadScoring';
import { SentimentAnalysis } from './sentimentAnalyzer';

export interface Task {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'follow_up' | 'research' | 'demo';
  title: string;
  description: string;
  prospect_id: string;
  prospect_name: string;
  company: string;
  priority_score: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string;
  estimated_minutes: number;
  context: {
    last_activity?: string;
    days_since_contact?: number;
    deal_value?: number;
    close_probability?: number;
  };
}

interface PrioritizationFactors {
  leadScore?: LeadScore;
  sentiment?: SentimentAnalysis;
  daysSinceContact: number;
  dealValue: number;
  closeDate?: Date;
  responseTime?: number;
  engagementLevel: number;
}

export function calculateTaskPriority(factors: PrioritizationFactors): number {
  let score = 0;

  if (factors.leadScore) {
    score += factors.leadScore.composite_score * 0.3;
  }

  if (factors.sentiment) {
    if (factors.sentiment.urgency_level === 'critical') score += 30;
    else if (factors.sentiment.urgency_level === 'high') score += 20;
    else if (factors.sentiment.urgency_level === 'medium') score += 10;

    if (factors.sentiment.sentiment_score < -0.3) {
      score += 25;
    }
  }

  if (factors.daysSinceContact > 7) {
    score += 15;
  } else if (factors.daysSinceContact > 3) {
    score += 10;
  }

  if (factors.dealValue) {
    if (factors.dealValue > 100000) score += 20;
    else if (factors.dealValue > 50000) score += 15;
    else if (factors.dealValue > 25000) score += 10;
    else score += 5;
  }

  if (factors.closeDate) {
    const daysToClose = Math.floor(
      (factors.closeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysToClose <= 7) score += 25;
    else if (daysToClose <= 14) score += 15;
    else if (daysToClose <= 30) score += 10;
  }

  if (factors.responseTime && factors.responseTime < 2) {
    score += 20;
  }

  score += factors.engagementLevel * 0.2;

  return Math.min(100, Math.round(score));
}

export function getTaskUrgency(priorityScore: number): Task['urgency'] {
  if (priorityScore >= 80) return 'critical';
  if (priorityScore >= 60) return 'high';
  if (priorityScore >= 40) return 'medium';
  return 'low';
}

export function generateDailyTasks(
  prospects: any[],
  deals: any[],
  previousActivities: any[]
): Task[] {
  const tasks: Task[] = [];

  prospects.forEach(prospect => {
    const daysSinceContact = calculateDaysSinceContact(
      prospect.id,
      previousActivities
    );

    if (daysSinceContact >= 5) {
      const priorityScore = calculateTaskPriority({
        daysSinceContact,
        dealValue: 0,
        engagementLevel: prospect.priority_score || 50,
      });

      tasks.push({
        id: `follow-up-${prospect.id}`,
        type: 'follow_up',
        title: `Follow up with ${prospect.first_name} ${prospect.last_name}`,
        description: `It's been ${daysSinceContact} days since last contact`,
        prospect_id: prospect.id,
        prospect_name: `${prospect.first_name} ${prospect.last_name}`,
        company: prospect.company || 'Unknown',
        priority_score: priorityScore,
        urgency: getTaskUrgency(priorityScore),
        estimated_minutes: 15,
        context: {
          days_since_contact: daysSinceContact,
        },
      });
    }
  });

  deals
    .filter(deal => deal.stage !== 'won' && deal.stage !== 'lost')
    .forEach(deal => {
      const closeDate = deal.expected_close_date ? new Date(deal.expected_close_date) : undefined;
      const daysToClose = closeDate
        ? Math.floor((closeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysToClose <= 14) {
        const priorityScore = calculateTaskPriority({
          daysSinceContact: 0,
          dealValue: deal.value || 0,
          closeDate,
          engagementLevel: 80,
        });

        tasks.push({
          id: `deal-check-${deal.id}`,
          type: 'call',
          title: `Check in on ${deal.name}`,
          description: `Deal closes in ${daysToClose} days - ensure momentum`,
          prospect_id: deal.prospect_id,
          prospect_name: deal.prospect_name || 'Unknown',
          company: deal.company || 'Unknown',
          priority_score: priorityScore,
          urgency: getTaskUrgency(priorityScore),
          due_date: closeDate?.toISOString(),
          estimated_minutes: 30,
          context: {
            deal_value: deal.value,
            close_probability: deal.probability,
          },
        });
      }
    });

  return tasks.sort((a, b) => b.priority_score - a.priority_score);
}

function calculateDaysSinceContact(
  prospectId: string,
  activities: any[]
): number {
  const prospectActivities = activities
    .filter(a => a.prospect_id === prospectId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (prospectActivities.length === 0) return 999;

  const lastActivity = new Date(prospectActivities[0].created_at);
  const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

  return daysSince;
}

export function estimateTaskDuration(taskType: Task['type']): number {
  switch (taskType) {
    case 'email':
      return 10;
    case 'call':
      return 20;
    case 'meeting':
      return 45;
    case 'demo':
      return 60;
    case 'follow_up':
      return 15;
    case 'research':
      return 30;
    default:
      return 15;
  }
}

export function generateTimeBlocks(tasks: Task[], workdayHours: number = 8): any[] {
  const blocks = [];
  let currentTime = new Date();
  currentTime.setHours(9, 0, 0, 0);

  const sortedTasks = tasks
    .filter(t => t.urgency === 'critical' || t.urgency === 'high')
    .slice(0, 10);

  sortedTasks.forEach(task => {
    const endTime = new Date(currentTime.getTime() + task.estimated_minutes * 60000);

    blocks.push({
      task,
      start_time: currentTime.toISOString(),
      end_time: endTime.toISOString(),
    });

    currentTime = new Date(endTime.getTime() + 15 * 60000);
  });

  return blocks;
}
