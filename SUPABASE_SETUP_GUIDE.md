# Hướng dẫn cấu hình Supabase cho Chat

## 1. Tạo file .env.local

Tạo file `.env.local` trong thư mục gốc của project với nội dung:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## 2. Lấy thông tin từ Supabase Dashboard

1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Vào **Settings** > **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** > **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3. Tạo bảng chat_messages

Chạy SQL sau trong Supabase SQL Editor:

```sql
-- Tạo bảng chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo index
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);

-- Tạo function và trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## 4. Kiểm tra kết nối

Sau khi cấu hình xong:

1. Restart development server: `npm run dev`
2. Mở Developer Tools (F12) > Console
3. Gửi một tin nhắn trong chatbot
4. Kiểm tra console log để xem:
   - `🔄 Bắt đầu lưu tin nhắn`
   - `✅ Lưu tin nhắn thành công` hoặc `❌ Lỗi khi lưu tin nhắn`

## 5. Kiểm tra dữ liệu trong Supabase

1. Vào Supabase Dashboard > **Table Editor**
2. Chọn bảng `chat_messages`
3. Xem dữ liệu đã được lưu chưa

## 6. Troubleshooting

### Lỗi "Supabase URL or Anon Key is missing"
- Kiểm tra file `.env.local` có tồn tại không
- Kiểm tra tên biến môi trường có đúng không
- Restart development server

### Lỗi "relation 'chat_messages' does not exist"
- Chạy lại SQL tạo bảng
- Kiểm tra tên bảng có đúng không

### Lỗi "permission denied"
- Kiểm tra RLS policies
- Tạm thời disable RLS: `ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;`

### Lỗi kết nối
- Kiểm tra URL và API key
- Kiểm tra internet connection
- Kiểm tra Supabase project có active không




