import { useState } from 'react';

interface StepGoalSelectProps {
  initial: string[];
  onNext: (goals: string[]) => void;
}

const GOALS = [
  {
    key: 'loyalty',
    icon: '⬡',
    title: 'Loyalty Program',
    desc: 'Reward customers with points on every order, set up tiers, and keep them coming back.',
    bullets: ['Points per ₹ spent', 'Bronze / Silver / Gold tiers', 'Widget on your store'],
    time: '~3 min',
  },
  {
    key: 'campaigns',
    icon: '🎯',
    title: 'Rewards Campaign',
    desc: 'Run time-limited campaigns — birthday rewards, anniversary bonuses, referral bursts.',
    bullets: ['Order-triggered rewards', 'Audience conditions', 'Auto-expiry guardrails'],
    time: '~4 min',
  },
  {
    key: 'affiliates',
    icon: '🔗',
    title: 'Affiliate Tracking',
    desc: 'Give influencers and partners unique coupon codes and UTM links with attribution.',
    bullets: ['Unique coupon per partner', 'UTM link builder', 'Revenue attribution'],
    time: '~2 min',
  },
] as const;

export function StepGoalSelect({ initial, onNext }: StepGoalSelectProps) {
  const [selected, setSelected] = useState<string[]>(initial.length ? initial : []);

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const canContinue = selected.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-base font-bold text-gray-900">What do you want to set up first?</h3>
        <p className="text-sm text-gray-400 mt-1">Pick one or more — you can always add the others later.</p>
      </div>

      <div className="flex flex-col gap-3">
        {GOALS.map((g) => {
          const isSelected = selected.includes(g.key);
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => toggle(g.key)}
              className={[
                'w-full text-left rounded-xl border-2 p-4 transition-all',
                isSelected
                  ? 'border-violet-600 bg-violet-50 shadow-sm ring-1 ring-violet-600'
                  : 'border-gray-100 hover:border-violet-200 hover:bg-gray-50',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5 flex-shrink-0">{g.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">{g.title}</span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{g.time}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{g.desc}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {g.bullets.map((b) => (
                      <span key={b} className="text-[11px] text-gray-400 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-violet-300 flex-shrink-0 inline-block" />
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={[
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                  isSelected ? 'bg-violet-600 border-violet-600' : 'border-gray-300',
                ].join(' ')}>
                  {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => canContinue && onNext(selected)}
        disabled={!canContinue}
        className={[
          'w-full py-2.5 rounded-xl text-sm font-semibold transition-all',
          canContinue
            ? 'bg-violet-600 text-white hover:bg-violet-700'
            : 'bg-gray-100 text-gray-300 cursor-not-allowed',
        ].join(' ')}
      >
        {canContinue ? `Continue with ${selected.length === 1 ? GOALS.find(g => g.key === selected[0])?.title : `${selected.length} selected`} →` : 'Choose at least one'}
      </button>
    </div>
  );
}
