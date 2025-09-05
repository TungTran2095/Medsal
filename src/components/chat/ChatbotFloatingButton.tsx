"use client";

import { Button } from '@/components/ui/button';
import { MessageCircle, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface ChatbotFloatingButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  messageCount: number;
  hasUnreadMessages?: boolean;
}

export default function ChatbotFloatingButton({ 
  isOpen, 
  onToggle, 
  messageCount,
  hasUnreadMessages = false 
}: ChatbotFloatingButtonProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Notification badge */}
      {messageCount > 0 && !isOpen && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-semibold animate-pulse">
          {messageCount > 9 ? '9+' : messageCount}
        </div>
      )}
      
      {/* Floating button */}
      <Button
        onClick={onToggle}
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300",
          "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary",
          "hover:scale-110 active:scale-95",
          isOpen && !isMobile && "rotate-180"
        )}
        aria-label={isOpen ? "Đóng chatbot" : "Mở chatbot"}
      >
        <div className="relative">
          {isOpen && !isMobile ? (
            <X className="h-6 w-6 text-primary-foreground" />
          ) : (
            <div className="relative">
              <MessageCircle className="h-6 w-6 text-primary-foreground" />
              {hasUnreadMessages && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
              )}
            </div>
          )}
        </div>
      </Button>
      
      {/* Tooltip - Only show on desktop */}
      {!isMobile && (
        <div className={cn(
          "absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 transition-opacity duration-200 pointer-events-none",
          "after:absolute after:top-full after:right-4 after:border-4 after:border-transparent after:border-t-gray-900",
          "group-hover:opacity-100"
        )}>
          {isOpen ? "Đóng AI Assistant" : "Mở AI Assistant"}
        </div>
      )}
    </div>
  );
}
