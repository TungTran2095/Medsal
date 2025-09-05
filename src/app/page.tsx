
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { Message } from '@/types';
import ChatHistory from '@/components/chat/ChatHistory';
import ChatInput from '@/components/chat/ChatInput';
import { echoUserInput } from '@/ai/flows/echo-user-input';
import type { EchoUserInputInput } from '@/ai/flows/echo-user-input';
import { useToast } from "@/hooks/use-toast";
import { Sparkles, PanelRightClose, PanelRightOpen, Loader2 } from 'lucide-react';
import WorkspaceContent from '@/components/workspace/WorkspaceContent';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>('');
  const { toast } = useToast();
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter(); 

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    // Redirect to dashboard doanh thu if authenticated
    if (!loading && user) {
      router.push('/dashboard/revenue');
      return;
    }
  }, [user, loading, router]);

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

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

    // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Đang chuyển hướng...</p>
        </div>
      </div>
    );
  }

  // Don't render anything (will redirect in useEffect)
  return null;
}

