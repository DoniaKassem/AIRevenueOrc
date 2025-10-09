import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CrawlWebsiteRequest {
  website_id: string;
}

function extractTextFromHTML(html: string): string {
  let text = html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return text;
}

function extractSections(html: string): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = [];
  
  const headingMatches = html.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi);
  
  for (const match of headingMatches) {
    sections.push({
      heading: match[1].trim(),
      content: '',
    });
  }
  
  return sections;
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

    const { website_id }: CrawlWebsiteRequest = await req.json();

    if (!website_id) {
      throw new Error("website_id is required");
    }

    const { data: website, error: websiteError } = await supabase
      .from("knowledge_websites")
      .select("*")
      .eq("id", website_id)
      .single();

    if (websiteError || !website) {
      throw new Error("Website not found");
    }

    await supabase
      .from("knowledge_websites")
      .update({ sync_status: "syncing" })
      .eq("id", website_id);

    const crawlResponse = await fetch(website.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SalesBot/1.0)",
      },
    });

    if (!crawlResponse.ok) {
      throw new Error(`Failed to fetch website: ${crawlResponse.statusText}`);
    }

    const html = await crawlResponse.text();
    
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : website.url;

    const extractedText = extractTextFromHTML(html);
    const sections = extractSections(html);

    await supabase
      .from("knowledge_websites")
      .update({
        page_title: pageTitle,
        crawled_content: extractedText,
        content_sections: sections,
        last_synced_at: new Date().toISOString(),
        sync_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", website_id);

    const chunkSize = 1000;
    const overlap = 200;
    const chunks: { text: string; index: number }[] = [];

    for (let i = 0; i < extractedText.length; i += chunkSize - overlap) {
      const chunk = extractedText.slice(i, i + chunkSize);
      chunks.push({
        text: chunk,
        index: chunks.length,
      });
    }

    const embeddingsToInsert = [];
    for (const chunk of chunks) {
      try {
        const embeddingResponse = await fetch(
          "https://api.openai.com/v1/embeddings",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              input: chunk.text,
              model: "text-embedding-3-small",
            }),
          }
        );

        if (!embeddingResponse.ok) {
          console.error(
            `Failed to generate embedding for chunk ${chunk.index}`
          );
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        embeddingsToInsert.push({
          company_profile_id: website.company_profile_id,
          source_type: "website",
          source_id: website_id,
          chunk_text: chunk.text,
          chunk_index: chunk.index,
          embedding: embedding,
          metadata: {
            url: website.url,
            page_title: pageTitle,
          },
        });
      } catch (error) {
        console.error(`Error processing chunk ${chunk.index}:`, error);
      }
    }

    if (embeddingsToInsert.length > 0) {
      const { error: embeddingError } = await supabase
        .from("knowledge_embeddings")
        .insert(embeddingsToInsert);

      if (embeddingError) {
        console.error("Error inserting embeddings:", embeddingError);
      }
    }

    await supabase.from("company_training_sessions").insert({
      company_profile_id: website.company_profile_id,
      training_type: "website_synced",
      knowledge_sources_count: 1,
      embeddings_generated: embeddingsToInsert.length,
      training_status: "completed",
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        website_id,
        page_title: pageTitle,
        text_length: extractedText.length,
        sections_found: sections.length,
        chunks_processed: chunks.length,
        embeddings_created: embeddingsToInsert.length,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error crawling website:", error);

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
