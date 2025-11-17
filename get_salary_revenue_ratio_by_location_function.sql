-- Function: get_salary_revenue_ratio_by_location
-- Returns salary-to-revenue ratio data for each location with allowed ratio
DROP FUNCTION IF EXISTS get_salary_revenue_ratio_by_location(INTEGER, INTEGER[], TEXT[], TEXT[], TEXT[]);
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
          -- Loại bỏ các địa điểm không cần thiết
          AND f.dia_diem IS NOT NULL
          AND f.dia_diem NOT IN ('Medim', 'Medlatec Group', 'Med Mê Linh', 'Medcom', 'Medon')
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
          -- Loại bỏ các địa điểm không cần thiết
          AND pt."Don vi" IS NOT NULL
          AND pt."Don vi" NOT IN ('Medim', 'Medlatec Group', 'Med Mê Linh', 'Medcom', 'Medon')
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
          -- Loại bỏ các địa điểm không cần thiết
          AND dr."Tên Đơn vị" IS NOT NULL
          AND dr."Tên Đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group', 'Medim', 'Medlatec Group', 'Med Mê Linh')
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
    salary_revenue_data_raw AS (
        SELECT
            al.loc_name AS ten_don_vi,
            COALESCE(fts.total_ft_salary, 0) AS tong_luong_fulltime,
            COALESCE(pts.total_pt_salary, 0) AS tong_luong_parttime,
            COALESCE(fts.total_ft_salary, 0) + COALESCE(pts.total_pt_salary, 0) AS tong_luong,
            COALESCE(rev.total_revenue, 0) AS doanh_thu
        FROM all_locations al
        LEFT JOIN ft_salaries_by_loc fts ON al.loc_name = fts.loc_name
        LEFT JOIN pt_salaries_by_loc pts ON al.loc_name = pts.loc_name
        LEFT JOIN revenue_by_loc rev ON al.loc_name = rev.loc_name
        -- Loại bỏ các địa điểm không cần thiết
        WHERE al.loc_name NOT IN ('Medim', 'Medlatec Group', 'Med Mê Linh', 'Medcom', 'Medon')
    ),
    salary_revenue_data AS (
        SELECT
            -- Gộp các địa điểm theo yêu cầu
            CASE 
                WHEN ten_don_vi IN ('Med Huế', 'Med Đà Nẵng') THEN 'Med Huda'
                WHEN ten_don_vi IN ('Med TP.HCM', 'Med Bình Dương', 'Med Đồng Nai', 'Med Bình Phước') THEN 'Med Đông Nam Bộ'
                ELSE ten_don_vi
            END AS ten_don_vi,
            SUM(tong_luong_fulltime) AS tong_luong_fulltime,
            SUM(tong_luong_parttime) AS tong_luong_parttime,
            SUM(tong_luong) AS tong_luong,
            SUM(doanh_thu) AS doanh_thu,
            CASE
                WHEN SUM(doanh_thu) = 0 THEN 0.0
                ELSE SUM(tong_luong) / SUM(doanh_thu)
            END AS ty_le_luong_doanh_thu,
            CASE
                WHEN SUM(doanh_thu) = 0 THEN 0.0
                ELSE SUM(tong_luong_fulltime) / SUM(doanh_thu)
            END AS ty_le_fulltime_doanh_thu
        FROM salary_revenue_data_raw
        GROUP BY CASE 
            WHEN ten_don_vi IN ('Med Huế', 'Med Đà Nẵng') THEN 'Med Huda'
            WHEN ten_don_vi IN ('Med TP.HCM', 'Med Bình Dương', 'Med Đồng Nai', 'Med Bình Phước') THEN 'Med Đông Nam Bộ'
            ELSE ten_don_vi
        END
    ),
    kpi_data_by_location_raw AS (
        -- Nhóm dữ liệu từ Chi_tieu_2025 theo tên địa điểm cuối cùng và tổng hợp KPI_quy_luong_2025 và Chi_tieu_DT
        SELECT
            TRIM(
                (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
            ) AS loc_name,
            SUM(
                CASE 
                    WHEN k."KPI_quy_luong_2025" IS NULL OR k."KPI_quy_luong_2025"::text = '' THEN 0
                    WHEN REPLACE(k."KPI_quy_luong_2025"::text, ',', '') ~ '^-?[0-9]+\.?[0-9]*$' THEN
                        CAST(REPLACE(k."KPI_quy_luong_2025"::text, ',', '') AS NUMERIC)
                    ELSE 0
                END
            ) AS total_kpi_quy_luong_2025,
            SUM(
                CASE 
                    WHEN k."Chi_tieu_DT" IS NULL OR k."Chi_tieu_DT"::text = '' THEN 0
                    WHEN REPLACE(k."Chi_tieu_DT"::text, ',', '') ~ '^-?[0-9]+\.?[0-9]*$' THEN
                        CAST(REPLACE(k."Chi_tieu_DT"::text, ',', '') AS NUMERIC)
                    ELSE 0
                END
            ) AS total_chi_tieu_dt
        FROM "Chi_tieu_2025" k
        WHERE k."Địa điểm_ngành dọc" IS NOT NULL
          AND k."Địa điểm_ngành dọc" != ''
          AND array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1) IS NOT NULL
          AND TRIM(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
          ) IS NOT NULL
          AND TRIM(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
          ) != ''
          AND TRIM(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
          ) NOT IN ('Medim', 'Medlatec Group', 'Med Mê Linh', 'Medcom', 'Medon')
        GROUP BY TRIM(
            (string_to_array(k."Địa điểm_ngành dọc", '>'))[array_length(string_to_array(k."Địa điểm_ngành dọc", '>'), 1)]
        )
    ),
    kpi_data_by_location AS (
        SELECT
            -- Gộp các địa điểm theo yêu cầu
            CASE 
                WHEN loc_name IN ('Med Huế', 'Med Đà Nẵng') THEN 'Med Huda'
                WHEN loc_name IN ('Med TP.HCM', 'Med Bình Dương', 'Med Đồng Nai', 'Med Bình Phước') THEN 'Med Đông Nam Bộ'
                ELSE loc_name
            END AS loc_name_key,
            SUM(total_kpi_quy_luong_2025) AS total_kpi_quy_luong_2025,
            SUM(total_chi_tieu_dt) AS total_chi_tieu_dt
        FROM kpi_data_by_location_raw
        GROUP BY CASE 
            WHEN loc_name IN ('Med Huế', 'Med Đà Nẵng') THEN 'Med Huda'
            WHEN loc_name IN ('Med TP.HCM', 'Med Bình Dương', 'Med Đồng Nai', 'Med Bình Phước') THEN 'Med Đông Nam Bộ'
            ELSE loc_name
        END
    )
    SELECT
        srd.ten_don_vi,
        srd.tong_luong_fulltime,
        srd.tong_luong_parttime,
        srd.tong_luong,
        srd.doanh_thu,
        srd.ty_le_luong_doanh_thu,
        srd.ty_le_fulltime_doanh_thu,
        -- QL/DT được phép = KPI_quy_luong_2025 / Chi_tieu_DT (giống bảng duyệt quỹ lương các tỉnh tháng)
        CASE
            WHEN COALESCE(kpi.total_chi_tieu_dt, 0) > 0 
            THEN COALESCE(kpi.total_kpi_quy_luong_2025, 0) / kpi.total_chi_tieu_dt
            ELSE 0
        END AS ty_le_ql_dt_duoc_phep
    FROM salary_revenue_data srd
    LEFT JOIN kpi_data_by_location kpi ON LOWER(srd.ten_don_vi) = LOWER(kpi.loc_name_key)
    WHERE srd.tong_luong > 0 OR srd.doanh_thu > 0
    ORDER BY srd.ty_le_luong_doanh_thu DESC;
END;
$$;
