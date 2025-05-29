
'use client';

import type { Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
  toggleTheme: () => void;
}

// Provide a default context
const defaultThemeContext: ThemeContextType = {
  theme: 'light', // Default theme for SSR and before client-side detection
  setTheme: () => {},
  toggleTheme: () => {},
};

const ThemeContext = createContext<ThemeContextType>(defaultThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize theme state. Server-Side Rendering will use this initial 'light' state.
  const [theme, setTheme] = useState<Theme>('light');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after initial mount.
    setHasMounted(true);
    const storedTheme = localStorage.getItem('app-theme') as Theme | null;
    
    // Set the theme based on localStorage, or default to 'light' if nothing is stored.
    setTheme(storedTheme || 'light');
  }, []); // Empty dependency array ensures this runs once on mount client-side

  useEffect(() => {
    // This effect also runs only on the client, after hasMounted is true and theme changes.
    if (hasMounted) {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('app-theme', theme);
    }
  }, [theme, hasMounted]); // Re-run when theme or hasMounted status changes

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const contextValue = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, toggleTheme]);

  // ThemeProvider ALWAYS renders its children and the Context Provider.
  // It does not return null based on hasMounted, as that caused structural hydration issues.
  // The effects above handle client-side theme application.
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // This should ideally not happen if ThemeProvider is at the root
    // and createContext has a default value.
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
