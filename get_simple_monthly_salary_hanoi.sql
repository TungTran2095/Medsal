-- Function đơn giản để lấy dữ liệu lương theo tháng cho Hà Nội
-- Dựa trên logic của get_simple_monthly_salary_province nhưng chỉ lấy dữ liệu Hà Nội

DROP FUNCTION IF EXISTS get_simple_monthly_salary_hanoi(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_simple_monthly_salary_hanoi(
    p_filter_year INTEGER,
    p_filter_month INTEGER
)
RETURNS TABLE(
    department_name TEXT,
    ft_salary_month NUMERIC,
    pt_salary_month NUMERIC,
    total_salary_month NUMERIC,
    total_revenue_month NUMERIC,
    target_revenue_month NUMERIC,
    completion_ratio NUMERIC,
    salary_revenue_ratio NUMERIC,
    cumulative_salary_revenue_ratio NUMERIC,
    quy_cung_2025 NUMERIC,
    allowed_salary_revenue_ratio NUMERIC,
    allowed_salary_fund NUMERIC,
    excess_salary_fund NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    month_str TEXT;
    month_revenue_str TEXT;
BEGIN
    -- Convert month number to "Tháng XX" format for salary tables
    month_str := 'Tháng ' || LPAD(p_filter_month::TEXT, 2, '0');
    -- Convert month number to "Tháng XX-YYYY" format for revenue table
    month_revenue_str := 'Tháng ' || LPAD(p_filter_month::TEXT, 2, '0') || '-' || p_filter_year::TEXT;
    
    RETURN QUERY
    WITH salary_data AS (
        -- Get FT salary data for the specific month - filter for Hanoi using nganh_doc and hn_or_note
        SELECT 
            f.nganh_doc AS raw_department,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS ft_salary_month,
            0 AS pt_salary_month
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
            AND f.thang = month_str
            AND f.hn_or_note = 'Hà Nội'
            AND f.nganh_doc IS NOT NULL
            AND f.nganh_doc != ''
        GROUP BY f.nganh_doc

        UNION ALL

        -- Get PT salary data for the specific month - filter for Hanoi using Don vi 2 and HN_or_not
        SELECT 
            pt."Don vi  2" AS raw_department,
            0 AS ft_salary_month,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS pt_salary_month
        FROM "Parttime" pt
        WHERE pt."Nam"::INTEGER = p_filter_year
            AND pt."Thoi gian" = month_str
            AND pt."HN_or_not" = 'Hà Nội'
            AND pt."Don vi  2" IS NOT NULL
            AND pt."Don vi  2" != ''
        GROUP BY pt."Don vi  2"
    ),
    aggregated_salary AS (
        SELECT 
            TRIM(LOWER(sd.raw_department)) AS department_key,
            SUM(sd.ft_salary_month) AS ft_salary_month,
            SUM(sd.pt_salary_month) AS pt_salary_month,
            SUM(sd.ft_salary_month + sd.pt_salary_month) AS total_salary_month
        FROM salary_data sd
        GROUP BY TRIM(LOWER(sd.raw_department))
    ),
    revenue_data AS (
        SELECT 
            TRIM(LOWER(dt."Tên Đơn vị")) AS department_key,
            SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)) AS total_revenue_month,
            SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)) AS target_revenue_month
        FROM "Doanh_thu" dt
        WHERE dt."Tháng pro" = month_revenue_str
            AND dt."Năm" = p_filter_year
            AND (
                LOWER(dt."Tên Đơn vị") LIKE '%hà nội%' OR
                LOWER(dt."Tên Đơn vị") LIKE '%hanoi%' OR
                LOWER(dt."Tên Đơn vị") LIKE '%hn%' OR
                LOWER(dt."Tên Đơn vị") LIKE '%ha noi%'
            )
        GROUP BY TRIM(LOWER(dt."Tên Đơn vị"))
    ),
    cumulative_salary_data AS (
        -- Tính lũy kế lương cả năm 2025 cho Hà Nội - sử dụng nganh_doc và hn_or_note
        SELECT 
            f.nganh_doc AS raw_department,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS cumulative_ft_salary,
            0 AS cumulative_pt_salary
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
            AND f.hn_or_note = 'Hà Nội'
            AND f.nganh_doc IS NOT NULL
            AND f.nganh_doc != ''
        GROUP BY f.nganh_doc

        UNION ALL

        -- Tính lũy kế lương PT cả năm 2025 cho Hà Nội - sử dụng Don vi 2 và HN_or_not
        SELECT 
            pt."Don vi  2" AS raw_department,
            0 AS cumulative_ft_salary,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS cumulative_pt_salary
        FROM "Parttime" pt
        WHERE pt."Nam"::INTEGER = p_filter_year
            AND pt."HN_or_not" = 'Hà Nội'
            AND pt."Don vi  2" IS NOT NULL
            AND pt."Don vi  2" != ''
        GROUP BY pt."Don vi  2"
    ),
    aggregated_cumulative_salary AS (
        SELECT 
            TRIM(LOWER(csd.raw_department)) AS department_key,
            SUM(csd.cumulative_ft_salary) AS cumulative_ft_salary,
            SUM(csd.cumulative_pt_salary) AS cumulative_pt_salary,
            SUM(csd.cumulative_ft_salary + csd.cumulative_pt_salary) AS cumulative_total_salary
        FROM cumulative_salary_data csd
        GROUP BY TRIM(LOWER(csd.raw_department))
    ),
    cumulative_revenue_data AS (
        -- Tính lũy kế doanh thu cả năm 2025 cho Hà Nội
        SELECT 
            TRIM(LOWER(dt."Tên Đơn vị")) AS department_key,
            SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)) AS cumulative_revenue
        FROM "Doanh_thu" dt
        WHERE dt."Năm" = p_filter_year
            AND (
                LOWER(dt."Tên Đơn vị") LIKE '%hà nội%' OR
                LOWER(dt."Tên Đơn vị") LIKE '%hanoi%' OR
                LOWER(dt."Tên Đơn vị") LIKE '%hn%' OR
                LOWER(dt."Tên Đơn vị") LIKE '%ha noi%'
            )
        GROUP BY TRIM(LOWER(dt."Tên Đơn vị"))
    ),
    final_data AS (
        SELECT 
            COALESCE(asd.department_key, rd.department_key) AS department_key,
            COALESCE(asd.ft_salary_month, 0) AS ft_salary_month,
            COALESCE(asd.pt_salary_month, 0) AS pt_salary_month,
            COALESCE(asd.total_salary_month, 0) AS total_salary_month,
            COALESCE(rd.total_revenue_month, 0) AS total_revenue_month,
            COALESCE(rd.target_revenue_month, 0) AS target_revenue_month,
            CASE 
                WHEN COALESCE(rd.target_revenue_month, 0) > 0 
                THEN (COALESCE(rd.total_revenue_month, 0) / rd.target_revenue_month) * 100
                ELSE 0
            END AS completion_ratio,
            CASE 
                WHEN COALESCE(rd.total_revenue_month, 0) > 0 
                THEN (COALESCE(asd.total_salary_month, 0) / rd.total_revenue_month) * 100
                ELSE 0
            END AS salary_revenue_ratio,
            COALESCE(acsd.cumulative_total_salary, 0) AS cumulative_total_salary,
            COALESCE(crd.cumulative_revenue, 0) AS cumulative_revenue,
            CASE 
                WHEN COALESCE(crd.cumulative_revenue, 0) > 0 
                THEN (COALESCE(acsd.cumulative_total_salary, 0) / crd.cumulative_revenue) * 100
                ELSE 0
            END AS cumulative_salary_revenue_ratio
        FROM aggregated_salary asd
        FULL OUTER JOIN revenue_data rd ON asd.department_key = rd.department_key
        LEFT JOIN aggregated_cumulative_salary acsd ON COALESCE(asd.department_key, rd.department_key) = acsd.department_key
        LEFT JOIN cumulative_revenue_data crd ON COALESCE(asd.department_key, rd.department_key) = crd.department_key
    )
    SELECT 
        fd.department_key AS department_name,
        fd.ft_salary_month,
        fd.pt_salary_month,
        fd.total_salary_month,
        fd.total_revenue_month,
        fd.target_revenue_month,
        fd.completion_ratio,
        fd.salary_revenue_ratio,
        fd.cumulative_salary_revenue_ratio,
        -- Quỹ cứng 2025 (có thể cần điều chỉnh logic này)
        CASE 
            WHEN fd.cumulative_salary_revenue_ratio <= 15 THEN fd.cumulative_total_salary
            ELSE fd.cumulative_total_salary * 0.15 / (fd.cumulative_salary_revenue_ratio / 100)
        END AS quy_cung_2025,
        -- Tỷ lệ lương/doanh thu cho phép (15%)
        15.0 AS allowed_salary_revenue_ratio,
        -- Quỹ lương cho phép
        fd.cumulative_revenue * 0.15 AS allowed_salary_fund,
        -- Quỹ lương vượt mức
        GREATEST(0, fd.cumulative_total_salary - (fd.cumulative_revenue * 0.15)) AS excess_salary_fund
    FROM final_data fd
    WHERE (fd.total_salary_month > 0 OR fd.total_revenue_month > 0)
        -- Bỏ các đơn vị không cần thiết
        AND fd.department_key NOT IN (
            'med pharma', 'medaz', 'medcom', 'medicons', 'medim', 'medon',
            'med pharma group', 'medaz group', 'medcom group', 'medicons group', 'medim group', 'medon group'
        )
    ORDER BY fd.total_salary_month DESC;
END;
$$;
