import express, { Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from '../db';
import { 
  prospects, 
  deals, 
  conversations, 
  conversationTranscripts, 
  conversationInsights,
  aiPredictions,
  emailSends,
  callLogs
} from '../../shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getOpenAIKey, getAIConfigurationStatus } from '../services/keyResolver';

const router = express.Router();

// Initialize OpenAI client using key resolver
function getOpenAIClient(orgId?: string): OpenAI | null {
  const keyResult = getOpenAIKey(orgId);
  if (!keyResult.key) {
    console.warn('OPENAI_API_KEY not configured, AI features will use fallback logic');
    return null;
  }
  return new OpenAI({ apiKey: keyResult.key });
}

// =============================================
// AI CONFIGURATION STATUS & TEST
// =============================================

router.get('/config/status', async (req: Request, res: Response) => {
  try {
    const status = getAIConfigurationStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    console.error('Failed to get AI config status:', error);
    res.status(500).json({ success: false, error: 'Failed to get configuration status' });
  }
});

router.post('/config/test', async (req: Request, res: Response) => {
  try {
    const keyResult = getOpenAIKey();
    
    if (!keyResult.isConfigured) {
      return res.json({
        success: false,
        error: 'OpenAI API key not configured',
        configured: false,
      });
    }

    // Test the key with a minimal API call
    const openai = new OpenAI({ apiKey: keyResult.key! });
    
    // Use a cheap endpoint to test - list models
    await openai.models.list();

    res.json({
      success: true,
      configured: true,
      source: keyResult.source,
      maskedKey: keyResult.maskedKey,
      message: 'OpenAI API key is valid and working',
    });
  } catch (error: any) {
    console.error('OpenAI test failed:', error);
    
    // Determine if it's an auth error or other issue
    const isAuthError = error.status === 401 || error.code === 'invalid_api_key';
    
    res.json({
      success: false,
      configured: true,
      error: isAuthError ? 'Invalid API key' : (error.message || 'Connection test failed'),
      errorType: isAuthError ? 'auth' : 'connection',
    });
  }
});

// Validation schemas
const analyzeConversationSchema = z.object({
  conversation_id: z.string().uuid(),
  use_ai: z.boolean().optional().default(true),
});

const analyzeDealSchema = z.object({
  deal_ids: z.array(z.string().uuid()),
  use_ai: z.boolean().optional().default(true),
});

const prioritizeSchema = z.object({
  prospect_ids: z.array(z.string().uuid()),
  use_ai: z.boolean().optional().default(true),
});

// =============================================
// AI CONVERSATION ANALYZER
// =============================================

router.post('/conversation/analyze', async (req: Request, res: Response) => {
  try {
    const { conversation_id, use_ai } = analyzeConversationSchema.parse(req.body);

    // Update status to processing
    await db.update(conversations)
      .set({ analysisStatus: 'processing' })
      .where(eq(conversations.id, conversation_id));

    // Get conversation segments
    const segments = await db.query.conversationTranscripts.findMany({
      where: eq(conversationTranscripts.conversationId, conversation_id),
      orderBy: (transcripts, { asc }) => [asc(transcripts.segmentNumber)],
    });

    if (!segments || segments.length === 0) {
      throw new Error('No transcript segments found');
    }

    const openai = getOpenAIClient();
    const useOpenAI = use_ai && openai;
    let analysis: any;

    if (useOpenAI) {
      // AI-powered analysis
      const fullTranscript = segments
        .map((s) => `[${s.speakerRole?.toUpperCase()}] ${s.speakerName}: ${s.text}`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert sales coach analyzing sales call transcripts. Provide detailed, actionable insights.',
          },
          {
            role: 'user',
            content: `Analyze this sales call and provide insights as JSON with: summary, sentiment_score (0-100), engagement_score (0-100), talk_ratio {rep, prospect}, key_points, action_items, questions_asked, objections, next_steps, meddpicc {metrics, economic_buyer, decision_criteria, decision_process, pain, champion}, topics, keywords, pricing_discussed, budget_mentioned, ai_recommendations. Transcript:\n\n${fullTranscript}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      });

      try {
        analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError);
        analysis = analyzeTranscriptFallback(segments);
      }
    } else {
      // Fallback rule-based analysis
      analysis = analyzeTranscriptFallback(segments);
    }

    // Insert insights
    const [insight] = await db.insert(conversationInsights).values({
      conversationId: conversation_id,
      summary: analysis.summary,
      sentimentScore: analysis.sentiment_score?.toString(),
      engagementScore: analysis.engagement_score?.toString(),
      talkRatio: analysis.talk_ratio,
      keyPoints: analysis.key_points,
      actionItems: analysis.action_items,
      questionsAsked: analysis.questions_asked,
      objections: analysis.objections,
      nextSteps: analysis.next_steps,
      meddpicc: analysis.meddpicc,
      topics: analysis.topics,
      keywords: analysis.keywords,
      pricingDiscussed: analysis.pricing_discussed,
      budgetMentioned: analysis.budget_mentioned,
      aiRecommendations: analysis.ai_recommendations,
      modelVersion: useOpenAI ? 'gpt-4o-mini' : 'v1.0.0-fallback',
    }).returning();

    // Update conversation status
    await db.update(conversations)
      .set({ analysisStatus: 'completed' })
      .where(eq(conversations.id, conversation_id));

    res.json({
      success: true,
      conversation_id,
      insight,
      used_openai: useOpenAI,
    });
  } catch (error: any) {
    console.error('Conversation analysis error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Analysis failed',
    });
  }
});

// =============================================
// AI DEAL ANALYZER
// =============================================

router.post('/deal/analyze', async (req: Request, res: Response) => {
  try {
    const { deal_ids, use_ai } = analyzeDealSchema.parse(req.body);

    const results: Array<{ deal_id: string; risk_score: number; summary: string; gaps: string[]; next_steps: string[]; used_ai: boolean }> = [];
    const openai = getOpenAIClient();
    const useOpenAI = use_ai && openai;

    for (const dealId of deal_ids) {
      const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
      if (!deal) continue;

      // Get recent email and call activity - fixed to use proper joins
      const recentActivity: any[] = [];
      
      if (deal.accountId) {
        const [emails, calls] = await Promise.all([
          db.select().from(emailSends)
            .where(eq(emailSends.prospectId, deal.accountId))
            .limit(20),
          db.select().from(callLogs)
            .where(eq(callLogs.prospectId, deal.accountId))
            .limit(20),
        ]);
        recentActivity.push(...emails, ...calls);
      }

      let riskScore: number;
      let summary: string;
      let gaps: string[];
      let nextSteps: string[];
      let keyRiskFactors: string[] = [];

      if (useOpenAI) {
        const daysSinceCreated = deal.createdAt ? Math.floor(
          (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ) : 0;
        const daysUntilClose = deal.closeDate
          ? Math.floor((new Date(deal.closeDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert sales coach and deal strategist.' },
            {
              role: 'user',
              content: `Analyze this deal as JSON with: riskScore (0-100), summary, gaps, nextSteps, keyRiskFactors. Deal: ${deal.name}, Stage: ${deal.stage}, Amount: $${deal.amount}, Days in stage: ${daysSinceCreated}, Recent activities: ${recentActivity.length}`,
            },
          ],
          temperature: 0.4,
          max_tokens: 800,
        });

        try {
          const aiAnalysis = JSON.parse(response.choices[0]?.message?.content || '{}');
          riskScore = aiAnalysis.riskScore || 50;
          summary = aiAnalysis.summary || '';
          gaps = aiAnalysis.gaps || [];
          nextSteps = aiAnalysis.nextSteps || [];
          keyRiskFactors = aiAnalysis.keyRiskFactors || [];
        } catch (parseError) {
          console.error('Failed to parse OpenAI response:', parseError);
          riskScore = calculateRiskScoreFallback(deal, recentActivity);
          summary = `${deal.name} in ${deal.stage} stage. Risk: ${riskScore}/100`;
          gaps = ['AI parsing error - using fallback'];
          nextSteps = ['Continue engagement'];
          keyRiskFactors = [];
        }
      } else {
        // Fallback analysis
        riskScore = calculateRiskScoreFallback(deal, recentActivity);
        summary = `${deal.name} in ${deal.stage} stage. Risk: ${riskScore}/100`;
        gaps = ['Insufficient data for detailed analysis'];
        nextSteps = ['Continue engagement'];
        keyRiskFactors = recentActivity.length === 0 ? ['No recent activity'] : [];
      }

      // Update deal
      await db.update(deals).set({
        riskScore,
        aiAnalysis: { summary, gaps, next_steps: nextSteps, key_risk_factors: keyRiskFactors },
      }).where(eq(deals.id, dealId));

      // Insert prediction
      await db.insert(aiPredictions).values({
        entityType: 'deal',
        entityId: dealId,
        predictionType: 'close_probability',
        score: (100 - riskScore).toString(),
        confidence: (useOpenAI ? 0.85 : 0.70).toString(),
        reasoning: { summary, gaps, next_steps: nextSteps, risk_factors: keyRiskFactors },
        modelVersion: useOpenAI ? 'gpt-4o-mini' : 'v1.0.0-fallback',
      });

      results.push({ deal_id: dealId, risk_score: riskScore, summary, gaps, next_steps: nextSteps, used_ai: !!useOpenAI });
    }

    res.json({ success: true, results, used_openai: useOpenAI });
  } catch (error: any) {
    console.error('Deal analysis error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message || 'Analysis failed' });
  }
});

// =============================================
// AI PRIORITIZATION
// =============================================

router.post('/prioritize', async (req: Request, res: Response) => {
  try {
    const { prospect_ids, use_ai } = prioritizeSchema.parse(req.body);

    const prospectList = await db.select().from(prospects).where(inArray(prospects.id, prospect_ids));
    const results: Array<{ prospect_id: string; priority_score: number; insights: string[]; recommended_actions: string[]; used_ai: boolean }> = [];
    const openai = getOpenAIClient();
    const useOpenAI = use_ai && openai;

    for (const prospect of prospectList) {
      let score: number;
      let insights: string[];
      let recommendedActions: string[] = [];
      let contactMethod = 'email';
      let reasoning = '';

      if (useOpenAI) {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an AI sales assistant specializing in lead qualification.' },
            {
              role: 'user',
              content: `Analyze prospect as JSON with: priorityScore (0-100), insights, recommendedActions, contactMethod, reasoning. Prospect: ${prospect.firstName} ${prospect.lastName}, Title: ${prospect.title}, Company: ${prospect.company}, Status: ${prospect.status}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 600,
        });

        try {
          const aiAnalysis = JSON.parse(response.choices[0]?.message?.content || '{}');
          score = aiAnalysis.priorityScore || 50;
          insights = aiAnalysis.insights || [];
          recommendedActions = aiAnalysis.recommendedActions || [];
          contactMethod = aiAnalysis.contactMethod || 'email';
          reasoning = aiAnalysis.reasoning || '';
        } catch (parseError) {
          console.error('Failed to parse OpenAI response:', parseError);
          score = calculatePriorityScoreFallback(prospect);
          insights = [`Priority score: ${score}/100 (fallback due to parsing error)`];
        }
      } else {
        score = calculatePriorityScoreFallback(prospect);
        insights = [`Priority score: ${score}/100`];
      }

      // Update prospect
      await db.update(prospects).set({
        priorityScore: score,
        aiInsights: { insights, recommended_actions: recommendedActions, contact_method: contactMethod, reasoning },
      }).where(eq(prospects.id, prospect.id));

      // Insert prediction
      await db.insert(aiPredictions).values({
        entityType: 'prospect',
        entityId: prospect.id,
        predictionType: 'priority_score',
        score: score.toString(),
        confidence: (useOpenAI ? 0.90 : 0.75).toString(),
        reasoning: { insights, recommended_actions: recommendedActions, contact_method: contactMethod, reasoning },
        modelVersion: useOpenAI ? 'gpt-4o-mini' : 'v1.0.0-fallback',
      });

      results.push({ prospect_id: prospect.id, priority_score: score, insights, recommended_actions: recommendedActions, used_ai: !!useOpenAI });
    }

    res.json({ success: true, results, used_openai: useOpenAI });
  } catch (error: any) {
    console.error('Prioritization error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message || 'Prioritization failed' });
  }
});

