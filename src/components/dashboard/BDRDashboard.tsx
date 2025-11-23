import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  Pause,
  Settings,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Users,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  Target,
  BarChart3,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardSummary {
  active_prospects: number;
  pending_tasks: number;
  pending_approvals: number;
  pending_handoffs: number;
  today_emails_sent: number;
  today_replies_received: number;
  today_meetings_scheduled: number;
  week_response_rate: number;
  avg_qualification_score: number;
}

interface BDRAgentConfig {
  id: string;
  agent_name: string;
  is_active: boolean;
  auto_approve_messages: boolean;
  max_daily_touches: number;
  min_intent_score: number;
  preferred_channels: string[];
}

interface BDRTask {
  id: string;
  prospect_id: string;
  task_type: string;
  status: string;
  priority: number;
  scheduled_for: string;
  created_at: string;
}

interface BDRHandoff {
  id: string;
  prospect_id: string;
  handoff_type: string;
  priority: string;
  qualification_score: number;
  executive_summary: string;
  status: string;
  created_at: string;
}

interface BDRActivity {
  id: string;
  prospect_id: string;
  activity_type: string;
  channel: string;
  subject: string;
  message_preview: string;
  was_automated: boolean;
  created_at: string;
}

interface PerformanceMetrics {
  metric_date: string;
  emails_sent: number;
  replies_received: number;
  meetings_scheduled: number;
  email_response_rate: number;
  prospects_qualified: number;
  prospects_handed_off: number;
}

