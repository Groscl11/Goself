import { useEffect, useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card, CardContent } from '../../components/ui/Card';
import { clientMenuItems } from './clientMenuItems';
import { supabase } from '../../lib/supabase';

export function LoyaltyConfiguration() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Loyalty Configuration">
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loyalty Configuration</h3>
            <p className="text-gray-600">Configure point earning rules and program settings</p>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
