import React, { useState } from 'react';
import {
  Play,
  RefreshCw,
  Save,
  Download,
  TrendingUp,
  Zap,
  DollarSign,
  Clock,
  Award,
  Settings as SettingsIcon,
} from 'lucide-react';
import { routeAIRequest, type TaskType } from '../../lib/ai/modelRouter';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface ModelResult {
  provider: string;
  model: string;
  response: string;
  latency: number;
  cost: number;
  tokens: { input: number; output: number };
}

export default function AIPlayground() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('general');
  const [selectedProviders, setSelectedProviders] = useState({
    openai: true,
    claude: true,
    gemini: true,
  });
  const [results, setResults] = useState<ModelResult[]>([]);
  const [running, setRunning] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);

  const taskTypes: TaskType[] = [
    'general',
    'email-generation',
    'deep-research',
    'sentiment-analysis',
    'lead-scoring',
    'deal-analysis',
    'conversation-analysis',
    'company-research',
  ];

  const providerModels: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini'],
    claude: ['claude-3-5-sonnet', 'claude-3-haiku'],
    gemini: ['gemini-pro', 'gemini-flash'],
  };

  async function handleRunTest() {
    if (!prompt.trim() || !user?.team_id) {
      alert('Please enter a prompt');
      return;
    }

    setRunning(true);
    setResults([]);

    try {
      const testPromises: Promise<ModelResult>[] = [];

      // Run tests for selected providers
      Object.entries(selectedProviders).forEach(([provider, enabled]) => {
        if (enabled) {
          providerModels[provider].forEach(model => {
            testPromises.push(
              (async () => {
                try {
                  const startTime = Date.now();
                  const result = await routeAIRequest(prompt, {
                    systemPrompt: systemPrompt || undefined,
                    taskType,
                    teamId: user.team_id!,
                    fallbackEnabled: false,
                  });

                  return {
                    provider,
                    model,
                    response: result.response,
                    latency: Date.now() - startTime,
                    cost: result.cost,
                    tokens: {
                      input: result.usage.inputTokens,
                      output: result.usage.outputTokens,
                    },
                  };
                } catch (error: any) {
                  return {
                    provider,
                    model,
                    response: `Error: ${error.message}`,
                    latency: 0,
                    cost: 0,
                    tokens: { input: 0, output: 0 },
                  };
                }
              })()
            );
          });
        }
      });

      const testResults = await Promise.all(testPromises);
      setResults(testResults);

      // Save experiment to database
      await saveExperiment(testResults);
    } catch (error) {
      console.error('Test execution failed:', error);
      alert('Failed to run tests');
    } finally {
      setRunning(false);
    }
  }

  async function saveExperiment(testResults: ModelResult[]) {
    if (!user?.team_id || !user?.id) return;

    try {
      await supabase.from('ai_playground_experiments').insert({
        team_id: user.team_id,
        user_id: user.id,
        experiment_name: `Test: ${taskType}`,
        prompt,
        system_prompt: systemPrompt || null,
        models_tested: testResults,
      });
    } catch (error) {
      console.error('Error saving experiment:', error);
    }
  }

  function handleExportResults() {
    const data = {
      prompt,
      systemPrompt,
      taskType,
      temperature,
      maxTokens,
      results,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-playground-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const bestByLatency = results.length > 0
    ? results.reduce((best, curr) => (curr.latency < best.latency ? curr : best))
    : null;

  const bestByCost = results.length > 0
    ? results.reduce((best, curr) => (curr.cost < best.cost ? curr : best))
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Playground</h1>
          <p className="text-sm text-gray-600 mt-1">
            Test and compare different AI models side-by-side
          </p>
        </div>
        <div className="flex gap-3">
          {results.length > 0 && (
            <button
              onClick={handleExportResults}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export Results
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Configuration Panel */}
        <div className="col-span-4 space-y-4">
          {/* Task Type */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Task Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Type
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as TaskType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {taskTypes.map(type => (
                    <option key={type} value={type}>
                      {type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temperature
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Focused</span>
                  <span>{temperature}</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Select Providers</h3>
            <div className="space-y-2">
              {Object.keys(providerModels).map(provider => (
                <label key={provider} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProviders[provider as keyof typeof selectedProviders]}
                    onChange={(e) =>
                      setSelectedProviders({
                        ...selectedProviders,
                        [provider]: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{provider}</span>
                  <span className="text-xs text-gray-500">
                    ({providerModels[provider].length} models)
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Performance Summary */}
          {results.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Performance Summary</h3>
              <div className="space-y-2">
                {bestByLatency && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-600" />
                      <span className="text-gray-600">Fastest</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {bestByLatency.provider} ({bestByLatency.latency}ms)
                    </span>
                  </div>
                )}
                {bestByCost && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-gray-600">Cheapest</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {bestByCost.provider} (${bestByCost.cost.toFixed(4)})
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-gray-600">Total Cost</span>
                  <span className="font-medium text-gray-900">
                    ${results.reduce((sum, r) => sum + r.cost, 0).toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Testing Area */}
        <div className="col-span-8 space-y-4">
          {/* Prompts */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                System Prompt (Optional)
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant that..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
              />
            </div>

            <button
              onClick={handleRunTest}
              disabled={running || !prompt.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {running ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Run Test
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={`${result.provider}-${result.model}-${index}`}
                  className="bg-white p-4 rounded-lg border border-gray-200"
                >
                  {/* Result Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 capitalize">
                        {result.provider} - {result.model}
                      </h4>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {result.latency}ms
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ${result.cost.toFixed(6)}
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {result.tokens.input + result.tokens.output} tokens
                        </div>
                      </div>
                    </div>
                    {((bestByLatency && result === bestByLatency) ||
                      (bestByCost && result === bestByCost)) && (
                      <div className="flex gap-1">
                        {bestByLatency && result === bestByLatency && (
                          <span className="px-2 py-1 bg-yellow-50 text-yellow-700 text-xs font-medium rounded">
                            Fastest
                          </span>
                        )}
                        {bestByCost && result === bestByCost && (
                          <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded">
                            Cheapest
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Response */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {result.response}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && !running && (
            <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
              <SettingsIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No results yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Enter a prompt and click "Run Test" to compare models
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
