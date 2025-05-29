
'use client';

import type { Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
  toggleTheme: () => void;
}

// Provide a default context to prevent errors if consumed before provider is fully ready,
// though with the hasMounted logic, children are not rendered until provider is ready.
const defaultThemeContext: ThemeContextType = {
  theme: 'light', // Sensible default, server will render based on this if children were rendered.
  setTheme: () => {},
  toggleTheme: () => {},
};

const ThemeContext = createContext<ThemeContextType>(defaultThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize theme state. The actual theme will be determined client-side.
  // Server-Side Rendering will use this initial 'light' state if it were to render children.
  const [theme, setTheme] = useState<Theme>('light');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after initial mount.
    setHasMounted(true);
    const storedTheme = localStorage.getItem('app-theme') as Theme | null;
    const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      setTheme(preferredTheme);
    }
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
  }, [theme, hasMounted]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const contextValue = React.useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  // Delay rendering children until hasMounted is true.
  // This ensures that children are rendered on the client only after the theme
  // has been properly determined from localStorage/OS preference, preventing
  // a mismatch with server-rendered HTML (which would be based on initial 'light' theme
  // or, with this change, effectively nothing if server renders null here too).
  if (!hasMounted) {
    return null;
  }

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
