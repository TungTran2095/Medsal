-- Tìm tất cả các phiên bản của hàm get_doctor_count_latest_fulltime
SELECT 
    proname as function_name,
    proargtypes::regtype[] as argument_types,
    prorettype::regtype as return_type,
    oid
FROM pg_proc 
WHERE proname = 'get_doctor_count_latest_fulltime';

-- Xóa tất cả các phiên bản của hàm (chạy sau khi xem kết quả trên)
-- DROP FUNCTION IF EXISTS get_doctor_count_latest_fulltime() CASCADE;
-- DROP FUNCTION IF EXISTS get_doctor_count_latest_fulltime(INTEGER) CASCADE;
-- DROP FUNCTION IF EXISTS get_doctor_count_latest_fulltime(TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS get_doctor_count_latest_fulltime(INTEGER, INTEGER[]) CASCADE;
-- DROP FUNCTION IF EXISTS get_doctor_count_latest_fulltime(INTEGER, TEXT[]) CASCADE;

-- Function: get_monthly_doctor_salary_per_workday_trend
DROP FUNCTION IF EXISTS get_monthly_doctor_salary_per_workday_trend(INTEGER, TEXT[], TEXT[]);
CREATE OR REPLACE FUNCTION get_monthly_doctor_salary_per_workday_trend(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL,
    p_filter_nganh_docs TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    month_label TEXT,
    year_val INTEGER,
    salary_per_workday DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t."Thang_x" AS month_label,
        f.nam::INTEGER AS year_val,
        CASE
            WHEN SUM(
                COALESCE(f.ngay_thuong_chinh_thuc, 0) +
                COALESCE(f.ngay_thuong_thu_viec, 0) +
                COALESCE(f.nghi_tuan, 0) +
                COALESCE(f.le_tet, 0) +
                COALESCE(f.ngay_thuong_chinh_thuc2, 0) +
                COALESCE(f.ngay_thuong_thu_viec3, 0) +
                COALESCE(f.nghi_tuan4, 0) +
                COALESCE(f.le_tet5, 0) +
                COALESCE(f.nghi_nl, 0)
            ) = 0 THEN 0
            ELSE
                SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION))
                /
                SUM(
                    COALESCE(f.ngay_thuong_chinh_thuc, 0) +
                    COALESCE(f.ngay_thuong_thu_viec, 0) +
                    COALESCE(f.nghi_tuan, 0) +
                    COALESCE(f.le_tet, 0) +
                    COALESCE(f.ngay_thuong_chinh_thuc2, 0) +
                    COALESCE(f.ngay_thuong_thu_viec3, 0) +
                    COALESCE(f.nghi_tuan4, 0) +
                    COALESCE(f.le_tet5, 0) +
                    COALESCE(f.nghi_nl, 0)
                )
        END AS salary_per_workday
    FROM
        "Fulltime" f
    INNER JOIN
        "Time" t ON f.nam::INTEGER = t."Năm"::INTEGER
                 AND LEFT(regexp_replace(f.thang, '\\D', '', 'g'), 2) = LEFT(regexp_replace(t."Thang_x", '\\D', '', 'g'), 2)
    JOIN
        "MS_CBNV" m ON f.ma_nhan_vien = m."Mã nhân viên"
    JOIN
        "MS_Org_chucdanh" o ON TRIM(UPPER(m."Job title")) = TRIM(UPPER(o."CHỨC DANH CÔNG VIỆC (JOB TITLE)"))
    WHERE
        o."JOB TYPE" = 'Bác sĩ'
        AND f.thang IS NOT NULL
        AND t."Thang_x" IS NOT NULL
        AND regexp_replace(f.thang, '\\D', '', 'g') ~ '^\\d{2}'
        AND regexp_replace(t."Thang_x", '\\D', '', 'g') ~ '^\\d{2}'
        AND (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
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
    GROUP BY
        f.nam::INTEGER,
        t."Thang_x"
    ORDER BY
        f.nam::INTEGER,
        LEFT(regexp_replace(t."Thang_x", '\\D', '', 'g'), 2)::INTEGER;
END;
$$;

-- Function to get Back Office Employee Ratio by month for trend analysis
-- Returns monthly data for current year and previous year
CREATE OR REPLACE FUNCTION get_back_office_employee_ratio_by_month(
    p_filter_year INTEGER DEFAULT NULL
)
RETURNS TABLE(
    year INTEGER,
    month_label TEXT,
    back_office_count BIGINT,
    total_count BIGINT,
    back_office_ratio NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_year INTEGER;
    v_previous_year INTEGER;
BEGIN
    -- If no year specified, use the latest year from Fulltime table
    IF p_filter_year IS NULL THEN
        SELECT MAX(nam) INTO v_current_year FROM "Fulltime";
    ELSE
        v_current_year := p_filter_year;
    END IF;
    
    v_previous_year := v_current_year - 1;
    
    RETURN QUERY
    WITH monthly_data AS (
        SELECT 
            f.nam::INTEGER as data_year,
            f.thang as data_month_label,
            f.nganh_doc,
            f.ma_nhan_vien
        FROM "Fulltime" f
        WHERE f.nam IN (v_current_year, v_previous_year)
          AND f.thang IS NOT NULL
          AND regexp_replace(f.thang, '\D', '', 'g') ~ '^\d+$'
          AND f.nganh_doc IS NOT NULL
          AND f.nganh_doc <> ''
    ),
    back_office_employees AS (
        SELECT DISTINCT md.data_year, md.data_month_label, md.ma_nhan_vien
        FROM monthly_data md
        JOIN "ms_org_nganhdoc" org ON md.nganh_doc = org."Department"
        WHERE 
            -- Standard back office types
            org."Loại" IN ('Khối quản trị', 'Ban lãnh đạo', 'Khối hậu cần dự án', 'Khối tài chính kế toán')
            OR
            -- Special cases
            (org."Loại" = 'ĐVTV ngoài y tế' AND org."Department" IN ('Medon', 'Medcom', 'Medicons'))
            OR
            (org."Loại" = 'Khối chuyên môn' AND org."Bussiness Unit" = 'Ban Kế hoạch')
            OR
            (org."Loại" = 'Khối khách hàng cá nhân' AND org."Bussiness Unit" = 'Ban Trải nghiệm khách hàng')
    ),
    monthly_totals AS (
        SELECT 
            data_year,
            data_month_label,
            COUNT(DISTINCT ma_nhan_vien) as total_count
        FROM monthly_data
        GROUP BY data_year, data_month_label
    ),
    monthly_back_office AS (
        SELECT 
            data_year,
            data_month_label,
            COUNT(DISTINCT ma_nhan_vien) as back_office_count
        FROM back_office_employees
        GROUP BY data_year, data_month_label
    )
    SELECT 
        mt.data_year as year,
        mt.data_month_label as month_label,
        COALESCE(mbo.back_office_count, 0) as back_office_count,
        mt.total_count,
        CASE 
            WHEN mt.total_count = 0 THEN 0
            ELSE ROUND((COALESCE(mbo.back_office_count, 0)::NUMERIC / mt.total_count::NUMERIC) * 100, 2)
        END as back_office_ratio
    FROM monthly_totals mt
    LEFT JOIN monthly_back_office mbo ON mt.data_year = mbo.data_year AND mt.data_month_label = mbo.data_month_label
    ORDER BY mt.data_year, CAST(regexp_replace(mt.data_month_label, '\D', '', 'g') AS INTEGER);
END;
$$; 

-- Function to calculate Back Office Employee Ratio for latest month
-- This function calculates the ratio of back office employees to total employees
-- based on complex business logic involving ms_org_nganhdoc table
-- Only considers the latest month in the Fulltime table
CREATE OR REPLACE FUNCTION get_back_office_employee_ratio_latest_month()
RETURNS TABLE(
    back_office_count BIGINT,
    total_count BIGINT,
    back_office_ratio NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_year INTEGER;
    v_max_month TEXT;
BEGIN
    -- Get the latest year and month from Fulltime table
    SELECT MAX(nam) INTO v_max_year FROM "Fulltime";
    
    SELECT thang INTO v_max_month
    FROM "Fulltime"
    WHERE nam = v_max_year
      AND thang IS NOT NULL
      AND regexp_replace(thang, '\D', '', 'g') ~ '^\d+$'
    ORDER BY CAST(regexp_replace(thang, '\D', '', 'g') AS INTEGER) DESC
    LIMIT 1;
    
    RETURN QUERY
    WITH ft_employee_data AS (
        SELECT DISTINCT f.ma_nhan_vien, f.nganh_doc
        FROM "Fulltime" f
        WHERE f.nam = v_max_year
          AND f.thang = v_max_month
          AND f.nganh_doc IS NOT NULL
          AND f.nganh_doc <> ''
    ),
    back_office_employees AS (
        SELECT DISTINCT fed.ma_nhan_vien
        FROM ft_employee_data fed
        JOIN "ms_org_nganhdoc" org ON fed.nganh_doc = org."Department"
        WHERE 
            -- Standard back office types
            org."Loại" IN ('Khối quản trị', 'Ban lãnh đạo', 'Khối hậu cần dự án', 'Khối tài chính kế toán')
            OR
            -- Special cases
            (org."Loại" = 'ĐVTV ngoài y tế' AND org."Department" IN ('Medon', 'Medcom', 'Medicons'))
            OR
            (org."Loại" = 'Khối chuyên môn' AND org."Bussiness Unit" = 'Ban Kế hoạch')
            OR
            (org."Loại" = 'Khối khách hàng cá nhân' AND org."Bussiness Unit" = 'Ban Trải nghiệm khách hàng')
    ),
    total_employees AS (
        SELECT COUNT(DISTINCT ma_nhan_vien) as total_count
        FROM ft_employee_data
    ),
    back_office_count AS (
        SELECT COUNT(DISTINCT ma_nhan_vien) as back_office_count
        FROM back_office_employees
    )
    SELECT 
        bo.back_office_count,
        te.total_count,
        CASE 
            WHEN te.total_count = 0 THEN 0
            ELSE ROUND((bo.back_office_count::NUMERIC / te.total_count::NUMERIC) * 100, 2)
        END as back_office_ratio
    FROM back_office_count bo
    CROSS JOIN total_employees te;
END;
$$;

-- Function to calculate Back Office Salary Ratio for latest month
-- This function calculates the ratio of back office salary to total salary
-- based on complex business logic involving ms_org_nganhdoc table
-- Only considers the latest month in the Fulltime table
CREATE OR REPLACE FUNCTION get_back_office_salary_ratio_latest_month()
RETURNS TABLE(
    back_office_salary NUMERIC,
    total_salary NUMERIC,
    back_office_salary_ratio NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_year INTEGER;
    v_max_month TEXT;
BEGIN
    -- Get the latest year and month from Fulltime table
    SELECT MAX(nam) INTO v_max_year FROM "Fulltime";
    
    SELECT thang INTO v_max_month
    FROM "Fulltime"
    WHERE nam = v_max_year
      AND thang IS NOT NULL
      AND regexp_replace(thang, '\D', '', 'g') ~ '^\d+$'
    ORDER BY CAST(regexp_replace(thang, '\D', '', 'g') AS INTEGER) DESC
    LIMIT 1;
    
    RETURN QUERY
    WITH ft_salary_data AS (
        SELECT f.ma_nhan_vien, f.nganh_doc, f.tong_thu_nhap
        FROM "Fulltime" f
        WHERE f.nam = v_max_year
          AND f.thang = v_max_month
          AND f.nganh_doc IS NOT NULL
          AND f.nganh_doc <> ''
          AND f.tong_thu_nhap IS NOT NULL
    ),
    back_office_salaries AS (
        SELECT SUM(fsd.tong_thu_nhap) as back_office_salary
        FROM ft_salary_data fsd
        JOIN "ms_org_nganhdoc" org ON fsd.nganh_doc = org."Department"
        WHERE 
            -- Standard back office types
            org."Loại" IN ('Khối quản trị', 'Ban lãnh đạo', 'Khối hậu cần dự án', 'Khối tài chính kế toán')
            OR
            -- Special cases
            (org."Loại" = 'ĐVTV ngoài y tế' AND org."Department" IN ('Medon', 'Medcom', 'Medicons'))
            OR
            (org."Loại" = 'Khối chuyên môn' AND org."Bussiness Unit" = 'Ban Kế hoạch')
            OR
            (org."Loại" = 'Khối khách hàng cá nhân' AND org."Bussiness Unit" = 'Ban Trải nghiệm khách hàng')
    ),
    total_salary AS (
        SELECT SUM(tong_thu_nhap) as total_salary
        FROM ft_salary_data
    )
    SELECT 
        COALESCE(bos.back_office_salary, 0),
        COALESCE(ts.total_salary, 0),
        CASE 
            WHEN COALESCE(ts.total_salary, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(bos.back_office_salary, 0)::NUMERIC / ts.total_salary::NUMERIC) * 100, 2)
        END as back_office_salary_ratio
    FROM back_office_salaries bos
    CROSS JOIN total_salary ts;
END;
$$;

-- Function to get Back Office Salary Ratio by month for trend analysis
-- Returns monthly data for current year and previous year
CREATE OR REPLACE FUNCTION get_back_office_salary_ratio_by_month(
    p_filter_year INTEGER DEFAULT NULL
)
RETURNS TABLE(
    year INTEGER,
    month_label TEXT,
    back_office_salary NUMERIC,
    total_salary NUMERIC,
    back_office_salary_ratio NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_year INTEGER;
    v_previous_year INTEGER;
BEGIN
    -- If no year specified, use the latest year from Fulltime table
    IF p_filter_year IS NULL THEN
        SELECT MAX(nam) INTO v_current_year FROM "Fulltime";
    ELSE
        v_current_year := p_filter_year;
    END IF;
    
    v_previous_year := v_current_year - 1;
    
    RETURN QUERY
    WITH monthly_data AS (
        SELECT 
            f.nam::INTEGER as data_year,
            f.thang as data_month_label,
            f.nganh_doc,
            f.tong_thu_nhap
        FROM "Fulltime" f
        WHERE f.nam IN (v_current_year, v_previous_year)
          AND f.thang IS NOT NULL
          AND regexp_replace(f.thang, '\D', '', 'g') ~ '^\d+$'
          AND f.nganh_doc IS NOT NULL
          AND f.nganh_doc <> ''
          AND f.tong_thu_nhap IS NOT NULL
    ),
    back_office_salaries AS (
        SELECT md.data_year, md.data_month_label, SUM(md.tong_thu_nhap) as back_office_salary
        FROM monthly_data md
        JOIN "ms_org_nganhdoc" org ON md.nganh_doc = org."Department"
        WHERE 
            -- Standard back office types
            org."Loại" IN ('Khối quản trị', 'Ban lãnh đạo', 'Khối hậu cần dự án', 'Khối tài chính kế toán')
            OR
            -- Special cases
            (org."Loại" = 'ĐVTV ngoài y tế' AND org."Department" IN ('Medon', 'Medcom', 'Medicons'))
            OR
            (org."Loại" = 'Khối chuyên môn' AND org."Bussiness Unit" = 'Ban Kế hoạch')
            OR
            (org."Loại" = 'Khối khách hàng cá nhân' AND org."Bussiness Unit" = 'Ban Trải nghiệm khách hàng')
        GROUP BY md.data_year, md.data_month_label
    ),
    monthly_totals AS (
        SELECT 
            data_year,
            data_month_label,
            SUM(tong_thu_nhap) as total_salary
        FROM monthly_data
        GROUP BY data_year, data_month_label
    )
    SELECT 
        mt.data_year as year,
        mt.data_month_label as month_label,
        COALESCE(bos.back_office_salary, 0) as back_office_salary,
        mt.total_salary,
        CASE 
            WHEN mt.total_salary = 0 THEN 0
            ELSE ROUND((COALESCE(bos.back_office_salary, 0)::NUMERIC / mt.total_salary::NUMERIC) * 100, 2)
        END as back_office_salary_ratio
    FROM monthly_totals mt
    LEFT JOIN back_office_salaries bos ON mt.data_year = bos.data_year AND mt.data_month_label = bos.data_month_label
    ORDER BY mt.data_year, CAST(regexp_replace(mt.data_month_label, '\D', '', 'g') AS INTEGER);
END;
$$; 