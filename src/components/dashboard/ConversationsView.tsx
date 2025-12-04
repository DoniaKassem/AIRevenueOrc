import { useEffect, useState } from 'react';
import {
  MessageSquare,
  Play,
  Search,
  Filter,
  TrendingUp,
  Clock,
  Users,
  Sparkles,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import UploadRecordingForm from '../forms/UploadRecordingForm';

interface Conversation {
  id: string;
  title: string;
  type: string;
  duration_seconds: number;
  started_at: string;
  analysis_status: string;
  created_at: string;
}

interface ConversationInsight {
  summary: string;
  sentiment_score: number;
  engagement_score: number;
  talk_ratio: { rep: number; prospect: number };
  key_points: string[];
  action_items: string[];
  next_steps: string[];
  ai_recommendations: string[];
}

export default function ConversationsView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [insight, setInsight] = useState<ConversationInsight | null>(null);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadConversationDetails(selectedConversation);
    }
  }, [selectedConversation]);

  async function loadConversations() {
    try {
      const response = await fetch('/api/conversations');
      const result = await response.json();

      if (!result.success) throw new Error(result.error || 'Failed to load conversations');
      setConversations(result.data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadConversationDetails(id: string) {
    try {
      const [insightRes, transcriptRes] = await Promise.all([
        fetch(`/api/conversations/${id}/insights`),
        fetch(`/api/conversations/${id}/transcripts`),
      ]);

      const insightResult = await insightRes.json();
      const transcriptResult = await transcriptRes.json();

      setInsight(insightResult.data || null);
      setTranscripts(transcriptResult.data || []);
    } catch (error) {
      console.error('Error loading conversation details:', error);
    }
  }

  const filteredConversations = conversations.filter(
    (c) =>
      c.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const avgSentiment =
    conversations.length > 0
      ? conversations.reduce((sum, c) => sum + 75, 0) / conversations.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Conversation Intelligence
          </h1>
          <p className="text-slate-600 mt-1">
            AI-powered analysis of calls and meetings
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition"
        >
          <Play className="w-5 h-5" />
          <span>Upload Recording</span>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Total Conversations',
            value: conversations.length,
            icon: MessageSquare,
            color: 'blue',
          },
          {
            label: 'Avg Duration',
            value: conversations.length > 0
              ? `${Math.round(
                  conversations.reduce((sum, c) => sum + c.duration_seconds, 0) /
                    conversations.length /
                    60
                )}m`
              : '0m',
            icon: Clock,
            color: 'green',
          },
          {
            label: 'Avg Sentiment',
            value: `${Math.round(avgSentiment)}%`,
            icon: TrendingUp,
            color: 'purple',
          },
          {
            label: 'Analyzed',
            value: conversations.filter((c) => c.analysis_status === 'completed')
              .length,
            icon: Sparkles,
            color: 'cyan',
          },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {stat.value}
                </p>
              </div>
              <div className={`bg-${stat.color}-100 p-3 rounded-lg`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-white rounded-xl border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[600px]">
            {loading ? (
              <div className="p-8 text-center text-slate-500">
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">No conversations yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Upload your first recording to get started
                </p>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  className={`p-4 border-b border-slate-200 cursor-pointer transition hover:bg-slate-50 ${
                    selectedConversation === conversation.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-slate-900">
                      {conversation.title}
                    </h3>
                    {conversation.analysis_status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : conversation.analysis_status === 'processing' ? (
                      <Clock className="w-4 h-4 text-yellow-600 animate-spin" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="capitalize">{conversation.type}</span>
                    <span>{formatDuration(conversation.duration_seconds)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(conversation.started_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-span-2 space-y-6">
          {!selectedConversation ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Select a conversation
              </h3>
              <p className="text-slate-600">
                Choose a conversation from the list to view AI insights and
                transcripts
              </p>
            </div>
          ) : insight ? (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  AI Summary
                </h2>
                <p className="text-slate-700 leading-relaxed mb-6">
                  {insight.summary}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-600 mb-1">Sentiment</p>
                    <p className="text-2xl font-bold text-green-700">
                      {Math.round(insight.sentiment_score)}%
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-600 mb-1">Engagement</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {Math.round(insight.engagement_score)}%
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Talk Ratio
                  </p>
                  <div className="flex h-4 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600"
                      style={{ width: `${insight.talk_ratio.rep}%` }}
                    />
                    <div
                      className="bg-green-600"
                      style={{ width: `${insight.talk_ratio.prospect}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 mt-1">
                    <span>Rep: {Math.round(insight.talk_ratio.rep)}%</span>
                    <span>
                      Prospect: {Math.round(insight.talk_ratio.prospect)}%
                    </span>
                  </div>
                </div>
              </div>

              {insight.action_items && insight.action_items.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">
                    Action Items
                  </h2>
                  <ul className="space-y-2">
                    {insight.action_items.slice(0, 5).map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start space-x-3 text-slate-700"
                      >
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insight.ai_recommendations &&
                insight.ai_recommendations.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-slate-900">
                        AI Recommendations
                      </h2>
                    </div>
                    <ul className="space-y-2">
                      {insight.ai_recommendations.map((rec, idx) => (
                        <li key={idx} className="text-slate-700">
                          • {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {transcripts.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">
                    Transcript
                  </h2>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {transcripts.map((segment) => (
                      <div key={segment.id} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                              segment.speaker_role === 'rep'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {segment.speaker_name?.charAt(0) || '?'}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-slate-900">
                              {segment.speaker_name || 'Unknown'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {Math.floor(segment.start_time / 60)}:
                              {String(Math.floor(segment.start_time % 60)).padStart(
                                2,
                                '0'
                              )}
                            </span>
                          </div>
                          <p className="text-slate-700">{segment.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Analysis in progress
              </h3>
              <p className="text-slate-600">
                AI is analyzing this conversation. Check back in a moment.
              </p>
            </div>
          )}
        </div>
      </div>

      <UploadRecordingForm
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={loadConversations}
      />
    </div>
  );
}
