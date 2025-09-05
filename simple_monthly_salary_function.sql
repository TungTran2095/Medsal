-- Function đơn giản để lấy dữ liệu lương theo tháng cho các tỉnh
-- Dựa trên logic của get_nganhdoc_salary_kpi_2025_province nhưng chỉ lấy dữ liệu theo tháng cụ thể

DROP FUNCTION IF EXISTS get_simple_monthly_salary_province(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_simple_monthly_salary_province(
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
        -- Get FT salary data for the specific month
        SELECT 
            f.dia_diem AS raw_department,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS ft_salary_month,
            0 AS pt_salary_month
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
            AND f.thang = month_str
        GROUP BY f.dia_diem

        UNION ALL

        -- Get PT salary data for the specific month
        SELECT 
            pt."Don vi" AS raw_department,
            0 AS ft_salary_month,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS pt_salary_month
        FROM "Parttime" pt
        WHERE pt."Nam"::INTEGER = p_filter_year
            AND pt."Thoi gian" = month_str
        GROUP BY pt."Don vi"
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
        GROUP BY TRIM(LOWER(dt."Tên Đơn vị"))
    ),
    cumulative_salary_data AS (
        -- Tính lũy kế lương cả năm 2025 (giống với logic KPI)
        SELECT 
            f.dia_diem AS raw_department,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS cumulative_ft_salary,
            0 AS cumulative_pt_salary
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
        GROUP BY f.dia_diem

        UNION ALL

        SELECT 
            pt."Don vi" AS raw_department,
            0 AS cumulative_ft_salary,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS cumulative_pt_salary
        FROM "Parttime" pt
        WHERE pt."Nam"::INTEGER = p_filter_year
        GROUP BY pt."Don vi"
    ),
    aggregated_cumulative_salary AS (
        SELECT 
            TRIM(LOWER(sd.raw_department)) AS department_key,
            SUM(sd.cumulative_ft_salary) AS cumulative_ft_salary,
            SUM(sd.cumulative_pt_salary) AS cumulative_pt_salary,
            SUM(sd.cumulative_ft_salary + sd.cumulative_pt_salary) AS cumulative_total_salary
        FROM cumulative_salary_data sd
        GROUP BY TRIM(LOWER(sd.raw_department))
    ),
    cumulative_revenue_data AS (
        -- Tính lũy kế doanh thu cả năm 2025 (giống với logic KPI)
        SELECT 
            TRIM(LOWER(dt."Tên Đơn vị")) AS department_key,
            SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)) AS cumulative_total_revenue
        FROM "Doanh_thu" dt
        WHERE dt."Tháng pro" LIKE '%2025%'
        GROUP BY TRIM(LOWER(dt."Tên Đơn vị"))
    ),
    monthly_revenue_data AS (
        -- Tính doanh thu tháng cụ thể
        SELECT 
            TRIM(LOWER(dt."Tên Đơn vị")) AS department_key,
            SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)) AS total_revenue_month
        FROM "Doanh_thu" dt
        WHERE dt."Tháng pro" LIKE '%2025%'
        AND (
            CASE 
                WHEN month_str = 'Tháng 01' THEN dt."Tháng pro" LIKE '%Tháng 01%'
                WHEN month_str = 'Tháng 02' THEN dt."Tháng pro" LIKE '%Tháng 02%'
                WHEN month_str = 'Tháng 03' THEN dt."Tháng pro" LIKE '%Tháng 03%'
                WHEN month_str = 'Tháng 04' THEN dt."Tháng pro" LIKE '%Tháng 04%'
                WHEN month_str = 'Tháng 05' THEN dt."Tháng pro" LIKE '%Tháng 05%'
                WHEN month_str = 'Tháng 06' THEN dt."Tháng pro" LIKE '%Tháng 06%'
                WHEN month_str = 'Tháng 07' THEN dt."Tháng pro" LIKE '%Tháng 07%'
                WHEN month_str = 'Tháng 08' THEN dt."Tháng pro" LIKE '%Tháng 08%'
                WHEN month_str = 'Tháng 09' THEN dt."Tháng pro" LIKE '%Tháng 09%'
                WHEN month_str = 'Tháng 10' THEN dt."Tháng pro" LIKE '%Tháng 10%'
                WHEN month_str = 'Tháng 11' THEN dt."Tháng pro" LIKE '%Tháng 11%'
                WHEN month_str = 'Tháng 12' THEN dt."Tháng pro" LIKE '%Tháng 12%'
                ELSE FALSE
            END
        )
        GROUP BY TRIM(LOWER(dt."Tên Đơn vị"))
    ),
    quy_cung_data AS (
        -- Lấy quỹ cứng 2025 từ bảng Chi_tieu_2025
        SELECT 
            TRIM(LOWER(k."Địa điểm_ngành dọc")) AS department_key,
            CAST(REPLACE(k."KPI_quy_luong_2025"::text, ',', '') AS NUMERIC) AS quy_cung_2025
        FROM "Chi_tieu_2025" k
        WHERE k."Loại" = 'Các tỉnh'
        AND k."Địa điểm_ngành dọc" NOT IN ('Medcom', 'Medon')
    )
    SELECT 
        -- Gộp các đơn vị theo yêu cầu (giống với bảng so sánh chỉ tiêu 2025)
        CASE 
            WHEN TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) IN ('Med Huế', 'Med Đà Nẵng') THEN 'Med Huda'
            WHEN TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) IN ('Med TP.HCM', 'Med Bình Dương', 'Med Đồng Nai', 'Med Bình Phước') THEN 'Med Đông Nam Bộ'
            ELSE TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)])
        END AS department_name,
        SUM(COALESCE(a.ft_salary_month, 0)) AS ft_salary_month,
        SUM(COALESCE(a.pt_salary_month, 0)) AS pt_salary_month,
        SUM(COALESCE(a.total_salary_month, 0)) AS total_salary_month,
        SUM(COALESCE(r.total_revenue_month, 0)) AS total_revenue_month,
        SUM(COALESCE(r.target_revenue_month, 0)) AS target_revenue_month,
        -- Tỷ lệ hoàn thành chỉ tiêu = Tổng doanh thu tháng / Chỉ tiêu doanh thu tháng
        CASE 
            WHEN SUM(COALESCE(r.target_revenue_month, 0)) > 0 
            THEN SUM(COALESCE(r.total_revenue_month, 0)) / SUM(COALESCE(r.target_revenue_month, 0))
            ELSE 0
        END AS completion_ratio,
        -- Quỹ lương/Doanh thu = Tổng quỹ lương tháng / Tổng doanh thu tháng
        CASE 
            WHEN SUM(COALESCE(r.total_revenue_month, 0)) > 0 
            THEN SUM(COALESCE(a.total_salary_month, 0)) / SUM(COALESCE(r.total_revenue_month, 0))
            ELSE 0
        END AS salary_revenue_ratio,
        -- Quỹ lương/Doanh thu lũy kế = Tổng quỹ lương lũy kế / Tổng doanh thu lũy kế
        CASE 
            WHEN SUM(COALESCE(cr.cumulative_total_revenue, 0)) > 0 
            THEN SUM(COALESCE(ca.cumulative_total_salary, 0)) / SUM(COALESCE(cr.cumulative_total_revenue, 0))
            ELSE 0
        END AS cumulative_salary_revenue_ratio,
        -- Quỹ cứng 2025
        SUM(COALESCE(qc.quy_cung_2025, 0)) AS quy_cung_2025,
        -- QL/DT được phép = KPI_quy_luong_2025 / Chi_tieu_DT (giống bảng so sánh chỉ tiêu)
        CASE 
            WHEN SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 
            THEN SUM(COALESCE(qc.quy_cung_2025, 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0))
            ELSE 0
        END AS allowed_salary_revenue_ratio,
        -- Quỹ lương được phép chia = Tổng doanh thu tháng × QL/DT được phép
        CASE 
            WHEN SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 
            THEN SUM(COALESCE(mr.total_revenue_month, 0)) * (SUM(COALESCE(qc.quy_cung_2025, 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0)))
            ELSE 0
        END AS allowed_salary_fund,
        -- Vượt quỹ lương tháng = Tổng quỹ lương tháng - Quỹ lương được phép chia
        SUM(COALESCE(a.total_salary_month, 0)) - 
        CASE 
            WHEN SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 
            THEN SUM(COALESCE(mr.total_revenue_month, 0)) * (SUM(COALESCE(qc.quy_cung_2025, 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0)))
            ELSE 0
        END AS excess_salary_fund
    FROM "Chi_tieu_2025" k
    LEFT JOIN aggregated_salary a
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = a.department_key
    LEFT JOIN revenue_data r
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = r.department_key
    LEFT JOIN aggregated_cumulative_salary ca
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = ca.department_key
    LEFT JOIN cumulative_revenue_data cr
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = cr.department_key
    LEFT JOIN monthly_revenue_data mr
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = mr.department_key
    LEFT JOIN quy_cung_data qc
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = qc.department_key
    WHERE k."Loại" = 'Các tỉnh'
    AND k."Địa điểm_ngành dọc" NOT IN ('Medcom', 'Medon')
    GROUP BY 
        CASE 
            WHEN TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) IN ('Med Huế', 'Med Đà Nẵng') THEN 'Med Huda'
            WHEN TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) IN ('Med TP.HCM', 'Med Bình Dương', 'Med Đồng Nai', 'Med Bình Phước') THEN 'Med Đông Nam Bộ'
            ELSE TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)])
        END
    ORDER BY department_name;
END;
$$;
