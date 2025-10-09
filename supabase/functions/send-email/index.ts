import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  prospect_id: string;
  template_id?: string;
  subject: string;
  body: string;
  cadence_enrollment_id?: string;
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

    const emailData: EmailRequest = await req.json();

    const { data: prospect, error: prospectError } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", emailData.prospect_id)
      .maybeSingle();

    if (prospectError || !prospect) {
      throw new Error("Prospect not found");
    }

    const { data: emailRecord, error: insertError } = await supabase
      .from("email_sends")
      .insert({
        template_id: emailData.template_id,
        prospect_id: emailData.prospect_id,
        cadence_enrollment_id: emailData.cadence_enrollment_id,
        subject: emailData.subject,
        body: emailData.body,
        sent_by: user.id,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailRecord.id,
        message: "Email queued successfully",
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