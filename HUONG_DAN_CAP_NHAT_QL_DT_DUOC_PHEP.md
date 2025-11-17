# Hướng dẫn cập nhật cách lấy dữ liệu QL/DT được phép

## 🔄 Thay đổi đã thực hiện

**Trước đây:** Tính toán QL/DT được phép = `KPI_quy_luong_2025 / Chi_tieu_DT`

**Bây giờ:** Lấy trực tiếp từ cột `"Tỷ lệ quỹ lương/DT 2025"` trong bảng `Chi_tieu_2025`

## 📊 Công thức mới

```sql
-- ❌ Cũ (tính toán):
CASE
    WHEN COALESCE(k."Chi_tieu_DT", 0) > 0 THEN COALESCE(k."KPI_quy_luong_2025", 0) / k."Chi_tieu_DT"
    ELSE 0
END AS ty_le_ql_dt_duoc_phep

-- ✅ Mới (lấy trực tiếp):
COALESCE(k."Tỷ lệ quỹ lương/DT 2025", 0) AS ty_le_ql_dt_duoc_phep
```

## 🚀 Cách deploy

### Bước 1: Kiểm tra dữ liệu trong bảng Chi_tieu_2025
```sql
-- Chạy file test_chi_tieu_2025_data.sql để kiểm tra
SELECT 
    "Địa điểm_ngành dọc",
    "Tỷ lệ quỹ lương/DT 2025"
FROM "Chi_tieu_2025"
WHERE "Tỷ lệ quỹ lương/DT 2025" IS NOT NULL
LIMIT 10;
```

### Bước 2: Deploy function mới
Sử dụng file `deploy_function_fixed.sql` (đã được cập nhật) hoặc chạy trực tiếp:

```sql
-- Drop function cũ
DROP FUNCTION IF EXISTS get_salary_revenue_ratio_by_location(INTEGER, INTEGER[], TEXT[], TEXT[], TEXT[]);

-- Tạo function mới với công thức đã cập nhật
CREATE OR REPLACE FUNCTION get_salary_revenue_ratio_by_location(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL,
    p_filter_nganh_docs TEXT[] DEFAULT NULL,
    p_filter_donvi2 TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    ten_don_vi TEXT,
    tong_luong_fulltime NUMERIC,
    tong_luong_parttime NUMERIC,
    tong_luong NUMERIC,
    doanh_thu NUMERIC,
    ty_le_luong_doanh_thu NUMERIC,
    ty_le_fulltime_doanh_thu NUMERIC,
    ty_le_ql_dt_duoc_phep NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH
    -- ... (giữ nguyên logic cũ)
    SELECT
        srd.ten_don_vi,
        srd.tong_luong_fulltime,
        srd.tong_luong_parttime,
        srd.tong_luong,
        srd.doanh_thu,
        srd.ty_le_luong_doanh_thu,
        srd.ty_le_fulltime_doanh_thu,
        -- ✅ CÔNG THỨC MỚI: Lấy trực tiếp từ cột "Tỷ lệ quỹ lương/DT 2025"
        COALESCE(k."Tỷ lệ quỹ lương/DT 2025", 0) AS ty_le_ql_dt_duoc_phep
    FROM salary_revenue_data srd
    LEFT JOIN "Chi_tieu_2025" k ON TRIM(LOWER(srd.ten_don_vi)) = TRIM(LOWER(
        (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
    ))
    WHERE srd.tong_luong > 0 OR srd.doanh_thu > 0
    ORDER BY srd.ty_le_luong_doanh_thu DESC;
END;
$$;
```

### Bước 3: Test function
```sql
-- Test với dữ liệu mẫu
SELECT 
    ten_don_vi,
    ROUND(ty_le_luong_doanh_thu * 100, 2) as ty_le_luong_doanh_thu_percent,
    ROUND(ty_le_fulltime_doanh_thu * 100, 2) as ty_le_fulltime_doanh_thu_percent,
    ROUND(ty_le_ql_dt_duoc_phep * 100, 2) as ty_le_ql_dt_duoc_phep_percent
FROM get_salary_revenue_ratio_by_location(2024, ARRAY[1], null, null, null)
LIMIT 5;
```

## 🎯 Lợi ích của thay đổi

### 1. Đơn giản hóa
- Không cần tính toán phức tạp
- Lấy trực tiếp giá trị đã có sẵn
- Giảm thiểu lỗi tính toán

### 2. Chính xác hơn
- Sử dụng giá trị chính thức từ bảng `Chi_tieu_2025`
- Đảm bảo tính nhất quán với dữ liệu gốc
- Tránh sai số do làm tròn

### 3. Dễ bảo trì
- Logic đơn giản, dễ hiểu
- Ít phụ thuộc vào nhiều cột
- Dễ debug khi có vấn đề

## 🔍 Kiểm tra kết quả

### 1. So sánh với bảng Chi_tieu_2025
```sql
-- Kiểm tra dữ liệu trong bảng Chi_tieu_2025
SELECT 
    "Địa điểm_ngành dọc",
    "Tỷ lệ quỹ lương/DT 2025"
FROM "Chi_tieu_2025"
WHERE "Tỷ lệ quỹ lương/DT 2025" IS NOT NULL;

-- So sánh với kết quả function
SELECT 
    ten_don_vi,
    ty_le_ql_dt_duoc_phep
FROM get_salary_revenue_ratio_by_location(2024, null, null, null, null)
WHERE ty_le_ql_dt_duoc_phep > 0;
```

### 2. Kiểm tra chart
- Mở chart "Tỷ lệ lương/doanh thu theo địa điểm"
- Xác nhận đường line QL/DT được phép hiển thị đúng
- So sánh với giá trị trong bảng "Phân Tích Lương Tổng Hợp"

## ⚠️ Lưu ý quan trọng

### 1. Dữ liệu NULL
- Nếu cột `"Tỷ lệ quỹ lương/DT 2025"` là NULL, sẽ trả về 0
- Cần kiểm tra dữ liệu trong bảng `Chi_tieu_2025`

### 2. Mapping địa điểm
- Đảm bảo tên địa điểm trong function khớp với `"Địa điểm_ngành dọc"`
- Kiểm tra logic tách chuỗi `string_to_array`

### 3. Đơn vị dữ liệu
- Đảm bảo cột `"Tỷ lệ quỹ lương/DT 2025"` đã ở dạng phần trăm (0-1) hoặc cần chia 100
- Kiểm tra format dữ liệu trong bảng

## 🎉 Kết quả mong đợi

Sau khi cập nhật:
- Function lấy dữ liệu QL/DT được phép trực tiếp từ cột `"Tỷ lệ quỹ lương/DT 2025"`
- Chart hiển thị đường line QL/DT được phép chính xác
- Dữ liệu khớp với bảng "Phân Tích Lương Tổng Hợp"
- Logic đơn giản và dễ bảo trì hơn
