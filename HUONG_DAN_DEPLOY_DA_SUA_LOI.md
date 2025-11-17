# Hướng dẫn Deploy Function (ĐÃ SỬA LỖI)

## ✅ Lỗi đã được sửa

**Lỗi gốc:** `syntax error at or near "["`
- **Nguyên nhân:** PostgreSQL không hỗ trợ cú pháp `[1]` cho array
- **Giải pháp:** Sử dụng `ARRAY[1]` thay vì `[1]`

## 🚀 Cách deploy (ĐÃ SỬA LỖI)

### Cách 1: Deploy qua Supabase SQL Editor (KHUYẾN NGHỊ)

1. **Mở Supabase Dashboard**
   - Truy cập https://supabase.com/dashboard
   - Chọn project của bạn

2. **Mở SQL Editor**
   - Click vào "SQL Editor" ở sidebar
   - Tạo query mới

3. **Copy và paste file `deploy_function_fixed.sql`**
   - File này đã được sửa lỗi cú pháp array
   - Copy toàn bộ nội dung và paste vào SQL Editor

4. **Chạy script**
   - Click "Run" để thực thi
   - Kiểm tra kết quả

### Cách 2: Sử dụng script Node.js

```bash
node deploy_function_simple.js
```

## 🧪 Kiểm tra kết quả

### 1. Kiểm tra function đã được tạo
```sql
SELECT proname, proargnames, proargtypes 
FROM pg_proc 
WHERE proname = 'get_salary_revenue_ratio_by_location';
```

### 2. Test function với cú pháp đúng
```sql
-- ✅ ĐÚNG: Sử dụng ARRAY[1]
SELECT 
    ten_don_vi,
    ROUND(ty_le_luong_doanh_thu * 100, 2) as ty_le_luong_doanh_thu_percent,
    ROUND(ty_le_fulltime_doanh_thu * 100, 2) as ty_le_fulltime_doanh_thu_percent,
    ROUND(ty_le_ql_dt_duoc_phep * 100, 2) as ty_le_ql_dt_duoc_phep_percent
FROM get_salary_revenue_ratio_by_location(2024, ARRAY[1], null, null, null)
LIMIT 5;

-- ❌ SAI: Sử dụng [1] (sẽ gây lỗi)
-- FROM get_salary_revenue_ratio_by_location(2024, [1], null, null, null)
```

### 3. Test với các tham số khác
```sql
-- Test với nhiều tháng
SELECT * FROM get_salary_revenue_ratio_by_location(2024, ARRAY[1,2,3], null, null, null);

-- Test với địa điểm cụ thể
SELECT * FROM get_salary_revenue_ratio_by_location(2024, null, ARRAY['Med Ba Đình'], null, null);

-- Test với ngành dọc
SELECT * FROM get_salary_revenue_ratio_by_location(2024, null, null, ARRAY['Hệ thống khám chữa bệnh'], null);
```

## 🎯 Kết quả mong đợi

Sau khi deploy thành công:

### 1. Function hoạt động bình thường
- Không có lỗi syntax
- Trả về dữ liệu đúng format
- Có đầy đủ 8 trường: `ten_don_vi`, `tong_luong_fulltime`, `tong_luong_parttime`, `tong_luong`, `doanh_thu`, `ty_le_luong_doanh_thu`, `ty_le_fulltime_doanh_thu`, `ty_le_ql_dt_duoc_phep`

### 2. Chart hiển thị 3 đường line
- **Tỷ lệ tổng lương/doanh thu** (đường liền, màu chart-1)
- **Tỷ lệ lương Fulltime/doanh thu** (đường liền, màu chart-2)  
- **QL/DT được phép** (đường nét đứt, màu chart-3) - **MỚI**

### 3. Tooltip hiển thị đầy đủ
- Format: `Địa điểm (Tổng: X%, FT: Y%, QL/DT: Z%)`
- Hiển thị đúng giá trị phần trăm

## 🔧 Troubleshooting

### Nếu vẫn gặp lỗi syntax
1. Kiểm tra file `deploy_function_fixed.sql` đã được sửa chưa
2. Đảm bảo sử dụng `ARRAY[1]` thay vì `[1]`
3. Kiểm tra dấu ngoặc và dấu phẩy

### Nếu function không trả về dữ liệu
1. Kiểm tra bảng `Fulltime`, `Parttime`, `Doanh_thu` có dữ liệu không
2. Kiểm tra bảng `Chi_tieu_2025` có dữ liệu không
3. Kiểm tra mapping giữa tên địa điểm

### Nếu QL/DT được phép = 0
1. Kiểm tra bảng `Chi_tieu_2025` có dữ liệu `KPI_quy_luong_2025` và `Chi_tieu_DT` không
2. Kiểm tra mapping giữa tên địa điểm trong bảng `Chi_tieu_2025`
3. Kiểm tra công thức tính toán

## 📋 Checklist deploy

- [ ] Đã sử dụng file `deploy_function_fixed.sql`
- [ ] Đã sử dụng cú pháp `ARRAY[1]` thay vì `[1]`
- [ ] Function đã được tạo thành công
- [ ] Test function trả về dữ liệu
- [ ] Chart hiển thị 3 đường line
- [ ] Tooltip hiển thị đầy đủ thông tin

## 🎉 Hoàn tất

Sau khi hoàn thành tất cả các bước trên, chart "Tỷ lệ lương/doanh thu theo địa điểm" sẽ hiển thị đầy đủ 3 đường line với dữ liệu QL/DT được phép giống như trong bảng "Phân Tích Lương Tổng Hợp".
