import { useState, useEffect, useCallback } from 'react';
import { chatService } from '@/lib/chatService';
import type { Message } from '@/types';
import { useToast } from './use-toast';

interface UseChatOptions {
  autoLoadMessages?: boolean;
  maxMessages?: number;
}

export function useChat(options: UseChatOptions = {}) {
  const { autoLoadMessages = true, maxMessages = 50 } = options;
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const { toast } = useToast();

  // Load messages from database when component mounts
  useEffect(() => {
    if (autoLoadMessages) {
      loadMessages();
    }
  }, [autoLoadMessages]);

  const loadMessages = useCallback(async () => {
    try {
      setIsLoadingMessages(true);
      const savedMessages = await chatService.getMessages(maxMessages);
      
      // Nếu không có tin nhắn nào, thêm tin nhắn chào mừng
      if (savedMessages.length === 0) {
        const welcomeMessage: Message = {
          id: 'welcome-' + Date.now(),
          text: "Xin chào! Tôi là Echo, trợ lý AI của bạn. Hãy hỏi tôi bất cứ điều gì hoặc yêu cầu dữ liệu từ cơ sở dữ liệu của bạn nhé!",
          sender: 'ai',
          timestamp: Date.now(),
        };
        setMessages([welcomeMessage]);
        // Lưu tin nhắn chào mừng vào database
        await chatService.saveMessage(welcomeMessage);
      } else {
        setMessages(savedMessages);
      }
    } catch (error) {
      console.error('Lỗi khi tải tin nhắn:', error);
      toast({
        title: "Lỗi tải tin nhắn",
        description: "Không thể tải tin nhắn cũ. Bạn có thể tiếp tục chat bình thường.",
        variant: "destructive",
      });
      // Fallback: thêm tin nhắn chào mừng
      const welcomeMessage: Message = {
        id: 'welcome-' + Date.now(),
        text: "Xin chào! Tôi là Echo, trợ lý AI của bạn. Hãy hỏi tôi bất cứ điều gì hoặc yêu cầu dữ liệu từ cơ sở dữ liệu của bạn nhé!",
        sender: 'ai',
        timestamp: Date.now(),
      };
      setMessages([welcomeMessage]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [maxMessages, toast]);

  const addMessage = useCallback(async (message: Omit<Message, 'id' | 'timestamp'>) => {
    try {
      const newMessage = await chatService.saveMessage(message);
      setMessages(prev => [...prev, newMessage]);
      return newMessage;
    } catch (error) {
      console.error('Lỗi khi lưu tin nhắn:', error);
      toast({
        title: "Lỗi lưu tin nhắn",
        description: "Không thể lưu tin nhắn. Tin nhắn vẫn hiển thị nhưng có thể mất khi tải lại trang.",
        variant: "destructive",
      });
      
      // Fallback: tạo message với ID tạm thời
      const tempMessage: Message = {
        id: `${message.sender}-${Date.now()}`,
        text: message.text,
        sender: message.sender,
        timestamp: Date.now(),
        user_id: message.user_id,
        session_id: message.session_id
      };
      setMessages(prev => [...prev, tempMessage]);
      return tempMessage;
    }
  }, [toast]);

  const sendMessage = useCallback(async (text: string, aiResponseCallback?: (text: string) => Promise<string>) => {
    // Thêm tin nhắn của user
    const userMessage = await addMessage({
      text,
      sender: 'user',
      user_id: chatService.getCurrentSession().userId,
      session_id: chatService.getCurrentSession().sessionId
    });

    setIsLoading(true);

    try {
      // Gọi AI response callback nếu có
      let aiResponseText = '';
      if (aiResponseCallback) {
        aiResponseText = await aiResponseCallback(text);
      } else {
        // Fallback response nếu không có callback
        aiResponseText = `Bạn đã nói: "${text}". Tôi đang xử lý yêu cầu của bạn...`;
      }

      // Thêm tin nhắn của AI
      await addMessage({
        text: aiResponseText,
        sender: 'ai',
        user_id: chatService.getCurrentSession().userId,
        session_id: chatService.getCurrentSession().sessionId
      });

    } catch (error) {
      console.error('Lỗi khi xử lý tin nhắn:', error);
      toast({
        title: "Lỗi xử lý",
        description: "Có lỗi xảy ra khi xử lý tin nhắn của bạn.",
        variant: "destructive",
      });
      
      // Thêm tin nhắn lỗi
      await addMessage({
        text: "Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.",
        sender: 'ai',
        user_id: chatService.getCurrentSession().userId,
        session_id: chatService.getCurrentSession().sessionId
      });
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, toast]);

  const clearMessages = useCallback(async () => {
    try {
      await chatService.clearMessages();
      setMessages([]);
      toast({
        title: "Đã xóa tin nhắn",
        description: "Tất cả tin nhắn đã được xóa.",
      });
    } catch (error) {
      console.error('Lỗi khi xóa tin nhắn:', error);
      toast({
        title: "Lỗi xóa tin nhắn",
        description: "Không thể xóa tin nhắn. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const createNewSession = useCallback(() => {
    chatService.createNewSession();
    setMessages([]);
    toast({
      title: "Phiên mới",
      description: "Đã tạo phiên chat mới.",
    });
  }, [toast]);

  const exportMessages = useCallback(() => {
    try {
      const exportData = {
        messages: messages,
        session: chatService.getCurrentSession(),
        exportedAt: new Date().toISOString()
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Đã xuất tin nhắn",
        description: "File JSON đã được tải xuống.",
      });
    } catch (error) {
      console.error('Lỗi khi xuất tin nhắn:', error);
      toast({
        title: "Lỗi xuất tin nhắn",
        description: "Không thể xuất tin nhắn. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  }, [messages, toast]);

  return {
    messages,
    isLoading,
    isLoadingMessages,
    sendMessage,
    addMessage,
    clearMessages,
    createNewSession,
    exportMessages,
    loadMessages,
    sessionInfo: chatService.getCurrentSession()
  };
}




