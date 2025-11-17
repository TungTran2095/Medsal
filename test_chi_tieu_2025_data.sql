-- Test dữ liệu trong bảng Chi_tieu_2025
-- Kiểm tra cột "Tỷ lệ quỹ lương/DT 2025" và "Địa điểm_ngành dọc"

-- 1. Kiểm tra cấu trúc bảng
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Chi_tieu_2025' 
ORDER BY ordinal_position;

-- 2. Kiểm tra dữ liệu mẫu
SELECT 
    "Địa điểm_ngành dọc",
    "Tỷ lệ quỹ lương/DT 2025",
    "KPI_quy_luong_2025",
    "Chi_tieu_DT"
FROM "Chi_tieu_2025"
LIMIT 10;

-- 3. Kiểm tra mapping với tên địa điểm
SELECT 
    "Địa điểm_ngành dọc",
    TRIM(LOWER(
        (string_to_array("Địa điểm_ngành dọc", '>'))[array_length(string_to_array("Địa điểm_ngành dọc", '>'), 1)]
    )) as extracted_location,
    "Tỷ lệ quỹ lương/DT 2025"
FROM "Chi_tieu_2025"
WHERE "Tỷ lệ quỹ lương/DT 2025" IS NOT NULL
LIMIT 10;

-- 4. Kiểm tra các giá trị NULL
SELECT 
    COUNT(*) as total_records,
    COUNT("Tỷ lệ quỹ lương/DT 2025") as non_null_ratio,
    COUNT(*) - COUNT("Tỷ lệ quỹ lương/DT 2025") as null_ratio
FROM "Chi_tieu_2025";

-- 5. Kiểm tra các địa điểm có dữ liệu tỷ lệ
SELECT 
    TRIM(LOWER(
        (string_to_array("Địa điểm_ngành dọc", '>'))[array_length(string_to_array("Địa điểm_ngành dọc", '>'), 1)]
    )) as location_name,
    "Tỷ lệ quỹ lương/DT 2025"
FROM "Chi_tieu_2025"
WHERE "Tỷ lệ quỹ lương/DT 2025" IS NOT NULL
ORDER BY "Tỷ lệ quỹ lương/DT 2025" DESC;
