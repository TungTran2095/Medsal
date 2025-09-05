import { supabase } from './supabaseClient';
import type { Message, ChatMessage } from '@/types';

export class ChatService {
  private userId: string;
  private sessionId: string;

  constructor(userId?: string, sessionId?: string) {
    this.userId = userId || this.generateUserId();
    this.sessionId = sessionId || this.generateSessionId();
  }

  private generateUserId(): string {
    // Tạo user ID dựa trên session storage hoặc random
    if (typeof window !== 'undefined') {
      let userId = sessionStorage.getItem('chat_user_id');
      if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('chat_user_id', userId);
      }
      return userId;
    }
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateSessionId(): string {
    // Tạo session ID cho phiên chat hiện tại
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('chat_session_id');
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('chat_session_id', sessionId);
      }
      return sessionId;
    }
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Lưu tin nhắn vào database
  async saveMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    try {
      console.log('🔄 Bắt đầu lưu tin nhắn:', message);
      console.log('📊 User ID:', this.userId);
      console.log('📊 Session ID:', this.sessionId);
      console.log('🔗 Supabase client:', supabase ? 'OK' : 'NULL');

      // Kiểm tra Supabase client
      if (!supabase) {
        throw new Error('Supabase client is not initialized');
      }

      const chatMessage: Omit<ChatMessage, 'id' | 'created_at' | 'updated_at'> = {
        user_id: this.userId,
        message_text: message.text,
        sender: message.sender,
        timestamp: new Date().toISOString(),
        session_id: this.sessionId
      };

      console.log('📝 Dữ liệu sẽ lưu:', chatMessage);

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([chatMessage])
        .select()
        .single();

      if (error) {
        console.error('❌ Lỗi khi lưu tin nhắn:', error);
        console.error('❌ Chi tiết lỗi:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ Lưu tin nhắn thành công:', data);

      // Chuyển đổi từ database format sang Message format
      const savedMessage: Message = {
        id: data.id,
        text: data.message_text,
        sender: data.sender,
        timestamp: new Date(data.timestamp).getTime(),
        user_id: data.user_id,
        session_id: data.session_id
      };

      return savedMessage;
    } catch (error) {
      console.error('❌ Lỗi khi lưu tin nhắn:', error);
      throw error;
    }
  }

  // Lấy tất cả tin nhắn của user trong session hiện tại
  async getMessages(limit: number = 50): Promise<Message[]> {
    try {
      console.log('🔄 Bắt đầu lấy tin nhắn...');
      console.log('📊 User ID:', this.userId);
      console.log('📊 Session ID:', this.sessionId);

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', this.userId)
        .eq('session_id', this.sessionId)
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('❌ Lỗi khi lấy tin nhắn:', error);
        console.error('❌ Chi tiết lỗi:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ Lấy tin nhắn thành công:', data?.length || 0, 'tin nhắn');

      // Chuyển đổi từ database format sang Message format
      const messages: Message[] = data.map((msg: ChatMessage) => ({
        id: msg.id,
        text: msg.message_text,
        sender: msg.sender,
        timestamp: new Date(msg.timestamp).getTime(),
        user_id: msg.user_id,
        session_id: msg.session_id
      }));

      return messages;
    } catch (error) {
      console.error('❌ Lỗi khi lấy tin nhắn:', error);
      return [];
    }
  }

  // Lấy tin nhắn gần đây nhất
  async getRecentMessages(limit: number = 10): Promise<Message[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', this.userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Lỗi khi lấy tin nhắn gần đây:', error);
        throw error;
      }

      // Chuyển đổi và sắp xếp lại theo thứ tự tăng dần
      const messages: Message[] = data
        .map((msg: ChatMessage) => ({
          id: msg.id,
          text: msg.message_text,
          sender: msg.sender,
          timestamp: new Date(msg.timestamp).getTime(),
          user_id: msg.user_id,
          session_id: msg.session_id
        }))
        .reverse();

      return messages;
    } catch (error) {
      console.error('Lỗi khi lấy tin nhắn gần đây:', error);
      return [];
    }
  }

  // Xóa tất cả tin nhắn của user
  async clearMessages(): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('user_id', this.userId)
        .eq('session_id', this.sessionId);

      if (error) {
        console.error('Lỗi khi xóa tin nhắn:', error);
        throw error;
      }
    } catch (error) {
      console.error('Lỗi khi xóa tin nhắn:', error);
      throw error;
    }
  }

  // Tạo session mới
  createNewSession(): void {
    this.sessionId = this.generateSessionId();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('chat_session_id', this.sessionId);
    }
  }

  // Lấy thông tin session hiện tại
  getCurrentSession(): { userId: string; sessionId: string } {
    return {
      userId: this.userId,
      sessionId: this.sessionId
    };
  }
}

// Tạo instance mặc định
export const chatService = new ChatService();
