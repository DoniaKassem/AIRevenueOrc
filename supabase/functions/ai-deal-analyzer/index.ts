import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Deal {
  id: string;
  name: string;
  amount: number;
  stage: string;
  probability: number;
  close_date: string | null;
  created_at: string;
  metadata: any;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function analyzeDealWithOpenAI(
  deal: Deal,
  recentActivity: any[],
  openaiApiKey: string
): Promise<{
  riskScore: number;
  summary: string;
  gaps: string[];
  nextSteps: string[];
  keyRiskFactors: string[];
}> {
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysUntilClose = deal.close_date
    ? Math.floor((new Date(deal.close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const recentCount = recentActivity.filter((a) => {
    const activityDate = new Date(a.created_at || a.sent_at || a.started_at);
    return (Date.now() - activityDate.getTime()) / (1000 * 60 * 60 * 24) <= 7;
  }).length;

  const systemPrompt = `You are an expert sales coach and deal strategist. Analyze deal health and provide specific, actionable recommendations.`;

  const userPrompt = `Analyze this sales deal and provide strategic insights:

Deal Information:
- Name: ${deal.name}
- Stage: ${deal.stage}
- Amount: $${deal.amount.toLocaleString()}
- Days in current stage: ${daysSinceCreated}
${daysUntilClose !== null ? `- Days until expected close: ${daysUntilClose}` : '- No close date set'}
- Recent activities (last 7 days): ${recentCount}
${deal.metadata ? `- Additional context: ${JSON.stringify(deal.metadata)}` : ''}

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
- Close date alignment
- Deal size vs stage appropriateness
- MEDDPICC qualification completeness
- Stage-specific best practices`;

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.4,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    throw new Error('OpenAI API request failed');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  try {
    const parsed = JSON.parse(content);
    return {
      riskScore: parsed.riskScore || 50,
      summary: parsed.summary || '',
      gaps: parsed.gaps || [],
      nextSteps: parsed.nextSteps || [],
      keyRiskFactors: parsed.keyRiskFactors || [],
    };
  } catch (error) {
    throw new Error('Failed to parse OpenAI response');
  }
}

function calculateRiskScoreFallback(deal: Deal, recentActivity: any[]): number {
  let risk = 30;

  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceCreated > 90) {
    risk += 20;
  } else if (daysSinceCreated > 60) {
    risk += 10;
  }

  if (deal.close_date) {
    const daysToClose = Math.floor(
      (new Date(deal.close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysToClose < 0) {
      risk += 30;
    } else if (daysToClose < 7) {
      risk += 15;
    }
  }

  const recentActivityDays = 7;
  const recentActivityCount = recentActivity.filter((a) => {
    const activityDate = new Date(a.created_at || a.sent_at || a.started_at);
    return (Date.now() - activityDate.getTime()) / (1000 * 60 * 60 * 24) <= recentActivityDays;
  }).length;

  if (recentActivityCount === 0) {
    risk += 25;
  } else if (recentActivityCount < 2) {
    risk += 10;
  } else {
    risk -= 10;
  }

  if (deal.stage === 'discovery') {
    risk -= 5;
  } else if (deal.stage === 'negotiation') {
    risk += 5;
  }

  return Math.min(100, Math.max(0, risk));
}

function generateDealSummaryFallback(deal: Deal, riskScore: number, recentActivity: any[]): string {
  const stageName = deal.stage.charAt(0).toUpperCase() + deal.stage.slice(1).replace('_', ' ');
  const riskLevel = riskScore > 70 ? 'High' : riskScore > 40 ? 'Medium' : 'Low';
  
  let summary = `${deal.name} is in ${stageName} stage with a value of $${(deal.amount / 1000).toFixed(0)}K. `;
  summary += `Risk level: ${riskLevel} (${riskScore}/100). `;
  
  if (deal.close_date) {
    const daysToClose = Math.floor(
      (new Date(deal.close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysToClose < 0) {
      summary += `Deal is ${Math.abs(daysToClose)} days overdue. `;
    } else {
      summary += `${daysToClose} days until expected close. `;
    }
  }
  
  const recentCount = recentActivity.filter((a) => {
    const activityDate = new Date(a.created_at || a.sent_at || a.started_at);
    return (Date.now() - activityDate.getTime()) / (1000 * 60 * 60 * 24) <= 7;
  }).length;
  
  summary += `${recentCount} activities in the last 7 days.`;
  
  return summary;
}

function identifyGapsFallback(deal: Deal, recentActivity: any[]): string[] {
  const gaps: string[] = [];

  const hasRecentCall = recentActivity.some(
    (a) => a.disposition && (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24) <= 14
  );
  if (!hasRecentCall) {
    gaps.push('No calls logged in the last 14 days');
  }

  const hasRecentEmail = recentActivity.some(
    (a) => a.subject && (Date.now() - new Date(a.sent_at).getTime()) / (1000 * 60 * 60 * 24) <= 7
  );
  if (!hasRecentEmail) {
    gaps.push('No emails sent in the last 7 days');
  }

  if (!deal.metadata?.meddpicc || Object.keys(deal.metadata.meddpicc).length < 3) {
    gaps.push('MEDDPICC qualification incomplete');
  }

  if (!deal.close_date) {
    gaps.push('No close date set');
  }

  if (deal.probability === 0) {
    gaps.push('Deal probability not set');
  }

  return gaps;
}

function generateNextStepsFallback(deal: Deal, riskScore: number, gaps: string[]): string[] {
  const steps: string[] = [];

  if (riskScore > 70) {
    steps.push('Schedule urgent call with champion to assess deal status');
    steps.push('Review and update close date based on current situation');
  }

  if (gaps.includes('No calls logged in the last 14 days')) {
    steps.push('Schedule discovery or check-in call with key stakeholders');
  }

  if (gaps.includes('MEDDPICC qualification incomplete')) {
    steps.push('Complete MEDDPICC qualification framework');
    steps.push('Identify economic buyer and decision criteria');
  }

  if (gaps.includes('No close date set')) {
    steps.push('Work with prospect to establish realistic timeline');
  }

  if (deal.stage === 'discovery') {
    steps.push('Move to qualification by validating pain points and budget');
  } else if (deal.stage === 'qualification') {
    steps.push('Prepare and send proposal based on qualification insights');
  } else if (deal.stage === 'proposal') {
    steps.push('Schedule call to review proposal and address questions');
  } else if (deal.stage === 'negotiation') {
    steps.push('Work through final objections and prepare contract');
  }

  if (steps.length === 0) {
    steps.push('Continue current engagement plan and monitor progress');
  }

  return steps;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { deal_ids, use_ai = true } = await req.json();

    if (!deal_ids || !Array.isArray(deal_ids)) {
      throw new Error("deal_ids array required");
    }

    const results = [];
    const useOpenAI = use_ai && openaiApiKey;

    for (const dealId of deal_ids) {
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .select("*")
        .eq("id", dealId)
        .maybeSingle();

      if (dealError || !deal) continue;

      const [emailActivity, callActivity] = await Promise.all([
        supabase
          .from("email_sends")
          .select("*")
          .eq("prospect_id", deal.account_id)
          .order("sent_at", { ascending: false })
          .limit(20),
        supabase
          .from("call_logs")
          .select("*")
          .eq("prospect_id", deal.account_id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const recentActivity = [
        ...(emailActivity.data || []),
        ...(callActivity.data || []),
      ];

      let riskScore: number;
      let summary: string;
      let gaps: string[];
      let nextSteps: string[];
      let keyRiskFactors: string[] = [];

      if (useOpenAI) {
        try {
          const aiAnalysis = await analyzeDealWithOpenAI(deal, recentActivity, openaiApiKey!);
          riskScore = aiAnalysis.riskScore;
          summary = aiAnalysis.summary;
          gaps = aiAnalysis.gaps;
          nextSteps = aiAnalysis.nextSteps;
          keyRiskFactors = aiAnalysis.keyRiskFactors;
        } catch (error) {
          console.error('OpenAI analysis failed, using fallback:', error);
          riskScore = calculateRiskScoreFallback(deal, recentActivity);
          summary = generateDealSummaryFallback(deal, riskScore, recentActivity);
          gaps = identifyGapsFallback(deal, recentActivity);
          nextSteps = generateNextStepsFallback(deal, riskScore, gaps);
          keyRiskFactors = recentActivity.length === 0 ? ['No recent activity'] : [];
        }
      } else {
        riskScore = calculateRiskScoreFallback(deal, recentActivity);
        summary = generateDealSummaryFallback(deal, riskScore, recentActivity);
        gaps = identifyGapsFallback(deal, recentActivity);
        nextSteps = generateNextStepsFallback(deal, riskScore, gaps);
        keyRiskFactors = recentActivity.length === 0 ? ['No recent activity'] : [];
      }

      await supabase
        .from("deals")
        .update({
          risk_score: riskScore,
          ai_analysis: {
            summary,
            gaps,
            next_steps: nextSteps,
            key_risk_factors: keyRiskFactors,
            analyzed_at: new Date().toISOString(),
            model: useOpenAI ? 'gpt-4o-mini' : 'rule-based',
          },
        })
        .eq("id", dealId);

      await supabase.from("ai_predictions").insert({
        entity_type: "deal",
        entity_id: dealId,
        prediction_type: "close_probability",
        score: 100 - riskScore,
        confidence: useOpenAI ? 0.85 : 0.70,
        reasoning: {
          summary,
          gaps,
          next_steps: nextSteps,
          risk_factors: keyRiskFactors,
        },
        model_version: useOpenAI ? 'gpt-4o-mini' : 'v1.0.0-fallback',
      });

      results.push({
        deal_id: dealId,
        risk_score: riskScore,
        summary,
        gaps,
        next_steps: nextSteps,
        key_risk_factors: keyRiskFactors,
        used_ai: useOpenAI,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        used_openai: useOpenAI,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});