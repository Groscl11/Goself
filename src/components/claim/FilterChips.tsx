import React from 'react';

export type FilterKey = 'all' | 'trending' | string; // string = category slug

interface FilterChipsProps {
  categories: string[];
  active: FilterKey;
  onChange: (key: FilterKey) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  food: '☕',
  fashion: '👟',
  shopping: '🛍️',
  beauty: '💄',
  travel: '✈️',
  entertainment: '🎬',
};
const DEFAULT_EMOJI = '🎁';

export function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category.toLowerCase()] ?? DEFAULT_EMOJI;
}

export function FilterChips({ categories, active, onChange }: FilterChipsProps) {
  const chips: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'trending', label: '🔥 Trending' },
    ...categories.map((c) => ({
      key: c,
      label: `${categoryEmoji(c)} ${c.charAt(0).toUpperCase() + c.slice(1)}`,
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-2xl">
    <div
      className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {chips.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
            style={{
              background: isActive ? 'var(--gs-brand)' : 'var(--gs-brand-light)',
              color: isActive ? '#fff' : 'var(--gs-brand)',
              border: isActive
                ? '1.5px solid var(--gs-brand)'
                : '1.5px solid transparent',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
    </div>
  );
}
