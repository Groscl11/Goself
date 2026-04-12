export interface GoSelfTheme {
  brandColor: string;
  brandColorDark: string;
  brandColorLight: string;
  accentColor: string;
  fontFamily: string;
  displayFontFamily: string;
  borderRadius: string;
  logoUrl: string | null;
  brandName: string;
}

export const defaultTheme: GoSelfTheme = {
  brandColor: '#2d5016',
  brandColorDark: '#1e380f',
  brandColorLight: 'rgba(45,80,22,0.08)',
  accentColor: '#1a1a2e',
  fontFamily: "'DM Sans', sans-serif",
  displayFontFamily: "'Playfair Display', serif",
  borderRadius: '18px',
  logoUrl: null,
  brandName: 'Your Store',
};
