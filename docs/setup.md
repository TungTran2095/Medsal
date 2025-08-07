# Hướng Dẫn Cấu Hình - Med Sal

## 1. Cấu Hình Environment Variables

Tạo file `.env.local` trong thư mục gốc của dự án với nội dung sau:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# OpenAI Configuration (nếu sử dụng)
OPENAI_API_KEY=your_openai_api_key_here
```

### Cách Lấy Thông Tin Supabase:

1. **Truy cập Supabase Dashboard**: https://supabase.com/dashboard
2. **Chọn project** của bạn
3. **Vào Settings** → **API**
4. **Copy các giá trị**:
   - **Project URL**: Dán vào `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public**: Dán vào `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Cấu Hình Database Functions

Các dashboard components cần các SQL functions để hoạt động. Hãy chạy các SQL functions từ file `find_functions.sql` và `kpi_functions.sql` trong Supabase SQL Editor.

### Cách Thêm Functions:

1. **Vào Supabase Dashboard** → **SQL Editor**
2. **Tạo query mới**
3. **Copy và paste** nội dung từ file `find_functions.sql`
4. **Chạy query**
5. **Lặp lại** với file `kpi_functions.sql`

## 3. Cấu Hình Authentication

1. **Vào Authentication** → **Settings**
2. **Bật Email Authentication**
3. **Cấu hình Site URL**: `http://localhost:9002`
4. **Cấu hình Redirect URLs**: 
   - `http://localhost:9002/dashboard`
   - `http://localhost:9002/login`

## 4. Tạo User Đầu Tiên

1. **Vào Authentication** → **Users**
2. **Click "Add user"**
3. **Nhập email và password**
4. **Thêm user metadata** (tùy chọn):
   ```json
   {
     "full_name": "Admin User",
     "role": "admin",
     "department": "IT"
   }
   ```

## 5. Chạy Ứng Dụng

```bash
npm run dev
```

Truy cập: http://localhost:9002

## Troubleshooting

### Lỗi "Function does not exist"
- Đảm bảo đã chạy tất cả SQL functions từ file `find_functions.sql` và `kpi_functions.sql`
- Kiểm tra tên function trong Supabase SQL Editor

### Lỗi "Invalid API key"
- Kiểm tra `NEXT_PUBLIC_SUPABASE_ANON_KEY` trong `.env.local`
- Đảm bảo key bắt đầu với `eyJ...`

### Lỗi "Connection failed"
- Kiểm tra `NEXT_PUBLIC_SUPABASE_URL` trong `.env.local`
- Đảm bảo URL đúng format: `https://xxx.supabase.co`

### Dashboard không hiển thị dữ liệu
- Kiểm tra xem có dữ liệu trong database không
- Đảm bảo RLS (Row Level Security) được cấu hình đúng
- Kiểm tra logs trong Supabase Dashboard
