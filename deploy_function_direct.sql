-- Script để deploy function get_salary_revenue_ratio_by_location
-- Chạy trực tiếp trong Supabase SQL Editor

-- Bước 1: Drop function cũ nếu tồn tại
DROP FUNCTION IF EXISTS get_salary_revenue_ratio_by_location(INTEGER, INTEGER[], TEXT[], TEXT[], TEXT[]);

-- Bước 2: Tạo function mới
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
    ft_salaries_by_loc AS (
        SELECT
            COALESCE(f.dia_diem, 'Không xác định') AS loc_name,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS total_ft_salary
        FROM "Fulltime" f
        WHERE (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
          AND (
              p_filter_months IS NULL OR
              array_length(p_filter_months, 1) IS NULL OR
              array_length(p_filter_months, 1) = 0 OR
              regexp_replace(f.thang, '\D', '', 'g')::INTEGER = ANY(p_filter_months)
          )
          AND ( 
              p_filter_locations IS NULL OR
              array_length(p_filter_locations, 1) IS NULL OR
              array_length(p_filter_locations, 1) = 0 OR
              f.dia_diem = ANY(p_filter_locations)
          )
          AND (
              p_filter_nganh_docs IS NULL OR
              array_length(p_filter_nganh_docs, 1) IS NULL OR
              array_length(p_filter_nganh_docs, 1) = 0 OR
              f.nganh_doc = ANY(p_filter_nganh_docs)
          )
        GROUP BY COALESCE(f.dia_diem, 'Không xác định')
    ),
    pt_salaries_by_loc AS (
        SELECT
            COALESCE(pt."Don vi", 'Không xác định') AS loc_name,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS total_pt_salary
        FROM "Parttime" pt
        WHERE (p_filter_year IS NULL OR pt."Nam"::INTEGER = p_filter_year)
          AND (
              p_filter_months IS NULL OR
              array_length(p_filter_months, 1) IS NULL OR
              array_length(p_filter_months, 1) = 0 OR
              regexp_replace(pt."Thoi gian", '\D', '', 'g')::INTEGER = ANY(p_filter_months)
          )
          AND ( 
              p_filter_locations IS NULL OR
              array_length(p_filter_locations, 1) IS NULL OR
              array_length(p_filter_locations, 1) = 0 OR
              pt."Don vi" = ANY(p_filter_locations)
          )
          AND (
              p_filter_donvi2 IS NULL OR
              array_length(p_filter_donvi2, 1) IS NULL OR
              array_length(p_filter_donvi2, 1) = 0 OR
              pt."Don vi  2" = ANY(p_filter_donvi2)
          )
        GROUP BY COALESCE(pt."Don vi", 'Không xác định')
    ),
    revenue_by_loc AS (
        SELECT
            COALESCE(dr."Tên Đơn vị", 'Không xác định') AS loc_name,
            SUM(CAST(REPLACE(dr."Kỳ báo cáo"::text, ',', '') AS NUMERIC)) AS total_revenue
        FROM "Doanh_thu" dr
        WHERE (p_filter_year IS NULL OR dr."Năm"::INTEGER = p_filter_year)
          AND (
              p_filter_months IS NULL OR
              array_length(p_filter_months, 1) IS NULL OR
              array_length(p_filter_months, 1) = 0 OR
              regexp_replace(dr."Tháng", '\D', '', 'g')::INTEGER = ANY(p_filter_months)
          )
          AND dr."Tên Đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group')
          AND ( 
              p_filter_locations IS NULL OR
              array_length(p_filter_locations, 1) IS NULL OR
              array_length(p_filter_locations, 1) = 0 OR
             EXISTS (SELECT 1 FROM unnest(p_filter_locations) AS flocs WHERE LOWER(dr."Tên Đơn vị") = LOWER(flocs))
          )
        GROUP BY COALESCE(dr."Tên Đơn vị", 'Không xác định')
    ),
    all_locations AS (
        SELECT loc_name FROM ft_salaries_by_loc
        UNION
        SELECT loc_name FROM pt_salaries_by_loc
        UNION
        SELECT loc_name FROM revenue_by_loc
    ),
    salary_revenue_data AS (
        SELECT
            al.loc_name AS ten_don_vi,
            COALESCE(fts.total_ft_salary, 0) AS tong_luong_fulltime,
            COALESCE(pts.total_pt_salary, 0) AS tong_luong_parttime,
            COALESCE(fts.total_ft_salary, 0) + COALESCE(pts.total_pt_salary, 0) AS tong_luong,
            COALESCE(rev.total_revenue, 0) AS doanh_thu,
            CASE
                WHEN COALESCE(rev.total_revenue, 0) = 0 THEN 0.0
                ELSE (COALESCE(fts.total_ft_salary, 0) + COALESCE(pts.total_pt_salary, 0)) / rev.total_revenue
            END AS ty_le_luong_doanh_thu,
            CASE
                WHEN COALESCE(rev.total_revenue, 0) = 0 THEN 0.0
                ELSE COALESCE(fts.total_ft_salary, 0) / rev.total_revenue
            END AS ty_le_fulltime_doanh_thu
        FROM all_locations al
        LEFT JOIN ft_salaries_by_loc fts ON al.loc_name = fts.loc_name
        LEFT JOIN pt_salaries_by_loc pts ON al.loc_name = pts.loc_name
        LEFT JOIN revenue_by_loc rev ON al.loc_name = rev.loc_name
    )
    SELECT
        srd.ten_don_vi,
        srd.tong_luong_fulltime,
        srd.tong_luong_parttime,
        srd.tong_luong,
        srd.doanh_thu,
        srd.ty_le_luong_doanh_thu,
        srd.ty_le_fulltime_doanh_thu,
        -- QL/DT được phép từ cột "Tỷ lệ quỹ lương/DT 2025" trong bảng Chi_tieu_2025
        COALESCE(k."Tỷ lệ quỹ lương/DT 2025", 0) AS ty_le_ql_dt_duoc_phep
    FROM salary_revenue_data srd
    LEFT JOIN "Chi_tieu_2025" k ON TRIM(LOWER(srd.ten_don_vi)) = TRIM(LOWER(
        (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
    ))
    WHERE srd.tong_luong > 0 OR srd.doanh_thu > 0
    ORDER BY srd.ty_le_luong_doanh_thu DESC;
END;
$$;

-- Bước 3: Test function
SELECT 'Function đã được tạo thành công!' as status;

-- Bước 4: Test với dữ liệu mẫu
SELECT 
    ten_don_vi,
    ROUND(ty_le_luong_doanh_thu * 100, 2) as ty_le_luong_doanh_thu_percent,
    ROUND(ty_le_fulltime_doanh_thu * 100, 2) as ty_le_fulltime_doanh_thu_percent,
    ROUND(ty_le_ql_dt_duoc_phep * 100, 2) as ty_le_ql_dt_duoc_phep_percent
FROM get_salary_revenue_ratio_by_location(2024, ARRAY[1], null, null, null)
LIMIT 5;
