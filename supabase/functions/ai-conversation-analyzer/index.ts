import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function analyzeConversationWithOpenAI(
  segments: any[],
  openaiApiKey: string
): Promise<any> {
  const fullTranscript = segments
    .map((s) => `[${s.speaker_role.toUpperCase()}] ${s.speaker_name}: ${s.text}`)
    .join('\n');

  const systemPrompt = `You are an expert sales coach analyzing sales call transcripts. Provide detailed, actionable insights to help sales reps improve their performance and close more deals.`;

  const userPrompt = `Analyze this sales call transcript and provide comprehensive insights:

${fullTranscript}

Provide your analysis as JSON:
{
  "summary": "<2-3 sentence summary of the call>",
  "sentiment_score": <number 0-100, higher = more positive>,
  "engagement_score": <number 0-100, higher = better engagement>,
  "talk_ratio": {
    "rep": <percentage 0-100>,
    "prospect": <percentage 0-100>
  },
  "key_points": [<array of 3-5 most important discussion points>],
  "action_items": [<array of specific commitments and tasks>],
  "questions_asked": [<array of key questions from both sides>],
  "objections": [<array of concerns or objections raised>],
  "next_steps": [<array of agreed-upon next steps>],
  "meddpicc": {
    "metrics": <boolean: were success metrics discussed?>,
    "economic_buyer": <boolean: was budget/buyer identified?>,
    "decision_criteria": <boolean: were decision criteria discussed?>,
    "decision_process": <boolean: was the process/timeline covered?>,
    "pain": <boolean: were pain points identified?>,
    "champion": <boolean: is there an internal champion?>
  },
  "topics": [<array of main topics discussed>],
  "keywords": [<array of frequently mentioned important terms>],
  "pricing_discussed": <boolean>,
  "budget_mentioned": <boolean>,
  "ai_recommendations": [<array of 3-5 specific coaching tips>]
}

Provide actionable insights based on:
- Talk ratio and listening quality
- Question effectiveness and discovery
- Objection handling
- MEDDPICC qualification framework
- Deal progression and next steps`;

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
      max_tokens: 1500,
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

  return JSON.parse(content);
}

