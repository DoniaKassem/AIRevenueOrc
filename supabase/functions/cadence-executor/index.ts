import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function executeStep(
  supabase: any,
  step: any,
  enrollment: any,
  prospect: any
) {
  console.log(`Executing ${step.type} step for prospect ${prospect.id}`);

  switch (step.type) {
    case "email":
      if (step.template_id && prospect.email) {
        const { data: template } = await supabase
          .from("email_templates")
          .select("*")
          .eq("id", step.template_id)
          .maybeSingle();

        if (template) {
          let subject = template.subject;
          let body = template.body;

          subject = subject.replace(/\{\{first_name\}\}/g, prospect.first_name || "");
          subject = subject.replace(/\{\{last_name\}\}/g, prospect.last_name || "");
          subject = subject.replace(/\{\{company\}\}/g, prospect.company || "");

          body = body.replace(/\{\{first_name\}\}/g, prospect.first_name || "");
          body = body.replace(/\{\{last_name\}\}/g, prospect.last_name || "");
          body = body.replace(/\{\{company\}\}/g, prospect.company || "");
          body = body.replace(/\{\{title\}\}/g, prospect.title || "");

          await supabase.from("email_sends").insert({
            template_id: template.id,
            prospect_id: prospect.id,
            cadence_enrollment_id: enrollment.id,
            subject: subject,
            body: body,
            status: "queued",
          });

          await supabase.from("job_queue").insert({
            job_type: "send_email",
            payload: {
              prospect_id: prospect.id,
              email: prospect.email,
              subject: subject,
              body: body,
            },
            status: "pending",
          });
        }
      }
      break;

    case "call":
      await supabase.from("job_queue").insert({
        job_type: "schedule_call",
        payload: {
          prospect_id: prospect.id,
          cadence_enrollment_id: enrollment.id,
          phone: prospect.phone,
          notes: step.content,
        },
        status: "pending",
      });
      break;

    case "linkedin":
      await supabase.from("job_queue").insert({
        job_type: "linkedin_outreach",
        payload: {
          prospect_id: prospect.id,
          linkedin_url: prospect.linkedin_url,
          message: step.content,
        },
        status: "pending",
      });
      break;

    case "sms":
      if (prospect.phone) {
        await supabase.from("job_queue").insert({
          job_type: "send_sms",
          payload: {
            prospect_id: prospect.id,
            phone: prospect.phone,
            message: step.content,
          },
          status: "pending",
        });
      }
      break;

    case "task":
      await supabase.from("job_queue").insert({
        job_type: "create_task",
        payload: {
          prospect_id: prospect.id,
          description: step.content,
          cadence_enrollment_id: enrollment.id,
        },
        status: "pending",
      });
      break;
  }
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

    const { data: activeEnrollments, error: enrollmentsError } = await supabase
      .from("cadence_enrollments")
      .select(`
        *,
        cadence:cadences(*),
        prospect:prospects(*)
      `)
      .eq("status", "active");

    if (enrollmentsError) throw enrollmentsError;

    const results = [];

    for (const enrollment of activeEnrollments || []) {
      const { data: steps, error: stepsError } = await supabase
        .from("cadence_steps")
        .select("*")
        .eq("cadence_id", enrollment.cadence_id)
        .order("step_number");

      if (stepsError) continue;

      const currentStep = steps?.find(
        (s: any) => s.step_number === enrollment.current_step
      );

      if (!currentStep) {
        await supabase
          .from("cadence_enrollments")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", enrollment.id);
        results.push({ enrollment_id: enrollment.id, status: "completed" });
        continue;
      }

      const enrolledDate = new Date(enrollment.enrolled_at);
      const daysSinceEnrolled = Math.floor(
        (Date.now() - enrolledDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let totalDelay = 0;
      for (let i = 0; i < enrollment.current_step - 1; i++) {
        const prevStep = steps[i];
        if (prevStep) {
          totalDelay += prevStep.delay_days;
        }
      }

      totalDelay += currentStep.delay_days;

      if (daysSinceEnrolled >= totalDelay) {
        await executeStep(
          supabase,
          currentStep,
          enrollment,
          enrollment.prospect
        );

        const nextStep = enrollment.current_step + 1;
        const hasMoreSteps = steps?.some((s: any) => s.step_number === nextStep);

        if (hasMoreSteps) {
          await supabase
            .from("cadence_enrollments")
            .update({ current_step: nextStep })
            .eq("id", enrollment.id);
          results.push({
            enrollment_id: enrollment.id,
            status: "step_executed",
            next_step: nextStep,
          });
        } else {
          await supabase
            .from("cadence_enrollments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", enrollment.id);
          results.push({ enrollment_id: enrollment.id, status: "completed" });
        }
      } else {
        results.push({
          enrollment_id: enrollment.id,
          status: "waiting",
          days_until_next: totalDelay - daysSinceEnrolled,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
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