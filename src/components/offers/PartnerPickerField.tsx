/**
 * PartnerPickerField
 *
 * Reusable field that lets the user:
 *   1. Search existing partners (active + own) from the `partners` table
 *   2. Add a brand-new partner inline (creates a row in `partners` table)
 *   3. Clear the selection
 *
 * Props:
 *   value       — currently selected partner id (or null)
 *   clientId    — owner_client_id for new partner rows
 *   onChange    — called with the selected partner id (or null to clear)
 */

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Partner {
  id: string;
  partner_id: string | null;
  name: string;
  logo_url: string | null;
  shop_domain: string | null;
  status: string;
}

interface PartnerPickerFieldProps {
  value: string | null;
  clientId: string;
  onChange: (partnerId: string | null) => void;
}

export function PartnerPickerField({ value, clientId, onChange }: PartnerPickerFieldProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Partner | null>(null);

  // Inline "add new partner" state
  const [addingNew, setAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newError, setNewError] = useState('');
  const [newForm, setNewForm] = useState({
    name: '',
    shop_domain: '',
    contact_email: '',
    logo_url: '',
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAddingNew(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load partners when dropdown opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('partners')
      .select('id, partner_id, name, logo_url, shop_domain, status')
      .or(`status.eq.active,owner_client_id.eq.${clientId}`)
      .order('name')
      .then(({ data }) => {
        setPartners((data ?? []) as Partner[]);
        setLoading(false);
      });
  }, [open, clientId]);

  // Resolve selected partner name when value changes externally
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    supabase
      .from('partners')
      .select('id, partner_id, name, logo_url, shop_domain, status')
      .eq('id', value)
      .maybeSingle()
      .then(({ data }) => setSelected(data as Partner | null));
  }, [value]);

  const filtered = partners.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.shop_domain ?? '').toLowerCase().includes(search.toLowerCase())
  );

  function selectPartner(p: Partner) {
    setSelected(p);
    onChange(p.id);
    setOpen(false);
    setSearch('');
    setAddingNew(false);
  }

  async function handleAddNew() {
    setNewError('');
    if (!newForm.name.trim()) { setNewError('Partner name is required'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('partners')
      .insert({
        name: newForm.name.trim(),
        shop_domain: newForm.shop_domain.trim() || null,
        contact_email: newForm.contact_email.trim() || null,
        logo_url: newForm.logo_url.trim() || null,
        status: 'active',
        owner_client_id: clientId,
      })
      .select('id, partner_id, name, logo_url, shop_domain, status')
      .single();
    setSaving(false);
    if (error) { setNewError(error.message); return; }
    if (data) {
      setPartners(prev => [data as Partner, ...prev]);
      selectPartner(data as Partner);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 transition-colors text-left"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            {selected.logo_url && (
              <img src={selected.logo_url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
            )}
            <span className="font-medium text-gray-900 truncate">{selected.name}</span>
            {selected.partner_id && (
              <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{selected.partner_id}</span>
            )}
          </span>
        ) : (
          <span className="text-gray-400">Select or add a partner…</span>
        )}
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Clear button */}
      {value && (
        <button
          type="button"
          onClick={() => { setSelected(null); onChange(null); }}
          className="absolute right-8 top-2.5 text-gray-300 hover:text-gray-600 transition-colors"
          title="Clear"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search partners…"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-400 focus:border-purple-400 outline-none"
            />
          </div>

          {/* Partner list */}
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-400">Loading partners…</div>
            ) : filtered.length === 0 && !addingNew ? (
              <div className="px-4 py-3 text-sm text-gray-400">No partners found</div>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPartner(p)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left ${
                    selected?.id === p.id ? 'bg-purple-50' : ''
                  }`}
                >
                  {p.logo_url ? (
                    <img src={p.logo_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-gray-500">{p.name[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{p.name}</p>
                    {p.shop_domain && (
                      <p className="text-[11px] text-gray-400 truncate">{p.shop_domain}</p>
                    )}
                  </div>
                  {p.status !== 'active' && (
                    <span className="ml-auto text-[10px] text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">
                      {p.status}
                    </span>
                  )}
                  {selected?.id === p.id && (
                    <svg className="w-4 h-4 text-purple-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Add new partner section */}
          {!addingNew ? (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={() => setAddingNew(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add new partner
              </button>
            </div>
          ) : (
            <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New partner</p>
              {newError && (
                <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{newError}</p>
              )}
              <input
                value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Partner name *"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400"
              />
              <input
                value={newForm.shop_domain}
                onChange={e => setNewForm(f => ({ ...f, shop_domain: e.target.value }))}
                placeholder="Shopify domain (optional)"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400"
              />
              <input
                value={newForm.contact_email}
                onChange={e => setNewForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="Contact email (optional)"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400"
              />
              <input
                value={newForm.logo_url}
                onChange={e => setNewForm(f => ({ ...f, logo_url: e.target.value }))}
                placeholder="Logo URL (optional)"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setAddingNew(false); setNewError(''); setNewForm({ name: '', shop_domain: '', contact_email: '', logo_url: '' }); }}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNew}
                  disabled={saving}
                  className="flex-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors font-medium"
                >
                  {saving ? 'Adding…' : 'Add partner'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
