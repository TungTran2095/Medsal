
"use client";

import React, { useState, useEffect } from 'react';
import type { Message } from '@/types';
import ChatHistory from '@/components/chat/ChatHistory';
import ChatInput from '@/components/chat/ChatInput';
import { echoUserInput } from '@/ai/flows/echo-user-input';
import type { EchoUserInputInput } from '@/ai/flows/echo-user-input';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from 'lucide-react';

export default function EchoChamberPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    // Welcome message on initial load
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
      
      // Update conversation context for more coherent follow-up echos
      setConversationContext(
        (prevCtx) => `${prevCtx}\nUser: ${text}\nAI: ${aiResponse.echoedResponse}`.slice(-2000) // Keep context length manageable
      );

    } catch (error) {
      console.error('Error calling AI flow:', error);
      toast({
        title: "AI Error",
        description: "Oops! Something went wrong while talking to the AI. Please try again.",
        variant: "destructive",
      });
      // Add a visual error message in chat as well
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
    <div className="flex flex-col h-[calc(100vh-120px)] bg-background text-foreground border rounded-lg shadow-sm overflow-hidden">
      <header className="border-b p-4 shadow-sm bg-card">
        <div className="flex items-center justify-center">
          <Sparkles className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-xl font-semibold text-primary">Echo Chamber Chatbot</h1>
        </div>
      </header>
      <ChatHistory messages={messages} isLoading={isLoading} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      {/* Toaster is already in RootLayout */}
    </div>
  );
}