// =============================================
// HELPER FUNCTIONS
// =============================================

function analyzeTranscriptFallback(segments: any[]): any {
  const fullText = segments.map((s) => s.text).join(' ').toLowerCase();
  
  return {
    summary: `Conversation analyzed with ${segments.length} segments`,
    sentiment_score: 50,
    engagement_score: 50,
    talk_ratio: { rep: 50, prospect: 50 },
    key_points: ['Conversation recorded'],
    action_items: [],
    questions_asked: [],
    objections: [],
    next_steps: [],
    meddpicc: { metrics: false, economic_buyer: false, decision_criteria: false, decision_process: false, pain: false, champion: false },
    topics: [],
    keywords: [],
    pricing_discussed: fullText.includes('price') || fullText.includes('cost'),
    budget_mentioned: fullText.includes('budget'),
    ai_recommendations: ['Review conversation and add manual notes'],
  };
}

function calculateRiskScoreFallback(deal: any, recentActivity: any[]): number {
  let risk = 30;
  const daysSinceCreated = Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceCreated > 90) risk += 20;
  if (recentActivity.length === 0) risk += 25;
  if (!deal.closeDate) risk += 15;
  
  return Math.min(100, Math.max(0, risk));
}

function calculatePriorityScoreFallback(prospect: any): number {
  let score = 50;
  
  if (prospect.title) {
    const seniorityKeywords = ['ceo', 'cto', 'vp', 'director', 'head', 'chief'];
    if (seniorityKeywords.some(kw => prospect.title.toLowerCase().includes(kw))) score += 20;
  }
  
  if (prospect.company) score += 10;
  if (prospect.email && prospect.phone) score += 15;
  if (prospect.status === 'qualified') score += 20;
  
  return Math.min(100, Math.max(0, score));
}

export default router;
