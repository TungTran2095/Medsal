
"use client";

import type { Message } from '@/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === 'user';

  return (
    <div
      className={cn(
        'flex items-end gap-2 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 self-start shrink-0 ring-2 ring-primary/20">
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <Bot size={18} />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className="flex flex-col max-w-[80%] md:max-w-[75%]">
        <div
          className={cn(
            'rounded-2xl p-4 shadow-sm break-words border transition-all duration-200 hover:shadow-md',
            isUser
              ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md border-primary/20'
              : 'bg-gradient-to-br from-card to-card/80 text-card-foreground rounded-bl-md border-border/50'
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
        </div>
        
        <div className={cn(
          'flex items-center gap-1 mt-1.5',
          isUser ? 'justify-end' : 'justify-start'
        )}>
          <p
            className={cn(
              'text-xs',
              isUser ? 'text-primary-foreground/60' : 'text-muted-foreground'
            )}
          >
            {format(new Date(message.timestamp), 'HH:mm')}
          </p>
          {isUser && (
            <div className="flex items-center">
              <CheckCheck size={12} className="text-primary-foreground/60" />
            </div>
          )}
        </div>
      </div>
      
      {isUser && (
        <Avatar className="h-8 w-8 self-start shrink-0 ring-2 ring-primary/20">
          <AvatarFallback className="bg-gradient-to-br from-secondary to-secondary/80 text-secondary-foreground">
            <User size={18} />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
