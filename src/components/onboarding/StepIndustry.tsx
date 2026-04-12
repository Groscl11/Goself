import React, { useState } from 'react';

interface StepIndustryProps {
  initial: string;
  onNext: (industry: string) => void;
  onBack: () => void;
}

const INDUSTRIES = [
  { key: 'fashion',       label: 'Fashion & Apparel', emoji: '👗' },
  { key: 'food',          label: 'Food & Beverage',   emoji: '☕' },
  { key: 'beauty',        label: 'Beauty & Wellness', emoji: '💄' },
  { key: 'electronics',   label: 'Electronics',       emoji: '📱' },
  { key: 'home',          label: 'Home & Decor',      emoji: '🏠' },
  { key: 'sports',        label: 'Sports & Fitness',  emoji: '🏋️' },
  { key: 'travel',        label: 'Travel',            emoji: '✈️' },
  { key: 'entertainment', label: 'Entertainment',     emoji: '🎬' },
  { key: 'health',        label: 'Health & Pharmacy', emoji: '💊' },
  { key: 'luxury',        label: 'Luxury & Jewellery',emoji: '💎' },
  { key: 'kids',          label: 'Kids & Baby',       emoji: '🧸' },
  { key: 'other',         label: 'Other',             emoji: '🛍️' },
];

export function StepIndustry({ initial, onNext, onBack }: StepIndustryProps) {
  const [selected, setSelected] = useState(initial || '');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">What's your industry?</h2>
        <p className="text-sm text-gray-500 mt-1">
          We'll personalise reward templates and suggestions for you.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {INDUSTRIES.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-center"
            style={{
              borderColor: selected === key ? '#7c3aed' : '#e5e7eb',
              background: selected === key ? 'rgba(124,58,237,0.06)' : '#fff',
            }}
          >
            <span className="text-2xl leading-none">{emoji}</span>
            <span className="text-[11px] font-medium text-gray-700 leading-snug">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          disabled={!selected}
          onClick={() => onNext(selected)}
          className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{ background: selected ? '#7c3aed' : '#ccc', color: '#fff' }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
