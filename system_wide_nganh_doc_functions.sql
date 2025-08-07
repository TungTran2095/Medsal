-- SQL Functions for System-Wide Nganh Doc Comparison Table
-- These functions support filtering by nganh_doc and don_vi_2 parameters

-- Function: get_nganhdoc_ft_salary_hanoi_with_filter
-- Returns FT salary data for all units with nganh_doc filtering
DROP FUNCTION IF EXISTS get_nganhdoc_ft_salary_hanoi_with_filter(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_nganhdoc_ft_salary_hanoi_with_filter(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_nganh_docs TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    nganh_doc_key TEXT,
    ft_salary NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH normalized_nganh_doc AS (
        SELECT 
            f.*,
            -- Chuẩn hóa tên ngành dọc: loại bỏ khoảng trắng thừa, chuyển về chữ thường
            TRIM(LOWER(COALESCE(f.nganh_doc, 'Chưa phân loại'))) AS normalized_nganh_doc
        FROM "Fulltime" f
        WHERE
            (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                regexp_replace(f.thang, '\D', '', 'g')::INTEGER = ANY(p_filter_months)
            )
            AND (
                p_filter_nganh_docs IS NULL OR
                array_length(p_filter_nganh_docs, 1) IS NULL OR
                array_length(p_filter_nganh_docs, 1) = 0 OR
                f.nganh_doc = ANY(p_filter_nganh_docs)
            )
    ),
    unique_nganh_doc AS (
        SELECT 
            normalized_nganh_doc AS doc_key,
            SUM(CAST(REPLACE(tong_thu_nhap::text, ',', '') AS NUMERIC)) AS salary_amount
        FROM normalized_nganh_doc
        GROUP BY normalized_nganh_doc
    )
    SELECT doc_key AS nganh_doc_key, salary_amount AS ft_salary
    FROM unique_nganh_doc
    ORDER BY doc_key;
END;
$$;

-- Function: get_donvi2_pt_salary_with_filter
-- Returns PT salary data with don_vi_2 filtering
DROP FUNCTION IF EXISTS get_donvi2_pt_salary_with_filter(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_donvi2_pt_salary_with_filter(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_donvi2 TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    don_vi_2_key TEXT,
    pt_salary NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH normalized_don_vi_2 AS (
        SELECT 
            pt.*,
            -- Chuẩn hóa tên đơn vị 2: loại bỏ khoảng trắng thừa, chuyển về chữ thường
            TRIM(LOWER(COALESCE(pt."Don vi  2", 'Chưa phân loại'))) AS normalized_don_vi_2
        FROM "Parttime" pt
        WHERE
            (p_filter_year IS NULL OR pt."Nam"::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                regexp_replace(pt."Thoi gian", '\D', '', 'g')::INTEGER = ANY(p_filter_months)
            )
            AND (
                p_filter_donvi2 IS NULL OR
                array_length(p_filter_donvi2, 1) IS NULL OR
                array_length(p_filter_donvi2, 1) = 0 OR
                pt."Don vi  2" = ANY(p_filter_donvi2)
            )
    ),
    unique_don_vi_2 AS (
        SELECT 
            normalized_don_vi_2 AS unit_key,
            SUM(CAST(REPLACE("Tong tien"::text, ',', '') AS NUMERIC)) AS salary_amount
        FROM normalized_don_vi_2
        GROUP BY normalized_don_vi_2
    )
    SELECT unit_key AS don_vi_2_key, salary_amount AS pt_salary
    FROM unique_don_vi_2
    ORDER BY unit_key;
END;
$$;
