-- Chạy function get_simple_monthly_salary_hanoi trên Supabase
-- Copy và paste nội dung này vào Supabase SQL Editor

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
    excess_salary_fund NUMERIC,
    chi_tieu NUMERIC,
    doanh_thu_thuc_hien NUMERIC,
    ty_le_hoan_thanh NUMERIC,
    quy_luong_chuan NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    month_str TEXT;
    month_revenue_str TEXT;
    month_doanh_thu_str TEXT;
BEGIN
    -- Convert month number to "Tháng XX" format for salary tables
    month_str := 'Tháng ' || LPAD(p_filter_month::TEXT, 2, '0');
    -- Convert month number to "Tháng XX-YYYY" format for revenue table
    month_revenue_str := 'Tháng ' || LPAD(p_filter_month::TEXT, 2, '0') || '-' || p_filter_year::TEXT;
    
    -- Convert month number to "Tháng XX" format for Doanh_thu table
    month_doanh_thu_str := 'Tháng ' || LPAD(p_filter_month::TEXT, 2, '0');
    
    RETURN QUERY
    WITH salary_data AS (
        -- Get FT salary data for the specific month - filter for Hanoi using nganh_doc and hn_or_not
        SELECT 
            f.nganh_doc AS raw_department,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS ft_salary_month,
            0 AS pt_salary_month
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
            AND f.thang = month_str
            AND f.hn_or_not = 'Hà Nội'
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
    -- Tính lương riêng cho các đơn vị thuộc Hệ thống khám chữa bệnh
    health_system_ft_salary AS (
        SELECT 
            'bệnh viện đa khoa medlatec' AS department_key,
            COALESCE(SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)), 0) AS ft_salary_month
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
            AND f.thang = month_str
            AND f.nganh_doc = 'Hệ thống khám chữa bệnh'
            AND (f.dia_diem = 'Medlatec Ba Đình' OR f.dia_diem = 'Med Ba Đình' OR f.dia_diem = 'Bệnh viện đa khoa Medlatec')
        
        UNION ALL
        
        SELECT 
            'phòng khám đa khoa cầu giấy' AS department_key,
            COALESCE(SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)), 0) AS ft_salary_month
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
            AND f.thang = month_str
            AND f.nganh_doc = 'Hệ thống khám chữa bệnh'
            AND f.dia_diem = 'Med Cầu Giấy'
        
        UNION ALL
        
        SELECT 
            'phòng khám đa khoa tây hồ' AS department_key,
            COALESCE(SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)), 0) AS ft_salary_month
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
            AND f.thang = month_str
            AND f.nganh_doc = 'Hệ thống khám chữa bệnh'
            AND f.dia_diem = 'Med Tây Hồ'
        
        UNION ALL
        
        SELECT 
            'phòng khám đa khoa thanh xuân' AS department_key,
            COALESCE(SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)), 0) AS ft_salary_month
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
            AND f.thang = month_str
            AND f.nganh_doc = 'Hệ thống khám chữa bệnh'
            AND f.dia_diem = 'Med Thanh Xuân'
    ),
    health_system_pt_salary AS (
        SELECT 
            'bệnh viện đa khoa medlatec' AS department_key,
            COALESCE(SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)), 0) AS pt_salary_month
        FROM "Parttime" pt
        WHERE pt."Nam"::INTEGER = p_filter_year
            AND pt."Thoi gian" = month_str
            AND pt."HN_or_not" = 'Hà Nội'
            AND pt."Don vi  2" = 'Hệ thống khám chữa bệnh'
            AND (pt."Don vi" = 'Medlatec Ba Đình' OR pt."Don vi" = 'Med Ba Đình' OR pt."Don vi" = 'Bệnh viện đa khoa Medlatec')
        
        UNION ALL
        
        SELECT 
            'phòng khám đa khoa cầu giấy' AS department_key,
            COALESCE(SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)), 0) AS pt_salary_month
        FROM "Parttime" pt
        WHERE pt."Nam"::INTEGER = p_filter_year
            AND pt."Thoi gian" = month_str
            AND pt."HN_or_not" = 'Hà Nội'
            AND pt."Don vi  2" = 'Hệ thống khám chữa bệnh'
            AND pt."Don vi" = 'Med Cầu Giấy'
        
        UNION ALL
        
        SELECT 
            'phòng khám đa khoa tây hồ' AS department_key,
            COALESCE(SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)), 0) AS pt_salary_month
        FROM "Parttime" pt
        WHERE pt."Nam"::INTEGER = p_filter_year
            AND pt."Thoi gian" = month_str
            AND pt."HN_or_not" = 'Hà Nội'
            AND pt."Don vi  2" = 'Hệ thống khám chữa bệnh'
            AND pt."Don vi" = 'Med Tây Hồ'
        
        UNION ALL
        
        SELECT 
            'phòng khám đa khoa thanh xuân' AS department_key,
            COALESCE(SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)), 0) AS pt_salary_month
        FROM "Parttime" pt
        WHERE pt."Nam"::INTEGER = p_filter_year
            AND pt."Thoi gian" = month_str
            AND pt."HN_or_not" = 'Hà Nội'
            AND pt."Don vi  2" = 'Hệ thống khám chữa bệnh'
            AND pt."Don vi" = 'Med Thanh Xuân'
    ),
    health_system_salary AS (
        SELECT 
            ft.department_key,
            ft.ft_salary_month,
            COALESCE(pt.pt_salary_month, 0) AS pt_salary_month,
            ft.ft_salary_month + COALESCE(pt.pt_salary_month, 0) AS total_salary_month
        FROM health_system_ft_salary ft
        LEFT JOIN health_system_pt_salary pt ON ft.department_key = pt.department_key
    ),
    aggregated_salary AS (
        -- Dữ liệu lương từ salary_data (các đơn vị thông thường)
        SELECT 
            -- Gộp các Trung tâm KHDN thành một dòng duy nhất
            CASE 
                WHEN LOWER(TRIM(sd.raw_department)) LIKE '%khdn%' OR 
                     LOWER(TRIM(sd.raw_department)) LIKE '%khách hàng doanh nghiệp%' THEN 'trung tâm khdn'
                ELSE TRIM(LOWER(sd.raw_department))
            END AS department_key,
            SUM(sd.ft_salary_month) AS ft_salary_month,
            SUM(sd.pt_salary_month) AS pt_salary_month,
            SUM(sd.ft_salary_month + sd.pt_salary_month) AS total_salary_month
        FROM salary_data sd
        GROUP BY 
            CASE 
                WHEN LOWER(TRIM(sd.raw_department)) LIKE '%khdn%' OR 
                     LOWER(TRIM(sd.raw_department)) LIKE '%khách hàng doanh nghiệp%' THEN 'trung tâm khdn'
                ELSE TRIM(LOWER(sd.raw_department))
            END
        
        UNION ALL
        
        -- Dữ liệu lương từ health_system_salary (các đơn vị thuộc Hệ thống khám chữa bệnh)
        SELECT 
            hss.department_key,
            hss.ft_salary_month,
            hss.pt_salary_month,
            hss.total_salary_month
        FROM health_system_salary hss
    ),
    revenue_data AS (
        SELECT 
            -- Gộp các Trung tâm KHDN thành một dòng duy nhất
            CASE 
                WHEN LOWER(TRIM(dt."Tên Đơn vị")) LIKE '%khdn%' OR 
                     LOWER(TRIM(dt."Tên Đơn vị")) LIKE '%khách hàng doanh nghiệp%' THEN 'trung tâm khdn'
                ELSE TRIM(LOWER(dt."Tên Đơn vị"))
            END AS department_key,
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
        GROUP BY 
            CASE 
                WHEN LOWER(TRIM(dt."Tên Đơn vị")) LIKE '%khdn%' OR 
                     LOWER(TRIM(dt."Tên Đơn vị")) LIKE '%khách hàng doanh nghiệp%' THEN 'trung tâm khdn'
                ELSE TRIM(LOWER(dt."Tên Đơn vị"))
            END
    ),
    cumulative_salary_data AS (
        -- Tính lũy kế lương cả năm 2025 cho Hà Nội - sử dụng nganh_doc và hn_or_not
        SELECT 
            f.nganh_doc AS raw_department,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS cumulative_ft_salary,
            0 AS cumulative_pt_salary
        FROM "Fulltime" f
        WHERE f.nam::INTEGER = p_filter_year
            AND f.hn_or_not = 'Hà Nội'
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
            -- Gộp các Trung tâm KHDN thành một dòng duy nhất
            CASE 
                WHEN LOWER(TRIM(csd.raw_department)) LIKE '%khdn%' OR 
                     LOWER(TRIM(csd.raw_department)) LIKE '%khách hàng doanh nghiệp%' THEN 'trung tâm khdn'
                ELSE TRIM(LOWER(csd.raw_department))
            END AS department_key,
            SUM(csd.cumulative_ft_salary) AS cumulative_ft_salary,
            SUM(csd.cumulative_pt_salary) AS cumulative_pt_salary,
            SUM(csd.cumulative_ft_salary + csd.cumulative_pt_salary) AS cumulative_total_salary
        FROM cumulative_salary_data csd
        GROUP BY 
            CASE 
                WHEN LOWER(TRIM(csd.raw_department)) LIKE '%khdn%' OR 
                     LOWER(TRIM(csd.raw_department)) LIKE '%khách hàng doanh nghiệp%' THEN 'trung tâm khdn'
                ELSE TRIM(LOWER(csd.raw_department))
            END
    ),
    cumulative_revenue_data AS (
        -- Tính lũy kế doanh thu cả năm 2025 cho Hà Nội
        SELECT 
            -- Gộp các Trung tâm KHDN thành một dòng duy nhất
            CASE 
                WHEN LOWER(TRIM(dt."Tên Đơn vị")) LIKE '%khdn%' OR 
                     LOWER(TRIM(dt."Tên Đơn vị")) LIKE '%khách hàng doanh nghiệp%' THEN 'trung tâm khdn'
                ELSE TRIM(LOWER(dt."Tên Đơn vị"))
            END AS department_key,
            SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)) AS cumulative_revenue
        FROM "Doanh_thu" dt
        WHERE dt."Năm" = p_filter_year
            AND (
                LOWER(dt."Tên Đơn vị") LIKE '%hà nội%' OR
                LOWER(dt."Tên Đơn vị") LIKE '%hanoi%' OR
                LOWER(dt."Tên Đơn vị") LIKE '%hn%' OR
                LOWER(dt."Tên Đơn vị") LIKE '%ha noi%'
            )
        GROUP BY 
            CASE 
                WHEN LOWER(TRIM(dt."Tên Đơn vị")) LIKE '%khdn%' OR 
                     LOWER(TRIM(dt."Tên Đơn vị")) LIKE '%khách hàng doanh nghiệp%' THEN 'trung tâm khdn'
                ELSE TRIM(LOWER(dt."Tên Đơn vị"))
            END
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
        GREATEST(0, fd.cumulative_total_salary - (fd.cumulative_revenue * 0.15)) AS excess_salary_fund,
        -- Chỉ tiêu từ bảng Doanh_thu theo tháng và năm với các rule đặc biệt
        CASE 
            WHEN LOWER(fd.department_key) = 'phòng kế toán med vn' THEN
                -- Phòng kế toán Med VN: Tổng chỉ tiêu toàn hệ thống - Tổng chỉ tiêu của ĐVTV
                (SELECT 
                    COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0) - 
                    COALESCE(SUM(CASE WHEN dt."Khối DTQL" = 'ĐVTV' THEN CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC) ELSE 0 END), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year)
            WHEN LOWER(fd.department_key) = 'trung tâm phát triển đối tác và bảo hiểm' THEN
                -- Trung tâm phát triển Đối tác và Bảo hiểm: Chỉ tiêu = Sum khi Khối DTQL = "BV/PK-BHTM"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" = 'BV/PK-BHTM')
            WHEN LOWER(fd.department_key) = 'trung tâm khdn' THEN
                -- Trung tâm KHDN: Chỉ tiêu = Sum khi Khối DTQL = "KSK"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" = 'KSK')
            WHEN LOWER(fd.department_key) = 'trung tâm khách hàng chiến lược và dự án y tế' THEN
                -- Trung tâm Khách hàng chiến lược và Dự án y tế: Chỉ tiêu = Sum khi Khối DTQL = "TN-BV GM"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" = 'TN-BV GM')
            WHEN LOWER(fd.department_key) = 'trung tâm tại nhà toàn quốc' THEN
                -- Trung tâm tại nhà toàn quốc: Chỉ tiêu = Sum khi Khối DTQL = "CTCĐ" + "TN-CSPK" + "TN-CN/TC" và Tên Đơn vị = "Med Cầu Giấy"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('CTCĐ', 'TN-CSPK', 'TN-CN/TC')
                 AND dt."Tên Đơn vị" = 'Med Cầu Giấy')
            WHEN LOWER(fd.department_key) = 'trung tâm kinh doanh bv/pk' THEN
                -- Trung tâm kinh doanh BV/PK: Chỉ tiêu = Sum khi Khối DTQL = "BV/PK-BHTM" + "BV/PK-CN/TC"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC'))
            WHEN LOWER(fd.department_key) = 'ban kế hoạch' THEN
                -- Ban kế hoạch: Chỉ tiêu giống Phòng kế toán Med VN
                (SELECT 
                    COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0) - 
                    COALESCE(SUM(CASE WHEN dt."Khối DTQL" = 'ĐVTV' THEN CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC) ELSE 0 END), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year)
            WHEN LOWER(fd.department_key) = 'hệ thống kcb ngoại viện' THEN
                -- Hệ thống KCB ngoại viện: Chỉ tiêu giống Trung tâm KHDN
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" = 'KSK')
            WHEN LOWER(fd.department_key) = 'bệnh viện đa khoa medlatec' THEN
                -- Bệnh viện đa khoa Medlatec: Chỉ tiêu = Sum khi Khối DTQL = "BV/PK-BHTM" + "BV/PK-CN/TC" và Tên Đơn vị = "Medlatec Ba Đình"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                 AND (dt."Tên Đơn vị" = 'Medlatec Ba Đình' OR dt."Tên Đơn vị" = 'Med Ba Đình' OR dt."Tên Đơn vị" = 'Bệnh viện đa khoa Medlatec'))
            WHEN LOWER(fd.department_key) = 'phòng khám đa khoa tây hồ' THEN
                -- Phòng khám đa khoa Tây Hồ: Chỉ tiêu = Sum khi Khối DTQL = "BV/PK-BHTM" + "BV/PK-CN/TC" và Tên Đơn vị = "Med Tây Hồ"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                 AND dt."Tên Đơn vị" = 'Med Tây Hồ')
            WHEN LOWER(fd.department_key) = 'phòng khám đa khoa cầu giấy' THEN
                -- Phòng khám đa khoa Cầu Giấy: Chỉ tiêu = Sum khi Khối DTQL = "BV/PK-BHTM" + "BV/PK-CN/TC" và Tên Đơn vị = "Med Cầu Giấy"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                 AND dt."Tên Đơn vị" = 'Med Cầu Giấy')
            WHEN LOWER(fd.department_key) = 'phòng khám đa khoa thanh xuân' THEN
                -- Phòng khám đa khoa Thanh Xuân: Chỉ tiêu = Sum khi Khối DTQL = "BV/PK-BHTM" + "BV/PK-CN/TC" và Tên Đơn vị = "Med Thanh Xuân"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                 AND dt."Tên Đơn vị" = 'Med Thanh Xuân')
            ELSE
                -- Các đơn vị khác: Tổng chỉ tiêu toàn hệ thống (không trừ ĐVTV)
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year)
        END AS chi_tieu,
        -- Doanh thu thực hiện tháng [tháng được chọn] - Logic giống chi_tieu nhưng lấy từ cột "Kỳ báo cáo"
        CASE 
            WHEN LOWER(fd.department_key) = 'phòng kế toán med vn' THEN
                -- Phòng kế toán Med VN: Chỉ tiêu = Tổng chỉ tiêu - Chỉ tiêu ĐVTV
                (SELECT 
                    COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0) - 
                    COALESCE(SUM(CASE WHEN dt."Khối DTQL" = 'ĐVTV' THEN CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC) ELSE 0 END), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year)
            WHEN LOWER(fd.department_key) = 'trung tâm phát triển đối tác và bảo hiểm' THEN
                -- Trung tâm phát triển Đối tác và Bảo hiểm: Doanh thu thực hiện = Sum khi Khối DTQL = "BV/PK-BHTM"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" = 'BV/PK-BHTM')
            WHEN LOWER(fd.department_key) = 'trung tâm khdn' THEN
                -- Trung tâm KHDN: Doanh thu thực hiện = Sum khi Khối DTQL = "KSK"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" = 'KSK')
            WHEN LOWER(fd.department_key) = 'trung tâm khách hàng chiến lược và dự án y tế' THEN
                -- Trung tâm Khách hàng chiến lược và Dự án y tế: Doanh thu thực hiện = Sum khi Khối DTQL = "TN-BV GM"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" = 'TN-BV GM')
            WHEN LOWER(fd.department_key) = 'trung tâm tại nhà toàn quốc' THEN
                -- Trung tâm tại nhà toàn quốc: Doanh thu thực hiện = Sum khi Khối DTQL IN ('CTCĐ', 'TN-CSPK', 'TN-CN/TC') và Tên Đơn vị = 'Med Cầu Giấy'
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('CTCĐ', 'TN-CSPK', 'TN-CN/TC')
                 AND dt."Tên Đơn vị" = 'Med Cầu Giấy')
            WHEN LOWER(fd.department_key) = 'trung tâm kinh doanh bv/pk' THEN
                -- Trung tâm kinh doanh BV/PK: Doanh thu thực hiện = Sum khi Khối DTQL IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC'))
            WHEN LOWER(fd.department_key) = 'ban kế hoạch' THEN
                -- Ban kế hoạch: Doanh thu thực hiện giống Phòng kế toán Med VN
                (SELECT 
                    COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0) - 
                    COALESCE(SUM(CASE WHEN dt."Khối DTQL" = 'ĐVTV' THEN CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC) ELSE 0 END), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year)
            WHEN LOWER(fd.department_key) = 'hệ thống kcb ngoại viện' THEN
                -- Hệ thống KCB ngoại viện: Doanh thu thực hiện giống Trung tâm KHDN
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" = 'KSK')
            WHEN LOWER(fd.department_key) = 'bệnh viện đa khoa medlatec' THEN
                -- Bệnh viện đa khoa Medlatec: Doanh thu thực hiện = Sum khi Khối DTQL = "BV/PK-BHTM" + "BV/PK-CN/TC" và Tên Đơn vị = "Medlatec Ba Đình"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                 AND (dt."Tên Đơn vị" = 'Medlatec Ba Đình' OR dt."Tên Đơn vị" = 'Med Ba Đình' OR dt."Tên Đơn vị" = 'Bệnh viện đa khoa Medlatec'))
            WHEN LOWER(fd.department_key) = 'phòng khám đa khoa tây hồ' THEN
                -- Phòng khám đa khoa Tây Hồ: Doanh thu thực hiện = Sum khi Khối DTQL = "BV/PK-BHTM" + "BV/PK-CN/TC" và Tên Đơn vị = "Med Tây Hồ"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                 AND dt."Tên Đơn vị" = 'Med Tây Hồ')
            WHEN LOWER(fd.department_key) = 'phòng khám đa khoa cầu giấy' THEN
                -- Phòng khám đa khoa Cầu Giấy: Doanh thu thực hiện = Sum khi Khối DTQL = "BV/PK-BHTM" + "BV/PK-CN/TC" và Tên Đơn vị = "Med Cầu Giấy"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                 AND dt."Tên Đơn vị" = 'Med Cầu Giấy')
            WHEN LOWER(fd.department_key) = 'phòng khám đa khoa thanh xuân' THEN
                -- Phòng khám đa khoa Thanh Xuân: Doanh thu thực hiện = Sum khi Khối DTQL = "BV/PK-BHTM" + "BV/PK-CN/TC" và Tên Đơn vị = "Med Thanh Xuân"
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year
                 AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                 AND dt."Tên Đơn vị" = 'Med Thanh Xuân')
            ELSE
                -- Các đơn vị khác: Tổng doanh thu thực hiện toàn hệ thống (không trừ ĐVTV)
                (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year)
        END AS doanh_thu_thuc_hien,
        -- Tỷ lệ hoàn thành Chỉ tiêu = Doanh thu thực hiện / Chỉ tiêu (tránh chia cho 0)
        CASE 
            WHEN (CASE 
                WHEN LOWER(fd.department_key) = 'phòng kế toán med vn' THEN
                    (SELECT 
                        COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0) - 
                        COALESCE(SUM(CASE WHEN dt."Khối DTQL" = 'ĐVTV' THEN CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC) ELSE 0 END), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year)
                WHEN LOWER(fd.department_key) = 'trung tâm phát triển đối tác và bảo hiểm' THEN
                    (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year
                     AND dt."Khối DTQL" = 'BV/PK-BHTM')
                WHEN LOWER(fd.department_key) = 'trung tâm khdn' THEN
                    (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year
                     AND dt."Khối DTQL" = 'KSK')
                WHEN LOWER(fd.department_key) = 'trung tâm khách hàng chiến lược và dự án y tế' THEN
                    (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year
                     AND dt."Khối DTQL" = 'TN-BV GM')
                WHEN LOWER(fd.department_key) = 'trung tâm tại nhà toàn quốc' THEN
                    (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year
                     AND dt."Khối DTQL" IN ('CTCĐ', 'TN-CSPK', 'TN-CN/TC')
                     AND dt."Tên Đơn vị" = 'Med Cầu Giấy')
                WHEN LOWER(fd.department_key) = 'trung tâm kinh doanh bv/pk' THEN
                    (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year
                     AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC'))
                WHEN LOWER(fd.department_key) = 'ban kế hoạch' THEN
                    (SELECT 
                        COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0) - 
                        COALESCE(SUM(CASE WHEN dt."Khối DTQL" = 'ĐVTV' THEN CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC) ELSE 0 END), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year)
                WHEN LOWER(fd.department_key) = 'hệ thống kcb ngoại viện' THEN
                    (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year
                     AND dt."Khối DTQL" = 'KSK')
                WHEN LOWER(fd.department_key) = 'bệnh viện đa khoa medlatec' THEN
                    (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year
                     AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                     AND (dt."Tên Đơn vị" = 'Medlatec Ba Đình' OR dt."Tên Đơn vị" = 'Med Ba Đình' OR dt."Tên Đơn vị" = 'Bệnh viện đa khoa Medlatec'))
                WHEN LOWER(fd.department_key) = 'phòng khám đa khoa tây hồ' THEN
                    (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year
                     AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                     AND dt."Tên Đơn vị" = 'Med Tây Hồ')
                WHEN LOWER(fd.department_key) = 'phòng khám đa khoa cầu giấy' THEN
                    (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year
                     AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                     AND dt."Tên Đơn vị" = 'Med Cầu Giấy')
                WHEN LOWER(fd.department_key) = 'phòng khám đa khoa thanh xuân' THEN
                    (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                     FROM "Doanh_thu" dt 
                     WHERE dt."Tháng" = month_doanh_thu_str 
                     AND dt."Năm" = p_filter_year
                     AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                     AND dt."Tên Đơn vị" = 'Med Thanh Xuân')
                ELSE (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                      FROM "Doanh_thu" dt 
                      WHERE dt."Tháng" = month_doanh_thu_str 
                      AND dt."Năm" = p_filter_year)
            END) > 0 THEN
                -- Tính tỷ lệ hoàn thành
                (CASE 
                    WHEN LOWER(fd.department_key) = 'phòng kế toán med vn' THEN
                        (SELECT 
                            COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0) - 
                            COALESCE(SUM(CASE WHEN dt."Khối DTQL" = 'ĐVTV' THEN CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC) ELSE 0 END), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year) /
                        (SELECT 
                            COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0) - 
                            COALESCE(SUM(CASE WHEN dt."Khối DTQL" = 'ĐVTV' THEN CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC) ELSE 0 END), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year)
                    WHEN LOWER(fd.department_key) = 'trung tâm phát triển đối tác và bảo hiểm' THEN
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" = 'BV/PK-BHTM') /
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" = 'BV/PK-BHTM')
                    WHEN LOWER(fd.department_key) = 'trung tâm khdn' THEN
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" = 'KSK') /
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" = 'KSK')
                    WHEN LOWER(fd.department_key) = 'trung tâm khách hàng chiến lược và dự án y tế' THEN
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" = 'TN-BV GM') /
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" = 'TN-BV GM')
                    WHEN LOWER(fd.department_key) = 'trung tâm tại nhà toàn quốc' THEN
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('CTCĐ', 'TN-CSPK', 'TN-CN/TC')
                         AND dt."Tên Đơn vị" = 'Med Cầu Giấy') /
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('CTCĐ', 'TN-CSPK', 'TN-CN/TC')
                         AND dt."Tên Đơn vị" = 'Med Cầu Giấy')
                    WHEN LOWER(fd.department_key) = 'trung tâm kinh doanh bv/pk' THEN
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')) /
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC'))
                    WHEN LOWER(fd.department_key) = 'ban kế hoạch' THEN
                        (SELECT 
                            COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0) - 
                            COALESCE(SUM(CASE WHEN dt."Khối DTQL" = 'ĐVTV' THEN CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC) ELSE 0 END), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year) /
                        (SELECT 
                            COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0) - 
                            COALESCE(SUM(CASE WHEN dt."Khối DTQL" = 'ĐVTV' THEN CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC) ELSE 0 END), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year)
                    WHEN LOWER(fd.department_key) = 'hệ thống kcb ngoại viện' THEN
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" = 'KSK') /
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" = 'KSK')
                    WHEN LOWER(fd.department_key) = 'bệnh viện đa khoa medlatec' THEN
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                         AND (dt."Tên Đơn vị" = 'Medlatec Ba Đình' OR dt."Tên Đơn vị" = 'Med Ba Đình' OR dt."Tên Đơn vị" = 'Bệnh viện đa khoa Medlatec')) /
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                         AND (dt."Tên Đơn vị" = 'Medlatec Ba Đình' OR dt."Tên Đơn vị" = 'Med Ba Đình' OR dt."Tên Đơn vị" = 'Bệnh viện đa khoa Medlatec'))
                    WHEN LOWER(fd.department_key) = 'phòng khám đa khoa tây hồ' THEN
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                         AND dt."Tên Đơn vị" = 'Med Tây Hồ') /
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                         AND dt."Tên Đơn vị" = 'Med Tây Hồ')
                    WHEN LOWER(fd.department_key) = 'phòng khám đa khoa cầu giấy' THEN
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                         AND dt."Tên Đơn vị" = 'Med Cầu Giấy') /
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                         AND dt."Tên Đơn vị" = 'Med Cầu Giấy')
                    WHEN LOWER(fd.department_key) = 'phòng khám đa khoa thanh xuân' THEN
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                         AND dt."Tên Đơn vị" = 'Med Thanh Xuân') /
                        (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                         FROM "Doanh_thu" dt 
                         WHERE dt."Tháng" = month_doanh_thu_str 
                         AND dt."Năm" = p_filter_year
                         AND dt."Khối DTQL" IN ('BV/PK-BHTM', 'BV/PK-CN/TC')
                         AND dt."Tên Đơn vị" = 'Med Thanh Xuân')
                    ELSE (SELECT COALESCE(SUM(CAST(REPLACE(dt."Kỳ báo cáo"::text, ',', '') AS NUMERIC)), 0)
                          FROM "Doanh_thu" dt 
                          WHERE dt."Tháng" = month_doanh_thu_str 
                          AND dt."Năm" = p_filter_year) /
                         (SELECT COALESCE(SUM(CAST(REPLACE(dt."Chỉ tiêu"::text, ',', '') AS NUMERIC)), 0)
                 FROM "Doanh_thu" dt 
                 WHERE dt."Tháng" = month_doanh_thu_str 
                 AND dt."Năm" = p_filter_year)
                END)
            ELSE 0
        END AS ty_le_hoan_thanh,
        -- Quỹ lương chuẩn = KPI_quy_luong_2025 / 12 theo Địa điểm_ngành dọc
        (SELECT COALESCE(CAST(REPLACE(ct."KPI_quy_luong_2025"::text, ',', '') AS NUMERIC) / 12, 0)
         FROM "Chi_tieu_2025" ct
         WHERE TRIM(LOWER(
             (string_to_array(ct."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(ct."Địa điểm_ngành dọc", '>'), 1)]
         )) = LOWER(fd.department_key)
         AND ct."Loại" = 'Hà Nội'
         LIMIT 1) AS quy_luong_chuan
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

-- Test function - Kiểm tra các đơn vị đặc biệt và gộp KHDN
SELECT * FROM get_simple_monthly_salary_hanoi(2025, 7) 
WHERE LOWER(department_name) IN (
    'phòng kế toán med vn',
    'trung tâm phát triển đối tác và bảo hiểm',
    'trung tâm khdn',
    'trung tâm khách hàng chiến lược và dự án y tế'
)
ORDER BY department_name;

-- Kiểm tra xem còn các Trung tâm KHDN riêng lẻ không
SELECT * FROM get_simple_monthly_salary_hanoi(2025, 7) 
WHERE LOWER(department_name) LIKE '%khdn%'
ORDER BY department_name;
