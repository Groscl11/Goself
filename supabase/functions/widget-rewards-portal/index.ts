import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, phone, otp, widget_id, client_id } = await req.json();

    if (action === 'send_otp') {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await supabase
        .from('phone_verifications')
        .insert({
          phone_number: phone,
          otp: generatedOtp,
          expires_at: expiresAt,
          verified: false
        });

      console.log(`OTP for ${phone}: ${generatedOtp}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'OTP sent successfully',
          demo_otp: generatedOtp
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (action === 'verify_otp') {
      const { data: verification, error } = await supabase
        .from('phone_verifications')
        .select('*')
        .eq('phone_number', phone)
        .eq('otp', otp)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !verification) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid or expired OTP'
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      await supabase
        .from('phone_verifications')
        .update({ verified: true })
        .eq('id', verification.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('phone', phone)
        .maybeSingle();

      if (!profile) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No account found with this phone number'
          }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const { data: memberships } = await supabase
        .from('membership_enrollments')
        .select(`
          id,
          membership_program:membership_programs(
            id,
            program_name,
            description,
            client:clients(name)
          )
        `)
        .eq('member_id', profile.id)
        .eq('status', 'active');

      const { data: rewards } = await supabase
        .from('reward_allocations')
        .select(`
          id,
          quantity_allocated,
          quantity_redeemed,
          allocated_at,
          reward:rewards(
            id,
            reward_title,
            reward_description,
            reward_type,
            reward_value,
            image_url
          ),
          membership:membership_programs(
            id,
            program_name
          )
        `)
        .eq('member_id', profile.id)
        .eq('status', 'allocated')
        .gt('quantity_allocated', supabase.rpc('quantity_redeemed'));

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: profile.id,
            name: profile.full_name,
            email: profile.email,
            phone: phone
          },
          memberships: memberships || [],
          rewards: rewards || []
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid action'
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});