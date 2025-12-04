import { getRelevantKnowledge, buildCompanyContext, logKnowledgeUsage } from './knowledgeRetrieval';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  teamId?: string;
  agentType?: string;
  taskContext?: string;
}

export async function createOpenAICompletion(
  messages: OpenAIMessage[],
  options: OpenAICompletionOptions = {}
): Promise<string> {
  const {
    model = 'gpt-4o-mini',
    temperature = 0.7,
    maxTokens = 1000,
    teamId,
    agentType,
    taskContext,
  } = options;

  if (teamId && taskContext) {
    const knowledge = await getRelevantKnowledge(teamId, taskContext);
    if (knowledge && knowledge.company_profile.spokesperson_enabled) {
      const companyContext = buildCompanyContext(knowledge);
      messages[0] = {
        ...messages[0],
        content: `${messages[0].content}\n\n${companyContext}\n\nIMPORTANT: Use the company information above to ensure all responses align with the company's brand voice, messaging guidelines, and values. Follow the communication DOs and DON'Ts strictly.`,
      };

      if (agentType && knowledge.company_profile.id) {
        const knowledgeSources = knowledge.relevant_chunks.map(
          (chunk) => `${chunk.source_type}:${chunk.metadata?.file_name || chunk.metadata?.url || 'unknown'}`
        );
        await logKnowledgeUsage(
          knowledge.company_profile.id,
          agentType,
          taskContext,
          knowledgeSources,
          companyContext
        );
      }
    }
  }

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      model,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'OpenAI API request failed');
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'OpenAI API request failed');
  }
  
  return data.content;
}

export async function generateEmailContent(params: {
  prospectName: string;
  prospectTitle?: string;
  prospectCompany?: string;
  emailPurpose: string;
  keyPoints?: string[];
  tone?: 'professional' | 'casual' | 'friendly';
  teamId?: string;
}): Promise<{ subject: string; body: string }> {
  const {
    prospectName,
    prospectTitle,
    prospectCompany,
    emailPurpose,
    keyPoints = [],
    tone = 'professional',
    teamId,
  } = params;

  const systemPrompt = `You are an expert sales development representative (SDR) who writes highly personalized, engaging cold emails that get responses. Your emails are concise, value-focused, and never pushy.`;

  const userPrompt = `Write a personalized cold email with the following details:

Prospect Information:
- Name: ${prospectName}
${prospectTitle ? `- Title: ${prospectTitle}` : ''}
${prospectCompany ? `- Company: ${prospectCompany}` : ''}

Email Purpose: ${emailPurpose}

${keyPoints.length > 0 ? `Key Points to Include:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : ''}

Tone: ${tone}

Requirements:
1. Keep the email under 150 words
2. Start with a compelling, personalized opening line
3. Focus on value for the prospect, not your product
4. Include a clear, low-friction call-to-action
5. Use their name naturally but don't overdo it
6. No generic platitudes or buzzwords

Format your response as JSON:
{
  "subject": "The subject line (under 60 characters)",
  "body": "The complete email body"
}`;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await createOpenAICompletion(messages, {
    model: 'gpt-4o-mini',
    temperature: 0.8,
    maxTokens: 800,
    teamId,
    agentType: 'email_generation',
    taskContext: `Generate email for ${prospectName} about ${emailPurpose}`,
  });

  try {
    const cleanedResponse = response.trim();
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('No JSON found in response:', cleanedResponse);
      throw new Error('Failed to parse OpenAI response: No JSON found');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      subject: parsed.subject || '',
      body: parsed.body || '',
    };
  } catch (error) {
    console.error('Parse error:', error);
    console.error('Response was:', response);
    throw new Error('Failed to parse OpenAI response');
  }
}

export async function analyzeProspectWithAI(params: {
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  status: string;
  enrichmentData?: any;
  teamId?: string;
}): Promise<{
  priorityScore: number;
  insights: string[];
  recommendedActions: string[];
  contactMethod: string;
  reasoning: string;
}> {
  const systemPrompt = `You are an AI sales assistant specializing in lead qualification and prioritization. Analyze prospect data and provide actionable insights.`;

  const userPrompt = `Analyze this prospect and provide a comprehensive assessment:

