-- Kiểm tra cấu trúc bảng Doanh_thu để xác định tên cột chính xác

-- 1. Kiểm tra tất cả các cột trong bảng Doanh_thu
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'Doanh_thu' 
ORDER BY ordinal_position;

-- 2. Kiểm tra dữ liệu mẫu để xác định tên cột
SELECT *
FROM "Doanh_thu"
LIMIT 3;

-- 3. Kiểm tra các cột có chứa "Tên" hoặc "Đơn vị"
SELECT column_name
FROM information_schema.columns 
WHERE table_name = 'Doanh_thu' 
AND (column_name ILIKE '%tên%' OR column_name ILIKE '%đơn%' OR column_name ILIKE '%don%');

-- 4. Kiểm tra các cột có chứa "Kỳ báo cáo" hoặc "Năm" hoặc "Tháng"
SELECT column_name
FROM information_schema.columns 
WHERE table_name = 'Doanh_thu' 
AND (column_name ILIKE '%kỳ%' OR column_name ILIKE '%báo%' OR column_name ILIKE '%năm%' OR column_name ILIKE '%tháng%');
