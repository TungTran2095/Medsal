
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
  const [isChatbotOpen, setIsChatbotOpen] = useState(true);

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
    if (!isChatbotOpen) setIsChatbotOpen(true); // Open chatbot on send message

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
    <div className="flex flex-col md:flex-row flex-1 w-full h-full bg-muted/40">
      {/* Left Pane: Workspace */}
      <div className={cn(
          "w-full p-2 md:p-4 overflow-y-auto transition-all duration-300 ease-in-out",
          isChatbotOpen ? 'md:w-2/3' : 'md:flex-1'
        )}
      >
        <WorkspaceContent />
      </div>

      {/* Right Pane: Chatbot */}
      <div className={cn(
          "w-full p-2 md:p-4 flex flex-col transition-all duration-300 ease-in-out",
           isChatbotOpen ? 'md:w-1/3' : 'md:w-[72px]' // Changed md:w-auto to md:w-[72px] for closed state
        )}
      >
        <div className={cn(
            "flex flex-col flex-1 bg-background text-foreground border rounded-lg shadow-sm overflow-hidden h-full",
            isChatbotOpen ? 'min-h-[300px] md:min-h-0' : ''
          )}
        >
          <header className={cn(
              "border-b p-3 md:p-4 shadow-sm bg-card flex items-center",
              isChatbotOpen ? 'justify-between' : 'justify-center'
            )}
          >
            {isChatbotOpen && (
              <div className="flex items-center mr-2">
                <Sparkles className="h-6 w-6 mr-2 text-primary shrink-0" />
                <h1 className="text-xl font-semibold text-primary truncate">Chatbot</h1>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleChatbot}
              aria-expanded={isChatbotOpen}
              aria-controls="chatbot-content-area"
              title={isChatbotOpen ? 'Collapse Chatbot' : 'Expand Chatbot'}
            >
              {isChatbotOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
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
            {/* Content is always mounted but visibility/height is transitioned */}
            <ChatHistory messages={messages} isLoading={isLoading} />
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
