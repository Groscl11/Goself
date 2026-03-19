export async function syncOfferCounters(supabase: any, offerId: string) {
  const [{ count: totalUploaded, error: totalErr }, { count: totalAvailable, error: availErr }] = await Promise.all([
    supabase.from("offer_codes").select("id", { count: "exact", head: true }).eq("offer_id", offerId),
    supabase.from("offer_codes").select("id", { count: "exact", head: true }).eq("offer_id", offerId).eq("status", "available"),
  ]);

  if (totalErr || availErr) {
    throw new Error(totalErr?.message || availErr?.message || "Failed to compute offer code counts");
  }

  const rewardUpdate = {
    total_codes_uploaded: totalUploaded ?? 0,
    available_codes: totalAvailable ?? 0,
    voucher_count: totalUploaded ?? 0,
  };

  const { error: updateErr } = await supabase
    .from("rewards")
    .update(rewardUpdate)
    .eq("id", offerId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  return {
    totalUploaded: totalUploaded ?? 0,
    totalAvailable: totalAvailable ?? 0,
  };
}