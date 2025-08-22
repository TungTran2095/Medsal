-- Debug vấn đề "Check cơ chế lương GĐ Tỉnh" không tìm thấy dữ liệu Fulltime
-- Chạy các query này trên Supabase SQL Editor để kiểm tra

-- 1. Kiểm tra cấu trúc bảng co_che_luong
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'co_che_luong'
ORDER BY ordinal_position;

-- 2. Kiểm tra dữ liệu trong bảng co_che_luong cho GĐ tỉnh
SELECT 
    ID,
    id,
    Id,
    Ho_va_ten,
    Don_vi,
    Loai_co_che
FROM co_che_luong 
WHERE Loai_co_che = 'GĐ tỉnh'
LIMIT 10;

-- 3. Kiểm tra cấu trúc bảng Fulltime
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'Fulltime'
ORDER BY ordinal_position;

-- 4. Kiểm tra dữ liệu trong bảng Fulltime cho tháng 01 năm 2025
SELECT 
    ma_nhan_vien,
    ho_va_ten,
    tong_thu_nhap,
    thang,
    nam,
    dia_diem
FROM "Fulltime"
WHERE thang = 'Tháng 01' 
AND nam = 2025
LIMIT 10;

-- 5. Kiểm tra cụ thể nhân viên 893
SELECT 
    *
FROM "Fulltime"
WHERE ma_nhan_vien = 893 
AND thang = 'Tháng 01' 
AND nam = 2025;

-- 6. So sánh ID giữa hai bảng
WITH co_che_ids AS (
    SELECT DISTINCT
        COALESCE(ID, id, Id) as employee_id,
        Ho_va_ten,
        Don_vi
    FROM co_che_luong 
    WHERE Loai_co_che = 'GĐ tỉnh'
),
fulltime_ids AS (
    SELECT DISTINCT
        ma_nhan_vien,
        ho_va_ten,
        dia_diem
    FROM "Fulltime"
    WHERE thang = 'Tháng 01' 
    AND nam = 2025
)
SELECT 
    c.employee_id as co_che_id,
    c.Ho_va_ten as co_che_ten,
    c.Don_vi as co_che_don_vi,
    f.ma_nhan_vien as fulltime_id,
    f.ho_va_ten as fulltime_ten,
    f.dia_diem as fulltime_dia_diem,
    CASE 
        WHEN f.ma_nhan_vien IS NOT NULL THEN '✅ Có trong cả 2 bảng'
        ELSE '❌ Chỉ có trong co_che_luong'
    END as status
FROM co_che_ids c
LEFT JOIN fulltime_ids f ON c.employee_id::text = f.ma_nhan_vien::text
ORDER BY c.employee_id;

-- 7. Kiểm tra kiểu dữ liệu của ID
SELECT 
    'co_che_luong' as table_name,
    pg_typeof(ID) as id_type,
    pg_typeof(id) as id_lower_type,
    pg_typeof(Id) as id_camel_type
FROM co_che_luong 
WHERE Loai_co_che = 'GĐ tỉnh'
LIMIT 1

UNION ALL

SELECT 
    'Fulltime' as table_name,
    pg_typeof(ma_nhan_vien) as id_type,
    NULL as id_lower_type,
    NULL as id_camel_type
FROM "Fulltime"
LIMIT 1;

-- 8. Tìm nhân viên có tên "Nguyễn Văn Hiệu" trong cả hai bảng
SELECT 
    'co_che_luong' as source_table,
    COALESCE(ID, id, Id) as employee_id,
    Ho_va_ten,
    Don_vi
FROM co_che_luong 
WHERE Ho_va_ten ILIKE '%Nguyễn Văn Hiệu%'

UNION ALL

SELECT 
    'Fulltime' as source_table,
    ma_nhan_vien::text as employee_id,
    ho_va_ten,
    dia_diem as don_vi
FROM "Fulltime"
WHERE ho_va_ten ILIKE '%Nguyễn Văn Hiệu%';
