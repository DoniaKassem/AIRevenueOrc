import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessDocumentRequest {
  document_id: string;
  file_content?: string;
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

    const { document_id, file_content }: ProcessDocumentRequest = await req.json();

    if (!document_id) {
      throw new Error("document_id is required");
    }

    const { data: document, error: docError } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !document) {
      throw new Error("Document not found");
    }

    await supabase
      .from("knowledge_documents")
      .update({ processing_status: "processing" })
      .eq("id", document_id);

    let extractedText = file_content || "";

    if (!extractedText && document.storage_path) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("knowledge-documents")
        .download(document.storage_path);

      if (downloadError) {
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }

      extractedText = await fileData.text();
    }

    if (!extractedText) {
      throw new Error("No content to process");
    }

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

    await supabase
      .from("knowledge_documents")
      .update({
        extracted_text: extractedText,
        content_chunks: chunks,
        processing_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", document_id);

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
          company_profile_id: document.company_profile_id,
          source_type: "document",
          source_id: document_id,
          chunk_text: chunk.text,
          chunk_index: chunk.index,
          embedding: embedding,
          metadata: {
            file_name: document.file_name,
            document_type: document.document_type,
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
      company_profile_id: document.company_profile_id,
      training_type: "document_added",
      knowledge_sources_count: 1,
      embeddings_generated: embeddingsToInsert.length,
      training_status: "completed",
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        document_id,
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
    console.error("Error processing document:", error);

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
