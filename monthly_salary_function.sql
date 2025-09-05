-- Function: get_monthly_salary_data_2025_province
-- Returns monthly salary data for province units for a specific month
DROP FUNCTION IF EXISTS get_monthly_salary_data_2025_province(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_monthly_salary_data_2025_province(
    p_filter_year INTEGER,
    p_filter_month INTEGER
)
RETURNS TABLE(
    department_name TEXT,
    ft_salary_month NUMERIC,
    pt_salary_month NUMERIC,
    total_salary_month NUMERIC,
    total_revenue_month NUMERIC,
    salary_revenue_ratio NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH org_units AS (
        -- Get business units from MS_Org_Diadiem where Division = Company
        SELECT DISTINCT
            "Bussiness Unit" AS business_unit,
            "Department" AS department
        FROM "MS_Org_Diadiem"
        WHERE "Division" = 'Company'
            AND "Bussiness Unit" IS NOT NULL
            AND "Bussiness Unit" != ''
            AND "Department" IS NOT NULL
            AND "Department" != ''
    ),
    salary_data AS (
        -- FT salary data for specific month
        SELECT 
            f.dia_diem AS raw_department,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS ft_salary,
            0 AS pt_salary
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
            AND regexp_replace(f.thang, '\\D', '', 'g') ~ '^\\d+$'
            AND regexp_replace(f.thang, '\\D', '', 'g')::INTEGER = p_filter_month
        GROUP BY f.dia_diem

        UNION ALL

        -- PT salary data for specific month
        SELECT 
            pt."Don vi" AS raw_department,
            0 AS ft_salary,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS pt_salary
        FROM "Parttime" pt
        WHERE pt."Nam"::INTEGER = p_filter_year
            AND regexp_replace(pt."Thoi gian", '\\D', '', 'g') ~ '^\\d+$'
            AND regexp_replace(pt."Thoi gian", '\\D', '', 'g')::INTEGER = p_filter_month
        GROUP BY pt."Don vi"
    ),
    aggregated_salary AS (
        SELECT 
            raw_department,
            SUM(ft_salary) AS ft_salary_month,
            SUM(pt_salary) AS pt_salary_month,
            SUM(ft_salary + pt_salary) AS total_salary_month
        FROM salary_data
        GROUP BY raw_department
    ),
    revenue_data AS (
        -- Monthly revenue data
        SELECT 
            dt."Tên Đơn vị" AS department_name,
            SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)) AS total_revenue_month
        FROM "Doanh_thu" dt
        WHERE dt."Tháng pro" = CONCAT('Tháng ', LPAD(p_filter_month::text, 2, '0'), '-', p_filter_year)
        GROUP BY dt."Tên Đơn vị"
    )
    SELECT 
        COALESCE(o.business_unit, TRIM(a.raw_department)) AS department_name,
        COALESCE(a.ft_salary_month, 0) AS ft_salary_month,
        COALESCE(a.pt_salary_month, 0) AS pt_salary_month,
        COALESCE(a.total_salary_month, 0) AS total_salary_month,
        COALESCE(r.total_revenue_month, 0) AS total_revenue_month,
        CASE 
            WHEN COALESCE(r.total_revenue_month, 0) > 0 
            THEN COALESCE(a.total_salary_month, 0) / COALESCE(r.total_revenue_month, 0)
            ELSE 0
        END AS salary_revenue_ratio
    FROM aggregated_salary a
    LEFT JOIN org_units o ON TRIM(a.raw_department) = TRIM(o.department)
    LEFT JOIN revenue_data r ON COALESCE(o.business_unit, TRIM(a.raw_department)) = TRIM(r.department_name)
    WHERE COALESCE(o.business_unit, TRIM(a.raw_department)) NOT IN ('Medcom', 'Medon')
    ORDER BY department_name;
END;
$$;
