# Hướng Dẫn Quản Lý User - Med Sal

## Tổng Quan

Vì Med Sal là hệ thống nội bộ, việc đăng ký đã được vô hiệu hóa. Thay vào đó, quản trị viên sẽ tạo và quản lý user trực tiếp từ Supabase Dashboard.

## Cách Tạo User Mới

### 1. Truy Cập Supabase Dashboard

1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Vào **Authentication** → **Users**

### 2. Tạo User Thủ Công

#### Cách 1: Tạo User Trực Tiếp
1. Click **"Add user"** hoặc **"Invite user"**
2. Nhập thông tin:
   - **Email**: email của nhân viên
   - **Password**: mật khẩu tạm thời (user sẽ đổi sau khi đăng nhập lần đầu)
   - **User metadata** (tùy chọn):
     ```json
     {
       "full_name": "Nguyễn Văn A",
       "department": "Kế toán",
       "role": "user"
     }
     ```
3. Click **"Create user"**

#### Cách 2: Gửi Email Invitation
1. Click **"Invite user"**
2. Nhập email của nhân viên
3. Supabase sẽ gửi email invitation với link đặt mật khẩu
4. Nhân viên click link và đặt mật khẩu mới

### 3. Cấu Hình Email Templates

Để email invitation trông chuyên nghiệp hơn:

1. Vào **Authentication** → **Email Templates**
2. Tùy chỉnh:
   - **Confirm signup**: Email xác nhận đăng ký
   - **Invite user**: Email mời user
   - **Magic link**: Email đăng nhập bằng link
   - **Change email address**: Email thay đổi email
   - **Reset password**: Email reset mật khẩu

#### Ví dụ Email Template cho Invitation:
```html
<h2>Chào mừng bạn đến với Med Sal!</h2>
<p>Bạn đã được mời tham gia hệ thống quản lý lương nội bộ.</p>
<p>Vui lòng click vào link bên dưới để thiết lập mật khẩu:</p>
<a href="{{ .ConfirmationURL }}">Thiết lập mật khẩu</a>
<p>Link này sẽ hết hạn sau 24 giờ.</p>
<p>Nếu bạn không yêu cầu tài khoản này, vui lòng bỏ qua email này.</p>
```

## Quản Lý User

### 1. Xem Danh Sách User
- Vào **Authentication** → **Users**
- Xem thông tin: Email, Created at, Last sign in, Status

### 2. Chỉnh Sửa User
1. Click vào user cần chỉnh sửa
2. Có thể thay đổi:
   - **Email**
   - **User metadata** (tên, phòng ban, role)
   - **Password** (reset mật khẩu)

### 3. Vô Hiệu Hóa User
1. Click vào user
2. Click **"Disable user"**
3. User sẽ không thể đăng nhập nữa

### 4. Xóa User
1. Click vào user
2. Click **"Delete user"**
3. **Cẩn thận**: Hành động này không thể hoàn tác

## Cấu Hình Bảo Mật

### 1. Password Policy
Vào **Authentication** → **Settings** → **Password**:
- **Minimum length**: 8 ký tự
- **Require uppercase**: Bắt buộc chữ hoa
- **Require lowercase**: Bắt buộc chữ thường
- **Require numbers**: Bắt buộc số
- **Require special characters**: Bắt buộc ký tự đặc biệt

### 2. Session Management
- **Session timeout**: Thời gian session hết hạn
- **Refresh token rotation**: Tự động refresh token
- **JWT expiry**: Thời gian JWT hết hạn

### 3. MFA (Multi-Factor Authentication)
- Bật TOTP (Time-based One-Time Password)
- Yêu cầu user setup MFA sau khi đăng nhập lần đầu

## Role-Based Access Control

### 1. Tạo Roles trong User Metadata
```json
{
  "role": "admin",
  "department": "IT",
  "permissions": ["read", "write", "delete"]
}
```

### 2. Kiểm Tra Role trong Code
```typescript
// Trong component hoặc middleware
const userRole = user?.user_metadata?.role;
const userDepartment = user?.user_metadata?.department;

if (userRole === 'admin') {
  // Hiển thị admin features
}

if (userDepartment === 'HR') {
  // Hiển thị HR features
}
```

### 3. RLS (Row Level Security)
```sql
-- Ví dụ: User chỉ thấy dữ liệu của phòng ban mình
CREATE POLICY "Users can only see their department data" ON salaries
FOR ALL USING (
  department = current_setting('request.jwt.claims')::json->>'department'
);
```

## Monitoring và Logs

### 1. Xem Auth Logs
- Vào **Authentication** → **Logs**
- Xem các events: sign in, sign out, password reset, etc.

### 2. Failed Login Attempts
- Monitor các lần đăng nhập thất bại
- Có thể block IP nếu có quá nhiều failed attempts

### 3. User Activity
- Track thời gian đăng nhập cuối
- Monitor user sessions

## Best Practices

### 1. User Onboarding
1. Tạo user với email công ty
2. Gửi invitation email
3. User đặt mật khẩu lần đầu
4. Setup MFA (nếu cần)
5. Training về sử dụng hệ thống

### 2. User Offboarding
1. Disable user account
2. Backup user data (nếu cần)
3. Delete user (sau khi đã backup)

### 3. Security
- Regular password updates
- Monitor suspicious activities
- Backup user data regularly
- Use strong password policies

## Troubleshooting

### User không nhận được invitation email
1. Kiểm tra spam folder
2. Verify email template configuration
3. Check SMTP settings

### User không thể đăng nhập
1. Kiểm tra user status (enabled/disabled)
2. Verify email confirmation
3. Check password policy
4. Reset password nếu cần

### Session issues
1. Clear browser cache/cookies
2. Check JWT expiry settings
3. Verify CORS configuration

## API Endpoints (nếu cần)

### Tạo User qua API
```bash
curl -X POST 'https://your-project.supabase.co/auth/v1/admin/users' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "temporary_password",
    "user_metadata": {
      "full_name": "Nguyễn Văn A",
      "department": "HR"
    }
  }'
```

### List Users
```bash
curl -X GET 'https://your-project.supabase.co/auth/v1/admin/users' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```
