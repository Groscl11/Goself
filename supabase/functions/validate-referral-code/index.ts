import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ReferralValidationRequest {
  referral_code: string;
  client_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const referralCode = url.searchParams.get('code');

      if (!referralCode) {
        return new Response(
          JSON.stringify({ error: 'Referral code is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: loyaltyStatus, error } = await supabase
        .from('member_loyalty_status')
        .select(`
          id,
          member_user_id,
          referral_code,
          loyalty_program_id,
          member_users!inner(
            full_name,
            email,
            client_id
          ),
          loyalty_programs!inner(
            program_name,
            client_id
          )
        `)
        .eq('referral_code', referralCode.toUpperCase())
        .maybeSingle();

      if (error) {
        console.error('Database error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to validate referral code' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!loyaltyStatus) {
        return new Response(
          JSON.stringify({ valid: false, message: 'Invalid referral code' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          referrer_name: loyaltyStatus.member_users.full_name,
          program_name: loyaltyStatus.loyalty_programs.program_name,
          client_id: loyaltyStatus.loyalty_programs.client_id,
          loyalty_program_id: loyaltyStatus.loyalty_program_id,
          referrer_member_id: loyaltyStatus.member_user_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (req.method === 'POST') {
      const body: ReferralValidationRequest = await req.json();

      if (!body.referral_code) {
        return new Response(
          JSON.stringify({ error: 'Referral code is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: loyaltyStatus, error } = await supabase
        .from('member_loyalty_status')
        .select(`
          id,
          member_user_id,
          referral_code,
          loyalty_program_id,
          member_users!inner(
            full_name,
            client_id
          )
        `)
        .eq('referral_code', body.referral_code.toUpperCase())
        .maybeSingle();

      if (error || !loyaltyStatus) {
        return new Response(
          JSON.stringify({ valid: false }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (body.client_id && loyaltyStatus.member_users.client_id !== body.client_id) {
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'Referral code is not valid for this program'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          loyalty_program_id: loyaltyStatus.loyalty_program_id,
          referrer_member_id: loyaltyStatus.member_user_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
