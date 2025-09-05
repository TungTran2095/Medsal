"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { Message } from '@/types';
import ChatHistory from '@/components/chat/ChatHistory';
import ChatInput from '@/components/chat/ChatInput';
import ChatHeader from '@/components/chat/ChatHeader';
import QuickSuggestions from '@/components/chat/QuickSuggestions';
import ChatbotFloatingButton from '@/components/chat/ChatbotFloatingButton';
import { echoUserInput } from '@/ai/flows/echo-user-input';
import type { EchoUserInputInput } from '@/ai/flows/echo-user-input';
import { useToast } from "@/hooks/use-toast";
import { Sparkles, PanelRightClose, PanelRightOpen, Loader2, LayoutDashboard, DollarSign } from 'lucide-react';
import WorkspaceContent from '@/components/workspace/WorkspaceContent';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function SalaryDashboardPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>('');
  const [searchValue, setSearchValue] = useState('');
  const { toast } = useToast();
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter(); 

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !user) {
      router.push('/login');
    }

    // Initialize welcome message only if authenticated
    if (user) {
      setMessages([
        {
          id: 'welcome-' + Date.now(),
          text: "Xin chào! Tôi là Echo, trợ lý AI của bạn. Hãy hỏi tôi bất cứ điều gì hoặc yêu cầu dữ liệu từ cơ sở dữ liệu của bạn nhé!",
          sender: 'ai',
          timestamp: Date.now(),
        },
      ]);
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

  const handleClearChat = () => {
    setMessages([]);
    setConversationContext('');
    toast({
      title: "Đã xóa cuộc trò chuyện",
      description: "Cuộc trò chuyện đã được xóa thành công.",
    });
  };

  const handleExportChat = () => {
    const chatData = {
      messages: messages,
      exportedAt: new Date().toISOString(),
      totalMessages: messages.length
    };
    
    const dataStr = JSON.stringify(chatData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    toast({
      title: "Xuất cuộc trò chuyện",
      description: "Cuộc trò chuyện đã được xuất thành công.",
    });
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
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

  // Don't render if not authenticated (will redirect in useEffect)
  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col w-full h-full">
      <Header />
      <div className="flex flex-col w-full h-full p-0">
        <div className="w-full p-4 border-b bg-muted/30">
          <div className="flex items-center gap-4">
            <Button variant="default" size="sm" asChild>
              <a href="/dashboard/salary">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard Lương
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/dashboard/revenue">
                <DollarSign className="h-4 w-4 mr-2" />
                Dashboard Doanh Thu
              </a>
            </Button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row flex-1 w-full h-full p-0"> 
          <div className={cn(
            "w-full pt-0.5 pb-0.5 pl-0.5 pr-0 md:pt-1 md:pb-1 md:pl-1 md:pr-0.5 overflow-y-auto transition-all duration-300 ease-in-out",
            isChatbotOpen ? 'md:w-2/3' : 'md:flex-1'
          )}
          >
            <WorkspaceContent />
          </div>

          {/* Chatbot Sidebar - Only show when open */}
          {isChatbotOpen && (
            <div className="w-full pt-0.5 pb-0.5 pr-0.5 pl-0 md:pt-1 md:pb-1 md:pr-1 md:pl-0.5 flex flex-col transition-all duration-300 ease-in-out overflow-hidden md:w-1/3">
              <div className="flex flex-col flex-1 bg-card text-foreground border rounded-lg shadow-soft-md overflow-hidden h-full min-h-[200px] md:min-h-0">
                <ChatHeader
                  isOpen={isChatbotOpen}
                  onToggle={toggleChatbot}
                  onClearChat={handleClearChat}
                  onExportChat={handleExportChat}
                  searchValue={searchValue}
                  onSearchChange={setSearchValue}
                  messageCount={messages.length}
                />
                
                <div 
                  id="chatbot-content-area"
                  className="flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-in-out opacity-100 max-h-[100vh]"
                >
                  {messages.length === 0 && !isLoading && (
                    <QuickSuggestions 
                      onSuggestionClick={handleSuggestionClick} 
                      isLoading={isLoading} 
                    />
                  )}
                  <ChatHistory messages={messages} isLoading={isLoading} />
                  <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Floating Chatbot Button */}
      <ChatbotFloatingButton
        isOpen={isChatbotOpen}
        onToggle={toggleChatbot}
        messageCount={messages.length}
        hasUnreadMessages={false}
      />
    </div>
  );
}




