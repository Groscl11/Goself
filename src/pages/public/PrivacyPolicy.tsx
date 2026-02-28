import { useEffect, useState } from 'react';

export default function PrivacyPolicy() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: '#0a0a0a', minHeight: '100vh', color: '#e8e0d0' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #2a2a2a', padding: '24px 0', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <span style={{ color: '#e8e0d0', fontFamily: "'Georgia', serif", fontSize: 16, letterSpacing: '0.05em' }}>Loyalty by Goself</span>
          </a>
          <span style={{ color: '#666', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Privacy Policy</span>
        </div>
      </header>

      {/* Hero */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '64px 32px 48px' }}>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'all 0.6s ease' }}>
          <p style={{ color: '#7c3aed', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Legal</p>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.15, margin: '0 0 24px', color: '#f0ebe0' }}>Privacy Policy</h1>
          <div style={{ display: 'flex', gap: 24, color: '#888', fontSize: 14 }}>
            <span>Effective: February 28, 2026</span>
            <span>·</span>
            <span>Last updated: February 28, 2026</span>
          </div>
          <div style={{ height: 1, background: 'linear-gradient(90deg, #7c3aed44, transparent)', margin: '40px 0' }} />
        </div>

        {/* Intro */}
        <p style={{ fontSize: 18, lineHeight: 1.8, color: '#b0a898', marginBottom: 48 }}>
          Goself ("we", "our", or "us") operates the Loyalty by Goself Shopify application. This Privacy Policy explains how we collect, use, and protect information when merchants install our app and their customers interact with our loyalty program.
        </p>

        {/* Sections */}
        {[
          {
            num: '01',
            title: 'Information We Collect',
            content: [
              { heading: 'From Merchants (Store Owners)', text: 'When you install Loyalty by Goself, we collect: your Shopify store domain, store name, store owner name and email address, store currency and country, and your Shopify access token to sync data.' },
              { heading: 'From Customers', text: 'When customers interact with your loyalty program, we collect: name and email address, order history and purchase amounts, loyalty points balance and transaction history, referral activity, and membership tier information.' },
              { heading: 'Automatically Collected', text: 'We automatically receive Shopify webhook data for orders, customer updates, and store events as permitted by your installed app scopes.' },
            ]
          },
          {
            num: '02',
            title: 'How We Use Information',
            content: [
              { heading: 'To Provide the Service', text: 'We use collected data to operate loyalty programs, calculate and award points, process reward redemptions, send campaign notifications, and generate analytics reports for merchants.' },
              { heading: 'To Improve the Service', text: 'Aggregated, anonymized data may be used to improve our platform features, performance, and reliability.' },
              { heading: 'We Do Not Sell Data', text: 'We never sell merchant or customer data to third parties. We do not use customer data for advertising purposes outside of the merchant\'s own loyalty campaigns.' },
            ]
          },
          {
            num: '03',
            title: 'Data Storage & Security',
            content: [
              { heading: 'Storage', text: 'All data is stored securely using Supabase (PostgreSQL) hosted on AWS infrastructure with encryption at rest and in transit.' },
              { heading: 'Security Measures', text: 'We implement row-level security, encrypted tokens, HTTPS-only communication, and regular security audits to protect your data.' },
              { heading: 'Data Retention', text: 'Merchant data is retained for the duration of the app installation plus 90 days after uninstallation, after which it is permanently deleted.' },
            ]
          },
          {
            num: '04',
            title: 'GDPR & Customer Rights',
            content: [
              { heading: 'Data Access', text: 'Customers may request a copy of their personal data by contacting the merchant, who can export data from the Loyalty by Goself dashboard.' },
              { heading: 'Data Deletion', text: 'Upon a merchant\'s request or store uninstallation, all associated customer data is permanently deleted within 30 days.' },
              { heading: 'GDPR Webhooks', text: 'We fully support Shopify\'s mandatory GDPR webhooks: customers/data_request, customers/redact, and shop/redact are all implemented and processed.' },
            ]
          },
          {
            num: '05',
            title: 'Shopify App Permissions',
            content: [
              { heading: 'Scopes Used', text: 'Our app requests the following Shopify scopes: read/write orders, customers, products, discounts, price rules, script tags, themes, and checkouts. These are used solely to operate the loyalty program.' },
              { heading: 'No Unnecessary Access', text: 'We only request permissions required for core functionality. We do not access payment information, financial data, or staff accounts.' },
            ]
          },
          {
            num: '06',
            title: 'Contact Us',
            content: [
              { heading: 'Privacy Inquiries', text: 'For any privacy-related questions, data requests, or concerns, please contact us at: privacy@goself.in' },
              { heading: 'Merchant Support', text: 'For general support: support@goself.in or visit goself.netlify.app' },
            ]
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: 56, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: `all 0.6s ease ${i * 0.08}s` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginBottom: 24 }}>
              <span style={{ color: '#3a3a3a', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.1em' }}>{section.num}</span>
              <h2 style={{ fontSize: 22, fontWeight: 400, color: '#f0ebe0', margin: 0, borderBottom: '1px solid #1e1e1e', paddingBottom: 16, flex: 1 }}>{section.title}</h2>
            </div>
            <div style={{ paddingLeft: 44 }}>
              {section.content.map((item, j) => (
                <div key={j} style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#c8bfb0', marginBottom: 8, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.02em' }}>{item.heading}</h3>
                  <p style={{ fontSize: 16, lineHeight: 1.8, color: '#888078', margin: 0 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 40, marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <p style={{ color: '#555', fontSize: 14, margin: 0 }}>© 2026 Goself. All rights reserved.</p>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="/terms" style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none' }}>Terms of Service</a>
            <a href="/gdpr" style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none' }}>Data Request</a>
            <a href="mailto:privacy@goself.in" style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none' }}>privacy@goself.in</a>
          </div>
        </div>
      </div>
    </div>
  );
}