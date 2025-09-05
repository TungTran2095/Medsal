
"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendHorizontal, Paperclip, Smile, Mic } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

export default function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  return (
    <div className="border-t bg-background/95 backdrop-blur-sm sticky bottom-0">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-2 md:p-3"
      >
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Nhập tin nhắn của bạn..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className={cn(
              "w-full rounded-full px-4 py-2.5 pr-20 text-sm border-2 transition-all duration-200",
              "focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50",
              "placeholder:text-muted-foreground/70",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
            autoComplete="off"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-muted/50 rounded-full"
              aria-label="Attach file"
            >
              <Paperclip size={12} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-muted/50 rounded-full"
              aria-label="Emoji"
            >
              <Smile size={12} />
            </Button>
          </div>
        </div>
        
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !inputValue.trim()}
          className={cn(
            "h-9 w-9 rounded-full transition-all duration-200",
            "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "shadow-lg hover:shadow-xl"
          )}
          aria-label="Send message"
        >
          <SendHorizontal size={16} />
        </Button>
      </form>
    </div>
  );
}
