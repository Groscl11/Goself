import React, { useEffect, useState } from 'react';
import { CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface StepConnectShopifyProps {
  clientId: string;
  onNext: () => void;
  onBack: () => void;
}

interface Installation {
  shop_domain: string;
  shop_name: string | null;
  installation_status: string;
}

export function StepConnectShopify({ clientId, onNext, onBack }: StepConnectShopifyProps) {
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('store_installations')
          .select('shop_domain, shop_name, installation_status')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setInstallation(data ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  const SHOPIFY_APP_STORE_URL =
    'https://apps.shopify.com/goself-loyalty';

  const isConnected = installation?.installation_status === 'active';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Connect your Shopify store</h2>
        <p className="text-sm text-gray-500 mt-1">
          The GoSelf plugin pulls order data to trigger rewards automatically.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-2 border-t-violet-600 border-gray-100 rounded-full animate-spin" />
        </div>
      ) : isConnected ? (
        <div className="flex items-start gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">Store connected!</p>
            <p className="text-sm text-green-700 mt-0.5">
              {installation?.shop_name || installation?.shop_domain}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {installation?.shop_domain}
            </p>
          </div>
        </div>
      ) : installation ? (
        <div className="flex items-start gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">
              Store found but not active
            </p>
            <p className="text-sm text-yellow-700 mt-0.5">
              {installation.shop_domain} · Status: {installation.installation_status}
            </p>
            <a
              href={SHOPIFY_APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-yellow-800 underline mt-2"
            >
              Re-install app <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-sm text-gray-600">
              No Shopify store connected yet. Install the GoSelf app from the
              Shopify App Store to link your store.
            </p>
          </div>
          <a
            href={SHOPIFY_APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold bg-[#008060] text-white hover:bg-[#006e52] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.337 23.979l4.426-1.02L21.74 4.73c0-.134-.114-.23-.246-.23h-3.046c-.02 0-.04.003-.057.008l-.133.03-1.86 19.44z" />
              <path d="M11.64 7.786l-.507-.134c-.018-.004-.036-.007-.055-.007H8.033c-.142 0-.253.11-.271.25L6.37 21.89l4.423 1.019.848-15.123z" />
            </svg>
            Install on Shopify App Store
          </a>
          <div className="text-center">
            <button
              onClick={onNext}
              className="text-xs text-gray-400 underline hover:text-gray-600"
            >
              Skip for now — I'll connect later
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        >
          {isConnected ? 'Finish setup →' : 'Skip & Continue →'}
        </button>
      </div>
    </div>
  );
}
