import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Brain,
  Zap,
  Play,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface AgentExecution {
  id: string;
  agent_type: string;
  status: string;
  results: any;
  created_at: string;
}

export default function AIAgentsView() {
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);

  const agents = [
    {
      id: 'prioritize',
      name: 'Buyer Prioritization',
      description: 'Automatically score and rank prospects based on engagement signals and profile data',
      icon: TrendingUp,
      color: 'blue',
      action: 'Prioritize All Prospects',
    },
    {
      id: 'deal-analyzer',
      name: 'Deal Risk Analysis',
      description: 'Identify at-risk deals and provide recommendations to keep them on track',
      icon: Target,
      color: 'red',
      action: 'Analyze All Deals',
    },
    {
      id: 'conversation-analyzer',
      name: 'Conversation Intelligence',
      description: 'Extract insights, action items, and MEDDPICC from call recordings',
      icon: Brain,
      color: 'purple',
      action: 'Analyze Conversations',
    },
    {
      id: 'next-best-action',
      name: 'Next Best Action',
      description: 'Recommend the optimal next step for each prospect based on engagement history',
      icon: Zap,
      color: 'green',
      action: 'Generate Actions',
    },
    {
      id: 'forecasting',
      name: 'Revenue Forecasting',
      description: 'Predict quarterly outcomes based on pipeline health and historical patterns',
      icon: TrendingUp,
      color: 'cyan',
      action: 'Run Forecast',
    },
    {
      id: 'account-insights',
      name: 'Account Research',
      description: 'Enrich account data with market intelligence and buying signals',
      icon: Users,
      color: 'orange',
      action: 'Research Accounts',
    },
  ];

  useEffect(() => {
    loadRecentExecutions();
  }, []);

  async function loadRecentExecutions() {
    try {
      const { data, error } = await supabase
        .from('ai_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setExecutions(data || []);
    } catch (error) {
      console.error('Error loading executions:', error);
    }
  }

  async function runAgent(agentId: string) {
    setLoading(true);
    setActiveAgent(agentId);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (agentId === 'prioritize') {
        const { data: prospects } = await supabase
          .from('prospects')
          .select('id')
          .limit(100);

        if (prospects && prospects.length > 0) {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/ai-prioritize`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                prospect_ids: prospects.map((p) => p.id),
                use_ai: true,
              }),
            }
          );

          const result = await response.json();
          console.log('Prioritization result:', result);
        }
      } else if (agentId === 'deal-analyzer') {
        const { data: deals } = await supabase
          .from('deals')
          .select('id')
          .not('stage', 'in', '(closed_won,closed_lost)')
          .limit(50);

        if (deals && deals.length > 0) {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/ai-deal-analyzer`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                deal_ids: deals.map((d) => d.id),
                use_ai: true,
              }),
            }
          );

          const result = await response.json();
          console.log('Deal analysis result:', result);
        }
      }

      await loadRecentExecutions();
    } catch (error) {
      console.error('Error running agent:', error);
    } finally {
      setLoading(false);
      setActiveAgent(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">AI Agents</h1>
        <p className="text-slate-600 mt-1">
          Autonomous agents that work around the clock to optimize your revenue operations
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`bg-${agent.color}-100 p-3 rounded-lg`}>
                <agent.icon className={`w-6 h-6 text-${agent.color}-600`} />
              </div>
              {activeAgent === agent.id && (
                <div className="animate-pulse">
                  <div className="w-2 h-2 bg-green-600 rounded-full" />
                </div>
              )}
            </div>

            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {agent.name}
            </h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {agent.description}
            </p>

            <button
              onClick={() => runAgent(agent.id)}
              disabled={loading}
              className={`w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg transition ${
                loading && activeAgent === agent.id
                  ? 'bg-slate-300 cursor-not-allowed'
                  : `bg-${agent.color}-600 hover:bg-${agent.color}-700 text-white`
              }`}
            >
              {loading && activeAgent === agent.id ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>{agent.action}</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Agent Activity
          </h2>
        </div>

        <div className="divide-y divide-slate-200">
          {executions.length === 0 ? (
            <div className="p-12 text-center">
              <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                No agent activity yet
              </h3>
              <p className="text-slate-600">
                Run an agent to see AI-powered insights and recommendations
              </p>
            </div>
          ) : (
            executions.map((execution) => (
              <div key={execution.id} className="p-6 hover:bg-slate-50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-slate-900 capitalize">
                        {execution.prediction_type?.replace('_', ' ')}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          execution.score > 70
                            ? 'bg-green-100 text-green-700'
                            : execution.score > 40
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        Score: {Math.round(execution.score)}
                      </span>
                    </div>

                    {execution.reasoning?.summary && (
                      <p className="text-sm text-slate-700 mb-3">
                        {execution.reasoning.summary}
                      </p>
                    )}

                    {execution.reasoning?.next_steps &&
                      execution.reasoning.next_steps.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-slate-600 mb-2">
                            Recommended Actions:
                          </p>
                          <ul className="space-y-1">
                            {execution.reasoning.next_steps
                              .slice(0, 3)
                              .map((step: string, idx: number) => (
                                <li
                                  key={idx}
                                  className="flex items-start space-x-2 text-sm text-slate-600"
                                >
                                  <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                                  <span>{step}</span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}

                    {execution.reasoning?.gaps &&
                      execution.reasoning.gaps.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {execution.reasoning.gaps.map(
                            (gap: string, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 rounded text-xs"
                              >
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {gap}
                              </span>
                            )
                          )}
                        </div>
                      )}
                  </div>

                  <div className="text-right ml-4">
                    <p className="text-xs text-slate-500">
                      {new Date(execution.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(execution.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
