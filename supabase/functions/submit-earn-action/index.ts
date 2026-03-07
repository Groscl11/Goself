import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Parse & validate request body ──────────────────────────────────────────
    const body = await req.json();
    const {
      member_user_id,
      client_id,
      rule_id,
      rule_type,
      metadata: submitMeta = {},
    } = body as {
      member_user_id?: string;
      client_id?: string;
      rule_id?: string;
      rule_type?: string;
      metadata?: Record<string, unknown>;
    };

    if (!member_user_id || !client_id || !rule_id || !rule_type) {
      return jsonResponse(
        { error: "member_user_id, client_id, rule_id and rule_type are all required" },
        400
      );
    }

    // ── 1. Load the earning rule ───────────────────────────────────────────────
    const { data: rule, error: ruleErr } = await supabase
      .from("loyalty_earning_rules")
      .select(
        "id, rule_type, name, points_reward, is_active, " +
        "max_times_per_customer, cooldown_days, " +
        "social_platform, social_url, " +
        "client_id"
      )
      .eq("id", rule_id)
      .eq("client_id", client_id)
      .eq("is_active", true)
      .maybeSingle();

    if (ruleErr) {
      console.error("Rule fetch error:", ruleErr);
      return jsonResponse({ error: "Failed to fetch earning rule" }, 500);
    }

    if (!rule) {
      return jsonResponse(
        { error: "Earning rule not found, inactive, or does not belong to this client" },
        404
      );
    }

    if (rule.rule_type !== rule_type) {
      return jsonResponse(
        { error: `rule_type mismatch: rule is '${rule.rule_type}', submitted '${rule_type}'` },
        400
      );
    }

    const pointsToAward: number = rule.points_reward ?? 0;
    if (pointsToAward <= 0) {
      return jsonResponse({ error: "This rule awards 0 points and is not actionable" }, 400);
    }

    // ── 2. Verify the member belongs to this client ──────────────────────────
    const { data: member, error: memberErr } = await supabase
      .from("member_users")
      .select("id, email, full_name")
      .eq("id", member_user_id)
      .eq("client_id", client_id)
      .maybeSingle();

    if (memberErr || !member) {
      return jsonResponse({ error: "Member not found for this client" }, 404);
    }

    // ── 3. Cooldown / max_times_per_customer check ───────────────────────────
    if (rule.max_times_per_customer !== null || rule.cooldown_days !== null) {
      let countQuery = supabase
        .from("loyalty_points_transactions")
        .select("id", { count: "exact", head: true })
        .eq("member_user_id", member_user_id)
        .eq("transaction_type", "earned")
        .contains("metadata", { rule_id });

      // If cooldown_days is set, only look back that many days
      if (rule.cooldown_days !== null) {
        const since = new Date(
          Date.now() - rule.cooldown_days * 24 * 60 * 60 * 1000
        ).toISOString();
        countQuery = countQuery.gte("created_at", since);
      }

      const { count: priorCount, error: countErr } = await countQuery;

      if (countErr) {
        console.error("Cooldown check error:", countErr);
        return jsonResponse({ error: "Failed to check earn limits" }, 500);
      }

      const timesEarned = priorCount ?? 0;

      if (
        rule.max_times_per_customer !== null &&
        timesEarned >= rule.max_times_per_customer
      ) {
        return jsonResponse(
          {
            error: "Earn limit reached",
            detail: `This rule can only be earned ${rule.max_times_per_customer} time(s) per customer`,
            times_earned: timesEarned,
            limit: rule.max_times_per_customer,
          },
          409
        );
      }

      if (rule.cooldown_days !== null && timesEarned > 0) {
        return jsonResponse(
          {
            error: "Cooldown active",
            detail: `This rule can be earned once every ${rule.cooldown_days} day(s)`,
            cooldown_days: rule.cooldown_days,
          },
          409
        );
      }
    }

    // ── 4. Load member loyalty status ────────────────────────────────────────
    const { data: loyaltyStatus, error: statusErr } = await supabase
      .from("member_loyalty_status")
      .select("id, points_balance, lifetime_points_earned")
      .eq("member_user_id", member_user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (statusErr) {
      console.error("Loyalty status fetch error:", statusErr);
      return jsonResponse({ error: "Failed to fetch loyalty status" }, 500);
    }

    if (!loyaltyStatus) {
      return jsonResponse(
        {
          error: "No loyalty program found for this member",
          detail: "The member must be enrolled in a loyalty program before earning points",
        },
        404
      );
    }

    const currentBalance: number = loyaltyStatus.points_balance ?? 0;
    const newBalance = currentBalance + pointsToAward;
    const currentLifetime: number = loyaltyStatus.lifetime_points_earned ?? 0;

    // ── 5. Write the points transaction ──────────────────────────────────────
    const description = buildDescription(rule_type, rule, submitMeta);
    const txnMeta = {
      rule_id,
      rule_type,
      rule_name: rule.name,
      submitted_by: (submitMeta.submitted_by as string) ?? "plugin",
      ...submitMeta,
    };

    const { error: txnErr } = await supabase
      .from("loyalty_points_transactions")
      .insert({
        member_loyalty_status_id: loyaltyStatus.id,
        member_user_id,
        transaction_type: "earned",
        points_amount: pointsToAward,
        balance_after: newBalance,
        description,
        metadata: txnMeta,
      });

    if (txnErr) {
      console.error("Transaction insert error:", txnErr);
      return jsonResponse({ error: "Failed to record points transaction" }, 500);
    }

    // ── 6. Update loyalty status balance ─────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("member_loyalty_status")
      .update({
        points_balance: newBalance,
        lifetime_points_earned: currentLifetime + pointsToAward,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loyaltyStatus.id);

    if (updateErr) {
      console.error("Balance update error:", updateErr);
      // Transaction already written — log but don't fail the response
      // balance will reconcile on next recalc
      console.warn("Points transaction written but balance update failed — manual reconciliation may be needed");
    }

    console.log(
      `Earn action '${rule_type}' for member ${member_user_id}: +${pointsToAward} pts → new balance ${newBalance}`
    );

    return jsonResponse({
      success: true,
      points_awarded: pointsToAward,
      previous_balance: currentBalance,
      new_balance: newBalance,
      rule: {
        id: rule.id,
        type: rule.rule_type,
        name: rule.name,
      },
      member: {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Unhandled error in submit-earn-action:", message);
    return jsonResponse({ error: message }, 500);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDescription(
  ruleType: string,
  rule: { name: string; social_platform?: string | null },
  meta: Record<string, unknown>
): string {
  switch (ruleType) {
    case "signup":
      return `Sign-up bonus: ${rule.name}`;
    case "birthday":
      return `Birthday reward: ${rule.name}`;
    case "profile_complete":
      return `Profile completion reward: ${rule.name}`;
    case "social_follow": {
      const platform =
        (meta.social_platform as string) ?? rule.social_platform ?? "social media";
      return `Followed on ${capitalize(platform)}: ${rule.name}`;
    }
    case "review":
      return `Review submitted: ${rule.name}`;
    case "referral":
      return `Referral reward: ${rule.name}`;
    case "custom":
      return (meta.description as string) ?? `Custom action: ${rule.name}`;
    default:
      return `Points earned: ${rule.name}`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
