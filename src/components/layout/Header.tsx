"use client";

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';
import UserMenu from '@/components/auth/UserMenu';

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <div className="flex items-center space-x-2">
                         <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-md">
               <span className="text-sm font-bold text-primary-foreground">MS</span>
             </div>
             <span className="hidden font-bold sm:inline-block">
               Med Sal
             </span>
          </div>
        </div>
        
                  <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">

            <nav className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
              <span className="sr-only">Chuyển đổi theme</span>
            </Button>
            <UserMenu />
          </nav>
        </div>
      </div>
    </header>
  );
}
