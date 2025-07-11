-- RPC Functions for KPI 2025 Comparison Tables
-- These functions combine salary data with Chi_tieu_2025 table data

-- Function: get_nganhdoc_salary_kpi_2025_hanoi
-- Returns salary data for Hanoi units with KPI targets from Chi_tieu_2025
DROP FUNCTION IF EXISTS get_nganhdoc_salary_kpi_2025_hanoi(INTEGER, INTEGER[]);
CREATE OR REPLACE FUNCTION get_nganhdoc_salary_kpi_2025_hanoi(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL
)
RETURNS TABLE(
    department_name TEXT,
    ft_salary_2025 NUMERIC,
    pt_salary_2025 NUMERIC,
    total_salary_2025 NUMERIC,
    quy_cung_2025 NUMERIC,
    so_thang_da_chia INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH salary_data AS (
        -- Get FT salary data for Hanoi
        SELECT 
            COALESCE(f.nganh_doc, 'Chưa phân loại') AS department_name,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS ft_salary_2025,
            0 AS pt_salary_2025
        FROM "Fulltime" f
        WHERE (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                regexp_replace(f.thang, '\D', '', 'g')::INTEGER = ANY(p_filter_months)
            )
            AND f.hn_or_note = 'Hà Nội'
        GROUP BY COALESCE(f.nganh_doc, 'Chưa phân loại')
        
        UNION ALL
        
        -- Get PT salary data (all units, will be filtered by KPI table)
        SELECT 
            COALESCE(pt."Don_vi_2", 'Chưa phân loại') AS department_name,
            0 AS ft_salary_2025,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS pt_salary_2025
        FROM "Parttime" pt
        WHERE (p_filter_year IS NULL OR pt."Nam"::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                regexp_replace(pt."Thoi gian", '\D', '', 'g')::INTEGER = ANY(p_filter_months)
            )
        GROUP BY COALESCE(pt."Don_vi_2", 'Chưa phân loại')
    ),
    aggregated_salary AS (
        SELECT 
            department_name,
            SUM(ft_salary_2025) AS ft_salary_2025,
            SUM(pt_salary_2025) AS pt_salary_2025,
            SUM(ft_salary_2025 + pt_salary_2025) AS total_salary_2025
        FROM salary_data
        GROUP BY department_name
    )
    SELECT 
        s.department_name,
        s.ft_salary_2025,
        s.pt_salary_2025,
        s.total_salary_2025,
        COALESCE(k."Quỹ cứng 2025", 0) AS quy_cung_2025,
        COALESCE(k."Số tháng đã chia", 5) AS so_thang_da_chia
    FROM aggregated_salary s
    LEFT JOIN "Chi_tieu_2025" k ON TRIM(s.department_name) = TRIM(k."Department_name")
    WHERE k."Loại" = 'Hà Nội' OR k."Loại" IS NULL
    ORDER BY s.department_name;
END;
$$;

-- Function: get_nganhdoc_salary_kpi_2025_province
-- Returns salary data for province units with KPI targets from Chi_tieu_2025
DROP FUNCTION IF EXISTS get_nganhdoc_salary_kpi_2025_province(INTEGER, INTEGER[]);
CREATE OR REPLACE FUNCTION get_nganhdoc_salary_kpi_2025_province(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL
)
RETURNS TABLE(
    department_name TEXT,
    ft_salary_2025 NUMERIC,
    pt_salary_2025 NUMERIC,
    total_salary_2025 NUMERIC,
    quy_cung_2025 NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH salary_data AS (
        SELECT 
            f.dia_diem AS raw_department,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS ft_salary_2025,
            0 AS pt_salary_2025
        FROM "Fulltime" f
        WHERE (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                (
                    regexp_replace(f.thang, '\\D', '', 'g') ~ '^\\d+$'
                    AND regexp_replace(f.thang, '\\D', '', 'g')::INTEGER = ANY(p_filter_months)
                )
            )
        GROUP BY f.dia_diem

        UNION ALL

        SELECT 
            pt."Don vi" AS raw_department,
            0 AS ft_salary_2025,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS pt_salary_2025
        FROM "Parttime" pt
        WHERE (p_filter_year IS NULL OR pt."Nam"::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                (
                    regexp_replace(pt."Thoi gian", '\\D', '', 'g') ~ '^\\d+$'
                    AND regexp_replace(pt."Thoi gian", '\\D', '', 'g')::INTEGER = ANY(p_filter_months)
                )
            )
        GROUP BY pt."Don vi"
    ),
    aggregated_salary AS (
        SELECT 
            TRIM(LOWER(sd.raw_department)) AS department_key,
            SUM(sd.ft_salary_2025) AS ft_salary_2025,
            SUM(sd.pt_salary_2025) AS pt_salary_2025,
            SUM(sd.ft_salary_2025 + sd.pt_salary_2025) AS total_salary_2025
        FROM salary_data sd
        GROUP BY TRIM(LOWER(sd.raw_department))
    )
    SELECT 
        -- Lấy tên đơn vị cuối cùng sau dấu '>'
        TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) AS department_name,
        COALESCE(a.ft_salary_2025, 0) AS ft_salary_2025,
        COALESCE(a.pt_salary_2025, 0) AS pt_salary_2025,
        COALESCE(a.total_salary_2025, 0) AS total_salary_2025,
        COALESCE(k."KPI_quy_luong_2025", 0) AS quy_cung_2025
    FROM "Chi_tieu_2025" k
    LEFT JOIN aggregated_salary a
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = a.department_key
    WHERE k."Loại" = 'Các tỉnh'
    ORDER BY department_name;
END;
$$; 