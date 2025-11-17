# Hướng dẫn Deploy Function get_salary_revenue_ratio_by_location

## Vấn đề gặp phải
Khi chạy script deploy, gặp lỗi syntax error. Điều này có thể do:
1. Function `exec_sql` không tồn tại trong Supabase
2. Cách thực thi SQL không đúng
3. Quyền truy cập không đủ

## Giải pháp

### Cách 1: Deploy trực tiếp qua Supabase SQL Editor (KHUYẾN NGHỊ)

1. **Mở Supabase Dashboard**
   - Truy cập https://supabase.com/dashboard
   - Chọn project của bạn

2. **Mở SQL Editor**
   - Click vào "SQL Editor" ở sidebar
   - Tạo query mới

3. **Copy và paste nội dung file `deploy_function_direct.sql`**
   - Mở file `deploy_function_direct.sql`
   - Copy toàn bộ nội dung
   - Paste vào SQL Editor

4. **Chạy script**
   - Click "Run" để thực thi
   - Kiểm tra kết quả

### Cách 2: Sử dụng script Node.js (nếu có quyền)

1. **Cài đặt dependencies**
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Tạo file .env**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Chạy script**
   ```bash
   node deploy_function_simple.js
   ```

### Cách 3: Sử dụng psql (nếu có quyền truy cập database)

1. **Kết nối database**
   ```bash
   psql "postgresql://postgres:[password]@[host]:[port]/[database]"
   ```

2. **Chạy SQL file**
   ```bash
   \i deploy_function_direct.sql
   ```

## Kiểm tra kết quả

### 1. Kiểm tra function đã được tạo
```sql
SELECT proname, proargnames, proargtypes 
FROM pg_proc 
WHERE proname = 'get_salary_revenue_ratio_by_location';
```

### 2. Test function với dữ liệu mẫu
```sql
SELECT 
    ten_don_vi,
    ROUND(ty_le_luong_doanh_thu * 100, 2) as ty_le_luong_doanh_thu_percent,
    ROUND(ty_le_fulltime_doanh_thu * 100, 2) as ty_le_fulltime_doanh_thu_percent,
    ROUND(ty_le_ql_dt_duoc_phep * 100, 2) as ty_le_ql_dt_duoc_phep_percent
FROM get_salary_revenue_ratio_by_location(2024, [1], null, null, null)
LIMIT 5;
```

### 3. Kiểm tra chart hoạt động
- Mở chart "Tỷ lệ lương/doanh thu theo địa điểm"
- Xác nhận có 3 đường line:
  - Tỷ lệ tổng lương/doanh thu
  - Tỷ lệ lương Fulltime/doanh thu
  - **QL/DT được phép** (đường nét đứt)

## Troubleshooting

### Lỗi "function does not exist"
- Kiểm tra function đã được tạo chưa
- Chạy lại script deploy

### Lỗi "relation does not exist"
- Kiểm tra bảng `Chi_tieu_2025` có tồn tại không
- Kiểm tra tên bảng có đúng không

### Lỗi "permission denied"
- Kiểm tra quyền truy cập database
- Sử dụng service role key thay vì anon key

### Dữ liệu QL/DT = 0
- Kiểm tra bảng `Chi_tieu_2025` có dữ liệu không
- Kiểm tra mapping giữa tên địa điểm
- Kiểm tra công thức tính toán

## Kết quả mong đợi

Sau khi deploy thành công:
- Function `get_salary_revenue_ratio_by_location` được tạo
- Chart hiển thị 3 đường line
- Tooltip hiển thị đầy đủ thông tin
- Dữ liệu QL/DT được phép giống với bảng "Phân Tích Lương Tổng Hợp"

## Liên hệ hỗ trợ

Nếu gặp vấn đề, hãy:
1. Kiểm tra log lỗi chi tiết
2. Thử deploy bằng cách 1 (SQL Editor)
3. Kiểm tra quyền truy cập database
4. Liên hệ admin database nếu cần
