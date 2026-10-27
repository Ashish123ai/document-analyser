import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const ThemeContext = createContext(null);
const LEGACY_THEME_KEY = 'legal-analyzer-theme';

function readTheme(key) {
  const stored = localStorage.getItem(key);
  if (stored === 'dark' || stored === 'light') return stored;

  if (key !== 'legal-analyzer-theme:guest') {
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === 'dark' || legacy === 'light') {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(LEGACY_THEME_KEY);
      return legacy;
    }
  }

  return 'dark';
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const key = `legal-analyzer-theme:${user?.id || 'guest'}`;
  const [preference, setPreference] = useState(() => ({
    key: 'legal-analyzer-theme:guest',
    theme: readTheme('legal-analyzer-theme:guest'),
  }));
  const theme = preference.key === key ? preference.theme : 'dark';

  useEffect(() => {
    setPreference({ key, theme: readTheme(key) });
  }, [key]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (preference.key === key) localStorage.setItem(key, theme);
  }, [key, preference.key, theme]);

  const toggleTheme = () => {
    setPreference((current) => ({
      key,
      theme: (current.key === key ? current.theme : theme) === 'dark' ? 'light' : 'dark',
    }));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
