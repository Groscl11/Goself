import React, { useState } from 'react';
import { Globe, Mail, Phone } from 'lucide-react';

interface StepContactProps {
  initial: { contact_email: string; contact_phone: string; website_url: string };
  onNext: (data: { contact_email: string; contact_phone: string; website_url: string }) => void;
  onBack: () => void;
}

export function StepContact({ initial, onNext, onBack }: StepContactProps) {
  const [email, setEmail] = useState(initial.contact_email);
  const [phone, setPhone] = useState(initial.contact_phone);
  const [website, setWebsite] = useState(initial.website_url);
  const [error, setError] = useState<string | null>(null);

  function validate() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    setError(null);
    return true;
  }

  function handleNext() {
    if (!validate()) return;
    onNext({
      contact_email: email.trim(),
      contact_phone: phone.trim(),
      website_url: website.trim(),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Contact & store details</h2>
        <p className="text-sm text-gray-500 mt-1">
          We use this to reach you about your account and rewards campaigns.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Contact email <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="hello@yourstore.com"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Phone number <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Store website <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourstore.com"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="flex-1 py-3 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
