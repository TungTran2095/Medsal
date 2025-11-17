-- Test function get_salary_revenue_ratio_by_location
-- Chạy script này để kiểm tra function có hoạt động đúng không

-- Test 1: Gọi function với các tham số cơ bản
SELECT 
    ten_don_vi,
    tong_luong_fulltime,
    tong_luong_parttime,
    tong_luong,
    doanh_thu,
    ty_le_luong_doanh_thu,
    ty_le_fulltime_doanh_thu,
    ty_le_ql_dt_duoc_phep
FROM get_salary_revenue_ratio_by_location(
    2025,  -- p_filter_year
    NULL,  -- p_filter_months (tất cả các tháng)
    NULL,  -- p_filter_locations (tất cả địa điểm)
    NULL,  -- p_filter_nganh_docs (tất cả ngành dọc)
    NULL   -- p_filter_donvi2 (tất cả đơn vị 2)
)
LIMIT 10;

-- Test 2: Kiểm tra xem có địa điểm bị loại bỏ không
SELECT 
    ten_don_vi,
    COUNT(*) as count
FROM get_salary_revenue_ratio_by_location(
    2025,
    NULL,
    NULL,
    NULL,
    NULL
)
GROUP BY ten_don_vi
HAVING ten_don_vi IN ('Medim', 'Medlatec Group', 'Med Mê Linh', 'Medcom', 'Medon');

-- Test 3: Kiểm tra xem các địa điểm được gộp đúng chưa
SELECT 
    ten_don_vi,
    COUNT(*) as count
FROM get_salary_revenue_ratio_by_location(
    2025,
    NULL,
    NULL,
    NULL,
    NULL
)
GROUP BY ten_don_vi
HAVING ten_don_vi IN ('Med Huda', 'Med Đông Nam Bộ');


