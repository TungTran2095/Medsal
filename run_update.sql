-- Script to update the KPI function and test it
-- Run this in your Supabase SQL editor

-- First, drop and recreate the function
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
            AND f.hn_or_not = 'Hà Nội'
        GROUP BY COALESCE(f.nganh_doc, 'Chưa phân loại')
        
        UNION ALL
        
        -- Get PT salary data (all units, will be filtered by KPI table)
        SELECT 
            COALESCE(pt."Don vi  2", 'Chưa phân loại') AS department_name,
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
        GROUP BY COALESCE(pt."Don vi  2", 'Chưa phân loại')
    ),
    aggregated_salary AS (
        SELECT 
            salary_data.department_name,
            SUM(salary_data.ft_salary_2025) AS ft_salary_2025,
            SUM(salary_data.pt_salary_2025) AS pt_salary_2025,
            SUM(salary_data.ft_salary_2025 + salary_data.pt_salary_2025) AS total_salary_2025
        FROM salary_data
        GROUP BY salary_data.department_name
    )
    SELECT 
        s.department_name,
        s.ft_salary_2025,
        s.pt_salary_2025,
        s.total_salary_2025,
        COALESCE(k."KPI_quy_luong_2025", 0) AS quy_cung_2025,
        5 AS so_thang_da_chia
    FROM aggregated_salary s
    LEFT JOIN "Chi_tieu_2025" k ON TRIM(s.department_name) = TRIM(k."Địa điểm_ngành dọc")
    WHERE (k."Loại" = 'Hà Nội' OR k."Loại" IS NULL)
        AND s.department_name NOT IN ('Medon', 'Med Campuchia', 'Medcom')
    ORDER BY s.department_name;
END;
$$;

-- Test the function
SELECT * FROM get_nganhdoc_salary_kpi_2025_hanoi(2025, NULL) LIMIT 10;

-- Check if excluded units are still present
SELECT department_name 
FROM get_nganhdoc_salary_kpi_2025_hanoi(2025, NULL) 
WHERE department_name IN ('Medon', 'Med Campuchia', 'Medcom');