Prospect Details:
- Name: ${params.firstName} ${params.lastName}
${params.title ? `- Title: ${params.title}` : ''}
${params.company ? `- Company: ${params.company}` : ''}
${params.email ? `- Email: ${params.email}` : ''}
${params.phone ? `- Phone: ${params.phone}` : ''}
- Current Status: ${params.status}
${params.enrichmentData ? `- Additional Data: ${JSON.stringify(params.enrichmentData)}` : ''}

Provide your analysis as JSON:
{
  "priorityScore": <number 0-100>,
  "insights": [<array of 2-4 key insights>],
  "recommendedActions": [<array of 2-3 specific next steps>],
  "contactMethod": "<email|phone|linkedin>",
  "reasoning": "<brief explanation of priority score>"
}

Consider:
- Title/seniority level for decision-making authority
- Company quality and fit
- Contact information completeness
- Current engagement status
- Enrichment signals like funding, tech stack, growth indicators`;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await createOpenAICompletion(messages, {
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 600,
    teamId: params.teamId,
    agentType: 'prospect_prioritization',
    taskContext: `Analyze prospect ${params.firstName} ${params.lastName} at ${params.company}`,
  });

  try {
    const parsed = JSON.parse(response);
    return {
      priorityScore: parsed.priorityScore || 50,
      insights: parsed.insights || [],
      recommendedActions: parsed.recommendedActions || [],
      contactMethod: parsed.contactMethod || 'email',
      reasoning: parsed.reasoning || '',
    };
  } catch (error) {
    throw new Error('Failed to parse AI analysis response');
  }
}

export async function analyzeDealWithAI(params: {
  dealName: string;
  stage: string;
  amount: number;
  daysInStage: number;
  daysUntilClose?: number;
  recentActivityCount: number;
  metadata?: any;
  teamId?: string;
}): Promise<{
  riskScore: number;
  summary: string;
  gaps: string[];
  nextSteps: string[];
  keyRiskFactors: string[];
}> {
  const systemPrompt = `You are an expert sales coach and deal strategist. Analyze deal health and provide specific, actionable recommendations.`;

  const userPrompt = `Analyze this sales deal and provide strategic insights:

Deal Information:
- Name: ${params.dealName}
- Stage: ${params.stage}
- Amount: $${params.amount.toLocaleString()}
- Days in current stage: ${params.daysInStage}
${params.daysUntilClose ? `- Days until expected close: ${params.daysUntilClose}` : '- No close date set'}
- Recent activities (last 7 days): ${params.recentActivityCount}
${params.metadata ? `- Additional context: ${JSON.stringify(params.metadata)}` : ''}

Provide analysis as JSON:
{
  "riskScore": <number 0-100, higher = more risk>,
  "summary": "<2-3 sentence deal health summary>",
  "gaps": [<array of 2-5 missing elements or red flags>],
  "nextSteps": [<array of 3-5 specific actions to take>],
  "keyRiskFactors": [<array of 2-3 main risk factors>]
}

Consider:
- Activity recency and frequency
- Deal velocity and time in stage
- Missing qualification elements
- Close date alignment
- Deal size vs stage appropriateness`;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await createOpenAICompletion(messages, {
    model: 'gpt-4o-mini',
    temperature: 0.4,
    maxTokens: 800,
    teamId: params.teamId,
    agentType: 'deal_analysis',
    taskContext: `Analyze deal ${params.dealName} in ${params.stage} stage`,
  });

  try {
    const parsed = JSON.parse(response);
    return {
      riskScore: parsed.riskScore || 50,
      summary: parsed.summary || '',
      gaps: parsed.gaps || [],
      nextSteps: parsed.nextSteps || [],
      keyRiskFactors: parsed.keyRiskFactors || [],
    };
  } catch (error) {
    throw new Error('Failed to parse deal analysis response');
  }
}
