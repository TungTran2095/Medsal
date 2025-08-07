# Hướng Dẫn Triển Khai Bảng So Sánh Chi Tiết Theo Ngành Dọc (Toàn Hệ Thống)

## Tổng quan

Bảng này hiển thị dữ liệu so sánh lương theo ngành dọc cho toàn hệ thống, khác với bảng so sánh theo ngành dọc hiện tại chỉ hiển thị dữ liệu cho Medlatec Group.

## Bước 1: Tạo SQL Functions

### 1.1. Đăng nhập vào Supabase Dashboard
1. Truy cập https://supabase.com
2. Đăng nhập vào project của bạn
3. Vào SQL Editor

### 1.2. Chạy SQL Functions
1. Copy toàn bộ nội dung từ file `system_wide_nganh_doc_functions.sql`
2. Paste vào SQL Editor
3. Chạy script

### 1.3. Kiểm tra Functions đã được tạo

```sql
-- Kiểm tra functions đã được tạo
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
    'get_nganhdoc_ft_salary_hanoi_with_filter',
    'get_donvi2_pt_salary_with_filter'
);
```

### 1.4. Test Functions

```sql
-- Test FT function
SELECT * FROM get_nganhdoc_ft_salary_hanoi_with_filter(2024, NULL, NULL);

-- Test PT function  
SELECT * FROM get_donvi2_pt_salary_with_filter(2024, NULL, NULL);
```

## Bước 2: Troubleshooting

### 2.1. Lỗi "column reference is ambiguous"

**Nguyên nhân**: Xung đột tên cột trong CTE (Common Table Expression)

**Giải pháp**: 
1. Đảm bảo đã chạy đúng SQL functions từ file `system_wide_nganh_doc_functions.sql`
2. Kiểm tra functions đã được tạo thành công
3. Nếu vẫn lỗi, hãy xóa và tạo lại functions:

```sql
-- Xóa functions cũ
DROP FUNCTION IF EXISTS get_nganhdoc_ft_salary_hanoi_with_filter(INTEGER, INTEGER[], TEXT[]);
DROP FUNCTION IF EXISTS get_donvi2_pt_salary_with_filter(INTEGER, INTEGER[], TEXT[]);

-- Chạy lại script từ file system_wide_nganh_doc_functions.sql
```

### 2.2. Lỗi 400 - Function does not exist

**Nguyên nhân**: Functions chưa được tạo hoặc tên function sai

**Giải pháp**:
1. Kiểm tra functions đã được tạo:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%with_filter%';
```

2. Nếu không có, chạy lại script SQL

### 2.3. Lỗi "column does not exist"

**Nguyên nhân**: 
- Tên cột không đúng với cấu trúc bảng thực tế
- Cột có khoảng trắng hoặc ký tự đặc biệt

**Giải pháp**:
1. Kiểm tra cấu trúc bảng:
```sql
-- Kiểm tra cấu trúc bảng Parttime
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'Parttime' AND table_schema = 'public';

-- Kiểm tra cấu trúc bảng Fulltime
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'Fulltime' AND table_schema = 'public';
```

2. Cập nhật SQL functions với tên cột đúng
3. Lưu ý: Cột `Don vi  2` có khoảng trắng, không phải `Don_vi_2`

### 2.4. Lỗi dữ liệu không hiển thị

**Nguyên nhân**: 
- Bảng `Fulltime` hoặc `Parttime` không có dữ liệu
- Cột `nganh_doc` hoặc `Don vi  2` không có dữ liệu
- Không có dữ liệu cho năm/tháng được chọn

**Giải pháp**:
1. Kiểm tra dữ liệu trong bảng:
```sql
-- Kiểm tra bảng Fulltime
SELECT DISTINCT nganh_doc, nam, thang FROM "Fulltime" LIMIT 10;

-- Kiểm tra bảng Parttime  
SELECT DISTINCT "Don vi  2", "Nam", "Thoi gian" FROM "Parttime" LIMIT 10;
```

2. Đảm bảo có dữ liệu phù hợp với điều kiện lọc
3. Lưu ý: Bảng mới hiển thị toàn hệ thống, không chỉ Hà Nội

## Bước 3: Cập nhật Component

Component `SystemWideNganhDocComparisonTable` đã được cập nhật để:
1. Sử dụng fallback mechanism (thử functions mới trước, nếu không có sẽ dùng functions cũ)
2. Hiển thị thông báo lỗi phù hợp
3. Hỗ trợ đầy đủ các bộ lọc

## Bước 4: Kiểm tra hoạt động

1. Vào tab "So sánh cùng kỳ"
2. Tìm bảng "Bảng So Sánh Chi Tiết Theo Ngành Dọc (Toàn Hệ Thống)"
3. Kiểm tra dữ liệu hiển thị
4. Test các bộ lọc khác nhau

## Lưu ý quan trọng

1. **Tương thích ngược**: Component sẽ tự động fallback về functions cũ nếu functions mới chưa được tạo
2. **Performance**: Functions mới có thể chậm hơn do có thêm điều kiện lọc
3. **Dữ liệu**: Đảm bảo bảng `Fulltime` và `Parttime` có đủ dữ liệu
4. **Backup**: Nên backup database trước khi triển khai

## Liên hệ hỗ trợ

Nếu gặp vấn đề, hãy:
1. Kiểm tra logs trong browser console
2. Kiểm tra SQL logs trong Supabase
3. Tham khảo file `docs/system-wide-nganh-doc-comparison.md` để biết thêm chi tiết
