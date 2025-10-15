export interface SentimentAnalysis {
  sentiment_score: number;
  sentiment_label: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
  confidence_score: number;
  key_phrases: string[];
  emotions: Record<string, number>;
  response_tone: string;
  urgency_level: 'low' | 'medium' | 'high' | 'critical';
}

export function analyzeSentiment(text: string): SentimentAnalysis {
  const lowerText = text.toLowerCase();

  const positiveWords = [
    'thanks', 'thank you', 'great', 'excellent', 'perfect', 'love',
    'wonderful', 'amazing', 'fantastic', 'interested', 'yes',
    'definitely', 'absolutely', 'appreciate', 'excited'
  ];

  const negativeWords = [
    'unfortunately', 'sorry', 'no', 'not interested', 'cancel',
    'unsubscribe', 'stop', 'never', 'disappointed', 'bad',
    'terrible', 'awful', 'hate', 'worst'
  ];

  const urgentWords = [
    'asap', 'urgent', 'immediately', 'now', 'critical',
    'emergency', 'rush', 'quickly'
  ];

  let positiveCount = 0;
  let negativeCount = 0;
  let urgentCount = 0;

  positiveWords.forEach(word => {
    if (lowerText.includes(word)) positiveCount++;
  });

  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negativeCount++;
  });

  urgentWords.forEach(word => {
    if (lowerText.includes(word)) urgentCount++;
  });

  const totalWords = text.split(/\s+/).length;
  const sentimentScore = (positiveCount - negativeCount) / Math.max(totalWords / 10, 1);
  const normalizedScore = Math.max(-1, Math.min(1, sentimentScore));

  let sentimentLabel: SentimentAnalysis['sentiment_label'];
  if (normalizedScore >= 0.5) sentimentLabel = 'very_positive';
  else if (normalizedScore >= 0.1) sentimentLabel = 'positive';
  else if (normalizedScore >= -0.1) sentimentLabel = 'neutral';
  else if (normalizedScore >= -0.5) sentimentLabel = 'negative';
  else sentimentLabel = 'very_negative';

  const keyPhrases: string[] = [];
  if (lowerText.includes('interested in')) keyPhrases.push('interested in');
  if (lowerText.includes("let's schedule") || lowerText.includes('let us schedule')) {
    keyPhrases.push('wants to schedule');
  }
  if (lowerText.includes('pricing') || lowerText.includes('cost')) {
    keyPhrases.push('pricing inquiry');
  }
  if (lowerText.includes('demo')) keyPhrases.push('demo request');
  if (lowerText.includes('call') || lowerText.includes('meeting')) {
    keyPhrases.push('meeting request');
  }

  const emotions = {
    joy: positiveCount > 2 ? 0.7 : positiveCount > 0 ? 0.4 : 0.1,
    trust: lowerText.includes('thank') ? 0.8 : 0.3,
    anticipation: lowerText.includes('looking forward') || lowerText.includes('excited') ? 0.8 : 0.2,
    anger: negativeCount > 2 ? 0.6 : 0.1,
    frustration: lowerText.includes('unfortunately') ? 0.5 : 0.1,
  };

  const responseTone = normalizedScore > 0.3 ? 'enthusiastic' :
    normalizedScore > 0 ? 'positive' :
    normalizedScore > -0.3 ? 'neutral' : 'negative';

  const urgencyLevel: SentimentAnalysis['urgency_level'] =
    urgentCount > 1 ? 'critical' :
    urgentCount > 0 ? 'high' :
    positiveCount > 2 ? 'medium' : 'low';

  return {
    sentiment_score: Number(normalizedScore.toFixed(2)),
    sentiment_label: sentimentLabel,
    confidence_score: 0.75,
    key_phrases: keyPhrases,
    emotions,
    response_tone: responseTone,
    urgency_level: urgencyLevel,
  };
}
