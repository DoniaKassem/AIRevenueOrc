import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Prospect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  company: string | null;
  status: string;
  enrichment_data: any;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function analyzeProspectWithOpenAI(
  prospect: Prospect,
  openaiApiKey: string
): Promise<{
  priorityScore: number;
  insights: string[];
  recommendedActions: string[];
  contactMethod: string;
  reasoning: string;
}> {
  const systemPrompt = `You are an AI sales assistant specializing in lead qualification and prioritization. Analyze prospect data and provide actionable insights.`;

  const userPrompt = `Analyze this prospect and provide a comprehensive assessment:

Prospect Details:
- Name: ${prospect.first_name} ${prospect.last_name}
${prospect.title ? `- Title: ${prospect.title}` : ''}
${prospect.company ? `- Company: ${prospect.company}` : ''}
${prospect.email ? `- Email: ${prospect.email}` : ''}
${prospect.phone ? `- Phone: ${prospect.phone}` : ''}
- Current Status: ${prospect.status}
${prospect.enrichment_data ? `- Additional Data: ${JSON.stringify(prospect.enrichment_data)}` : ''}

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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 600,
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
      priorityScore: parsed.priorityScore || 50,
      insights: parsed.insights || [],
      recommendedActions: parsed.recommendedActions || [],
      contactMethod: parsed.contactMethod || 'email',
      reasoning: parsed.reasoning || '',
    };
  } catch (error) {
    throw new Error('Failed to parse OpenAI response');
  }
}

function calculatePriorityScoreFallback(prospect: Prospect): number {
  let score = 50;

  if (prospect.title) {
    const seniorityKeywords = ["ceo", "cto", "vp", "director", "head", "chief", "president"];
    const title = prospect.title.toLowerCase();
    if (seniorityKeywords.some(keyword => title.includes(keyword))) {
      score += 20;
    } else if (title.includes("manager")) {
      score += 10;
    }
  }

  if (prospect.company) {
    score += 10;
  }

  if (prospect.email && prospect.phone) {
    score += 15;
  } else if (prospect.email || prospect.phone) {
    score += 5;
  }

  if (prospect.status === "contacted") {
    score += 10;
  } else if (prospect.status === "qualified") {
    score += 20;
  }

  if (prospect.enrichment_data) {
    const enrichment = prospect.enrichment_data;
    if (enrichment.linkedin_connections > 500) score += 5;
    if (enrichment.recent_funding) score += 15;
    if (enrichment.tech_stack_match) score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

function generateInsightsFallback(prospect: Prospect, score: number): string[] {
  const insights: string[] = [];

  if (score > 80) {
    insights.push("High-value prospect with strong engagement signals");
  }

  if (prospect.title) {
    const title = prospect.title.toLowerCase();
    if (title.includes("ceo") || title.includes("founder")) {
      insights.push("Decision maker - can move quickly");
    } else if (title.includes("vp") || title.includes("director")) {
      insights.push("Senior influencer - build relationship");
    }
  }

  if (!prospect.email && !prospect.phone) {
    insights.push("Missing contact info - enrich data before outreach");
  }

  if (prospect.status === "new") {
    insights.push("Not yet contacted - prime for outreach");
  }

  return insights;
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { prospect_ids, use_ai = true } = await req.json();

    if (!prospect_ids || !Array.isArray(prospect_ids)) {
      throw new Error("prospect_ids array required");
    }

    const { data: prospects, error: fetchError } = await supabase
      .from("prospects")
      .select("*")
      .in("id", prospect_ids);

    if (fetchError) {
      throw fetchError;
    }

    const results = [];
    const useOpenAI = use_ai && openaiApiKey;

    for (const prospect of prospects || []) {
      let score: number;
      let insights: string[];
      let recommendedActions: string[] = [];
      let contactMethod = 'email';
      let reasoning = '';

      if (useOpenAI) {
        try {
          const aiAnalysis = await analyzeProspectWithOpenAI(prospect, openaiApiKey!);
          score = aiAnalysis.priorityScore;
          insights = aiAnalysis.insights;
          recommendedActions = aiAnalysis.recommendedActions;
          contactMethod = aiAnalysis.contactMethod;
          reasoning = aiAnalysis.reasoning;
        } catch (error) {
          console.error('OpenAI analysis failed, using fallback:', error);
          score = calculatePriorityScoreFallback(prospect);
          insights = generateInsightsFallback(prospect, score);
        }
      } else {
        score = calculatePriorityScoreFallback(prospect);
        insights = generateInsightsFallback(prospect, score);
      }

      await supabase
        .from("prospects")
        .update({
          priority_score: score,
          ai_insights: {
            insights,
            recommended_actions: recommendedActions,
            contact_method: contactMethod,
            reasoning,
            analyzed_at: new Date().toISOString(),
            model: useOpenAI ? 'gpt-4o-mini' : 'rule-based',
          },
        })
        .eq("id", prospect.id);

      await supabase
        .from("ai_predictions")
        .insert({
          entity_type: "prospect",
          entity_id: prospect.id,
          prediction_type: "priority_score",
          score: score,
          confidence: useOpenAI ? 0.90 : 0.75,
          reasoning: {
            insights,
            recommended_actions: recommendedActions,
            contact_method: contactMethod,
            reasoning,
          },
          model_version: useOpenAI ? 'gpt-4o-mini' : 'v1.0.0-fallback',
        });

      results.push({
        prospect_id: prospect.id,
        priority_score: score,
        insights,
        recommended_actions: recommendedActions,
        contact_method: contactMethod,
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