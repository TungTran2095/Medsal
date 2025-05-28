
"use client";

import type { Message } from '@/types';
import ChatMessage from './ChatMessage';
import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot } from 'lucide-react';

interface ChatHistoryProps {
  messages: Message[];
  isLoading: boolean;
}

export default function ChatHistory({ messages, isLoading }: ChatHistoryProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]); // Ensure scroll on isLoading change too

  return (
    <ScrollArea className="flex-1 h-0" viewportRef={viewportRef}> {/* Changed from flex-grow */}
      <div className="p-4 md:p-6 space-y-1"> {/* Reduced space-y for tighter packing */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-end gap-2 mb-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Avatar className="h-8 w-8 self-start shrink-0">
              <AvatarFallback className="bg-accent text-accent-foreground">
                <Bot size={18} />
              </AvatarFallback>
            </Avatar>
            <div className="bg-card text-card-foreground rounded-xl p-3 shadow-sm rounded-bl-sm max-w-[70%]">
              <div className="flex space-x-1">
                <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
