import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { GoSelfTheme, defaultTheme } from '../config/theme';
import { darkenHsl, hexToRgba } from '../utils/colorUtils';
import { supabase } from '../lib/supabase';

interface ThemeContextValue {
  theme: GoSelfTheme;
  loadTheme: (clientId: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  loadTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<GoSelfTheme>(defaultTheme);

  const loadTheme = useCallback(async (clientId: string) => {
    try {
      const { data } = await supabase
        .from('clients')
        .select('name, logo_url, primary_color')
        .eq('id', clientId)
        .maybeSingle();

      if (!data) return;

      setTheme((prev) => {
        const next = { ...prev };
        if (data.name) next.brandName = data.name;
        if (data.logo_url) next.logoUrl = data.logo_url;
        if (data.primary_color) {
          next.brandColor = data.primary_color;
          next.brandColorDark = darkenHsl(data.primary_color, 15);
          next.brandColorLight = hexToRgba(data.primary_color, 0.08);
        }
        return next;
      });
    } catch (err) {
      console.error('ThemeProvider: failed to load client theme', err);
    }
  }, []);

  // Inject CSS custom properties on every theme change
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--gs-brand', theme.brandColor);
    root.style.setProperty('--gs-brand-dark', theme.brandColorDark);
    root.style.setProperty('--gs-brand-light', theme.brandColorLight);
    root.style.setProperty('--gs-accent', theme.accentColor);
    root.style.setProperty('--gs-radius', theme.borderRadius);
    root.style.setProperty('--gs-font', theme.fontFamily);
    root.style.setProperty('--gs-display-font', theme.displayFontFamily);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, loadTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Consume the GoSelf theme. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
