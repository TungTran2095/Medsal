# Hướng dẫn thiết lập Chat Database

## 1. Tạo bảng chat_messages trong Supabase

Chạy file SQL sau trong Supabase SQL Editor:

```sql
-- Tạo bảng chat_messages để lưu trữ tin nhắn của chatbot
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- ID của user (có thể là session_id hoặc user_id thực)
  message_text TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id TEXT, -- Để nhóm các tin nhắn theo phiên chat
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo index để tối ưu hóa truy vấn
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);

-- Tạo function để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tạo trigger để tự động cập nhật updated_at
CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## 2. Cấu hình RLS (Row Level Security) - Tùy chọn

Nếu bạn muốn bảo mật dữ liệu theo user, có thể bật RLS:

```sql
-- Bật RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy để user chỉ có thể xem tin nhắn của mình
CREATE POLICY "Users can view their own messages" ON chat_messages
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true));

-- Policy để user chỉ có thể insert tin nhắn của mình
CREATE POLICY "Users can insert their own messages" ON chat_messages
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));
```

## 3. Tính năng đã được thêm

### ✅ Lưu trữ tin nhắn
- Tất cả tin nhắn của user và AI đều được lưu vào database
- Mỗi tin nhắn có user_id và session_id để phân biệt

### ✅ Tải lại tin nhắn cũ
- Khi mở chatbot, hệ thống sẽ tự động tải lại tin nhắn cũ
- Tin nhắn được sắp xếp theo thời gian

### ✅ Quản lý session
- Mỗi phiên chat có session_id riêng
- User có thể tạo session mới

### ✅ Export tin nhắn
- Có thể xuất tin nhắn ra file JSON
- Bao gồm thông tin session và thời gian

### ✅ Xóa tin nhắn
- Có thể xóa tất cả tin nhắn trong session hiện tại

## 4. Cách sử dụng

1. **Tự động lưu**: Tin nhắn sẽ được lưu tự động khi gửi
2. **Tự động tải**: Tin nhắn cũ sẽ được tải khi mở chatbot
3. **Xóa chat**: Sử dụng nút "Clear Chat" để xóa tất cả tin nhắn
4. **Export**: Sử dụng nút "Export" để tải file JSON
5. **Session mới**: Có thể tạo session mới (cần implement thêm UI)

## 5. Cấu trúc dữ liệu

### Bảng chat_messages:
- `id`: UUID primary key
- `user_id`: ID của user (tự động tạo)
- `message_text`: Nội dung tin nhắn
- `sender`: 'user' hoặc 'ai'
- `timestamp`: Thời gian gửi
- `session_id`: ID của phiên chat
- `created_at`: Thời gian tạo record
- `updated_at`: Thời gian cập nhật cuối

### Interface Message:
```typescript
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  user_id?: string;
  session_id?: string;
}
```

## 6. Lưu ý

- Tin nhắn được lưu trong sessionStorage để duy trì user_id và session_id
- Nếu xóa sessionStorage, sẽ tạo user_id và session_id mới
- Có thể mở rộng để tích hợp với hệ thống authentication thực




