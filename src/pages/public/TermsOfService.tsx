import { useEffect, useState } from 'react';

export default function TermsOfService() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  const sections = [
    {
      num: '01',
      title: 'Acceptance of Terms',
      content: [
        {
          heading: 'Agreement',
          text: 'By installing or using Loyalty by Goself ("the App"), you ("Merchant") agree to be bound by these Terms of Service. If you do not agree, do not install or use the App.',
        },
        {
          heading: 'Eligibility',
          text: 'You must have a valid Shopify store and be legally authorised to enter into agreements on behalf of your business to use this App.',
        },
      ],
    },
    {
      num: '02',
      title: 'Description of Service',
      content: [
        {
          heading: 'What We Provide',
          text: 'Loyalty by Goself provides a loyalty and rewards management platform for Shopify merchants, including points tracking, tier management, campaign automation, member management, and widget-based storefront integration.',
        },
        {
          heading: 'Service Availability',
          text: 'We aim for 99.9% uptime but do not guarantee uninterrupted access. Maintenance windows, Shopify API changes, or force-majeure events may affect availability.',
        },
      ],
    },
    {
      num: '03',
      title: 'Merchant Responsibilities',
      content: [
        {
          heading: 'Accurate Information',
          text: 'You are responsible for providing accurate store and contact information, configuring your loyalty program appropriately, and keeping your programme rules compliant with applicable law.',
        },
        {
          heading: 'Customer Communication',
          text: "You are responsible for communicating your loyalty programme terms to your customers, including points expiration, redemption rules, and any restrictions.",
        },
        {
          heading: 'Data Compliance',
          text: 'You are responsible for ensuring that your use of customer data through the App complies with applicable privacy laws (GDPR, CCPA, etc.) in your jurisdiction.',
        },
      ],
    },
    {
      num: '04',
      title: 'Prohibited Uses',
      content: [
        {
          heading: 'Prohibited Activities',
          text: 'You may not use the App to engage in fraudulent activity, manipulate points balances in bad faith, send unsolicited communications (spam), or violate Shopify\'s Partner Programme policies or Acceptable Use Policy.',
        },
        {
          heading: 'Automated Abuse',
          text: 'You may not use automated scripts, bots, or any means to artificially inflate points, rewards, or membership counts.',
        },
      ],
    },
    {
      num: '05',
      title: 'Intellectual Property',
      content: [
        {
          heading: 'Our IP',
          text: 'Loyalty by Goself, its code, designs, algorithms, and branding are the intellectual property of Goself. You are granted a limited, non-exclusive, non-transferable licence to use the App for your store.',
        },
        {
          heading: 'Your Data',
          text: 'You retain ownership of your merchant and customer data. We claim no ownership over it and use it solely to provide the Service as described in our Privacy Policy.',
        },
      ],
    },
    {
      num: '06',
      title: 'Payment & Billing',
      content: [
        {
          heading: 'Subscription',
          text: 'If you are on a paid plan, billing is handled through Shopify\'s billing API. By subscribing, you authorise recurring charges through Shopify Payments. All fees are non-refundable except as required by law.',
        },
        {
          heading: 'Plan Changes',
          text: 'You may upgrade, downgrade, or cancel your subscription at any time through the Shopify Partner Dashboard. Cancellation takes effect at the end of the current billing cycle.',
        },
      ],
    },
    {
      num: '07',
      title: 'Limitation of Liability',
      content: [
        {
          heading: 'Disclaimer',
          text: 'The App is provided "AS IS" without warranties of any kind. We do not warrant that the App will be error-free or that any specific results will be achieved by using it.',
        },
        {
          heading: 'Cap on Damages',
          text: 'To the maximum extent permitted by applicable law, our total liability to you for any claim arising from your use of the App shall not exceed the fees you paid to us in the 3 months preceding the claim.',
        },
      ],
    },
    {
      num: '08',
      title: 'Termination',
      content: [
        {
          heading: 'By You',
          text: 'You may terminate these Terms at any time by uninstalling the App from your Shopify store.',
        },
        {
          heading: 'By Us',
          text: 'We may suspend or terminate your access if you violate these Terms, engage in fraudulent activity, or if required to do so by Shopify or applicable law.',
        },
        {
          heading: 'Data After Termination',
          text: 'Upon termination, your data is retained for 90 days then permanently deleted in accordance with our Privacy Policy and Shopify\'s GDPR requirements.',
        },
      ],
    },
    {
      num: '09',
      title: 'Governing Law',
      content: [
        {
          heading: 'Jurisdiction',
          text: 'These Terms are governed by the laws of India. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of courts in Bengaluru, Karnataka, India.',
        },
      ],
    },
    {
      num: '10',
      title: 'Contact',
      content: [
        {
          heading: 'Legal Inquiries',
          text: 'For any questions regarding these Terms, please contact: legal@goself.in',
        },
        {
          heading: 'General Support',
          text: 'For product support: support@goself.in',
        },
      ],
    },
  ];

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: '#0a0a0a', minHeight: '100vh', color: '#e8e0d0' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #2a2a2a', padding: '24px 0', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            <span style={{ color: '#e8e0d0', fontFamily: "'Georgia', serif", fontSize: 16, letterSpacing: '0.05em' }}>Loyalty by Goself</span>
          </a>
          <span style={{ color: '#666', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Terms of Service</span>
        </div>
      </header>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '64px 32px 48px' }}>
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'all 0.6s ease' }}>
          <p style={{ color: '#7c3aed', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Legal</p>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.15, margin: '0 0 24px', color: '#f0ebe0' }}>Terms of Service</h1>
          <div style={{ display: 'flex', gap: 24, color: '#888', fontSize: 14 }}>
            <span>Effective: February 28, 2026</span>
            <span>·</span>
            <span>Last updated: February 28, 2026</span>
          </div>
          <div style={{ height: 1, background: 'linear-gradient(90deg, #7c3aed44, transparent)', margin: '40px 0' }} />
        </div>

        <p style={{ fontSize: 18, lineHeight: 1.8, color: '#b0a898', marginBottom: 48 }}>
          These Terms of Service ("Terms") govern your access to and use of the Loyalty by Goself
          Shopify application operated by Goself ("we", "our", "us"). Please read them carefully
          before installing or using the App.
        </p>

        {sections.map((section, i) => (
          <div key={i} style={{ marginBottom: 56, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: `all 0.6s ease ${i * 0.06}s` }}>
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

        <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 40, marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <p style={{ color: '#555', fontSize: 14, margin: 0 }}>© 2026 Goself. All rights reserved.</p>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="/privacy" style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none' }}>Privacy Policy</a>
            <a href="mailto:legal@goself.in" style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none' }}>legal@goself.in</a>
          </div>
        </div>
      </div>
    </div>
  );
}
