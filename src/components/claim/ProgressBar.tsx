import React, { useEffect, useState } from 'react';

interface ProgressBarProps {
  expiresAt: string | null;
}

function msToDisplay(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function ProgressBar({ expiresAt }: ProgressBarProps) {
  const [remaining, setRemaining] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) return;

    const expires = new Date(expiresAt).getTime();
    const now = Date.now();
    const fullDuration = expires - (now - 3600_000); // assume 1h window max
    setTotal(Math.max(expires - now, 1));

    const tick = () => {
      const rem = expires - Date.now();
      setRemaining(Math.max(rem, 0));
    };
    tick();

    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const fillPct = total > 0 ? Math.min((remaining / total) * 100, 100) : 0;
  const urgent = remaining < 300_000; // < 5 minutes

  return (
    <div className="px-4 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: 'var(--gs-brand)' }}>
          Offer expires in
        </span>
        <span
          className="text-xs font-semibold tabular-nums"
          style={{ color: urgent ? '#ef4444' : 'var(--gs-brand)' }}
        >
          {msToDisplay(remaining)}
        </span>
      </div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: 'var(--gs-brand-light)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${fillPct}%`,
            background: urgent
              ? '#ef4444'
              : 'linear-gradient(90deg, var(--gs-brand-dark), var(--gs-brand))',
          }}
        />
      </div>
    </div>
  );
}
