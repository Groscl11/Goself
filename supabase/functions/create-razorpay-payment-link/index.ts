import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  client_id: string;
  amount: number;          // in INR (integer)
  description: string;
  plan_id?: string;
  billing_cycle?: 'monthly' | 'annual';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const razorpayKeyId     = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const supabaseUrl       = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(
        JSON.stringify({ error: 'Razorpay credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body: RequestBody = await req.json();
    const { client_id, amount, description, plan_id, billing_cycle } = body;

    if (!client_id || !amount || !description) {
      return new Response(
        JSON.stringify({ error: 'client_id, amount, and description are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'amount must be greater than 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Create Razorpay Payment Link ────────────────────────────────────────

    const credentials = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const razorpayBody = {
      amount: amount * 100,          // Razorpay accepts paise
      currency: 'INR',
      description,
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { client_id, plan_id: plan_id ?? '', billing_cycle: billing_cycle ?? '' },
    };

    const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(razorpayBody),
    });

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text();
      console.error('Razorpay error:', errBody);
      return new Response(
        JSON.stringify({ error: 'Failed to create payment link', detail: errBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rzpData = await rzpRes.json();
    const payment_link_url: string = rzpData.short_url ?? rzpData.id;
    const payment_link_id: string  = rzpData.id;

    // ── Upsert invoice record ───────────────────────────────────────────────

    const supabaseRes = await fetch(`${supabaseUrl}/rest/v1/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        client_id,
        amount_inr: amount,
        status: 'sent',
        billing_cycle: billing_cycle ?? null,
        plan_id: plan_id ?? null,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        payment_link_url,
        notes: description,
      }),
    });

    const invoiceRows = await supabaseRes.json();
    const invoice = Array.isArray(invoiceRows) ? invoiceRows[0] : invoiceRows;

    return new Response(
      JSON.stringify({
        payment_link_url,
        payment_link_id,
        invoice_id: invoice?.id ?? null,
        invoice_number: invoice?.invoice_number ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    console.error('create-razorpay-payment-link error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
