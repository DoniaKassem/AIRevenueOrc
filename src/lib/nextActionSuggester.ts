import { LeadScore } from './leadScoring';
import { SentimentAnalysis } from './sentimentAnalyzer';

export interface NextAction {
  action_type: 'email' | 'call' | 'linkedin' | 'meeting' | 'follow_up' | 'research' | 'proposal';
  action_title: string;
  action_description: string;
  reasoning: string;
  priority_score: number;
  suggested_timing: string;
  suggested_content?: string;
}

interface ActionContext {
  leadScore: LeadScore;
  lastSentiment?: SentimentAnalysis;
  daysSinceLastContact: number;
  emailCount: number;
  callCount: number;
  hasReplied: boolean;
}

export function suggestNextActions(context: ActionContext): NextAction[] {
  const actions: NextAction[] = [];
  const { leadScore, lastSentiment, daysSinceLastContact, emailCount, callCount, hasReplied } = context;

  if (lastSentiment && lastSentiment.key_phrases.includes('demo request')) {
    actions.push({
      action_type: 'meeting',
      action_title: 'Schedule Product Demo',
      action_description: 'Prospect explicitly requested a demo in their last message',
      reasoning: 'High intent signal detected: demo request',
      priority_score: 95,
      suggested_timing: 'Within 2 hours',
      suggested_content: 'Send calendar link with demo slots available',
    });
  }

  if (lastSentiment && lastSentiment.key_phrases.includes('pricing inquiry')) {
    actions.push({
      action_type: 'email',
      action_title: 'Send Pricing Information',
      action_description: 'Prospect asked about pricing details',
      reasoning: 'Buying signal: price inquiry indicates interest',
      priority_score: 90,
      suggested_timing: 'Within 4 hours',
      suggested_content: 'Provide pricing tiers with ROI examples',
    });
  }

  if (lastSentiment && lastSentiment.sentiment_score < -0.3) {
    actions.push({
      action_type: 'call',
      action_title: 'Address Concerns via Phone',
      action_description: 'Negative sentiment detected in last interaction',
      reasoning: 'Negative sentiment requires personal touch to resolve concerns',
      priority_score: 85,
      suggested_timing: 'Today',
      suggested_content: 'Call to understand objections and provide clarification',
    });
  }

  if (leadScore.score_tier === 'burning' && !hasReplied && emailCount > 2) {
    actions.push({
      action_type: 'call',
      action_title: 'Follow Up with Phone Call',
      action_description: 'High-scoring lead not responding to emails',
      reasoning: 'Hot lead with high engagement but no email replies - try different channel',
      priority_score: 88,
      suggested_timing: 'Within 24 hours',
    });
  }

  if (leadScore.score_tier === 'hot' && hasReplied && emailCount > 3 && callCount === 0) {
    actions.push({
      action_type: 'meeting',
      action_title: 'Schedule Discovery Call',
      action_description: 'Engaged prospect ready for next step',
      reasoning: 'Multiple positive interactions indicate readiness for discovery call',
      priority_score: 82,
      suggested_timing: 'This week',
      suggested_content: 'Propose 30-min discovery call to discuss their needs',
    });
  }

  if (daysSinceLastContact >= 7 && leadScore.composite_score > 50) {
    actions.push({
      action_type: 'follow_up',
      action_title: 'Re-engage with Value Content',
      action_description: 'Quality lead has gone quiet',
      reasoning: 'Promising lead needs nurturing to stay engaged',
      priority_score: 70,
      suggested_timing: 'This week',
      suggested_content: 'Share case study or industry insight relevant to their business',
    });
  }

  if (lastSentiment && lastSentiment.key_phrases.includes('wants to schedule')) {
    actions.push({
      action_type: 'meeting',
      action_title: 'Coordinate Meeting Time',
      action_description: 'Prospect indicated interest in scheduling a meeting',
      reasoning: 'Direct scheduling intent expressed',
      priority_score: 93,
      suggested_timing: 'Within 3 hours',
      suggested_content: 'Provide available time slots or calendar booking link',
    });
  }

  if (leadScore.score_tier === 'warm' && emailCount < 2) {
    actions.push({
      action_type: 'email',
      action_title: 'Send Personalized Value Proposition',
      action_description: 'Early-stage prospect needs more information',
      reasoning: 'Build engagement with targeted content',
      priority_score: 60,
      suggested_timing: 'Within 2 days',
      suggested_content: 'Highlight specific benefits related to their industry/role',
    });
  }

  if (leadScore.engagement_score < 30 && emailCount > 5) {
    actions.push({
      action_type: 'research',
      action_title: 'Research Recent Company Activity',
      action_description: 'Low engagement despite multiple touchpoints',
      reasoning: 'Find new angle or trigger event to re-engage',
      priority_score: 50,
      suggested_timing: 'This week',
    });
  }

  if (leadScore.score_tier === 'burning' && hasReplied && callCount > 0) {
    actions.push({
      action_type: 'proposal',
      action_title: 'Prepare Formal Proposal',
      action_description: 'Highly engaged prospect ready for proposal',
      reasoning: 'All signals indicate prospect is evaluation-ready',
      priority_score: 92,
      suggested_timing: 'Within 48 hours',
      suggested_content: 'Tailored proposal addressing their specific pain points',
    });
  }

  if (lastSentiment && lastSentiment.urgency_level === 'critical') {
    actions.push({
      action_type: 'call',
      action_title: 'Urgent Response Required',
      action_description: 'Prospect message indicates time-sensitive matter',
      reasoning: 'Urgent language detected - immediate response needed',
      priority_score: 98,
      suggested_timing: 'Immediately',
    });
  }

  return actions.sort((a, b) => b.priority_score - a.priority_score).slice(0, 5);
}
