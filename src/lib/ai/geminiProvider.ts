/**
 * Gemini AI Provider (Google)
 * Integration with Google's Gemini models
 */

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    safetyRatings: any[];
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

const GEMINI_MODELS = {
  'gemini-pro': 'gemini-1.5-pro-latest',
  'gemini-flash': 'gemini-1.5-flash-latest',
  'gemini-pro-vision': 'gemini-1.5-pro-vision-latest',
};

/**
 * Call Gemini API
 */
export async function callGemini(
  messages: GeminiMessage[],
  config: GeminiConfig
): Promise<{ response: string; usage: any; latency: number }> {
  const startTime = Date.now();

  const model = config.model || GEMINI_MODELS['gemini-pro'];
  const temperature = config.temperature || 0.7;
  const maxTokens = config.maxTokens || 8192;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: messages.map(msg => ({
          role: msg.role,
          parts: msg.parts,
        })),
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data: GeminiResponse = await response.json();
    const text = data.candidates[0]?.content?.parts[0]?.text || '';

    return {
      response: text,
      usage: data.usageMetadata,
      latency,
    };
  } catch (error: any) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
}

/**
 * Generate text completion with Gemini
 */
export async function generateGeminiCompletion(
  prompt: string,
  systemPrompt?: string,
  config?: Partial<GeminiConfig>
): Promise<string> {
  const apiKey = config?.apiKey || import.meta.env.VITE_GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error('Google API key not configured');
  }

  const messages: GeminiMessage[] = [];

  // Add system prompt as first message if provided
  if (systemPrompt) {
    messages.push({
      role: 'user',
      parts: [{ text: systemPrompt }],
    });
    messages.push({
      role: 'model',
      parts: [{ text: 'Understood. I will follow these instructions.' }],
    });
  }

  messages.push({
    role: 'user',
    parts: [{ text: prompt }],
  });

  const result = await callGemini(messages, {
    apiKey,
    model: config?.model,
    temperature: config?.temperature,
    maxTokens: config?.maxTokens,
  });

  return result.response;
}

/**
 * Analyze image with Gemini (multimodal)
 */
export async function analyzeImageWithGemini(
  imageUrl: string,
  prompt: string,
  config?: Partial<GeminiConfig>
): Promise<string> {
  const apiKey = config?.apiKey || import.meta.env.VITE_GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error('Google API key not configured');
  }

  // For vision tasks, use the vision model
  const model = GEMINI_MODELS['gemini-pro-vision'];
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    // Fetch image and convert to base64
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const base64Image = await blobToBase64(imageBlob);
    const base64Data = base64Image.split(',')[1]; // Remove data:image/...;base64, prefix

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imageBlob.type,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini Vision API error: ${error.error?.message || response.statusText}`);
    }

    const data: GeminiResponse = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || '';
  } catch (error: any) {
    console.error('Gemini image analysis failed:', error);
    throw error;
  }
}

/**
 * Generate structured output with Gemini
 */
export async function generateStructuredGemini<T>(
  prompt: string,
  schema: string,
  config?: Partial<GeminiConfig>
): Promise<T> {
  const systemPrompt = `You are a helpful assistant that always responds with valid JSON matching this schema: ${schema}. Only output the JSON, no additional text.`;

  const response = await generateGeminiCompletion(prompt, systemPrompt, config);

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse Gemini JSON response:', error);
    throw new Error('Invalid JSON response from Gemini');
  }
}

/**
 * Stream Gemini responses
 */
export async function* streamGemini(
  messages: GeminiMessage[],
  config: GeminiConfig
): AsyncGenerator<string, void, unknown> {
  const model = config.model || GEMINI_MODELS['gemini-pro'];
  const temperature = config.temperature || 0.7;
  const maxTokens = config.maxTokens || 8192;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${config.apiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: messages.map(msg => ({
          role: msg.role,
          parts: msg.parts,
        })),
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
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
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield text;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('Gemini streaming failed:', error);
    throw error;
  }
}

/**
 * Get available Gemini models
 */
export function getGeminiModels() {
  return [
    {
      id: 'gemini-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Most capable model with large context window',
      contextWindow: 2000000,
      costPer1kTokens: { input: 0.00125, output: 0.00375 },
      supportsVision: false,
    },
    {
      id: 'gemini-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Fast and efficient model for most tasks',
      contextWindow: 1000000,
      costPer1kTokens: { input: 0.000075, output: 0.0003 },
      supportsVision: false,
    },
    {
      id: 'gemini-pro-vision',
      name: 'Gemini 1.5 Pro Vision',
      description: 'Multimodal model for image and text analysis',
      contextWindow: 2000000,
      costPer1kTokens: { input: 0.00125, output: 0.00375 },
      supportsVision: true,
    },
  ];
}

/**
 * Calculate cost for Gemini API call
 */
export function calculateGeminiCost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'gemini-pro'
): number {
  const models = getGeminiModels();
  const modelConfig = models.find(m => m.id === model);

  if (!modelConfig) {
    return 0;
  }

  const inputCost = (inputTokens / 1000) * modelConfig.costPer1kTokens.input;
  const outputCost = (outputTokens / 1000) * modelConfig.costPer1kTokens.output;

  return inputCost + outputCost;
}

/**
 * Helper function to convert blob to base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Batch analyze multiple texts with Gemini
 */
export async function batchAnalyzeWithGemini(
  texts: string[],
  analysisPrompt: string,
  config?: Partial<GeminiConfig>
): Promise<string[]> {
  const results: string[] = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const promises = batch.map(text =>
      generateGeminiCompletion(`${analysisPrompt}\n\nText: ${text}`, undefined, config)
    );

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // Add delay between batches to respect rate limits
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
