-- Update function: get_nganhdoc_salary_kpi_2025_province
-- Add total_revenue_2025 column from Doanh_thu table

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
    quy_cung_2025 NUMERIC,
    total_revenue_2025 NUMERIC,
    salary_revenue_ratio NUMERIC,
    allowed_salary_revenue_ratio NUMERIC,
    excess_ratio NUMERIC,
    excess_fund NUMERIC,
    additional_salary_fund NUMERIC
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
    ),
    revenue_data AS (
        SELECT 
            TRIM(LOWER(dt."Tên Đơn vị")) AS department_key,
            SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)) AS total_revenue_2025
        FROM "Doanh_thu" dt
        WHERE dt."Tháng pro" LIKE '%2025%'
        GROUP BY TRIM(LOWER(dt."Tên Đơn vị"))
    )
    SELECT 
        -- Gộp các đơn vị theo yêu cầu
        CASE 
            WHEN TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) IN ('Med Huế', 'Med Đà Nẵng') THEN 'Med Huda'
            WHEN TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]) IN ('Med TP.HCM', 'Med Bình Dương', 'Med Đồng Nai', 'Med Bình Phước') THEN 'Med Đông Nam Bộ'
            ELSE TRIM((string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)])
        END AS department_name,
        SUM(COALESCE(a.ft_salary_2025, 0)) AS ft_salary_2025,
        SUM(COALESCE(a.pt_salary_2025, 0)) AS pt_salary_2025,
        SUM(COALESCE(a.total_salary_2025, 0)) AS total_salary_2025,
        SUM(COALESCE(k."KPI_quy_luong_2025", 0)) AS quy_cung_2025,
        SUM(COALESCE(r.total_revenue_2025, 0)) AS total_revenue_2025,
        -- Quỹ lương/doanh thu lũy kế = Tổng lương 25 / Tổng doanh thu
        CASE 
            WHEN SUM(COALESCE(r.total_revenue_2025, 0)) > 0 THEN SUM(COALESCE(a.total_salary_2025, 0)) / SUM(COALESCE(r.total_revenue_2025, 0))
            ELSE 0
        END AS salary_revenue_ratio,
        -- Quỹ lương/doanh thu được phép chia = KPI_quy_luong_2025 / Chi_tieu_DT
        CASE 
            WHEN SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 THEN SUM(COALESCE(k."KPI_quy_luong_2025", 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0))
            ELSE 0
        END AS allowed_salary_revenue_ratio,
        -- Tỷ lệ vượt quỹ = QL/DT lũy kế - QL/DT được phép
        CASE 
            WHEN SUM(COALESCE(r.total_revenue_2025, 0)) > 0 AND SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 
            THEN (SUM(COALESCE(a.total_salary_2025, 0)) / SUM(COALESCE(r.total_revenue_2025, 0))) - (SUM(COALESCE(k."KPI_quy_luong_2025", 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0)))
            ELSE 0
        END AS excess_ratio,
        -- Quỹ cứng vượt = Tỷ lệ vượt quỹ * Tổng doanh thu
        CASE 
            WHEN SUM(COALESCE(r.total_revenue_2025, 0)) > 0 AND SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 
            THEN ((SUM(COALESCE(a.total_salary_2025, 0)) / SUM(COALESCE(r.total_revenue_2025, 0))) - (SUM(COALESCE(k."KPI_quy_luong_2025", 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0)))) * SUM(COALESCE(r.total_revenue_2025, 0))
            ELSE 0
        END AS excess_fund,
        -- Quỹ lương phải bù thêm = Quỹ cứng vượt / (12 - số tháng đã chia)
        -- Sử dụng 5 tháng đã chia như mặc định (có thể điều chỉnh sau)
        CASE 
            WHEN SUM(COALESCE(r.total_revenue_2025, 0)) > 0 AND SUM(COALESCE(k."Chi_tieu_DT", 0)) > 0 
            THEN ((SUM(COALESCE(a.total_salary_2025, 0)) / SUM(COALESCE(r.total_revenue_2025, 0))) - (SUM(COALESCE(k."KPI_quy_luong_2025", 0)) / SUM(COALESCE(k."Chi_tieu_DT", 0)))) * SUM(COALESCE(r.total_revenue_2025, 0)) / (12 - 5)
            ELSE 0
        END AS additional_salary_fund
    FROM "Chi_tieu_2025" k
    LEFT JOIN aggregated_salary a
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = a.department_key
    LEFT JOIN revenue_data r
        ON TRIM(LOWER(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )) = r.department_key
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
