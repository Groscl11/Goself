import React, { useState } from 'react';
import type { ClaimAllocation } from '../../hooks/useClaimToken';

interface RewardCodeBoxProps {
  allocation: ClaimAllocation;
}

export function RewardCodeBox({ allocation }: RewardCodeBoxProps) {
  const [copied, setCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const hasCode = Boolean(allocation.voucher_code);
  const hasUrl = Boolean(allocation.redemption_url);

  async function handleCopy() {
    if (!allocation.voucher_code) return;
    try {
      await navigator.clipboard.writeText(allocation.voucher_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback silent
    }
  }

  return (
    <div
      className="overflow-hidden"
      style={{
        border: '1.5px solid var(--gs-brand-light)',
        borderRadius: 'var(--gs-radius)',
        background: '#fff',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-start gap-3"
        style={{ background: 'var(--gs-brand-light)' }}
      >
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold leading-snug"
            style={{ color: 'var(--gs-brand-dark)', fontFamily: 'var(--gs-font)' }}
          >
            {allocation.reward_title}
          </p>
        </div>
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm"
          style={{ background: 'var(--gs-brand)', color: '#fff' }}
        >
          🎁
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Voucher code */}
        {hasCode && (
          <div>
            <p className="text-xs text-gray-400 mb-1 font-medium">Your code</p>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 px-3 py-2.5 text-center font-mono font-bold tracking-widest text-sm rounded-xl"
                style={{ background: '#f4f4f0', color: '#1a1a1a', letterSpacing: '0.18em' }}
              >
                {allocation.voucher_code}
              </div>
              <button
                onClick={handleCopy}
                className="px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap"
                style={{
                  background: copied ? '#22c55e' : 'var(--gs-brand)',
                  color: '#fff',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Redeem link */}
        {hasUrl && (
          <a
            href={allocation.redemption_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity duration-200 hover:opacity-90"
            style={{ background: 'var(--gs-brand)', color: '#fff' }}
          >
            <span>Redeem Now</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
              <path
                d="M4 8h8M9 5l3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}

        {/* How to redeem accordion */}
        <button
          onClick={() => setShowSteps((s) => !s)}
          className="w-full flex items-center justify-between text-xs font-medium py-1"
          style={{ color: 'var(--gs-brand)' }}
        >
          <span>How to redeem</span>
          <svg
            className="w-4 h-4 transition-transform duration-200"
            style={{ transform: showSteps ? 'rotate(180deg)' : 'none' }}
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {showSteps && (
          <ol className="space-y-1 text-xs text-gray-600 list-none">
            {hasCode && hasUrl && (
              <>
                <li className="flex gap-2">
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold"
                    style={{ background: 'var(--gs-brand)' }}
                  >
                    1
                  </span>
                  Copy the code above.
                </li>
                <li className="flex gap-2">
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold"
                    style={{ background: 'var(--gs-brand)' }}
                  >
                    2
                  </span>
                  Tap "Redeem Now" and paste code at checkout.
                </li>
              </>
            )}
            {hasCode && !hasUrl && (
              <>
                <li className="flex gap-2">
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold"
                    style={{ background: 'var(--gs-brand)' }}
                  >
                    1
                  </span>
                  Copy the code above.
                </li>
                <li className="flex gap-2">
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold"
                    style={{ background: 'var(--gs-brand)' }}
                  >
                    2
                  </span>
                  Paste the code when checking out.
                </li>
              </>
            )}
            {!hasCode && hasUrl && (
              <li className="flex gap-2">
                <span
                  className="flex-shrink-0 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold"
                  style={{ background: 'var(--gs-brand)' }}
                >
                  1
                </span>
                Tap "Redeem Now" to claim your reward.
              </li>
            )}
          </ol>
        )}
      </div>
    </div>
  );
}
