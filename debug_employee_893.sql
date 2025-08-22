-- Debug đặc biệt cho nhân viên 893
-- Chạy các query này trên Supabase SQL Editor để kiểm tra

-- 1. Kiểm tra nhân viên 893 trong bảng co_che_luong
SELECT 
    'co_che_luong' as source_table,
    ID,
    id,
    Id,
    Ho_va_ten,
    Don_vi,
    Loai_co_che,
    pg_typeof(ID) as id_type,
    pg_typeof(id) as id_lower_type,
    pg_typeof(Id) as id_camel_type
FROM co_che_luong 
WHERE Loai_co_che = 'GĐ tỉnh'
AND (ID = 893 OR id = 893 OR Id = 893 OR ID = '893' OR id = '893' OR Id = '893');

-- 2. Kiểm tra nhân viên 893 trong bảng Fulltime
SELECT 
    'Fulltime' as source_table,
    ma_nhan_vien,
    ho_va_ten,
    tong_thu_nhap,
    thang,
    nam,
    dia_diem,
    pg_typeof(ma_nhan_vien) as ma_nhan_vien_type
FROM "Fulltime"
WHERE ma_nhan_vien = 893 
AND thang = 'Tháng 01' 
AND nam = 2025;

-- 3. So sánh trực tiếp ID giữa hai bảng
WITH co_che_893 AS (
    SELECT 
        COALESCE(ID, id, Id) as employee_id,
        Ho_va_ten,
        Don_vi
    FROM co_che_luong 
    WHERE Loai_co_che = 'GĐ tỉnh'
    AND (ID = 893 OR id = 893 OR Id = 893 OR ID = '893' OR id = '893' OR Id = '893')
),
fulltime_893 AS (
    SELECT 
        ma_nhan_vien,
        ho_va_ten,
        tong_thu_nhap,
        dia_diem
    FROM "Fulltime"
    WHERE ma_nhan_vien = 893 
    AND thang = 'Tháng 01' 
    AND nam = 2025
)
SELECT 
    c.employee_id as co_che_id,
    c.Ho_va_ten as co_che_ten,
    c.Don_vi as co_che_don_vi,
    f.ma_nhan_vien as fulltime_id,
    f.ho_va_ten as fulltime_ten,
    f.tong_thu_nhap as fulltime_tong_thu_nhap,
    f.dia_diem as fulltime_dia_diem,
    CASE 
        WHEN f.ma_nhan_vien IS NOT NULL THEN '✅ Có trong cả 2 bảng'
        ELSE '❌ Chỉ có trong co_che_luong'
    END as status
FROM co_che_893 c
LEFT JOIN fulltime_893 f ON c.employee_id::text = f.ma_nhan_vien::text;

-- 4. Kiểm tra tất cả nhân viên GĐ tỉnh và so sánh với Fulltime
WITH co_che_all AS (
    SELECT 
        COALESCE(ID, id, Id) as employee_id,
        Ho_va_ten,
        Don_vi
    FROM co_che_luong 
    WHERE Loai_co_che = 'GĐ tỉnh'
),
fulltime_all AS (
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
FROM co_che_all c
LEFT JOIN fulltime_all f ON c.employee_id::text = f.ma_nhan_vien::text
ORDER BY c.employee_id;

-- 5. Kiểm tra xem có vấn đề gì với định dạng dữ liệu không
SELECT 
    'co_che_luong' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ID IS NOT NULL THEN 1 END) as id_not_null,
    COUNT(CASE WHEN id IS NOT NULL THEN 1 END) as id_lower_not_null,
    COUNT(CASE WHEN Id IS NOT NULL THEN 1 END) as id_camel_not_null,
    MIN(ID) as min_id,
    MAX(ID) as max_id,
    MIN(id) as min_id_lower,
    MAX(id) as max_id_lower,
    MIN(Id) as min_id_camel,
    MAX(Id) as max_id_camel
FROM co_che_luong 
WHERE Loai_co_che = 'GĐ tỉnh'

UNION ALL

SELECT 
    'Fulltime' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN ma_nhan_vien IS NOT NULL THEN 1 END) as ma_nhan_vien_not_null,
    NULL as id_lower_not_null,
    NULL as id_camel_not_null,
    MIN(ma_nhan_vien) as min_id,
    MAX(ma_nhan_vien) as max_id,
    NULL as min_id_lower,
    NULL as max_id_lower,
    NULL as min_id_camel,
    NULL as max_id_camel
FROM "Fulltime"
WHERE thang = 'Tháng 01' 
AND nam = 2025;
