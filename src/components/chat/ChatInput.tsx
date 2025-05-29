
"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SendHorizontal } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

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
  
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t bg-background p-2 sticky bottom-0" // Reduced gap and padding
    >
      <Input
        ref={inputRef}
        type="text"
        placeholder="Type a message..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        disabled={isLoading}
        className="flex-grow rounded-full px-3 h-9 text-sm focus-visible:ring-1 focus-visible:ring-accent" // Reduced px and h
        autoComplete="off"
      />
      <Button
        type="submit"
        size="icon"
        disabled={isLoading || !inputValue.trim()}
        className="rounded-full bg-accent hover:bg-accent/90 text-accent-foreground w-9 h-9 shrink-0" // Reduced w and h
        aria-label="Send message"
      >
        <SendHorizontal size={18} /> {/* Smaller icon */}
      </Button>
    </form>
  );
}