export function BDRDashboard() {
  const { profile } = useAuth();
  const [agentConfig, setAgentConfig] = useState<BDRAgentConfig | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tasks, setTasks] = useState<BDRTask[]>([]);
  const [handoffs, setHandoffs] = useState<BDRHandoff[]>([]);
  const [recentActivity, setRecentActivity] = useState<BDRActivity[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'handoffs' | 'activity' | 'settings'>('overview');

  useEffect(() => {
    if (profile?.team_id) {
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [profile?.team_id]);

  const loadDashboardData = async () => {
    if (!profile?.team_id) return;

    try {
      setLoading(true);

      // Load agent config
      const { data: configData } = await supabase
        .from('bdr_agent_configs')
        .select('*')
        .eq('team_id', profile.team_id)
        .eq('is_active', true)
        .single();

      if (configData) {
        setAgentConfig(configData);
      }

      // Load dashboard summary
      const { data: summaryData } = await supabase.rpc('get_bdr_dashboard_summary', {
        p_team_id: profile.team_id,
      });

      if (summaryData && summaryData.length > 0) {
        setSummary(summaryData[0]);
      }

      // Load pending tasks
      const { data: tasksData } = await supabase
        .from('bdr_tasks')
        .select('*')
        .eq('team_id', profile.team_id)
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .limit(10);

      if (tasksData) {
        setTasks(tasksData);
      }

      // Load pending handoffs
      const { data: handoffsData } = await supabase
        .from('bdr_handoffs')
        .select('*')
        .eq('team_id', profile.team_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);

      if (handoffsData) {
        setHandoffs(handoffsData);
      }

      // Load recent activity
      const { data: activityData } = await supabase
        .from('bdr_activities')
        .select('*')
        .eq('team_id', profile.team_id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (activityData) {
        setRecentActivity(activityData);
      }

      // Load performance metrics (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: metricsData } = await supabase
        .from('bdr_performance_metrics')
        .select('*')
        .eq('team_id', profile.team_id)
        .gte('metric_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('metric_date', { ascending: true });

      if (metricsData) {
        setPerformanceMetrics(metricsData);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAgentStatus = async () => {
    if (!agentConfig) return;

    try {
      const { error } = await supabase
        .from('bdr_agent_configs')
        .update({ is_active: !agentConfig.is_active })
        .eq('id', agentConfig.id);

      if (!error) {
        setAgentConfig({ ...agentConfig, is_active: !agentConfig.is_active });
      }
    } catch (error) {
      console.error('Failed to toggle agent status:', error);
    }
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'email_sent':
      case 'email_received':
      case 'email_opened':
      case 'email_clicked':
        return <Mail className="h-4 w-4" />;
      case 'linkedin_message':
      case 'linkedin_connection':
      case 'linkedin_view':
        return <MessageSquare className="h-4 w-4" />;
      case 'phone_call':
      case 'voicemail_left':
        return <Phone className="h-4 w-4" />;
      case 'meeting_scheduled':
      case 'meeting_completed':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getTaskTypeColor = (taskType: string) => {
    const colors = {
      discover: 'bg-blue-100 text-blue-800',
      research: 'bg-purple-100 text-purple-800',
      engage: 'bg-green-100 text-green-800',
      follow_up: 'bg-yellow-100 text-yellow-800',
      qualify: 'bg-orange-100 text-orange-800',
      handoff: 'bg-red-100 text-red-800',
    };
    return colors[taskType as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-600';
    if (priority >= 6) return 'text-orange-600';
    if (priority >= 4) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">BDR Agent Dashboard</h2>
          <p className="text-gray-600">
            Monitor and control your autonomous business development agent
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          {agentConfig && (
            <button
              onClick={toggleAgentStatus}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium ${
                agentConfig.is_active
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {agentConfig.is_active ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause Agent
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Agent
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Agent Status Card */}
      {agentConfig && (
        <div className={`p-6 rounded-lg border-2 ${
          agentConfig.is_active
            ? 'bg-green-50 border-green-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${
                agentConfig.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`} />
              <div>
                <h3 className="font-semibold text-lg">{agentConfig.agent_name}</h3>
                <p className="text-sm text-gray-600">
                  {agentConfig.is_active ? 'Active and monitoring prospects' : 'Paused'}
                </p>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <div className="text-gray-600">Daily Limit</div>
                <div className="font-semibold">{agentConfig.max_daily_touches} touches</div>
              </div>
              <div>
                <div className="text-gray-600">Min Intent</div>
                <div className="font-semibold">{agentConfig.min_intent_score}%</div>
              </div>
              <div>
                <div className="text-gray-600">Channels</div>
                <div className="font-semibold">{agentConfig.preferred_channels.join(', ')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Emails</p>
                <p className="text-2xl font-bold text-gray-900">{summary.today_emails_sent}</p>
                <p className="text-sm text-green-600">
                  {summary.today_replies_received} replies
                </p>
              </div>
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Meetings Booked</p>
                <p className="text-2xl font-bold text-gray-900">{summary.today_meetings_scheduled}</p>
                <p className="text-sm text-gray-600">Today</p>
              </div>
              <Calendar className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Response Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.week_response_rate?.toFixed(1) || 0}%
                </p>
                <p className="text-sm text-gray-600">Last 7 days</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Prospects</p>
                <p className="text-2xl font-bold text-gray-900">{summary.active_prospects}</p>
                <p className="text-sm text-gray-600">
                  Avg score: {summary.avg_qualification_score?.toFixed(0) || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {['overview', 'tasks', 'handoffs', 'activity', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-4 px-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Performance Chart */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">7-Day Performance</h3>
            <div className="space-y-4">
              {performanceMetrics.length > 0 ? (
                performanceMetrics.map((metric) => (
                  <div key={metric.metric_date} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-gray-600">
                      {new Date(metric.metric_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-gray-600">Emails</div>
                        <div className="font-semibold">{metric.emails_sent}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Replies</div>
                        <div className="font-semibold">{metric.replies_received}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Response Rate</div>
                        <div className="font-semibold">
                          {metric.email_response_rate?.toFixed(1) || 0}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Meetings</div>
                        <div className="font-semibold">{metric.meetings_scheduled}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No performance data available yet
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold">Pending Tasks</h4>
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary?.pending_tasks || 0}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="h-5 w-5 text-yellow-600" />
                <h4 className="font-semibold">Pending Approvals</h4>
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary?.pending_approvals || 0}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <Target className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold">Ready for Handoff</h4>
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary?.pending_handoffs || 0}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Task Queue</h3>
            {tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className={getPriorityColor(task.priority)}>
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getTaskTypeColor(
                              task.task_type
                            )}`}
                          >
                            {task.task_type.replace('_', ' ')}
                          </span>
                          <span className="text-sm text-gray-600">
                            Priority: {task.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {task.scheduled_for
                            ? `Scheduled for ${new Date(task.scheduled_for).toLocaleString()}`
                            : 'Ready to execute'}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(task.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No pending tasks</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'handoffs' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Sales Handoffs</h3>
            {handoffs.length > 0 ? (
              <div className="space-y-4">
                {handoffs.map((handoff) => (
                  <div
                    key={handoff.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            handoff.priority === 'urgent'
                              ? 'bg-red-100 text-red-800'
                              : handoff.priority === 'high'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {handoff.priority}
                        </span>
                        <span className="text-xs text-gray-600">{handoff.handoff_type}</span>
                      </div>
                      <div className="text-sm font-semibold text-green-600">
                        Score: {handoff.qualification_score}
                      </div>
                    </div>
                    <p className="text-sm text-gray-900 mb-2">{handoff.executive_summary}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{new Date(handoff.created_at).toLocaleDateString()}</span>
                      <button className="text-blue-600 hover:text-blue-700 font-medium">
                        View Details →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No pending handoffs</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="mt-1">{getActivityIcon(activity.activity_type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {activity.activity_type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">
                          via {activity.channel}
                        </span>
                        {activity.was_automated && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            Automated
                          </span>
                        )}
                      </div>
                      {activity.subject && (
                        <p className="text-sm text-gray-900 font-medium">{activity.subject}</p>
                      )}
                      {activity.message_preview && (
                        <p className="text-sm text-gray-600 truncate">{activity.message_preview}</p>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(activity.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No recent activity</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && agentConfig && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Agent Configuration</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={agentConfig.agent_name}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Daily Touches
                  </label>
                  <input
                    type="number"
                    value={agentConfig.max_daily_touches}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Intent Score
                  </label>
                  <input
                    type="number"
                    value={agentConfig.min_intent_score}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auto-Approve Messages
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={agentConfig.auto_approve_messages}
                      readOnly
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-gray-600">
                      {agentConfig.auto_approve_messages ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Channels
                </label>
                <div className="flex flex-wrap gap-2">
                  {agentConfig.preferred_channels.map((channel) => (
                    <span
                      key={channel}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pt-4">
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Settings className="h-4 w-4" />
                  Edit Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
