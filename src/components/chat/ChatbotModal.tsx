"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';
import ChatHistory from './ChatHistory';
import ChatInput from './ChatInput';
import QuickSuggestions from './QuickSuggestions';
import type { Message } from '@/types';

interface ChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onSuggestionClick: (suggestion: string) => void;
  messageCount: number;
}

export default function ChatbotModal({
  isOpen,
  onClose,
  messages,
  isLoading,
  onSendMessage,
  onSuggestionClick,
  messageCount
}: ChatbotModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">AI Assistant</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {messageCount > 0 ? `${messageCount} tin nhắn` : 'Sẵn sàng hỗ trợ'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {messages.length === 0 && !isLoading && (
            <QuickSuggestions 
              onSuggestionClick={onSuggestionClick} 
              isLoading={isLoading} 
            />
          )}
          <ChatHistory messages={messages} isLoading={isLoading} />
          <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} />
        </div>
      </DialogContent>
    </Dialog>
  );
}


