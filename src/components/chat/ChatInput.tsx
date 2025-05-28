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
      className="flex items-center gap-3 border-t bg-background p-3 md:p-4 sticky bottom-0"
    >
      <Input
        ref={inputRef}
        type="text"
        placeholder="Type a message..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        disabled={isLoading}
        className="flex-grow rounded-full px-4 h-11 text-sm focus-visible:ring-1 focus-visible:ring-accent"
        autoComplete="off"
      />
      <Button
        type="submit"
        size="icon"
        disabled={isLoading || !inputValue.trim()}
        className="rounded-full bg-accent hover:bg-accent/90 text-accent-foreground w-11 h-11 shrink-0"
        aria-label="Send message"
      >
        <SendHorizontal size={20} />
      </Button>
    </form>
  );
}
