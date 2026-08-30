import type { CSSProperties } from 'react';
import { CheckCircle2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SectionType = 'hero' | 'benefits' | 'how_it_works' | 'faq' | 'final_cta';

export type HeroVariant = 'centered' | 'split';
export interface HeroContent { eyebrow: string; headline: string; subheadline: string; variant?: HeroVariant; imageUrl?: string; }
export interface BenefitsContent { title: string; items: string[]; }
export interface HowItWorksContent { title: string; steps: string[]; }
export interface FaqItem { q: string; a: string; }
export interface FaqContent { title: string; items: FaqItem[]; }
export interface FinalCtaContent { headline: string; subtext: string; }

export type SectionContent = HeroContent | BenefitsContent | HowItWorksContent | FaqContent | FinalCtaContent;

export interface PortalSection {
  id: string;
  type: SectionType;
  visible: boolean;
  content: SectionContent;
}

export interface PortalTheme {
  primaryColor: string;
  secondaryColor?: string;
  borderRadius?: string;
  fontHeading?: string;
  fontBody?: string;
  logoUrl: string | null;
  clientName: string;
}

export const DEFAULT_THEME: Required<Pick<PortalTheme, 'secondaryColor' | 'borderRadius' | 'fontHeading' | 'fontBody'>> = {
  secondaryColor: '#8B5CF6',
  borderRadius: '8px',
  fontHeading: "'Inter', sans-serif",
  fontBody: "'Inter', sans-serif",
};

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Hero',
  benefits: 'Benefits',
  how_it_works: 'How It Works',
  faq: 'FAQ',
  final_cta: 'Final CTA',
};

export function defaultContentFor(type: SectionType): SectionContent {
  switch (type) {
    case 'hero':
      return { eyebrow: 'Earn while sharing what you love', headline: 'Turn your audience into commission', subheadline: 'Join our affiliate program and earn on every sale you refer.', variant: 'centered', imageUrl: '' };
    case 'benefits':
      return { title: 'Why partner with us?', items: ['Competitive commission on every sale', 'Track everything in your own dashboard', 'Get paid reliably, on time'] };
    case 'how_it_works':
      return { title: 'How it works', steps: ['Apply to join the program', 'Share your unique link', 'Earn commission on every sale'] };
    case 'faq':
      return { title: 'Frequently asked questions', items: [{ q: 'How much can I earn?', a: 'Commission rates vary by partner tier — details are shared after you apply.' }] };
    case 'final_cta':
      return { headline: 'Ready to get started?', subtext: 'Apply now and start earning.' };
  }
}

export function defaultSections(): PortalSection[] {
  return [
    { id: 'hero-1', type: 'hero', visible: true, content: defaultContentFor('hero') },
    { id: 'benefits-1', type: 'benefits', visible: true, content: defaultContentFor('benefits') },
    { id: 'how-1', type: 'how_it_works', visible: true, content: defaultContentFor('how_it_works') },
    { id: 'faq-1', type: 'faq', visible: true, content: defaultContentFor('faq') },
    { id: 'cta-1', type: 'final_cta', visible: true, content: defaultContentFor('final_cta') },
  ];
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

interface RenderProps {
  section: PortalSection;
  theme: PortalTheme;
  onApply?: () => void;
  onLogin?: () => void;
}

export function PortalSectionRenderer({ section, theme, onApply, onLogin }: RenderProps) {
  if (!section.visible) return null;
  const radius = theme.borderRadius ?? DEFAULT_THEME.borderRadius;
  const fontHeading = theme.fontHeading ?? DEFAULT_THEME.fontHeading;
  const fontBody = theme.fontBody ?? DEFAULT_THEME.fontBody;
  const secondary = theme.secondaryColor ?? DEFAULT_THEME.secondaryColor;
  const headingStyle: CSSProperties = { fontFamily: fontHeading };
  const bodyStyle: CSSProperties = { fontFamily: fontBody };

  switch (section.type) {
    case 'hero': {
      const c = section.content as HeroContent;
      const variant = c.variant ?? 'centered';

      const applyBtn = (
        <button
          onClick={onApply}
          className="px-5 py-2.5 text-white text-sm font-medium"
          style={{ backgroundColor: theme.primaryColor, borderRadius: radius, ...bodyStyle }}
        >
          Become an affiliate
        </button>
      );
      const loginBtn = (
        <button
          onClick={onLogin}
          className="px-5 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
          style={{ borderRadius: radius, ...bodyStyle }}
        >
          Log in
        </button>
      );
      const eyebrow = (
        <span
          className="inline-block text-xs font-semibold px-3 py-1 mb-4"
          style={{ backgroundColor: theme.primaryColor + '1a', color: theme.primaryColor, borderRadius: radius, ...bodyStyle }}
        >
          {c.eyebrow}
        </span>
      );

      if (variant === 'split') {
        return (
          <section className="px-6 py-16" style={{ background: `linear-gradient(135deg, ${theme.primaryColor}0d, ${secondary}0d)` }}>
            <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
              <div>
                {eyebrow}
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3" style={headingStyle}>{c.headline}</h1>
                <p className="text-base text-gray-600 dark:text-gray-300 mb-8" style={bodyStyle}>{c.subheadline}</p>
                <div className="flex items-center gap-3">{applyBtn}{loginBtn}</div>
              </div>
              <div className="aspect-[4/3] overflow-hidden" style={{ borderRadius: radius }}>
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${secondary})` }}
                  />
                )}
              </div>
            </div>
          </section>
        );
      }

      return (
        <section className="px-6 py-16 sm:py-20 text-center" style={{ backgroundColor: theme.primaryColor + '0d' }}>
          <div className="max-w-2xl mx-auto">
            {eyebrow}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3" style={headingStyle}>{c.headline}</h1>
            <p className="text-base text-gray-600 dark:text-gray-300 mb-8" style={bodyStyle}>{c.subheadline}</p>
            <div className="flex items-center justify-center gap-3">{applyBtn}{loginBtn}</div>
          </div>
        </section>
      );
    }
    case 'benefits': {
      const c = section.content as BenefitsContent;
      return (
        <section className="px-6 py-14">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center" style={headingStyle}>{c.title}</h2>
            <ul className="space-y-3">
              {c.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300" style={bodyStyle}>
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: theme.primaryColor }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }
    case 'how_it_works': {
      const c = section.content as HowItWorksContent;
      return (
        <section className="px-6 py-14 bg-gray-50 dark:bg-gray-900/40">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center" style={headingStyle}>{c.title}</h2>
            <ol className="space-y-4">
              {c.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300" style={bodyStyle}>
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      );
    }
    case 'faq': {
      const c = section.content as FaqContent;
      return (
        <section className="px-6 py-14">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center" style={headingStyle}>{c.title}</h2>
            <div className="space-y-4">
              {c.items.map((item, i) => (
                <div key={i} className="border-b border-gray-200 dark:border-gray-700 pb-4" style={bodyStyle}>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{item.q}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case 'final_cta': {
      const c = section.content as FinalCtaContent;
      return (
        <section className="px-6 py-16 text-center text-white" style={{ backgroundColor: theme.primaryColor }}>
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold mb-2" style={headingStyle}>{c.headline}</h2>
            <p className="text-sm opacity-90 mb-6" style={bodyStyle}>{c.subtext}</p>
            <button
              onClick={onApply}
              className="px-6 py-2.5 text-sm font-semibold"
              style={{ color: theme.primaryColor, backgroundColor: '#fff', borderRadius: radius, ...bodyStyle }}
            >
              Become an affiliate
            </button>
          </div>
        </section>
      );
    }
  }
}
