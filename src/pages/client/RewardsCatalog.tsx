import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import { supabase } from '../../lib/supabase';

type OfferType = 'store_discount' | 'partner_voucher' | 'marketplace_offer';

interface CatalogOffer {
  offer_id: string;
  distribution_id: string;
  title: string;
  description: string | null;
  offer_type: OfferType;
  reward_type: string;
  discount_value: number;
  coupon_type: 'unique' | 'generic' | string;
  points_cost: number;
  issuer_name: string | null;
  available_codes: number;
  total_codes_uploaded: number;
  access_type: string;
  max_per_member: number;
}

interface CatalogResponse {
  success: boolean;
  store_discounts: CatalogOffer[];
  partner_vouchers: CatalogOffer[];
  marketplace_offers: CatalogOffer[];
  existing_codes: Record<string, { code: string | null; expires_at: string | null }>;
  error?: string;
}

const TABS = [
  { id: 'store_discounts', label: 'Store Discounts' },
  { id: 'partner_vouchers', label: 'Partner Vouchers' },
  { id: 'marketplace_offers', label: 'Marketplace Offers' },
  { id: 'existing_codes', label: 'Assigned Codes' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function RewardsCatalog() {
  const [clientId, setClientId] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [tab, setTab] = useState<TabId>('store_discounts');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploadingOfferId, setUploadingOfferId] = useState<string | null>(null);
  const [codesText, setCodesText] = useState('');
  const [codesExpiresAt, setCodesExpiresAt] = useState('');
  const [search, setSearch] = useState('');
  const [catalog, setCatalog] = useState<CatalogResponse>({
    success: true,
    store_discounts: [],
    partner_vouchers: [],
    marketplace_offers: [],
    existing_codes: {},
  });

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles' as any)
      .select('client_id')
      .eq('id', user.id)
      .maybeSingle();

    const resolvedClientId = (profile as any)?.client_id as string | undefined;
    if (!resolvedClientId) {
      setLoading(false);
      return;
    }

    setClientId(resolvedClientId);

    const { data: install } = await supabase
      .from('store_installations' as any)
      .select('shop_domain')
      .eq('client_id', resolvedClientId)
      .eq('installation_status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const installShopDomain = (install as any)?.shop_domain as string | undefined;

    const { data: integration } = !installShopDomain
      ? await supabase
          .from('integration_configs' as any)
          .select('shop_domain')
          .eq('client_id', resolvedClientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const resolvedShop = (installShopDomain || (integration as any)?.shop_domain || '') as string;
    setShopDomain(resolvedShop);

    await loadCatalog(resolvedClientId, resolvedShop);
  }

  async function loadCatalog(currentClientId = clientId, currentShop = shopDomain) {
    if (!currentClientId && !currentShop) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('get-rewards-catalog', {
      body: {
        client_id: currentClientId || undefined,
        shop_domain: currentShop || undefined,
      },
    });

    if (error) {
      const detailedError =
        (data as any)?.error ||
        ((error as any)?.context as any)?.error ||
        error.message;

      setCatalog({
        success: false,
        error: detailedError,
        store_discounts: [],
        partner_vouchers: [],
        marketplace_offers: [],
        existing_codes: {},
      });
      setLoading(false);
      return;
    }

    if (data?.success === false) {
      setCatalog({
        success: false,
        error: data?.error || 'Failed to load rewards catalog',
        store_discounts: data?.store_discounts || [],
        partner_vouchers: data?.partner_vouchers || [],
        marketplace_offers: data?.marketplace_offers || [],
        existing_codes: data?.existing_codes || {},
      });
      setLoading(false);
      return;
    }

    setCatalog({
      success: true,
      store_discounts: data?.store_discounts || [],
      partner_vouchers: data?.partner_vouchers || [],
      marketplace_offers: data?.marketplace_offers || [],
      existing_codes: data?.existing_codes || {},
    });
    setLoading(false);
  }

  async function toggleDistribution(offer: CatalogOffer) {
    setSaving(offer.distribution_id);

    const { data: current } = await supabase
      .from('offer_distributions' as any)
      .select('is_active')
      .eq('id', offer.distribution_id)
      .maybeSingle();

    const nextState = !((current as any)?.is_active ?? true);
    const { error } = await (supabase
      .from('offer_distributions' as any) as any)
      .update({ is_active: nextState, updated_at: new Date().toISOString() })
      .eq('id', offer.distribution_id);

    if (error) {
      alert(`Failed to update offer: ${error.message}`);
      setSaving(null);
      return;
    }

    await loadCatalog();
    setSaving(null);
  }

  async function submitCodes() {
    if (!uploadingOfferId || !shopDomain) return;

    const codes = codesText
      .split(/\r?\n/)
      .map((c) => c.trim())
      .filter(Boolean);

    if (codes.length === 0) {
      alert('Please provide at least one code.');
      return;
    }

    setSaving(uploadingOfferId);

    const { data, error } = await supabase.functions.invoke('upload-offer-codes', {
      body: {
        offer_id: uploadingOfferId,
        shop_domain: shopDomain,
        codes,
        expires_at: codesExpiresAt || null,
      },
    });

    if (error || !data?.success) {
      alert(`Upload failed: ${data?.error || error?.message || 'Unknown error'}`);
      setSaving(null);
      return;
    }

    alert(`Uploaded ${data.inserted} codes (${data.skipped_duplicates} duplicates skipped).`);
    setCodesText('');
    setCodesExpiresAt('');
    setUploadingOfferId(null);
    await loadCatalog();
    setSaving(null);
  }

  const currentOffers = useMemo(() => {
    const source =
      tab === 'store_discounts'
        ? catalog.store_discounts
        : tab === 'partner_vouchers'
        ? catalog.partner_vouchers
        : catalog.marketplace_offers;

    return source.filter((offer) => {
      if (!search.trim()) return true;
      const needle = search.toLowerCase();
      return (
        offer.title.toLowerCase().includes(needle) ||
        (offer.description || '').toLowerCase().includes(needle) ||
        (offer.issuer_name || '').toLowerCase().includes(needle)
      );
    });
  }, [catalog, tab, search]);

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Rewards Catalog">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Rewards Catalog</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage adopted offers, upload code pools, and control live availability.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 mb-5 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab !== 'existing_codes' && (
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search offers by title, issuer, or description"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading rewards catalog...</div>
        ) : !catalog.success ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {catalog.error || 'Failed to load rewards catalog.'}
          </div>
        ) : tab === 'existing_codes' ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {Object.keys(catalog.existing_codes).length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">No assigned codes found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-3">Offer ID</th>
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-left px-4 py-3">Expires At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(catalog.existing_codes).map(([offerId, value]) => (
                    <tr key={offerId}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{offerId}</td>
                      <td className="px-4 py-3 font-mono font-medium">{value.code || 'generic'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {value.expires_at ? new Date(value.expires_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {currentOffers.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-xl py-12 text-center text-sm text-gray-500">
                No offers found for this tab.
              </div>
            ) : (
              currentOffers.map((offer) => (
                <div key={offer.distribution_id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{offer.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{offer.description || 'No description'}</p>
                      <div className="flex gap-3 mt-2 text-xs text-gray-600 flex-wrap">
                        <span>Points: {offer.points_cost}</span>
                        <span>Type: {offer.offer_type}</span>
                        <span>Coupon: {offer.coupon_type}</span>
                        <span>Issuer: {offer.issuer_name || 'Your store'}</span>
                        {offer.coupon_type === 'unique' && (
                          <span>
                            Codes: {offer.available_codes}/{offer.total_codes_uploaded}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {offer.coupon_type === 'unique' && (
                        <button
                          onClick={() => setUploadingOfferId(offer.offer_id)}
                          className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 text-xs font-medium hover:bg-blue-100"
                        >
                          Upload Codes
                        </button>
                      )}
                      <button
                        onClick={() => toggleDistribution(offer)}
                        disabled={saving === offer.distribution_id}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 bg-gray-50 text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
                      >
                        {saving === offer.distribution_id ? 'Saving...' : 'Toggle Active'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {uploadingOfferId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-5">
              <h2 className="text-lg font-semibold text-gray-900">Upload Offer Codes</h2>
              <p className="text-xs text-gray-500 mt-1">One code per line. Duplicates are skipped.</p>

              <textarea
                value={codesText}
                onChange={(e) => setCodesText(e.target.value)}
                className="w-full mt-4 border border-gray-300 rounded-lg px-3 py-2 text-sm h-48 font-mono"
                placeholder={'CODE-001\nCODE-002\nCODE-003'}
              />

              <div className="mt-3">
                <label className="text-xs text-gray-600">Expiry (optional)</label>
                <input
                  type="datetime-local"
                  value={codesExpiresAt}
                  onChange={(e) => setCodesExpiresAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setUploadingOfferId(null);
                    setCodesText('');
                    setCodesExpiresAt('');
                  }}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCodes}
                  disabled={saving === uploadingOfferId}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50"
                >
                  {saving === uploadingOfferId ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
