
"use client";

import React, { useState, useEffect } from 'react';
import type { Message } from '@/types';
import ChatHistory from '@/components/chat/ChatHistory';
import ChatInput from '@/components/chat/ChatInput';
import { echoUserInput } from '@/ai/flows/echo-user-input';
import type { EchoUserInputInput } from '@/ai/flows/echo-user-input';
import { useToast } from "@/hooks/use-toast";
import { Sparkles, PanelRightClose, PanelRightOpen } from 'lucide-react';
import WorkspaceContent from '@/components/workspace/WorkspaceContent';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>('');
  const { toast } = useToast();
  const [isChatbotOpen, setIsChatbotOpen] = useState(false); 

  useEffect(() => {
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        text: "Hello! I'm your AI Echo. Type something and I'll echo it back with a twist!",
        sender: 'ai',
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const handleSendMessage = async (text: string) => {
    if (!isChatbotOpen) setIsChatbotOpen(true); 

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setIsLoading(true);

    try {
      const aiInput: EchoUserInputInput = {
        userInput: text,
        previousContext: conversationContext,
      };
      const aiResponse = await echoUserInput(aiInput);

      const newAiMessage: Message = {
        id: `ai-${Date.now()}`,
        text: aiResponse.echoedResponse,
        sender: 'ai',
        timestamp: Date.now(),
      };
      setMessages((prevMessages) => [...prevMessages, newAiMessage]);
      
      setConversationContext(
        (prevCtx) => `${prevCtx}\nUser: ${text}\nAI: ${aiResponse.echoedResponse}`.slice(-2000)
      );

    } catch (error) {
      console.error('Error calling AI flow:', error);
      toast({
        title: "AI Error",
        description: "Oops! Something went wrong while talking to the AI. Please try again.",
        variant: "destructive",
      });
      const errorAiMessage: Message = {
        id: `ai-error-${Date.now()}`,
        text: "I'm having a little trouble responding right now. Please try sending your message again.",
        sender: 'ai',
        timestamp: Date.now(),
      };
      setMessages((prevMessages) => [...prevMessages, errorAiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChatbot = () => {
    setIsChatbotOpen(!isChatbotOpen);
  };

  return (
    <div className="flex flex-col md:flex-row flex-1 w-full h-full p-0"> 
      <div className={cn(
          "w-full pt-0.5 pb-0.5 pl-0.5 pr-0 md:pt-1 md:pb-1 md:pl-1 md:pr-0.5 overflow-y-auto transition-all duration-300 ease-in-out",
          isChatbotOpen ? 'md:w-2/3' : 'md:flex-1'
        )}
      >
        <WorkspaceContent />
      </div>

      <div className={cn(
          "w-full pt-0.5 pb-0.5 pr-0.5 pl-0 md:pt-1 md:pb-1 md:pr-1 md:pl-0.5 flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
           isChatbotOpen ? 'md:w-1/3' : 'md:w-[56px]' 
        )}
      >
        <div className={cn(
            "flex flex-col flex-1 bg-card text-foreground border rounded-lg shadow-soft-md overflow-hidden h-full backdrop-blur-lg", // Added backdrop-blur-lg
            isChatbotOpen ? 'min-h-[200px] md:min-h-0' : ''
          )}
        >
          <header className={cn(
              "border-b p-1 md:p-1.5 shadow-sm flex items-center justify-end" 
            )}
          >
            <div className={cn(
                "flex items-center mr-auto overflow-hidden transition-all duration-300 ease-in-out",
                isChatbotOpen 
                  ? "opacity-100 max-w-xs px-1" 
                  : "opacity-0 max-w-0 pointer-events-none px-0" 
              )}
            >
              <Sparkles className="h-5 w-5 mr-1.5 text-primary shrink-0" /> 
              <h1 className="text-md font-semibold text-primary truncate">Chatbot</h1> 
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleChatbot}
              aria-expanded={isChatbotOpen}
              aria-controls="chatbot-content-area"
              title={isChatbotOpen ? 'Collapse Chatbot' : 'Expand Chatbot'}
              className="h-7 w-7" 
            >
              {isChatbotOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />} 
              <span className="sr-only">{isChatbotOpen ? 'Collapse Chatbot' : 'Expand Chatbot'}</span>
            </Button>
          </header>
          
          <div 
            id="chatbot-content-area"
            className={cn(
              "flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-in-out",
              isChatbotOpen
                ? "opacity-100 max-h-[100vh]" 
                : "opacity-0 max-h-0" 
            )}
          >
            <ChatHistory messages={messages} isLoading={isLoading} />
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
