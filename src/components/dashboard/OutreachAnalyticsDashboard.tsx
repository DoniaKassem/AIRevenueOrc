/**
 * Outreach Analytics Dashboard
 * Comprehensive performance visualization for BDR outreach
 */

import React, { useState, useEffect } from 'react';
import {
  createAnalyticsService,
  CampaignPerformance,
  ChannelPerformance,
  TemplatePerformance,
  AgentPerformance,
  ResponseTrend,
  SendTimeAnalysis,
  ObjectionAnalysis,
  OutreachROI,
} from '@/lib/outreach/analyticsService';

interface OutreachAnalyticsDashboardProps {
  teamId: string;
  daysBack?: number;
}

export function OutreachAnalyticsDashboard({ teamId, daysBack = 30 }: OutreachAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for all analytics data
  const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([]);
  const [channels, setChannels] = useState<ChannelPerformance[]>([]);
  const [templates, setTemplates] = useState<TemplatePerformance[]>([]);
  const [agentPerf, setAgentPerf] = useState<AgentPerformance | null>(null);
  const [trends, setTrends] = useState<ResponseTrend[]>([]);
  const [sendTimes, setSendTimes] = useState<SendTimeAnalysis[]>([]);
  const [objections, setObjections] = useState<ObjectionAnalysis[]>([]);
  const [roi, setROI] = useState<OutreachROI | null>(null);

  const [selectedTab, setSelectedTab] = useState<'overview' | 'campaigns' | 'channels' | 'templates' | 'agent' | 'roi'>('overview');

  const analyticsService = createAnalyticsService(teamId);

  // Load all data
  useEffect(() => {
    loadAnalytics();
  }, [teamId, daysBack]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError(null);

      const [
        campaignData,
        channelData,
        templateData,
        agentData,
        trendData,
        sendTimeData,
        objectionData,
      ] = await Promise.all([
        analyticsService.getCampaignPerformance(daysBack),
        analyticsService.getChannelPerformance(daysBack),
        analyticsService.getTemplatePerformance(10),
        analyticsService.getAgentPerformance(daysBack),
        analyticsService.getResponseTrends(daysBack),
        analyticsService.getSendTimeAnalysis(),
        analyticsService.getObjectionAnalysis(daysBack),
      ]);

      setCampaigns(campaignData);
      setChannels(channelData);
      setTemplates(templateData);
      setAgentPerf(agentData);
      setTrends(trendData);
      setSendTimes(sendTimeData);
      setObjections(objectionData);

      // Calculate ROI with placeholder values
      const roiData = await analyticsService.calculateROI({
        toolCosts: 500,
        hourlyRate: 50,
        hoursInvested: 40,
        dataEnrichmentCost: 200,
        avgDealSize: 50000,
        closedWonCount: 2,
        pipelineCount: 10,
      });
      setROI(roiData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={loadAnalytics}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Outreach Analytics</h1>
          <p className="text-gray-600">Performance metrics for the last {daysBack} days</p>
        </div>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'campaigns', label: 'Campaigns' },
            { id: 'channels', label: 'Channels' },
            { id: 'templates', label: 'Templates' },
            { id: 'agent', label: 'BDR Agent' },
            { id: 'roi', label: 'ROI' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {selectedTab === 'overview' && (
          <OverviewTab
            campaigns={campaigns}
            channels={channels}
            agentPerf={agentPerf}
            trends={trends}
            objections={objections}
          />
        )}
        {selectedTab === 'campaigns' && <CampaignsTab campaigns={campaigns} />}
        {selectedTab === 'channels' && <ChannelsTab channels={channels} sendTimes={sendTimes} />}
        {selectedTab === 'templates' && <TemplatesTab templates={templates} />}
        {selectedTab === 'agent' && <AgentTab agentPerf={agentPerf} objections={objections} />}
        {selectedTab === 'roi' && <ROITab roi={roi} />}
      </div>
    </div>
  );
}

/* ==================== Overview Tab ==================== */

function OverviewTab({
  campaigns,
  channels,
  agentPerf,
  trends,
  objections,
}: {
  campaigns: CampaignPerformance[];
  channels: ChannelPerformance[];
  agentPerf: AgentPerformance | null;
  trends: ResponseTrend[];
  objections: ObjectionAnalysis[];
}) {
  // Calculate totals
  const totalProspects = campaigns.reduce((sum, c) => sum + c.prospectsEnrolled, 0);
  const totalTouches = channels.reduce((sum, c) => sum + c.totalSent, 0);
  const totalReplies = channels.reduce((sum, c) => sum + c.totalReplied, 0);
  const totalMeetings = channels.reduce((sum, c) => sum + c.meetingsScheduled, 0);
  const avgReplyRate = totalTouches > 0 ? (totalReplies / totalTouches) * 100 : 0;
  const avgMeetingRate = totalTouches > 0 ? (totalMeetings / totalTouches) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Prospects Contacted"
          value={totalProspects}
          subtitle={`${totalTouches} total touches`}
          icon="👥"
        />
        <MetricCard
          title="Reply Rate"
          value={`${avgReplyRate.toFixed(1)}%`}
          subtitle={`${totalReplies} replies`}
          icon="💬"
          trend={channels[0]?.replyRateTrend}
        />
        <MetricCard
          title="Meeting Rate"
          value={`${avgMeetingRate.toFixed(1)}%`}
          subtitle={`${totalMeetings} meetings booked`}
          icon="📅"
          trend={channels[0]?.meetingRateTrend}
        />
        <MetricCard
          title="Automation Rate"
          value={agentPerf ? `${agentPerf.automatedResponsesRate.toFixed(0)}%` : 'N/A'}
          subtitle={agentPerf ? `${agentPerf.totalRepliesProcessed} replies processed` : ''}
          icon="🤖"
        />
      </div>

      {/* Channel Performance Comparison */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Channel Performance</h3>
        <div className="space-y-4">
          {channels.map(channel => (
            <div key={channel.channel} className="flex items-center">
              <div className="w-24 font-medium capitalize">{channel.channel}</div>
              <div className="flex-1">
                <div className="flex items-center space-x-4">
                  <ProgressBar
                    label="Reply Rate"
                    value={channel.replyRate}
                    max={10}
                    color="blue"
                  />
                  <ProgressBar
                    label="Meeting Rate"
                    value={channel.meetingRate}
                    max={5}
                    color="green"
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {channel.totalSent} sent
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Response Trend Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Response Trends</h3>
        <TrendChart trends={trends} />
      </div>

      {/* Top Objections */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Top Objections</h3>
        <div className="space-y-3">
          {objections.slice(0, 5).map(obj => (
            <div key={obj.objectionType} className="flex items-center justify-between">
              <div>
                <div className="font-medium capitalize">{obj.objectionType.replace(/_/g, ' ')}</div>
                <div className="text-sm text-gray-600">
                  {obj.handledSuccessfully}/{obj.count} handled successfully
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{obj.percentage.toFixed(0)}%</div>
                <div className="text-sm text-gray-600">{obj.count} total</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==================== Campaigns Tab ==================== */

function CampaignsTab({ campaigns }: { campaigns: CampaignPerformance[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strategy</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prospects</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Touches</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reply Rate</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Meeting Rate</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Meetings</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {campaigns.map(campaign => (
              <tr key={campaign.campaignId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{campaign.campaignName}</div>
                  <div className="text-sm text-gray-500">{new Date(campaign.startedAt).toLocaleDateString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                    {campaign.strategy}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {campaign.prospectsEnrolled}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {campaign.totalTouches}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-gray-900">{campaign.replyRate.toFixed(1)}%</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-gray-900">{campaign.meetingRate.toFixed(1)}%</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {campaign.meetingsScheduled}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      campaign.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {campaign.isActive ? 'Active' : 'Paused'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No campaigns found for the selected period.</p>
        </div>
      )}
    </div>
  );
}

/* ==================== Channels Tab ==================== */

function ChannelsTab({ channels, sendTimes }: { channels: ChannelPerformance[]; sendTimes: SendTimeAnalysis[] }) {
  return (
    <div className="space-y-6">
      {/* Channel Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {channels.map(channel => (
          <div key={channel.channel} className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 capitalize">{channel.channel}</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Delivery Rate</span>
                  <span className="text-sm font-medium">{channel.deliveryRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${channel.deliveryRate}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Open Rate</span>
                  <span className="text-sm font-medium">{channel.openRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, channel.openRate * 2)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Reply Rate</span>
                  <span className="text-sm font-medium">{channel.replyRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, channel.replyRate * 5)}%` }}
                  ></div>
                </div>
                {channel.replyRateTrend !== 0 && (
                  <div className={`text-xs mt-1 ${channel.replyRateTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {channel.replyRateTrend > 0 ? '↑' : '↓'} {Math.abs(channel.replyRateTrend).toFixed(0)}% vs previous period
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Sent</span>
                  <span className="font-medium">{channel.totalSent}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Meetings</span>
                  <span className="font-medium">{channel.meetingsScheduled}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Best Send Times */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Best Send Times</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sendTimes
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
            .map((time, idx) => (
              <div key={`${time.dayOfWeek}-${time.hour}`} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{time.dayOfWeek}</span>
                  {idx < 3 && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Top {idx + 1}</span>}
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {time.hour}:00
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {time.replyRate.toFixed(1)}% reply rate
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ==================== Templates Tab ==================== */

function TemplatesTab({ templates }: { templates: TemplatePerformance[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Template Performance Leaderboard</h3>
        <p className="text-sm text-gray-600 mt-1">Top performing templates ranked by reply rate</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Times Sent</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Open Rate</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reply Rate</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Meeting Rate</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Time to Reply</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {templates.map((template, idx) => (
              <tr key={template.templateId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {idx < 3 && (
                      <span className="text-2xl mr-2">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-900">#{idx + 1}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{template.templateName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    {template.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {template.timesSent}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-gray-900">{template.openRate.toFixed(1)}%</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-green-600">{template.replyRate.toFixed(1)}%</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-medium text-blue-600">{template.meetingRate.toFixed(1)}%</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {template.avgTimeToReply ? `${template.avgTimeToReply.toFixed(0)}h` : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No template performance data available.</p>
        </div>
      )}
    </div>
  );
}

/* ==================== Agent Tab ==================== */

function AgentTab({ agentPerf, objections }: { agentPerf: AgentPerformance | null; objections: ObjectionAnalysis[] }) {
  if (!agentPerf) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No BDR agent performance data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agent KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Prospects Contacted"
          value={agentPerf.totalProspectsContacted}
          subtitle={`${agentPerf.totalTouches} total touches`}
          icon="🎯"
        />
        <MetricCard
          title="Replies Processed"
          value={agentPerf.totalRepliesProcessed}
          subtitle={`${agentPerf.avgResponseTime}min avg response time`}
          icon="⚡"
        />
        <MetricCard
          title="Automation Rate"
          value={`${agentPerf.automatedResponsesRate.toFixed(0)}%`}
          subtitle={`${agentPerf.humanEscalationRate.toFixed(0)}% escalated to human`}
          icon="🤖"
        />
        <MetricCard
          title="Avg Confidence"
          value={`${agentPerf.avgConfidence.toFixed(0)}%`}
          subtitle="AI decision confidence"
          icon="🎓"
        />
      </div>

      {/* Routing Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Reply Routing Distribution</h3>
        <div className="space-y-3">
          {Object.entries(agentPerf.routingBreakdown).map(([route, count]) => {
            const total = Object.values(agentPerf.routingBreakdown).reduce((sum, c) => sum + c, 0);
            const percentage = total > 0 ? (count / total) * 100 : 0;

            return (
              <div key={route} className="flex items-center">
                <div className="w-40 text-sm font-medium capitalize">{route.replace(/_/g, ' ')}</div>
                <div className="flex-1">
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-6 mr-3">
                      <div
                        className="bg-blue-600 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 10 && `${percentage.toFixed(0)}%`}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 w-12 text-right">{count}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Success Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Objection Handling</h3>
          <div className="text-center">
            <div className="text-5xl font-bold text-green-600 mb-2">
              {agentPerf.objectionHandlingSuccessRate.toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Meeting Scheduling</h3>
          <div className="text-center">
            <div className="text-5xl font-bold text-blue-600 mb-2">
              {agentPerf.meetingSchedulingSuccessRate.toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
        </div>
      </div>

      {/* Objection Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Objection Breakdown</h3>
        <div className="space-y-4">
          {objections.map(obj => (
            <div key={obj.objectionType} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium capitalize">{obj.objectionType.replace(/_/g, ' ')}</div>
                <div className="text-sm text-gray-600">{obj.count} occurrences ({obj.percentage.toFixed(0)}%)</div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                <div>
                  <span className="text-gray-600">Soft:</span> <span className="font-medium">{obj.severity.soft}</span>
                </div>
                <div>
                  <span className="text-gray-600">Medium:</span> <span className="font-medium">{obj.severity.medium}</span>
                </div>
                <div>
                  <span className="text-gray-600">Hard:</span> <span className="font-medium">{obj.severity.hard}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-green-600">
                  ✓ {obj.handledSuccessfully} handled successfully
                </div>
                <div className="text-orange-600">
                  ↑ {obj.escalatedToHuman} escalated to human
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==================== ROI Tab ==================== */

function ROITab({ roi }: { roi: OutreachROI | null }) {
  if (!roi) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No ROI data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ROI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-2">Total Investment</div>
          <div className="text-3xl font-bold text-gray-900">
            ${roi.totalCost.toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-2">Total Revenue</div>
          <div className="text-3xl font-bold text-green-600">
            ${roi.totalRevenue.toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-sm text-gray-600 mb-2">ROI</div>
          <div className={`text-3xl font-bold ${roi.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {roi.roi > 0 ? '+' : ''}{roi.roi.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Tool Subscriptions</span>
            <span className="font-medium">${roi.costBreakdown.toolSubscriptions.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Time Invested</span>
            <span className="font-medium">${roi.costBreakdown.timeInvested.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Data Enrichment</span>
            <span className="font-medium">${roi.costBreakdown.dataEnrichment.toLocaleString()}</span>
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between items-center font-semibold">
            <span>Total Cost</span>
            <span>${roi.totalCost.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Breakdown</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Closed Won</span>
            <span className="font-medium text-green-600">${roi.revenueBreakdown.closedWonRevenue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Pipeline (Weighted)</span>
            <span className="font-medium">${roi.revenueBreakdown.pipelineGenerated.toLocaleString()}</span>
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between items-center font-semibold">
            <span>Expected Revenue</span>
            <span className="text-green-600">${roi.revenueBreakdown.expectedRevenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Unit Economics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Unit Economics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Cost per Prospect</div>
            <div className="text-2xl font-bold text-gray-900">
              ${roi.metrics.costPerProspect.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Cost per Meeting</div>
            <div className="text-2xl font-bold text-gray-900">
              ${roi.metrics.costPerMeeting.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Cost per Opportunity</div>
            <div className="text-2xl font-bold text-gray-900">
              ${roi.metrics.costPerOpportunity.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Revenue per Prospect</div>
            <div className="text-2xl font-bold text-green-600">
              ${roi.metrics.revenuePerProspect.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== Reusable Components ==================== */

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: number;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">{title}</div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      {subtitle && <div className="text-sm text-gray-600">{subtitle}</div>}
      {trend !== undefined && trend !== 0 && (
        <div className={`text-xs mt-2 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(0)}% vs previous period
        </div>
      )}
    </div>
  );
}

function ProgressBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: 'blue' | 'green' | 'purple';
}) {
  const percentage = Math.min(100, (value / max) * 100);
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
  };

  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span>{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${colorClasses[color]} h-2 rounded-full`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

function TrendChart({ trends }: { trends: ResponseTrend[] }) {
  if (trends.length === 0) {
    return <div className="text-center text-gray-500 py-8">No trend data available</div>;
  }

  // Simple text-based chart
  const maxReplyRate = Math.max(...trends.map(t => t.replyRate), 10);

  return (
    <div className="space-y-2">
      {trends.slice(-14).map(trend => {
        const barWidth = (trend.replyRate / maxReplyRate) * 100;
        return (
          <div key={trend.date} className="flex items-center text-sm">
            <div className="w-24 text-gray-600">{new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            <div className="flex-1 flex items-center">
              <div className="flex-1 bg-gray-200 rounded-full h-6 mr-3">
                <div
                  className="bg-blue-600 h-6 rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium"
                  style={{ width: `${barWidth}%` }}
                >
                  {barWidth > 15 && `${trend.replyRate.toFixed(1)}%`}
                </div>
              </div>
              <div className="text-gray-600 w-20 text-right">
                {trend.totalReplies} / {trend.totalSent}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
