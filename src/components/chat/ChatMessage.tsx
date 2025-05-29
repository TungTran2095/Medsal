
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
        'flex items-end gap-1.5 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out', // Reduced gap and mb
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <Avatar className="h-7 w-7 self-start shrink-0"> {/* Smaller avatar */}
          <AvatarFallback className="bg-accent text-accent-foreground">
            <Bot size={16} /> {/* Smaller icon */}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[75%] md:max-w-[70%] rounded-lg p-2 shadow-sm break-words', // Smaller padding, rounded-lg
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-card text-card-foreground rounded-bl-sm'
        )}
      >
        <p className="text-sm leading-snug">{message.text}</p> {/* Tighter line height */}
        <p
          className={cn(
            'text-xs mt-1', // Reduced mt
            isUser ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground text-left'
          )}
        >
          {format(new Date(message.timestamp), 'p')}
        </p>
      </div>
      {isUser && (
        <Avatar className="h-7 w-7 self-start shrink-0"> {/* Smaller avatar */}
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <User size={16} /> {/* Smaller icon */}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
