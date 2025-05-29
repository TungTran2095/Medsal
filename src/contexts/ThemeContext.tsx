
'use client';

import type { Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light'); // Default to light, will be updated by useEffect

  useEffect(() => {
    // This effect runs only on the client after hydration
    const storedTheme = localStorage.getItem('app-theme') as Theme | null;
    const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      setTheme(preferredTheme);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs once on mount client-side

  useEffect(() => {
    // This effect also runs only on the client
    if (typeof window !== 'undefined') { // Ensure localStorage and document are available
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('app-theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // To prevent hydration mismatch, we can render nothing or a placeholder on the server / during initial client render
  // until the theme is determined client-side. For simplicity, we'll render children directly,
  // but be mindful that this can cause a flash if server-rendered HTML expects one theme and client determines another.
  // A more robust solution might involve a "loading" state or rendering children only after theme is set.
  // However, for typical SPA behavior starting client-side, this is often acceptable.
  // If using SSR and seeing flashes, consider `next-themes` or a more complex initial state management.


  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