function analyzeTranscriptFallback(segments: any[]): any {
  const fullText = segments.map((s) => `${s.speaker_name}: ${s.text}`).join('\n');
  
  let repWordCount = 0;
  let prospectWordCount = 0;
  
  segments.forEach((segment) => {
    const wordCount = segment.text.split(/\s+/).length;
    if (segment.speaker_role === 'rep') {
      repWordCount += wordCount;
    } else {
      prospectWordCount += wordCount;
    }
  });
  
  const totalWords = repWordCount + prospectWordCount;
  const talkRatio = {
    rep: totalWords > 0 ? (repWordCount / totalWords) * 100 : 0,
    prospect: totalWords > 0 ? (prospectWordCount / totalWords) * 100 : 0,
  };
  
  const keyPoints: string[] = [];
  const actionItems: string[] = [];
  const questions: string[] = [];
  const objections: string[] = [];
  const nextSteps: string[] = [];
  
  const actionKeywords = ['will', 'going to', 'need to', 'should', 'must', 'task', 'action'];
  const questionMarkers = ['?', 'what', 'when', 'where', 'who', 'why', 'how'];
  const objectionKeywords = ['concern', 'worried', 'hesitant', 'issue', 'problem', 'but'];
  const nextStepKeywords = ['next', 'follow up', 'schedule', 'send', 'meeting'];
  
  segments.forEach((segment) => {
    const text = segment.text.toLowerCase();
    
    if (actionKeywords.some((kw) => text.includes(kw))) {
      actionItems.push(segment.text);
    }
    
    if (questionMarkers.some((marker) => text.includes(marker)) || text.includes('?')) {
      questions.push(segment.text);
    }
    
    if (objectionKeywords.some((kw) => text.includes(kw))) {
      objections.push(segment.text);
    }
    
    if (nextStepKeywords.some((kw) => text.includes(kw))) {
      nextSteps.push(segment.text);
    }
  });
  
  const sentimentWords = {
    positive: ['great', 'excellent', 'perfect', 'love', 'excited', 'interested', 'yes', 'agree'],
    negative: ['no', 'not', 'never', 'cannot', 'won\'t', 'difficult', 'expensive', 'concerned'],
  };
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  segments.forEach((segment) => {
    const text = segment.text.toLowerCase();
    sentimentWords.positive.forEach((word) => {
      if (text.includes(word)) positiveCount++;
    });
    sentimentWords.negative.forEach((word) => {
      if (text.includes(word)) negativeCount++;
    });
  });
  
  const sentimentScore = positiveCount + negativeCount > 0
    ? (positiveCount / (positiveCount + negativeCount)) * 100
    : 50;
  
  const engagementScore = Math.min(100, (questions.length * 10 + (100 - Math.abs(talkRatio.rep - 50)) * 0.5));
  
  const duration = segments.length > 0
    ? Math.round(segments[segments.length - 1].end_time / 60)
    : 0;
  
  let summary = `This ${duration}-minute conversation `;
  
  if (sentimentScore > 70) {
    summary += 'was very positive with strong engagement. ';
  } else if (sentimentScore > 50) {
    summary += 'had a generally positive tone. ';
  } else {
    summary += 'revealed some concerns that need addressing. ';
  }
  
  if (talkRatio.rep > 70) {
    summary += 'The sales rep dominated the conversation - consider asking more questions. ';
  } else if (talkRatio.prospect > 70) {
    summary += 'The prospect spoke extensively - good discovery happening. ';
  } else {
    summary += 'The conversation had good back-and-forth dialogue. ';
  }
  
  const lower = fullText.toLowerCase();
  
  const meddpicc = {
    metrics: lower.includes('metric') || lower.includes('roi') || lower.includes('measure'),
    economic_buyer: lower.includes('budget') || lower.includes('decision maker'),
    decision_criteria: lower.includes('criteria') || lower.includes('evaluate') || lower.includes('compare'),
    decision_process: lower.includes('process') || lower.includes('timeline') || lower.includes('approval'),
    pain: lower.includes('pain') || lower.includes('challenge') || lower.includes('problem'),
    champion: lower.includes('champion') || lower.includes('advocate') || lower.includes('sponsor'),
  };
  
  const topicKeywords = {
    'Pricing': ['price', 'cost', 'pricing', 'payment'],
    'Timeline': ['timeline', 'when', 'schedule', 'date'],
    'Features': ['feature', 'functionality', 'capability'],
    'Integration': ['integrate', 'integration', 'api', 'connect'],
    'ROI': ['roi', 'return', 'savings', 'value'],
    'Competition': ['competitor', 'alternative', 'vs', 'compare'],
    'Security': ['security', 'compliance', 'privacy', 'gdpr'],
    'Support': ['support', 'training', 'onboarding', 'help'],
  };
  
  const topics: string[] = [];
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some((kw) => lower.includes(kw))) {
      topics.push(topic);
    }
  });
  
  const wordFreq: Record<string, number> = {};
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'we', 'they', 'he', 'she', 'it']);
  
  segments.forEach((segment) => {
    const words = segment.text.toLowerCase().split(/\W+/);
    words.forEach((word: string) => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
  });
  
  const keywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
  
  const pricingDiscussed = lower.includes('price') ||
    lower.includes('cost') ||
    lower.includes('budget');
  
  const budgetMentioned = lower.includes('budget');
  
  const recommendations: string[] = [];
  
  if (talkRatio.rep > 65) {
    recommendations.push('Ask more open-ended questions to encourage prospect participation');
  }
  
  if (sentimentScore < 50) {
    recommendations.push('Address concerns raised - schedule follow-up to discuss objections');
  }
  
  if (engagementScore < 40) {
    recommendations.push('Increase engagement by sharing relevant case studies or demos');
  }
  
  if (objections.length > 3) {
    recommendations.push('Prepare detailed responses to objections before next meeting');
  }
  
  if (talkRatio.prospect > 65) {
    recommendations.push('Good discovery - ensure you captured all key information');
  }
  
  if (sentimentScore > 70 && engagementScore > 60) {
    recommendations.push('Strong call - move quickly to next stage while momentum is high');
  }
  
  return {
    summary,
    key_points: keyPoints.slice(0, 5),
    action_items: actionItems.slice(0, 10),
    questions_asked: questions.slice(0, 10),
    objections: objections.slice(0, 5),
    next_steps: nextSteps.slice(0, 5),
    sentiment_score: sentimentScore,
    engagement_score: engagementScore,
    talk_ratio: talkRatio,
    meddpicc,
    topics,
    keywords,
    pricing_discussed: pricingDiscussed,
    budget_mentioned: budgetMentioned,
    ai_recommendations: recommendations,
  };
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

    const { conversation_id, use_ai = true } = await req.json();

    if (!conversation_id) {
      throw new Error("conversation_id required");
    }

    await supabase
      .from("conversations")
      .update({ analysis_status: "processing" })
      .eq("id", conversation_id);

    const { data: segments, error: segmentsError } = await supabase
      .from("conversation_transcripts")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("segment_number");

    if (segmentsError) throw segmentsError;

    if (!segments || segments.length === 0) {
      throw new Error("No transcript segments found");
    }

    const useOpenAI = use_ai && openaiApiKey;
    let analysis: any;

    if (useOpenAI) {
      try {
        analysis = await analyzeConversationWithOpenAI(segments, openaiApiKey!);
      } catch (error) {
        console.error('OpenAI analysis failed, using fallback:', error);
        analysis = analyzeTranscriptFallback(segments);
      }
    } else {
      analysis = analyzeTranscriptFallback(segments);
    }

    const { data: insight, error: insertError } = await supabase
      .from("conversation_insights")
      .insert({
        conversation_id,
        ...analysis,
        model_version: useOpenAI ? 'gpt-4o-mini' : 'v1.0.0-fallback',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await supabase
      .from("conversations")
      .update({ analysis_status: "completed" })
      .eq("id", conversation_id);

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id,
        insight,
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