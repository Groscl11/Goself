import React, { useRef, useState } from 'react';
import { Upload, Link, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface StepBrandBasicsProps {
  clientId: string;
  initial: { name: string; logo_url: string; primary_color: string };
  onNext: (data: { name: string; logo_url: string; primary_color: string }) => void;
}

const PRESET_COLORS = [
  '#2d5016', '#1e3a5f', '#7c3aed', '#b45309', '#0891b2',
  '#dc2626', '#059669', '#d97706', '#4338ca', '#be185d',
];

export function StepBrandBasics({ clientId, initial, onNext }: StepBrandBasicsProps) {
  const [name, setName] = useState(initial.name);
  const [logoUrl, setLogoUrl] = useState(initial.logo_url);
  const [color, setColor] = useState(initial.primary_color || '#2d5016');
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Max file size is 2 MB.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop();
      const path = `logos/${clientId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('client-assets')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('client-assets').getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Try a URL instead.');
    } finally {
      setUploading(false);
    }
  }

  function applyUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed.startsWith('http')) {
      setError('Please enter a valid URL starting with http.');
      return;
    }
    setLogoUrl(trimmed);
    setUrlMode(false);
    setUrlInput('');
    setError(null);
  }

  const canNext = name.trim().length >= 2;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Set up your brand</h2>
        <p className="text-sm text-gray-500 mt-1">
          This is what your customers will see on reward pages.
        </p>
      </div>

      {/* Store name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Store name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sunrise Apparel"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Brand logo</label>
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="flex-shrink-0 w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <div className="relative w-full h-full">
                <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-1" />
                <button
                  onClick={() => setLogoUrl('')}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-3xl text-gray-300">🏪</span>
            )}
          </div>

          {/* Upload controls */}
          <div className="flex-1 space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors w-full justify-center"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading…' : 'Upload file'}
              <span className="text-xs text-gray-400">(PNG/JPG, max 2 MB)</span>
            </button>
            <button
              onClick={() => setUrlMode((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors w-full justify-center"
            >
              <Link className="w-4 h-4" />
              Paste a URL instead
            </button>
            {urlMode && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                  onKeyDown={(e) => e.key === 'Enter' && applyUrl()}
                />
                <button
                  onClick={applyUrl}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded font-medium"
                >
                  Use
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Brand color
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full transition-transform hover:scale-110"
              style={{
                background: c,
                outline: color === c ? `3px solid ${c}` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
          <div className="relative">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer overflow-hidden opacity-0 absolute inset-0"
            />
            <div
              className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 pointer-events-none"
            >
              +
            </div>
          </div>
          <span className="text-xs font-mono text-gray-500">{color}</span>
        </div>
        {/* Preview strip */}
        <div
          className="mt-3 h-2 rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        disabled={!canNext}
        onClick={() => onNext({ name: name.trim(), logo_url: logoUrl, primary_color: color })}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: canNext ? '#7c3aed' : '#ccc',
          color: '#fff',
        }}
      >
        Continue →
      </button>
    </div>
  );
}
