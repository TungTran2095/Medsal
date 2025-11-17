# Hướng dẫn Deploy Function (ĐÃ SỬA TẤT CẢ LỖI)

## ✅ Các lỗi đã được sửa

### 1. **Lỗi cú pháp Array**
- **Lỗi:** `syntax error at or near "["`
- **Nguyên nhân:** PostgreSQL không hỗ trợ `[1]`
- **Giải pháp:** Sử dụng `ARRAY[1]`

### 2. **Lỗi tên cột**
- **Lỗi:** `column dr.Tên đơn vị does not exist`
- **Nguyên nhân:** Tên cột không đúng case
- **Giải pháp:** Sử dụng `"Tên Đơn vị"` (chữ Đ viết hoa)

### 3. **Cách lấy dữ liệu QL/DT được phép**
- **Trước:** Tính toán `KPI_quy_luong_2025 / Chi_tieu_DT`
- **Bây giờ:** Lấy trực tiếp từ `"Tỷ lệ quỹ lương/DT 2025"`

## 🚀 Cách deploy (KHUYẾN NGHỊ)

### Sử dụng file `deploy_function_final.sql`

1. **Mở Supabase SQL Editor**
2. **Copy toàn bộ nội dung file `deploy_function_final.sql`**
3. **Paste vào SQL Editor**
4. **Click "Run"**

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
```

### 3. Kiểm tra cấu trúc bảng (nếu cần)
```sql
-- Chạy file check_doanh_thu_structure.sql để kiểm tra
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'Doanh_thu' 
ORDER BY ordinal_position;
```

## 🎯 Kết quả mong đợi

### 1. Function hoạt động bình thường
- Không có lỗi syntax
- Trả về dữ liệu đúng format
- Có đầy đủ 8 trường

### 2. Chart hiển thị 3 đường line
- **Tỷ lệ tổng lương/doanh thu** (đường liền, màu chart-1)
- **Tỷ lệ lương Fulltime/doanh thu** (đường liền, màu chart-2)  
- **QL/DT được phép** (đường nét đứt, màu chart-3) - **MỚI**

### 3. Dữ liệu QL/DT được phép
- Lấy từ cột `"Tỷ lệ quỹ lương/DT 2025"` trong bảng `Chi_tieu_2025`
- Mapping theo cột `"Địa điểm_ngành dọc"`
- Giá trị chính xác, không cần tính toán

## 🔧 Troubleshooting

### Nếu vẫn gặp lỗi tên cột
1. Chạy `check_doanh_thu_structure.sql` để kiểm tra cấu trúc bảng
2. Xác định tên cột chính xác
3. Cập nhật SQL function với tên cột đúng

### Nếu QL/DT được phép = 0
1. Kiểm tra bảng `Chi_tieu_2025` có dữ liệu không
2. Kiểm tra cột `"Tỷ lệ quỹ lương/DT 2025"` có giá trị không
3. Kiểm tra mapping giữa tên địa điểm

### Nếu không có dữ liệu doanh thu
1. Kiểm tra bảng `Doanh_thu` có dữ liệu không
2. Kiểm tra tên cột `"Tên Đơn vị"` có đúng không
3. Kiểm tra filter năm/tháng có phù hợp không

## 📋 Checklist deploy

- [ ] Đã sử dụng file `deploy_function_final.sql`
- [ ] Đã sử dụng cú pháp `ARRAY[1]` thay vì `[1]`
- [ ] Đã sử dụng tên cột `"Tên Đơn vị"` (chữ Đ viết hoa)
- [ ] Function đã được tạo thành công
- [ ] Test function trả về dữ liệu
- [ ] Chart hiển thị 3 đường line
- [ ] QL/DT được phép lấy từ cột `"Tỷ lệ quỹ lương/DT 2025"`

## 🎉 Hoàn tất

Sau khi hoàn thành tất cả các bước trên:
- Function `get_salary_revenue_ratio_by_location` hoạt động bình thường
- Chart "Tỷ lệ lương/doanh thu theo địa điểm" hiển thị 3 đường line
- Dữ liệu QL/DT được phép lấy trực tiếp từ bảng `Chi_tieu_2025`
- Tất cả lỗi syntax và tên cột đã được sửa

## 📞 Hỗ trợ

Nếu vẫn gặp vấn đề:
1. Kiểm tra log lỗi chi tiết
2. Chạy script kiểm tra cấu trúc bảng
3. Xác định tên cột chính xác trong database
4. Cập nhật SQL function với thông tin đúng
