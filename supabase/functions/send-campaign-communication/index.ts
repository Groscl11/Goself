import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { communication_id, batch_send } = await req.json();

    if (batch_send) {
      const { data: pendingCommunications, error: fetchError } = await supabase
        .from("communication_logs")
        .select("*")
        .eq("status", "pending")
        .limit(50);

      if (fetchError) {
        throw new Error(`Failed to fetch pending communications: ${fetchError.message}`);
      }

      const results = [];
      for (const comm of pendingCommunications || []) {
        const result = await sendCommunication(supabase, comm);
        results.push(result);
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: results.length,
          results,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!communication_id) {
      return new Response(
        JSON.stringify({ error: "communication_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: communication, error: fetchError } = await supabase
      .from("communication_logs")
      .select("*")
      .eq("id", communication_id)
      .maybeSingle();

    if (fetchError || !communication) {
      return new Response(
        JSON.stringify({ error: "Communication not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await sendCommunication(supabase, communication);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing communication:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function sendCommunication(supabase: any, communication: any) {
  try {
    console.log(`Sending ${communication.communication_type} to ${communication.recipient_email || communication.recipient_phone}`);

    let sendResult;
    
    if (communication.communication_type === "email") {
      sendResult = await sendEmail(communication);
    } else if (communication.communication_type === "sms") {
      sendResult = await sendSMS(communication);
    } else if (communication.communication_type === "whatsapp") {
      sendResult = await sendWhatsApp(communication);
    } else {
      throw new Error(`Unsupported communication type: ${communication.communication_type}`);
    }

    const updateData: any = {
      status: sendResult.success ? "sent" : "failed",
      sent_at: new Date().toISOString(),
      provider_response: sendResult.response,
    };

    if (!sendResult.success) {
      updateData.error_message = sendResult.error;
    }

    await supabase
      .from("communication_logs")
      .update(updateData)
      .eq("id", communication.id);

    return {
      success: sendResult.success,
      communication_id: communication.id,
      type: communication.communication_type,
      recipient: communication.recipient_email || communication.recipient_phone,
      message: sendResult.success ? "Communication sent successfully" : sendResult.error,
    };
  } catch (error) {
    console.error(`Failed to send communication ${communication.id}:`, error);
    
    await supabase
      .from("communication_logs")
      .update({
        status: "failed",
        error_message: error.message,
      })
      .eq("id", communication.id);

    return {
      success: false,
      communication_id: communication.id,
      error: error.message,
    };
  }
}

async function sendEmail(communication: any) {
  console.log("[SIMULATED] Sending email:");
  console.log("To:", communication.recipient_email);
  console.log("Subject:", communication.subject);
  console.log("Body:", communication.message_body);
  console.log("Link:", communication.personalized_url);

  return {
    success: true,
    response: {
      provider: "simulated",
      message_id: `sim_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  };
}

async function sendSMS(communication: any) {
  console.log("[SIMULATED] Sending SMS:");
  console.log("To:", communication.recipient_phone);
  console.log("Message:", communication.message_body);

  return {
    success: true,
    response: {
      provider: "simulated",
      message_id: `sms_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  };
}

async function sendWhatsApp(communication: any) {
  console.log("[SIMULATED] Sending WhatsApp:");
  console.log("To:", communication.recipient_phone);
  console.log("Message:", communication.message_body);

  return {
    success: true,
    response: {
      provider: "simulated",
      message_id: `wa_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  };
}