import { Navigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { UserRole } from '../lib/database.types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export function RoleBasedRoute({ children, allowedRoles }: RoleBasedRouteProps) {
  const { profile, loading } = useAuth();
  const [shopifyChecked, setShopifyChecked] = useState(false);
  const triedSSO = useRef(false);

  useEffect(() => {
    // Already authenticated or auth still loading — no SSO needed
    if (profile || loading) {
      setShopifyChecked(true);
      return;
    }

    // Only try SSO once per mount
    if (triedSSO.current) {
      setShopifyChecked(true);
      return;
    }
    triedSSO.current = true;

    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setShopifyChecked(true);
    }, 6000);

    (async () => {
      try {
        const w = window as any;
        const bridge = w.shopify;
        if (!bridge?.idToken) {
          setShopifyChecked(true);
          return;
        }

        const sessionToken = await bridge.idToken().catch(() => null);
        const shopDomain = bridge.config?.shop as string | undefined;
        if (!sessionToken || !shopDomain || cancelled) {
          setShopifyChecked(true);
          return;
        }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/shopify-token-exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ session_token: sessionToken, shop: shopDomain }),
        });

        if (!res.ok || cancelled) {
          setShopifyChecked(true);
          return;
        }

        const data = await res.json().catch(() => null);
        if (data?.success && data.access_token && !cancelled) {
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token || '',
          });
          // onAuthStateChange fires → profile loads → this effect re-runs with profile set
        } else {
          setShopifyChecked(true);
        }
      } catch {
        setShopifyChecked(true);
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [loading, profile]);

  if (loading || (!profile && !shopifyChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
