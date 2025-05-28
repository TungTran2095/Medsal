
"use client";

import React, { useState, useEffect } from 'react';
import type { Message } from '@/types';
import ChatHistory from '@/components/chat/ChatHistory';
import ChatInput from '@/components/chat/ChatInput';
import { echoUserInput } from '@/ai/flows/echo-user-input';
import type { EchoUserInputInput } from '@/ai/flows/echo-user-input';
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from 'lucide-react';
import WorkspaceContent from '@/components/workspace/WorkspaceContent';

export default function DashboardPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>('');
  const { toast } = useToast();

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

  return (
    <div className="flex flex-col md:flex-row flex-1 w-full h-full bg-muted/40">
      {/* Left Pane: Workspace */}
      <div className="w-full md:w-1/2 p-2 md:p-4 overflow-y-auto">
        <WorkspaceContent />
      </div>

      {/* Right Pane: Chatbot */}
      {/* Ensure this pane also allows content to scroll if it overflows */}
      <div className="w-full md:w-1/2 flex flex-col p-2 md:p-4 md:max-h-full"> {/* max-h-full for md screens to contain chatbot height */}
        <div className="flex flex-col flex-1 bg-background text-foreground border rounded-lg shadow-sm overflow-hidden h-full min-h-[300px] md:min-h-0"> {/* min-h for mobile, flex-1 for desktop */}
          <header className="border-b p-4 shadow-sm bg-card">
            <div className="flex items-center justify-center">
              <Sparkles className="h-6 w-6 mr-2 text-primary" />
              <h1 className="text-xl font-semibold text-primary">Chatbot</h1>
            </div>
          </header>
          <ChatHistory messages={messages} isLoading={isLoading} />
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
