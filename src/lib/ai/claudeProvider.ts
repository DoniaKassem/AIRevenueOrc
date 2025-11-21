/**
 * Claude AI Provider (Anthropic)
 * Integration with Anthropic's Claude models
 */

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  id: string;
  content: Array<{ text: string; type: string }>;
  model: string;
  role: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

const CLAUDE_MODELS = {
  'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3-opus': 'claude-3-opus-20240229',
  'claude-3-sonnet': 'claude-3-sonnet-20240229',
  'claude-3-haiku': 'claude-3-haiku-20240307',
};

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Call Claude API with messages
 */
export async function callClaude(
  messages: ClaudeMessage[],
  config: ClaudeConfig
): Promise<{ response: string; usage: any; latency: number }> {
  const startTime = Date.now();

  const model = config.model || CLAUDE_MODELS['claude-3-5-sonnet'];
  const maxTokens = config.maxTokens || 4096;
  const temperature = config.temperature || 0.7;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages,
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Claude API error: ${error.error?.message || response.statusText}`);
    }

    const data: ClaudeResponse = await response.json();
    const text = data.content[0]?.text || '';

    return {
      response: text,
      usage: data.usage,
      latency,
    };
  } catch (error: any) {
    console.error('Claude API call failed:', error);
    throw error;
  }
}

/**
 * Generate text completion with Claude
 */
export async function generateClaudeCompletion(
  prompt: string,
  systemPrompt?: string,
  config?: Partial<ClaudeConfig>
): Promise<string> {
  const apiKey = config?.apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const messages: ClaudeMessage[] = [
    { role: 'user', content: prompt },
  ];

  // Add system prompt as first user message if provided
  if (systemPrompt) {
    messages.unshift({
      role: 'user',
      content: `System instructions: ${systemPrompt}\n\nNow, here's the actual request:`,
    });
  }

  const result = await callClaude(messages, {
    apiKey,
    model: config?.model,
    maxTokens: config?.maxTokens,
    temperature: config?.temperature,
  });

  return result.response;
}

/**
 * Analyze text with Claude
 */
export async function analyzeWithClaude(
  text: string,
  analysisType: 'sentiment' | 'summary' | 'key-points' | 'questions',
  config?: Partial<ClaudeConfig>
): Promise<string> {
  const prompts = {
    sentiment: `Analyze the sentiment of the following text and provide a detailed breakdown of the emotional tone, key themes, and overall sentiment (positive, negative, neutral, mixed):\n\n${text}`,
    summary: `Provide a concise summary of the following text, capturing the main points and key takeaways:\n\n${text}`,
    'key-points': `Extract the key points and main ideas from the following text as a bullet list:\n\n${text}`,
    questions: `Generate insightful questions that could be asked based on the following text:\n\n${text}`,
  };

  return generateClaudeCompletion(prompts[analysisType], undefined, config);
}

/**
 * Generate structured output with Claude
 */
export async function generateStructuredClaude<T>(
  prompt: string,
  schema: string,
  config?: Partial<ClaudeConfig>
): Promise<T> {
  const systemPrompt = `You are a helpful assistant that always responds with valid JSON matching this schema: ${schema}`;

  const response = await generateClaudeCompletion(prompt, systemPrompt, config);

  try {
    // Extract JSON from response (Claude sometimes wraps it in markdown)
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse Claude JSON response:', error);
    throw new Error('Invalid JSON response from Claude');
  }
}

/**
 * Stream Claude responses (for real-time chat)
 */
export async function* streamClaude(
  messages: ClaudeMessage[],
  config: ClaudeConfig
): AsyncGenerator<string, void, unknown> {
  const model = config.model || CLAUDE_MODELS['claude-3-5-sonnet'];
  const maxTokens = config.maxTokens || 4096;
  const temperature = config.temperature || 0.7;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield parsed.delta.text;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('Claude streaming failed:', error);
    throw error;
  }
}

/**
 * Get available Claude models
 */
export function getClaudeModels() {
  return [
    {
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Most capable model, best for complex analysis and reasoning',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      description: 'Powerful model for challenging tasks',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.015, output: 0.075 },
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      description: 'Balanced performance and speed',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
    },
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      description: 'Fast and cost-effective for simpler tasks',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.00025, output: 0.00125 },
    },
  ];
}

/**
 * Calculate cost for Claude API call
 */
export function calculateClaudeCost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'claude-3-5-sonnet'
): number {
  const models = getClaudeModels();
  const modelConfig = models.find(m => m.id === model);

  if (!modelConfig) {
    return 0;
  }

  const inputCost = (inputTokens / 1000) * modelConfig.costPer1kTokens.input;
  const outputCost = (outputTokens / 1000) * modelConfig.costPer1kTokens.output;

  return inputCost + outputCost;
}
