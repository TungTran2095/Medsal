
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
    <ScrollArea className="flex-1 h-0" viewportRef={viewportRef}> 
      <div className="p-2 space-y-1"> {/* Reduced padding */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-end gap-2 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-300"> {/* Reduced mb */}
            <Avatar className="h-7 w-7 self-start shrink-0"> {/* Smaller avatar */}
              <AvatarFallback className="bg-accent text-accent-foreground">
                <Bot size={16} /> {/* Smaller icon */}
              </AvatarFallback>
            </Avatar>
            <div className="bg-card text-card-foreground rounded-lg p-2 shadow-sm rounded-bl-sm max-w-[70%]"> {/* Smaller padding, rounded-lg */}
              <div className="flex space-x-1">
                <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span> {/* Smaller dots */}
                <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
