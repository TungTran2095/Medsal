
"use client";

import type { Message } from '@/types';
import ChatMessage from './ChatMessage';
import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, Sparkles } from 'lucide-react';

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
  }, [messages, isLoading]);

  return (
    <ScrollArea className="flex-1 h-0" viewportRef={viewportRef}> 
      <div className="p-3 space-y-2">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2 animate-in fade-in-50 slide-in-from-bottom-2 duration-700 delay-200">
              Chào mừng đến với AI Assistant
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs animate-in fade-in-50 slide-in-from-bottom-2 duration-700 delay-300">
              Tôi có thể giúp bạn phân tích dữ liệu, trả lời câu hỏi và hỗ trợ công việc của bạn.
            </p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div 
            key={msg.id} 
            className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <ChatMessage message={msg} />
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-end gap-3 mb-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Avatar className="h-8 w-8 self-start shrink-0 ring-2 ring-primary/20 animate-pulse">
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <Bot size={18} />
              </AvatarFallback>
            </Avatar>
            <div className="bg-gradient-to-r from-card to-card/80 text-card-foreground rounded-2xl p-4 shadow-sm rounded-bl-md max-w-[75%] border border-border/50 animate-pulse">
              <div className="flex space-x-1.5">
                <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-primary/60 rounded-full animate-bounce"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
