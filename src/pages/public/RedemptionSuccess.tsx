import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CheckCircle, Copy, Check, ExternalLink, Share2, Gift } from 'lucide-react';

interface Allocation {
  reward_id: string;
  reward_title: string;
  voucher_code: string | null;
  redemption_url: string | null;
}

export function RedemptionSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    allocations?: Allocation[];
    rewardCount?: number;
    campaignName?: string;
  } | null;

  const allocations: Allocation[] = state?.allocations || [];
  const rewardCount = state?.rewardCount ?? allocations.length ?? 1;
  const campaignName = state?.campaignName || '';

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const buildWhatsAppText = () => {
    const lines = allocations.map((a) => {
      let line = `🎁 *${a.reward_title}*`;
      if (a.voucher_code) line += `\n   Code: \`${a.voucher_code}\``;
      if (a.redemption_url) line += `\n   Redeem: ${a.redemption_url}`;
      return line;
    });
    const text = `Hey! I just claimed ${rewardCount} reward${rewardCount !== 1 ? 's' : ''} from ${campaignName || 'a rewards campaign'}! 🎉\n\n${lines.join('\n\n')}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-600 rounded-full mb-4">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Rewards Claimed!</h1>
          <p className="text-gray-600">
            You successfully claimed {rewardCount} reward{rewardCount !== 1 ? 's' : ''}.
            {campaignName && ` Details below for ${campaignName}.`}
          </p>
        </div>

        {/* Reward cards */}
        {allocations.length > 0 ? (
          <div className="space-y-4 mb-6">
            {allocations.map((a) => (
              <Card key={a.reward_id} padding="none">
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                      <Gift className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-3">{a.reward_title}</h3>

                      {a.voucher_code ? (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Coupon Code</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 border border-dashed border-gray-300 rounded-lg px-4 py-2 font-mono text-lg font-bold text-gray-900 tracking-widest text-center select-all">
                              {a.voucher_code}
                            </div>
                            <button
                              onClick={() => copyCode(a.voucher_code!, a.reward_id)}
                              className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                copiedId === a.reward_id
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            >
                              {copiedId === a.reward_id ? (
                                <><Check className="w-4 h-4" /> Copied!</>
                              ) : (
                                <><Copy className="w-4 h-4" /> Copy</>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mb-3 italic">
                          No coupon code — this reward will be processed directly.
                        </p>
                      )}

                      {a.redemption_url && (
                        <a
                          href={a.redemption_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Redeem online
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mb-6">
            <div className="text-center py-4">
              <p className="text-gray-600">Your rewards are being processed. Check your email for details and voucher codes.</p>
            </div>
          </Card>
        )}

        {/* Email notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            📧 A confirmation with your reward details has been sent to your email address.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={buildWhatsAppText()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
          >
            <Share2 className="w-5 h-5" />
            Share on WhatsApp
          </a>
          <Button
            onClick={() => window.close()}
            className="flex-1"
          >
            Close Window
          </Button>
        </div>
      </div>
    </div>
  );
}
