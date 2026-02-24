import { useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CheckCircle, Gift } from 'lucide-react';

export function RedemptionSuccess() {
  const [searchParams] = useSearchParams();
  const rewardCount = searchParams.get('rewards') || '1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <Card className="p-8 text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Rewards Claimed Successfully!
        </h1>

        <p className="text-gray-600 mb-6">
          You have successfully claimed {rewardCount} reward{rewardCount !== '1' ? 's' : ''}.
          Check your email for redemption details and instructions.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Gift className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-sm text-green-800 font-medium mb-1">
                What's Next?
              </p>
              <p className="text-sm text-green-700">
                Your rewards and voucher codes have been sent to your email.
                You can use them on your next purchase or redeem them as instructed.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => window.close()}
          className="w-full"
        >
          Close Window
        </Button>
      </Card>
    </div>
  );
}
