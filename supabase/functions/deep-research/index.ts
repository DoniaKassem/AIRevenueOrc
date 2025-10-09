import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeepResearchRequest {
  company_profile_id: string;
  research_focus?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      company_profile_id,
      research_focus = "general",
    }: DeepResearchRequest = await req.json();

    if (!company_profile_id) {
      throw new Error("company_profile_id is required");
    }

    const { data: companyProfile, error: profileError } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("id", company_profile_id)
      .single();

    if (profileError || !companyProfile) {
      throw new Error("Company profile not found");
    }

    const { data: documents } = await supabase
      .from("knowledge_documents")
      .select("file_name, extracted_text")
      .eq("company_profile_id", company_profile_id)
      .eq("processing_status", "completed")
      .limit(5);

    const { data: websites } = await supabase
      .from("knowledge_websites")
      .select("url, page_title, crawled_content")
      .eq("company_profile_id", company_profile_id)
      .eq("sync_status", "completed")
      .limit(5);

    const existingKnowledge = {
      company_name: companyProfile.company_name,
      industry: companyProfile.industry,
      description: companyProfile.company_description,
      mission: companyProfile.mission_statement,
      website: companyProfile.website_url,
      value_propositions: companyProfile.value_propositions,
      products_services: companyProfile.products_services,
      target_customers: companyProfile.target_customers,
      documents: documents?.map((d) => ({
        name: d.file_name,
        excerpt: d.extracted_text?.slice(0, 500),
      })),
      websites: websites?.map((w) => ({
        url: w.url,
        title: w.page_title,
        excerpt: w.crawled_content?.slice(0, 500),
      })),
    };

    const researchPrompt = `You are a professional business research analyst. Conduct comprehensive research and analysis on the following company.

Company Information:
${JSON.stringify(existingKnowledge, null, 2)}

Research Focus: ${research_focus}

Provide a detailed analysis covering:

1. COMPANY OVERVIEW
   - Core business model and value proposition
   - Key products/services and their unique selling points
   - Target market and ideal customer profile

2. COMPETITIVE POSITIONING
   - Market position and competitive advantages
   - Key differentiators from competitors
   - Potential weaknesses or gaps

3. MESSAGING & COMMUNICATION
   - Brand voice and tone recommendations
   - Key messages for different audiences (prospects, customers, partners)
   - Communication dos and don'ts

4. SALES INTELLIGENCE
   - Ideal customer characteristics and buying signals
   - Common objections and how to address them
   - Best practices for engaging prospects

5. AI AGENT TRAINING RECOMMENDATIONS
   - Key facts AI agents must know
   - Suggested talking points for different scenarios
   - Response guidelines for common customer questions

Format your response as structured JSON:
{
  "overview": {
    "summary": "string",
    "business_model": "string",
    "key_offerings": ["string"],
    "target_market": "string"
  },
  "competitive_analysis": {
    "market_position": "string",
    "differentiators": ["string"],
    "competitive_advantages": ["string"],
    "areas_for_improvement": ["string"]
  },
  "messaging_guidelines": {
    "brand_voice": { "tone": "string", "style": "string", "formality": "string" },
    "key_messages": ["string"],
    "communication_dos": ["string"],
    "communication_donts": ["string"]
  },
  "sales_intelligence": {
    "ideal_customer_traits": ["string"],
    "buying_signals": ["string"],
    "common_objections": [{"objection": "string", "response": "string"}],
    "engagement_tips": ["string"]
  },
  "agent_training_data": {
    "must_know_facts": ["string"],
    "talking_points": { "discovery": ["string"], "demo": ["string"], "closing": ["string"] },
    "faq_responses": [{"question": "string", "answer": "string"}]
  },
  "knowledge_gaps": ["string"],
  "recommendations": ["string"]
}`;

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are an expert business analyst and AI training specialist. Provide comprehensive, actionable research in valid JSON format.",
            },
            {
              role: "user",
              content: researchPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(
        errorData.error?.message || "OpenAI API request failed"
      );
    }

    const openaiData = await openaiResponse.json();
    const researchContent = openaiData.choices?.[0]?.message?.content;

    if (!researchContent) {
      throw new Error("No content in OpenAI response");
    }

    let researchData;
    try {
      const jsonMatch = researchContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        researchData = JSON.parse(jsonMatch[0]);
      } else {
        researchData = JSON.parse(researchContent);
      }
    } catch (parseError) {
      console.error("Failed to parse research JSON:", parseError);
      researchData = {
        raw_content: researchContent,
        parsing_error: "Could not parse as JSON",
      };
    }

    if (researchData.messaging_guidelines?.brand_voice) {
      await supabase
        .from("company_profiles")
        .update({
          brand_voice: researchData.messaging_guidelines.brand_voice,
        })
        .eq("id", company_profile_id);
    }

    if (researchData.messaging_guidelines?.communication_dos) {
      await supabase
        .from("company_profiles")
        .update({
          communication_dos: researchData.messaging_guidelines.communication_dos,
        })
        .eq("id", company_profile_id);
    }

    if (researchData.messaging_guidelines?.communication_donts) {
      await supabase
        .from("company_profiles")
        .update({
          communication_donts:
            researchData.messaging_guidelines.communication_donts,
        })
        .eq("id", company_profile_id);
    }

    if (researchData.sales_intelligence?.ideal_customer_traits) {
      await supabase
        .from("company_profiles")
        .update({
          ideal_customer_profile: {
            traits: researchData.sales_intelligence.ideal_customer_traits,
            buying_signals: researchData.sales_intelligence.buying_signals,
          },
        })
        .eq("id", company_profile_id);
    }

    await supabase.from("company_training_sessions").insert({
      company_profile_id,
      training_type: "full",
      affected_agents: [
        "email_generation",
        "prioritization",
        "conversation_analysis",
        "deal_analysis",
      ],
      training_status: "completed",
      metrics: researchData,
      completed_at: new Date().toISOString(),
    });

    await supabase
      .from("company_profiles")
      .update({
        last_trained_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", company_profile_id);

    return new Response(
      JSON.stringify({
        success: true,
        research_data: researchData,
        model_used: openaiData.model,
        tokens_used: openaiData.usage,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error conducting deep research:", error);

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
