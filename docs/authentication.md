# Hệ Thống Authentication - Med Sal

## Tổng Quan

Hệ thống authentication đã được triển khai hoàn chỉnh sử dụng Supabase Auth với Next.js 15. Vì đây là hệ thống nội bộ, chức năng đăng ký đã được vô hiệu hóa. Quản trị viên sẽ tạo và quản lý user trực tiếp từ Supabase Dashboard.

## Các Tính Năng

### 1. Đăng nhập (Nội bộ)
- ✅ Form đăng nhập với email/password
- ✅ Validation client-side và server-side
- ✅ Xử lý lỗi thân thiện người dùng
- ✅ Hiển thị/ẩn mật khẩu
- ✅ Chỉ quản trị viên có thể tạo user mới

### 2. Bảo Vệ Route
- ✅ Middleware bảo vệ toàn bộ ứng dụng
- ✅ Redirect tự động về login khi chưa xác thực
- ✅ Redirect về trang được yêu cầu sau khi đăng nhập
- ✅ Ngăn truy cập trang login khi đã đăng nhập

### 3. Quản Lý Session
- ✅ AuthContext để quản lý trạng thái authentication
- ✅ Tự động cập nhật UI khi session thay đổi
- ✅ Persistent authentication across browser sessions

### 4. UI/UX
- ✅ Header với user menu và toggle theme
- ✅ Loading states khi kiểm tra authentication
- ✅ Toast notifications cho các hành động
- ✅ Responsive design cho mobile và desktop

## Cấu Trúc File

```
src/
├── contexts/
│   └── AuthContext.tsx          # Context quản lý authentication state
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx        # Form đăng nhập (nội bộ)
│   │   └── UserMenu.tsx         # Dropdown menu user
│   └── layout/
│       └── Header.tsx           # Header component với user menu
├── app/
│   ├── login/
│   │   └── page.tsx            # Trang authentication
│   ├── layout.tsx              # Root layout với providers
│   └── page.tsx                # Trang chính được bảo vệ
└── lib/
    └── supabaseClient.ts       # Supabase client configuration

middleware.ts                   # Route protection middleware
```

## Cách Sử Dụng

### 1. Cài Đặt Environment Variables

Đảm bảo bạn đã cấu hình các environment variables trong `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Cấu Hình Supabase

Trong Supabase Dashboard:
1. Bật Email Authentication
2. Cấu hình email templates (tuỳ chọn)
3. Thiết lập redirect URLs cho authentication

### 3. Chạy Ứng Dụng

```bash
npm run dev
```

## Luồng Authentication

### Tạo User (Quản trị viên)
1. Quản trị viên tạo user từ Supabase Dashboard
2. Gửi invitation email hoặc tạo user trực tiếp
3. User nhận email và thiết lập mật khẩu
4. User có thể đăng nhập vào hệ thống

### Đăng Nhập
1. User nhập thông tin trong LoginForm
2. Gọi `supabase.auth.signInWithPassword()`
3. Nếu thành công, AuthContext cập nhật user state
4. Middleware cho phép truy cập protected routes
5. Redirect về trang được yêu cầu hoặc dashboard

### Đăng Xuất
1. User click "Đăng xuất" trong UserMenu
2. Gọi `supabase.auth.signOut()`
3. AuthContext cập nhật user state về null
4. Middleware redirect về trang login

## Tùy Chỉnh

### Thêm Fields Mới
Để thêm fields như tên, số điện thoại:
1. Cập nhật user metadata trong Supabase Dashboard
2. Sử dụng `user_metadata` khi tạo user
3. Cập nhật UserMenu để hiển thị thông tin bổ sung

### Thêm Social Login
```typescript
// Trong AuthContext.tsx
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`
    }
  });
  return { error };
};
```

### Role-Based Access
```typescript
// Kiểm tra roles trong middleware hoặc components
const userRole = user?.user_metadata?.role;
if (userRole !== 'admin') {
  // Restrict access
}
```

## Troubleshooting

### Lỗi "User not found"
- Kiểm tra email đã được xác nhận chưa
- Đảm bảo user tồn tại trong Supabase Auth

### Lỗi Middleware
- Kiểm tra config matcher trong middleware.ts
- Đảm bảo Supabase client được khởi tạo đúng

### Session không persistent
- Kiểm tra cookie settings
- Đảm bảo HTTPS được sử dụng trong production

## User Management

Vì đây là hệ thống nội bộ, việc quản lý user được thực hiện thông qua Supabase Dashboard:

### Tạo User Mới
1. Vào Supabase Dashboard → Authentication → Users
2. Click "Add user" hoặc "Invite user"
3. Nhập email và mật khẩu tạm thời
4. Thêm user metadata (tên, phòng ban, role)

### Quản Lý User
- Xem danh sách user và trạng thái
- Chỉnh sửa thông tin user
- Vô hiệu hóa/xóa user
- Reset mật khẩu

Xem chi tiết trong file `docs/user-management.md`

## Security Best Practices

1. **Environment Variables**: Không bao giờ commit secrets vào version control
2. **RLS (Row Level Security)**: Bật RLS trong Supabase cho tất cả tables
3. **HTTPS**: Luôn sử dụng HTTPS trong production
4. **Input Validation**: Validate inputs cả client và server side
5. **Error Handling**: Không expose sensitive information trong error messages
6. **User Management**: Chỉ admin có quyền tạo/xóa user

## Production Checklist

- [ ] Cấu hình proper redirect URLs trong Supabase
- [ ] Bật RLS cho all database tables
- [ ] Thiết lập proper email templates cho invitation
- [ ] Configure CORS settings
- [ ] Test authentication flow trên production domain
- [ ] Monitor auth events và errors
- [ ] Thiết lập user management process
- [ ] Tạo admin user đầu tiên
