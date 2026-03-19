import type { SupabaseClient } from '@supabase/supabase-js';

interface UploadOfferCodesInput {
  supabase: SupabaseClient;
  offerId: string;
  codes: string[];
  expiresAt?: string | null;
}

interface UploadOfferCodesResult {
  success: boolean;
  inserted: number;
  skipped_duplicates: number;
  total_available: number;
  total_uploaded: number;
  error?: string;
}

function normalizeCodes(codes: string[]): string[] {
  return Array.from(
    new Set(
      codes
        .map((c) => (typeof c === 'string' ? c.trim() : ''))
        .filter((c) => c.length > 0)
    )
  );
}

export async function uploadOfferCodesDirect({
  supabase,
  offerId,
  codes,
  expiresAt,
}: UploadOfferCodesInput): Promise<UploadOfferCodesResult> {
  const normalizedCodes = normalizeCodes(codes);

  if (!offerId) {
    return {
      success: false,
      inserted: 0,
      skipped_duplicates: 0,
      total_available: 0,
      total_uploaded: 0,
      error: 'Missing offer id',
    };
  }

  if (normalizedCodes.length === 0) {
    return {
      success: false,
      inserted: 0,
      skipped_duplicates: 0,
      total_available: 0,
      total_uploaded: 0,
      error: 'No valid codes found',
    };
  }

  if (normalizedCodes.length > 1000) {
    return {
      success: false,
      inserted: 0,
      skipped_duplicates: 0,
      total_available: 0,
      total_uploaded: 0,
      error: 'Max 1000 codes per upload',
    };
  }

  const { data: existingRows, error: existingErr } = await supabase
    .from('offer_codes')
    .select('code')
    .eq('offer_id', offerId)
    .in('code', normalizedCodes);

  if (existingErr) {
    return {
      success: false,
      inserted: 0,
      skipped_duplicates: 0,
      total_available: 0,
      total_uploaded: 0,
      error: existingErr.message,
    };
  }

  const existingSet = new Set((existingRows ?? []).map((r: any) => r.code));
  const codesToInsert = normalizedCodes.filter((code) => !existingSet.has(code));

  let inserted = 0;
  if (codesToInsert.length > 0) {
    const rows = codesToInsert.map((code) => ({
      offer_id: offerId,
      code,
      status: 'available',
      expires_at: expiresAt || null,
    }));

    const { error: insertErr } = await supabase
      .from('offer_codes')
      .upsert(rows as any, { onConflict: 'offer_id,code', ignoreDuplicates: true });

    if (insertErr) {
      return {
        success: false,
        inserted: 0,
        skipped_duplicates: 0,
        total_available: 0,
        total_uploaded: 0,
        error: insertErr.message,
      };
    }

    inserted = codesToInsert.length;
  }

  const [{ count: totalUploaded, error: totalErr }, { count: totalAvailable, error: availErr }] = await Promise.all([
    supabase.from('offer_codes').select('id', { count: 'exact', head: true }).eq('offer_id', offerId),
    supabase.from('offer_codes').select('id', { count: 'exact', head: true }).eq('offer_id', offerId).eq('status', 'available'),
  ]);

  if (totalErr || availErr) {
    return {
      success: false,
      inserted,
      skipped_duplicates: normalizedCodes.length - inserted,
      total_available: 0,
      total_uploaded: 0,
      error: totalErr?.message || availErr?.message || 'Failed to compute code counts',
    };
  }

  // Keep rewards counters in sync with actual offer_codes rows.
  await (supabase as any)
    .from('rewards')
    .update({
      total_codes_uploaded: totalUploaded ?? 0,
      available_codes: totalAvailable ?? 0,
    })
    .eq('id', offerId);

  return {
    success: true,
    inserted,
    skipped_duplicates: normalizedCodes.length - inserted,
    total_available: totalAvailable ?? 0,
    total_uploaded: totalUploaded ?? 0,
  };
}
