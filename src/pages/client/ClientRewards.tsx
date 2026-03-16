import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { clientMenuItems } from './clientMenuItems';
import { supabase } from '../../lib/supabase';

interface OfferRow {
  id: string;
  title: string;
  offer_type: string;
  coupon_type: string;
  tracking_type: string;
  is_active: boolean;
  is_marketplace_listed: boolean;
  available_codes: number;
  total_codes_uploaded: number;
  created_at: string;
}

interface MarketplaceOffer {
  id: string;
  title: string;
  description: string | null;
  issuer_name: string | null;
  coupon_type: string;
  available_codes: number;
  already_adopted: boolean;
  my_points_cost: number | null;
}

const TABS = [
  { id: 'my_offers', label: 'My Offers' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'analytics', label: 'Analytics' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ClientRewards() {
  const [clientId, setClientId] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [tab, setTab] = useState<TabId>('my_offers');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [myOffers, setMyOffers] = useState<OfferRow[]>([]);
  const [marketplaceOffers, setMarketplaceOffers] = useState<MarketplaceOffer[]>([]);

  const [redeemOfferId, setRedeemOfferId] = useState<string | null>(null);
  const [redeemRowsText, setRedeemRowsText] = useState('');

  const [adoptOffer, setAdoptOffer] = useState<MarketplaceOffer | null>(null);
  const [adoptPointsCost, setAdoptPointsCost] = useState('500');
  const [adoptAccessType, setAdoptAccessType] = useState<'points_redemption' | 'campaign_reward' | 'both'>('points_redemption');

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

    await Promise.all([loadMyOffers(resolvedClientId), loadMarketplace(resolvedClientId, resolvedShop)]);
    setLoading(false);
  }

  async function loadMyOffers(currentClientId = clientId) {
    if (!currentClientId) return;

    const { data, error } = await supabase
      .from('rewards')
      .select('id, title, offer_type, coupon_type, tracking_type, is_active, is_marketplace_listed, available_codes, total_codes_uploaded, created_at')
      .or(`owner_client_id.eq.${currentClientId},client_id.eq.${currentClientId}`)
      .order('created_at', { ascending: false });

    if (error) {
      alert(`Failed to load offers: ${error.message}`);
      return;
    }

    setMyOffers((data || []) as OfferRow[]);
  }

  async function loadMarketplace(currentClientId = clientId, currentShop = shopDomain) {
    if (!currentClientId && !currentShop) return;

    const { data, error } = await supabase.functions.invoke('get-marketplace-offers', {
      body: {
        client_id: currentClientId || undefined,
        shop_domain: currentShop || undefined,
      },
    });

    if (error || !data?.success) {
      setMarketplaceOffers([]);
      return;
    }

    setMarketplaceOffers((data.offers || []) as MarketplaceOffer[]);
  }

  async function toggleMarketplaceListing(offer: OfferRow) {
    setSaving(offer.id);

    const { error } = await (supabase
      .from('rewards' as any) as any)
      .update({
        is_marketplace_listed: !offer.is_marketplace_listed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', offer.id);

    if (error) {
      alert(`Failed to update listing: ${error.message}`);
      setSaving(null);
      return;
    }

    await Promise.all([loadMyOffers(), loadMarketplace()]);
    setSaving(null);
  }

  async function submitRedemptionUpload() {
    if (!redeemOfferId || !shopDomain) return;

    const redemptions = redeemRowsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [code, redeemedAt] = line.split(',').map((v) => v.trim());
        return {
          code,
          redeemed_at: redeemedAt || new Date().toISOString(),
        };
      })
      .filter((row) => row.code);

    if (redemptions.length === 0) {
      alert('Add redemption rows as CODE or CODE,ISO_TIMESTAMP');
      return;
    }

    setSaving(redeemOfferId);
    const { data, error } = await supabase.functions.invoke('upload-redemption-data', {
      body: {
        offer_id: redeemOfferId,
        shop_domain: shopDomain,
        redemptions,
      },
    });

    if (error || !data?.success) {
      alert(`Upload failed: ${data?.error || error?.message || 'Unknown error'}`);
      setSaving(null);
      return;
    }

    alert(`Updated ${data.updated} redemptions.`);
    setRedeemOfferId(null);
    setRedeemRowsText('');
    await loadMyOffers();
    setSaving(null);
  }

  async function adoptSelectedOffer() {
    if (!adoptOffer || !shopDomain) return;

    const points = Number(adoptPointsCost);
    if ((adoptAccessType === 'points_redemption' || adoptAccessType === 'both') && (!points || points <= 0)) {
      alert('Points cost must be greater than zero.');
      return;
    }

    setSaving(adoptOffer.id);
    const { data, error } = await supabase.functions.invoke('adopt-marketplace-offer', {
      body: {
        offer_id: adoptOffer.id,
        shop_domain: shopDomain,
        points_cost: points,
        access_type: adoptAccessType,
        max_per_member: 1,
      },
    });

    if (error || !data?.success) {
      alert(`Adoption failed: ${data?.error || error?.message || 'Unknown error'}`);
      setSaving(null);
      return;
    }

    setAdoptOffer(null);
    await Promise.all([loadMarketplace(), loadMyOffers()]);
    setSaving(null);
  }

  const analytics = useMemo(() => {
    const total = myOffers.length;
    const listed = myOffers.filter((offer) => offer.is_marketplace_listed).length;
    const active = myOffers.filter((offer) => offer.is_active).length;
    const totalUploaded = myOffers.reduce((sum, offer) => sum + Number(offer.total_codes_uploaded || 0), 0);
    const totalAvailable = myOffers.reduce((sum, offer) => sum + Number(offer.available_codes || 0), 0);
    const redeemed = Math.max(totalUploaded - totalAvailable, 0);

    return {
      total,
      listed,
      active,
      totalUploaded,
      totalAvailable,
      redeemed,
    };
  }, [myOffers]);

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Client Rewards">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Client Rewards</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your offers, adopt marketplace offers, and track code performance.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3 mb-5 flex gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                tab === item.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading rewards...</div>
        ) : tab === 'my_offers' ? (
          <div className="grid gap-3">
            {myOffers.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-xl py-12 text-center text-sm text-gray-500">
                No offers found.
              </div>
            ) : (
              myOffers.map((offer) => (
                <div key={offer.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{offer.title}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-600 flex-wrap">
                        <span>{offer.offer_type}</span>
                        <span>{offer.coupon_type}</span>
                        <span>{offer.is_active ? 'Active' : 'Inactive'}</span>
                        <span>Marketplace: {offer.is_marketplace_listed ? 'Listed' : 'Private'}</span>
                        <span>
                          Codes: {offer.available_codes}/{offer.total_codes_uploaded}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {offer.tracking_type === 'manual' && (
                        <button
                          onClick={() => setRedeemOfferId(offer.id)}
                          className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 text-xs font-medium hover:bg-indigo-100"
                        >
                          Upload Redemptions
                        </button>
                      )}
                      <button
                        onClick={() => toggleMarketplaceListing(offer)}
                        disabled={saving === offer.id}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 bg-gray-50 text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
                      >
                        {saving === offer.id
                          ? 'Saving...'
                          : offer.is_marketplace_listed
                          ? 'Unlist Marketplace'
                          : 'Publish Marketplace'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : tab === 'marketplace' ? (
          <div className="grid gap-3">
            {marketplaceOffers.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-xl py-12 text-center text-sm text-gray-500">
                No marketplace offers available.
              </div>
            ) : (
              marketplaceOffers.map((offer) => (
                <div key={offer.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{offer.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{offer.description || 'No description'}</p>
                      <div className="flex gap-3 mt-2 text-xs text-gray-600 flex-wrap">
                        <span>Issuer: {offer.issuer_name || 'Unknown'}</span>
                        <span>Coupon: {offer.coupon_type}</span>
                        <span>Codes: {offer.available_codes}</span>
                        {offer.my_points_cost ? <span>Your Cost: {offer.my_points_cost} pts</span> : null}
                      </div>
                    </div>
                    <button
                      disabled={offer.already_adopted || saving === offer.id}
                      onClick={() => {
                        setAdoptOffer(offer);
                        setAdoptPointsCost(String(offer.my_points_cost || 500));
                        setAdoptAccessType('points_redemption');
                      }}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-50 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      {offer.already_adopted ? 'Adopted' : 'Adopt Offer'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Total Offers</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{analytics.total}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Marketplace Listed</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{analytics.listed}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Active Offers</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{analytics.active}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Codes Uploaded</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{analytics.totalUploaded}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Codes Available</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{analytics.totalAvailable}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Estimated Redeemed</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{analytics.redeemed}</p>
            </div>
          </div>
        )}

        {redeemOfferId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-5">
              <h2 className="text-lg font-semibold text-gray-900">Upload Redemption Data</h2>
              <p className="text-xs text-gray-500 mt-1">Format: CODE or CODE,2026-03-15T10:30:00Z (one per line)</p>
              <textarea
                value={redeemRowsText}
                onChange={(e) => setRedeemRowsText(e.target.value)}
                className="w-full mt-4 border border-gray-300 rounded-lg px-3 py-2 text-sm h-44 font-mono"
                placeholder={'ABC123\nXYZ999,2026-03-15T10:30:00Z'}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setRedeemOfferId(null);
                    setRedeemRowsText('');
                  }}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRedemptionUpload}
                  disabled={saving === redeemOfferId}
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg disabled:opacity-50"
                >
                  {saving === redeemOfferId ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        )}

        {adoptOffer && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-5">
              <h2 className="text-lg font-semibold text-gray-900">Adopt Marketplace Offer</h2>
              <p className="text-sm text-gray-600 mt-1">{adoptOffer.title}</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-600">Access Type</label>
                  <select
                    value={adoptAccessType}
                    onChange={(e) => setAdoptAccessType(e.target.value as typeof adoptAccessType)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  >
                    <option value="points_redemption">Points Redemption</option>
                    <option value="campaign_reward">Campaign Reward</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-600">Points Cost</label>
                  <input
                    type="number"
                    min={1}
                    value={adoptPointsCost}
                    onChange={(e) => setAdoptPointsCost(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setAdoptOffer(null)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={adoptSelectedOffer}
                  disabled={saving === adoptOffer.id}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50"
                >
                  {saving === adoptOffer.id ? 'Saving...' : 'Adopt Offer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
