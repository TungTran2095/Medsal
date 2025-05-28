"use client";

import type { Message } from '@/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Bot } from 'lucide-react';
import { format } from 'date-fns';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === 'user';

  return (
    <div
      className={cn(
        'flex items-end gap-2 mb-3 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 self-start shrink-0">
          <AvatarFallback className="bg-accent text-accent-foreground">
            <Bot size={18} />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[75%] md:max-w-[70%] rounded-xl p-3 shadow-sm break-words',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-card text-card-foreground rounded-bl-sm'
        )}
      >
        <p className="text-sm leading-relaxed">{message.text}</p>
        <p
          className={cn(
            'text-xs mt-1.5',
            isUser ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground text-left'
          )}
        >
          {format(new Date(message.timestamp), 'p')}
        </p>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 self-start shrink-0">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <User size={18} />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
