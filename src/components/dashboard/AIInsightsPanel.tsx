import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, AlertCircle, Calendar, Zap } from 'lucide-react';
import { NextAction } from '../../lib/nextActionSuggester';

interface AIInsightsPanelProps {
  prospectId: string;
  prospectName: string;
  onClose: () => void;
}

export default function AIInsightsPanel({ prospectId, prospectName, onClose }: AIInsightsPanelProps) {
  const [leadScore, setLeadScore] = useState<any>(null);
  const [sentiment, setSentiment] = useState<any>(null);
  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAIInsights();
  }, [prospectId]);

  async function loadAIInsights() {
    setLoading(true);
    try {
      await Promise.all([
        loadLeadScore(),
        loadSentiment(),
        loadNextActions()
      ]);
    } catch (error) {
      console.error('Error loading AI insights:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeadScore() {
    setLeadScore({
      composite_score: 78,
      score_tier: 'hot',
      engagement_score: 82,
      fit_score: 75,
      intent_score: 80,
      recency_score: 70,
      conversion_probability: 0.78,
    });
  }

  async function loadSentiment() {
    setSentiment({
      sentiment_score: 0.65,
      sentiment_label: 'positive',
      key_phrases: ['interested in', 'demo request', 'pricing inquiry'],
      response_tone: 'enthusiastic',
      urgency_level: 'high',
    });
  }

  async function loadNextActions() {
    setNextActions([
      {
        action_type: 'meeting',
        action_title: 'Schedule Product Demo',
        action_description: 'Prospect explicitly requested a demo in their last message',
        reasoning: 'High intent signal detected: demo request',
        priority_score: 95,
        suggested_timing: 'Within 2 hours',
        suggested_content: 'Send calendar link with demo slots available',
      },
      {
        action_type: 'email',
        action_title: 'Send Pricing Information',
        action_description: 'Prospect asked about pricing details',
        reasoning: 'Buying signal: price inquiry indicates interest',
        priority_score: 90,
        suggested_timing: 'Within 4 hours',
      },
      {
        action_type: 'call',
        action_title: 'Follow Up Phone Call',
        action_description: 'Reinforce demo interest with personal touch',
        reasoning: 'High engagement warrants direct conversation',
        priority_score: 85,
        suggested_timing: 'Today',
      },
    ]);
  }

  const getScoreTierColor = (tier: string) => {
    switch (tier) {
      case 'burning':
        return 'text-red-600 bg-red-100';
      case 'hot':
        return 'text-orange-600 bg-orange-100';
      case 'warm':
        return 'text-yellow-600 bg-yellow-100';
      case 'cold':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-slate-600 bg-slate-100';
    }
  };

  const getSentimentColor = (label: string) => {
    switch (label) {
      case 'very_positive':
        return 'text-green-700 bg-green-100';
      case 'positive':
        return 'text-green-600 bg-green-50';
      case 'neutral':
        return 'text-slate-600 bg-slate-100';
      case 'negative':
        return 'text-red-600 bg-red-50';
      case 'very_negative':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-slate-600 bg-slate-100';
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return Calendar;
      case 'call':
        return Sparkles;
      case 'email':
        return Sparkles;
      default:
        return Zap;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="h-32 bg-slate-200 rounded"></div>
            <div className="h-32 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">AI Insights</h2>
            <p className="text-slate-600 mt-1">{prospectName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {leadScore && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                  Lead Score
                </h3>
                <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${getScoreTierColor(leadScore.score_tier)}`}>
                  {leadScore.score_tier.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-4xl font-bold text-blue-600 mb-1">
                    {leadScore.composite_score}
                  </div>
                  <div className="text-sm text-slate-600">Composite Score</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-green-600 mb-1">
                    {(leadScore.conversion_probability * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-slate-600">Conversion Probability</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3">
                  <div className="text-lg font-semibold text-slate-900">{leadScore.engagement_score}</div>
                  <div className="text-xs text-slate-600">Engagement</div>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <div className="text-lg font-semibold text-slate-900">{leadScore.fit_score}</div>
                  <div className="text-xs text-slate-600">Fit</div>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <div className="text-lg font-semibold text-slate-900">{leadScore.intent_score}</div>
                  <div className="text-xs text-slate-600">Intent</div>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <div className="text-lg font-semibold text-slate-900">{leadScore.recency_score}</div>
                  <div className="text-xs text-slate-600">Recency</div>
                </div>
              </div>
            </div>
          )}

          {sentiment && (
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-green-600" />
                Sentiment Analysis
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className={`inline-block px-4 py-2 rounded-lg text-sm font-medium ${getSentimentColor(sentiment.sentiment_label)}`}>
                    {sentiment.sentiment_label.replace('_', ' ').toUpperCase()}
                  </span>
                  <div className="text-sm text-slate-600 mt-2">
                    Score: {sentiment.sentiment_score.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600 mb-1">Response Tone</div>
                  <div className="font-medium text-slate-900 capitalize">{sentiment.response_tone}</div>
                  <div className="text-sm text-slate-600 mt-2">
                    Urgency: <span className="font-medium capitalize">{sentiment.urgency_level}</span>
                  </div>
                </div>
              </div>

              {sentiment.key_phrases && sentiment.key_phrases.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-2">Key Phrases Detected:</div>
                  <div className="flex flex-wrap gap-2">
                    {sentiment.key_phrases.map((phrase: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                      >
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
              Recommended Next Actions
            </h3>

            <div className="space-y-3">
              {nextActions.map((action, idx) => {
                const Icon = getActionIcon(action.action_type);
                return (
                  <div
                    key={idx}
                    className="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start flex-1">
                        <Icon className="w-5 h-5 mr-3 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 mb-1">
                            {action.action_title}
                          </div>
                          <div className="text-sm text-slate-600 mb-2">
                            {action.action_description}
                          </div>
                          <div className="text-xs text-slate-500 italic">
                            {action.reasoning}
                          </div>
                          {action.suggested_content && (
                            <div className="text-xs text-blue-600 mt-2 bg-blue-50 px-3 py-2 rounded">
                              {action.suggested_content}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-lg font-bold text-orange-600">
                          {action.priority_score}
                        </div>
                        <div className="text-xs text-slate-500">Priority</div>
                        <div className="text-xs text-slate-600 mt-1">
                          {action.suggested_timing}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
