# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Supabase Setup

This application interacts with a Supabase database. Some features, like listing database tables in the Workspace or displaying dashboard analytics, require specific SQL functions to be present in your Supabase project.

### Required SQL Functions

To create these functions:

1.  Go to your Supabase Project.
2.  Navigate to the **SQL Editor** (usually found in the left sidebar).
3.  Click on **New query** (or "+ New query").
4.  For each function below, **carefully copy the ENTIRE SQL code block provided** (from `CREATE OR REPLACE FUNCTION` down to the final `$$;`) and paste it into the editor.
    *   **VERY IMPORTANT for "unterminated dollar-quoted string" errors:**
        *   Ensure your selection is exact.
        *   **Before clicking RUN, visually inspect the pasted code in the Supabase SQL Editor. If the editor has automatically added any comments (lines starting with `--`, like `-- source: dashboard...`) at the very end of the function block (especially after the `END;` line but before the final `$$;`), you MUST manually delete those comments from the editor before running the SQL. Otherwise, you will get an "unterminated dollar-quoted string" error.**
5.  Click **Run** for each function.
    *   **For `get_monthly_salary_trend_fulltime`, `get_monthly_salary_trend_parttime`, `get_monthly_revenue_trend`, `get_salary_revenue_ratio_components_by_location`, `get_location_comparison_metrics`, `get_nganhdoc_ft_salary_hanoi`, `get_donvi2_pt_salary`, `get_monthly_employee_trend_fulltime`, `get_monthly_ft_salary_revenue_per_employee_trend`, `get_total_workdays_fulltime`, `get_ft_workload_efficiency_by_location`, or `get_detailed_employee_salary_data`**: If you encounter an error like "cannot change return type of existing function" or "function with specified name and arguments already exists", you MUST first run `DROP FUNCTION function_name(parameters);` (e.g., `DROP FUNCTION get_monthly_salary_trend_fulltime(integer, text[], text[]);` or `DROP FUNCTION get_location_comparison_metrics(integer, integer[], text[]);` or `DROP FUNCTION get_nganhdoc_ft_salary_hanoi(INTEGER, INTEGER[]);` or `DROP FUNCTION get_monthly_employee_trend_fulltime(INTEGER, TEXT[], TEXT[]);` or `DROP FUNCTION get_monthly_ft_salary_revenue_per_employee_trend(INTEGER, TEXT[], TEXT[]);` or `DROP FUNCTION get_total_workdays_fulltime(INTEGER, INTEGER[], TEXT[], TEXT[]);` or `DROP FUNCTION get_ft_workload_efficiency_by_location(INTEGER, INTEGER[], TEXT[], TEXT[]);` or `DROP FUNCTION get_detailed_employee_salary_data(INTEGER, INTEGER[], TEXT[], TEXT[], INTEGER, INTEGER);`) and then run the `CREATE OR REPLACE FUNCTION` script for it.

#### `get_public_tables`

This function is used by the application to retrieve a list of tables from your public schema in Supabase. If this function is missing, you will see an error in the Workspace when it tries to load the table list.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE (table_name text)
LANGUAGE SQL
AS $$
  SELECT tablename::text FROM pg_catalog.pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
$$;
```

#### `get_employee_count_fulltime`

This function is used by the Payroll Dashboard to count the number of distinct full-time employees (`ma_nhan_vien` from the `Fulltime` table), with optional filters for a selected year, an array of months, an array of location names (`dia_diem`), and an array of `nganh_doc` names. It correctly parses text-based month columns.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_employee_count_fulltime(INTEGER, INTEGER[], TEXT[], TEXT[]);
CREATE OR REPLACE FUNCTION get_employee_count_fulltime(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL,
    filter_locations TEXT[] DEFAULT NULL,
    filter_nganh_docs TEXT[] DEFAULT NULL
)
RETURNS INTEGER -- Returns a count, so INTEGER or BIGINT
LANGUAGE SQL
AS $$
  SELECT COUNT(DISTINCT f.ma_nhan_vien)::INTEGER
  FROM "Fulltime" f
  WHERE (filter_year IS NULL OR f.nam::INTEGER = filter_year)
    AND (
        filter_months IS NULL OR
        array_length(filter_months, 1) IS NULL OR
        array_length(filter_months, 1) = 0 OR
        regexp_replace(f.thang, '\D', '', 'g')::INTEGER = ANY(filter_months)
    )
    AND (
        filter_locations IS NULL OR
        array_length(filter_locations, 1) IS NULL OR
        array_length(filter_locations, 1) = 0 OR
        f.dia_diem = ANY(filter_locations)
    )
    AND (
        filter_nganh_docs IS NULL OR
        array_length(filter_nganh_docs, 1) IS NULL OR
        array_length(filter_nganh_docs, 1) = 0 OR
        f.nganh_doc = ANY(filter_nganh_docs)
    );
$$;
```

#### `get_total_salary_fulltime`

This function is used by the Payroll Dashboard to calculate the total sum of `tong_thu_nhap` from the `Fulltime` table, with optional filters for a selected year, an array of months, an array of location names, and an array of `nganh_doc` names. It correctly parses text-based month columns (e.g., "Tháng 01") into integers.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_total_salary_fulltime(INTEGER, INTEGER[], TEXT[], TEXT[]);
CREATE OR REPLACE FUNCTION get_total_salary_fulltime(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL,
    filter_locations TEXT[] DEFAULT NULL,
    filter_nganh_docs TEXT[] DEFAULT NULL -- Added
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  SELECT SUM(CAST(REPLACE(tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION))
  FROM "Fulltime" f -- Added alias f
  WHERE (filter_year IS NULL OR f.nam::INTEGER = filter_year)
    AND (
        filter_months IS NULL OR
        array_length(filter_months, 1) IS NULL OR
        array_length(filter_months, 1) = 0 OR
        regexp_replace(f.thang, '\D', '', 'g')::INTEGER = ANY(filter_months)
    )
    AND ( 
        filter_locations IS NULL OR
        array_length(filter_locations, 1) IS NULL OR
        array_length(filter_locations, 1) = 0 OR
        f.dia_diem = ANY(filter_locations)
    )
    AND ( -- Added nganh_doc filter
        filter_nganh_docs IS NULL OR
        array_length(filter_nganh_docs, 1) IS NULL OR
        array_length(filter_nganh_docs, 1) = 0 OR
        f.nganh_doc = ANY(filter_nganh_docs)
    );
$$;
```

#### `get_total_salary_parttime`

This function is used by the Payroll Dashboard to calculate the total sum of `"Tong tien"` from the `Parttime` table, with optional filters for a selected year, an array of months, an array of location names, and an array of `"Don vi 2"` names. It correctly parses text-based month columns (e.g., "Tháng 01") into integers. It assumes the `Parttime` table has `"Nam"` (INTEGER for year), `"Thoi gian"` (TEXT for month description), `"Don vi"` (TEXT for location), and `"Don_vi_2"` (TEXT for secondary unit) columns.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_total_salary_parttime(INTEGER, INTEGER[], TEXT[], TEXT[]);
CREATE OR REPLACE FUNCTION get_total_salary_parttime(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL,
    filter_locations TEXT[] DEFAULT NULL,
    filter_donvi2 TEXT[] DEFAULT NULL -- Added
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  SELECT SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS DOUBLE PRECISION))
  FROM "Parttime" pt
  WHERE (filter_year IS NULL OR pt."Nam"::INTEGER = filter_year)
    AND (
        filter_months IS NULL OR
        array_length(filter_months, 1) IS NULL OR
        array_length(filter_months, 1) = 0 OR
        regexp_replace(pt."Thoi gian", '\D', '', 'g')::INTEGER = ANY(filter_months)
    )
    AND ( 
        filter_locations IS NULL OR
        array_length(filter_locations, 1) IS NULL OR
        array_length(filter_locations, 1) = 0 OR
        pt."Don vi" = ANY(filter_locations)
    )
    AND ( -- Added Don_vi_2 filter
        filter_donvi2 IS NULL OR
        array_length(filter_donvi2, 1) IS NULL OR
        array_length(filter_donvi2, 1) = 0 OR
        pt."Don_vi_2" = ANY(filter_donvi2) -- Assuming the column is named "Don_vi_2"
    );
$$;
```

#### `get_total_revenue`

This function is used by the Payroll Dashboard to calculate the total sum of "Kỳ báo cáo" from the "Doanh_thu" table, with optional filters for a selected year, an array of months, and an array of location names. It assumes "Doanh_thu" table has `"Năm"` (integer for year), `"Tháng"` (text for month), and "Tên đơn vị" (text for location) columns. Rows where "Tên đơn vị" is "Medcom", "Medon", "Medicons", "Meddom", or "Med Group" are excluded.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_total_revenue(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_total_revenue(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL,
    filter_locations TEXT[] DEFAULT NULL 
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  SELECT SUM(CAST(REPLACE(dr."Kỳ báo cáo"::text, ',', '') AS DOUBLE PRECISION))
  FROM "Doanh_thu" dr
  WHERE (filter_year IS NULL OR dr."Năm"::INTEGER = filter_year)
    AND (
        filter_months IS NULL OR
        array_length(filter_months, 1) IS NULL OR
        array_length(filter_months, 1) = 0 OR
        regexp_replace(dr."Tháng", '\D', '', 'g')::INTEGER = ANY(filter_months)
    )
    AND dr."Tên đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group')
    AND ( 
        filter_locations IS NULL OR
        array_length(filter_locations, 1) IS NULL OR
        array_length(filter_locations, 1) = 0 OR
        EXISTS (SELECT 1 FROM unnest(filter_locations) AS flocs WHERE LOWER(dr."Tên đơn vị") = LOWER(flocs)) -- Case-insensitive comparison
    );
$$;
```

#### `get_total_workdays_fulltime`

This function calculates the total sum of specified workday columns from the `Fulltime` table, with optional filters for year, months, locations (`dia_diem`), and `nganh_doc`. It's used for calculating "Lương/Công" and "Doanh thu/Công".

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_total_workdays_fulltime(INTEGER, INTEGER[], TEXT[], TEXT[]);
CREATE OR REPLACE FUNCTION get_total_workdays_fulltime(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL,
    filter_locations TEXT[] DEFAULT NULL,
    filter_nganh_docs TEXT[] DEFAULT NULL
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  SELECT SUM(
    COALESCE(f.ngay_thuong_chinh_thuc, 0) +
    COALESCE(f.ngay_thuong_thu_viec, 0) +
    COALESCE(f.nghi_tuan, 0) +
    COALESCE(f.le_tet, 0) +
    COALESCE(f.ngay_thuong_chinh_thuc2, 0) +
    COALESCE(f.ngay_thuong_thu_viec3, 0) +
    COALESCE(f.nghi_tuan4, 0) +
    COALESCE(f.le_tet5, 0) +
    COALESCE(f.nghi_nl, 0)
  )::DOUBLE PRECISION
  FROM "Fulltime" f
  WHERE (filter_year IS NULL OR f.nam::INTEGER = filter_year)
    AND (
        filter_months IS NULL OR
        array_length(filter_months, 1) IS NULL OR
        array_length(filter_months, 1) = 0 OR
        regexp_replace(f.thang, '\D', '', 'g')::INTEGER = ANY(filter_months)
    )
    AND (
        filter_locations IS NULL OR
        array_length(filter_locations, 1) IS NULL OR
        array_length(filter_locations, 1) = 0 OR
        f.dia_diem = ANY(filter_locations)
    )
    AND (
        filter_nganh_docs IS NULL OR
        array_length(filter_nganh_docs, 1) IS NULL OR
        array_length(filter_nganh_docs, 1) = 0 OR
        f.nganh_doc = ANY(filter_nganh_docs)
    );
$$;
```

#### `get_monthly_salary_trend_fulltime`

This function is used by the Payroll Dashboard to fetch the total salary (`tong_thu_nhap` from "Fulltime" table) aggregated per month and year, for a given year, optional list of locations, and optional list of `nganh_doc`. The X-axis of the chart will use the `Thang_x` column from your `Time` table.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_monthly_salary_trend_fulltime(INTEGER, TEXT[], TEXT[]);
CREATE OR REPLACE FUNCTION get_monthly_salary_trend_fulltime(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL,
    p_filter_nganh_docs TEXT[] DEFAULT NULL -- Added
)
RETURNS TABLE(
    month_label TEXT,
    year_val INTEGER,
    total_salary DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t."Thang_x" AS month_label,
        f.nam::INTEGER AS year_val,
        SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) AS total_salary
    FROM
        "Fulltime" f
    INNER JOIN
        "Time" t ON f.nam::INTEGER = t."Năm"::INTEGER
                 AND f.thang = t."Thang_x"
    WHERE
        (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
        AND ( 
            p_filter_locations IS NULL OR
            array_length(p_filter_locations, 1) IS NULL OR
            array_length(p_filter_locations, 1) = 0 OR
            f.dia_diem = ANY(p_filter_locations)
        )
        AND ( -- Added nganh_doc filter
            p_filter_nganh_docs IS NULL OR
            array_length(p_filter_nganh_docs, 1) IS NULL OR
            array_length(p_filter_nganh_docs, 1) = 0 OR
            f.nganh_doc = ANY(p_filter_nganh_docs)
        )
    GROUP BY
        f.nam::INTEGER,
        t."Thang_x",
        t.thangpro
    ORDER BY
        f.nam::INTEGER,
        regexp_replace(t.thangpro, '\D', '', 'g')::INTEGER;
END;
$$;
```

#### `get_monthly_salary_trend_parttime`

This function is used by the Payroll Dashboard to fetch the total part-time salary (`"Tong tien"` from "Parttime" table) aggregated per month and year, for a given year, optional list of locations, and optional list of `"Don vi 2"`. The X-axis of the chart will use the `Thang_x` column from your `Time` table. It assumes "Parttime" has columns `"Nam"` (INTEGER), `"Thoi gian"` (TEXT), `"Don vi"` (TEXT), and `"Don_vi_2"` (TEXT).

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_monthly_salary_trend_parttime(INTEGER, TEXT[], TEXT[]);
CREATE OR REPLACE FUNCTION get_monthly_salary_trend_parttime(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL,
    p_filter_donvi2 TEXT[] DEFAULT NULL -- Added
)
RETURNS TABLE(
    month_label TEXT,
    year_val INTEGER,
    total_salary DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t."Thang_x" AS month_label,
        pt."Nam"::INTEGER AS year_val,
        SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS DOUBLE PRECISION)) AS total_salary
    FROM
        "Parttime" pt
    INNER JOIN
        "Time" t ON pt."Nam"::INTEGER = t."Năm"::INTEGER
                 AND pt."Thoi gian" = t."Thang_x"
    WHERE
        (p_filter_year IS NULL OR pt."Nam"::INTEGER = p_filter_year)
        AND ( 
            p_filter_locations IS NULL OR
            array_length(p_filter_locations, 1) IS NULL OR
            array_length(p_filter_locations, 1) = 0 OR
            pt."Don vi" = ANY(p_filter_locations)
        )
        AND ( -- Added Don_vi_2 filter
            p_filter_donvi2 IS NULL OR
            array_length(p_filter_donvi2, 1) IS NULL OR
            array_length(p_filter_donvi2, 1) = 0 OR
            pt."Don_vi_2" = ANY(p_filter_donvi2) -- Assuming the column is named "Don_vi_2"
        )
    GROUP BY
        pt."Nam"::INTEGER,
        t."Thang_x",
        t.thangpro
    ORDER BY
        pt."Nam"::INTEGER,
        regexp_replace(t.thangpro, '\D', '', 'g')::INTEGER;
END;
$$;
```

#### `get_monthly_revenue_trend`

This function is used by the Payroll Dashboard to fetch the total revenue ("Kỳ báo cáo" from "Doanh_thu" table) aggregated per month and year, for a given year and optional list of locations. It excludes specific "Tên đơn vị" values. The X-axis of the chart will use the `Thang_x` column from your `Time` table. It assumes "Doanh_thu" has columns `"Năm"` (INTEGER), `"Tháng"` (TEXT), and `"Tên đơn vị"` (TEXT).

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_monthly_revenue_trend(INTEGER, TEXT[]);
CREATE OR REPLACE FUNCTION get_monthly_revenue_trend(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL 
)
RETURNS TABLE(
    month_label TEXT,
    year_val INTEGER,
    total_revenue DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t."Thang_x" AS month_label,
        dr."Năm"::INTEGER AS year_val,
        SUM(CAST(REPLACE(dr."Kỳ báo cáo"::text, ',', '') AS DOUBLE PRECISION)) AS total_revenue
    FROM
        "Doanh_thu" dr
    INNER JOIN
        "Time" t ON dr."Năm"::INTEGER = t."Năm"::INTEGER
                 AND dr."Tháng" = t."Thang_x"
    WHERE
        (p_filter_year IS NULL OR dr."Năm"::INTEGER = p_filter_year)
        AND dr."Tên đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group')
        AND ( 
            p_filter_locations IS NULL OR
            array_length(p_filter_locations, 1) IS NULL OR
            array_length(p_filter_locations, 1) = 0 OR
             EXISTS (SELECT 1 FROM unnest(p_filter_locations) AS flocs WHERE LOWER(dr."Tên đơn vị") = LOWER(flocs)) -- Case-insensitive comparison
        )
    GROUP BY
        dr."Năm"::INTEGER,
        t."Thang_x",
        t.thangpro
    ORDER BY
        dr."Năm"::INTEGER,
        regexp_replace(t.thangpro, '\D', '', 'g')::INTEGER;
END;
$$;
```

#### `get_monthly_employee_trend_fulltime`

This function is used by the Payroll Dashboard to fetch the count of distinct full-time employees (`ma_nhan_vien` from "Fulltime" table) aggregated per month and year, for a given year, optional list of locations (`dia_diem`), and optional list of `nganh_doc`. The X-axis of the chart will use the `Thang_x` column from your `Time` table.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_monthly_employee_trend_fulltime(INTEGER, TEXT[], TEXT[]);
CREATE OR REPLACE FUNCTION get_monthly_employee_trend_fulltime(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL,
    p_filter_nganh_docs TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    month_label TEXT,
    year_val INTEGER,
    employee_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t."Thang_x" AS month_label,
        f.nam::INTEGER AS year_val,
        COUNT(DISTINCT f.ma_nhan_vien)::INTEGER AS employee_count
    FROM
        "Fulltime" f
    INNER JOIN
        "Time" t ON f.nam::INTEGER = t."Năm"::INTEGER
                 AND f.thang = t."Thang_x"
    WHERE
        (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
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
        t."Thang_x",
        t.thangpro
    ORDER BY
        f.nam::INTEGER,
        regexp_replace(t.thangpro, '\D', '', 'g')::INTEGER;
END;
$$;
```

#### `get_monthly_ft_salary_revenue_per_employee_trend`

This function calculates the monthly average full-time salary per full-time employee and the monthly revenue per full-time employee. It uses the "Time" table as a backbone and joins aggregated monthly data for full-time salary, revenue, and full-time employee counts. Filters for year, locations, and `nganh_doc` are applied.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_monthly_ft_salary_revenue_per_employee_trend(INTEGER, TEXT[], TEXT[]);
CREATE OR REPLACE FUNCTION get_monthly_ft_salary_revenue_per_employee_trend(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL,
    p_filter_nganh_docs TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    month_label TEXT,
    year_val INTEGER,
    avg_salary_per_employee DOUBLE PRECISION,
    revenue_per_employee DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH monthly_ft_base AS (
        SELECT
            f.nam::INTEGER AS cal_year,
            f.thang AS cal_month_name, 
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) AS total_ft_salary,
            COUNT(DISTINCT f.ma_nhan_vien)::INTEGER AS ft_employee_count
        FROM "Fulltime" f
        WHERE (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
          AND (p_filter_locations IS NULL OR array_length(p_filter_locations, 1) IS NULL OR f.dia_diem = ANY(p_filter_locations))
          AND (p_filter_nganh_docs IS NULL OR array_length(p_filter_nganh_docs, 1) IS NULL OR f.nganh_doc = ANY(p_filter_nganh_docs))
        GROUP BY f.nam::INTEGER, f.thang
    ),
    monthly_revenue_base AS (
        SELECT
            dr."Năm"::INTEGER AS cal_year,
            dr."Tháng" AS cal_month_name,
            SUM(CAST(REPLACE(dr."Kỳ báo cáo"::text, ',', '') AS DOUBLE PRECISION)) AS total_revenue
        FROM "Doanh_thu" dr
        WHERE (p_filter_year IS NULL OR dr."Năm"::INTEGER = p_filter_year)
          AND (p_filter_locations IS NULL OR array_length(p_filter_locations, 1) IS NULL OR EXISTS (SELECT 1 FROM unnest(p_filter_locations) AS flocs WHERE LOWER(dr."Tên đơn vị") = LOWER(flocs))) -- Use case-insensitive EXISTS for revenue location filter
          AND dr."Tên đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group')
        GROUP BY dr."Năm"::INTEGER, dr."Tháng"
    )
    SELECT
        time_ref."Thang_x" AS month_label,
        time_ref."Năm"::INTEGER AS year_val,
        CASE
            WHEN COALESCE(ft.ft_employee_count, 0) = 0 THEN 0
            ELSE COALESCE(ft.total_ft_salary, 0) / ft.ft_employee_count
        END AS avg_salary_per_employee,
        CASE
            WHEN COALESCE(ft.ft_employee_count, 0) = 0 THEN 0
            ELSE COALESCE(rev.total_revenue, 0) / ft.ft_employee_count -- Revenue is divided by FT employee count from monthly_ft_base
        END AS revenue_per_employee
    FROM "Time" time_ref
    LEFT JOIN monthly_ft_base ft
        ON time_ref."Năm"::INTEGER = ft.cal_year AND time_ref."Thang_x" = ft.cal_month_name
    LEFT JOIN monthly_revenue_base rev
        ON time_ref."Năm"::INTEGER = rev.cal_year AND time_ref."Thang_x" = rev.cal_month_name
    WHERE (p_filter_year IS NULL OR time_ref."Năm"::INTEGER = p_filter_year)
    ORDER BY time_ref."Năm"::INTEGER, regexp_replace(time_ref.thangpro, '\D', '', 'g')::INTEGER;
END;
$$;
```

#### `get_salary_revenue_ratio_components_by_location`

This function calculates the full-time and part-time salary components of the salary-to-revenue ratio for each work location, applying optional year, month, and specific location filters.
It unifies location names from `Fulltime.dia_diem`, `Parttime."Don vi"`, and `Doanh_thu."Tên đơn vị"`.
**Note:** If you need this RPC to also filter its results based on `nganh_doc` (from Fulltime) or `Don_vi_2` (from Parttime) for the *purpose of this ratio calculation per location*, the SQL logic of this function would need significant redesign. The current signature does not include parameters for those.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_salary_revenue_ratio_components_by_location(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_salary_revenue_ratio_components_by_location(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL 
)
RETURNS TABLE(
    location_name TEXT,
    ft_salary_ratio_component DOUBLE PRECISION,
    pt_salary_ratio_component DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH
    ft_salaries_by_loc AS (
        SELECT
            COALESCE(f.dia_diem, 'Không xác định') AS loc_name,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) AS total_ft_salary
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
        GROUP BY COALESCE(f.dia_diem, 'Không xác định')
    ),
    pt_salaries_by_loc AS (
        SELECT
            COALESCE(pt."Don vi", 'Không xác định') AS loc_name,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS DOUBLE PRECISION)) AS total_pt_salary
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
        GROUP BY COALESCE(pt."Don vi", 'Không xác định')
    ),
    revenue_by_loc AS (
        SELECT
            COALESCE(dr."Tên đơn vị", 'Không xác định') AS loc_name,
            SUM(CAST(REPLACE(dr."Kỳ báo cáo"::text, ',', '') AS DOUBLE PRECISION)) AS total_revenue
        FROM "Doanh_thu" dr
        WHERE (p_filter_year IS NULL OR dr."Năm"::INTEGER = p_filter_year)
          AND (
              p_filter_months IS NULL OR
              array_length(p_filter_months, 1) IS NULL OR
              array_length(p_filter_months, 1) = 0 OR
              regexp_replace(dr."Tháng", '\D', '', 'g')::INTEGER = ANY(p_filter_months)
          )
          AND dr."Tên đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group')
          AND ( 
              p_filter_locations IS NULL OR
              array_length(p_filter_locations, 1) IS NULL OR
              array_length(p_filter_locations, 1) = 0 OR
             EXISTS (SELECT 1 FROM unnest(p_filter_locations) AS flocs WHERE LOWER(dr."Tên đơn vị") = LOWER(flocs)) -- Case-insensitive comparison
          )
        GROUP BY COALESCE(dr."Tên đơn vị", 'Không xác định')
    ),
    all_locations AS (
        SELECT loc_name FROM ft_salaries_by_loc
        UNION
        SELECT loc_name FROM pt_salaries_by_loc
        UNION
        SELECT loc_name FROM revenue_by_loc
    )
    SELECT
        al.loc_name AS location_name,
        CASE
            WHEN COALESCE(rev.total_revenue, 0) = 0 THEN 0.0
            ELSE COALESCE(fts.total_ft_salary, 0) / rev.total_revenue
        END AS ft_salary_ratio_component,
        CASE
            WHEN COALESCE(rev.total_revenue, 0) = 0 THEN 0.0
            ELSE COALESCE(pts.total_pt_salary, 0) / rev.total_revenue
        END AS pt_salary_ratio_component
    FROM all_locations al
    LEFT JOIN ft_salaries_by_loc fts ON al.loc_name = fts.loc_name
    LEFT JOIN pt_salaries_by_loc pts ON al.loc_name = pts.loc_name
    LEFT JOIN revenue_by_loc rev ON al.loc_name = rev.loc_name
    ORDER BY al.loc_name;
END;
$$;
```

#### `get_location_comparison_metrics`

This function fetches aggregated full-time salary, part-time salary, and total revenue for each location, based on a specified year and optional month/location filters. It's used for the detailed location comparison table.
**Note:** Similar to `get_salary_revenue_ratio_components_by_location`, this RPC aggregates by location. If filtering by `nganh_doc` or `Don_vi_2` is desired here, the SQL logic would need substantial changes. The current signature does not include parameters for those.

**SQL Code:**
```sql
-- Function: get_location_comparison_metrics
DROP FUNCTION IF EXISTS get_location_comparison_metrics(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_location_comparison_metrics(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL 
)
RETURNS TABLE(
    location_name TEXT,
    ft_salary NUMERIC,
    pt_salary NUMERIC,
    total_revenue NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH
    ft_salaries AS (
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
               EXISTS (SELECT 1 FROM unnest(p_filter_locations) AS flocs WHERE LOWER(f.dia_diem) = LOWER(flocs)) -- Case-insensitive
          )
        GROUP BY COALESCE(f.dia_diem, 'Không xác định')
    ),
    pt_salaries AS (
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
               EXISTS (SELECT 1 FROM unnest(p_filter_locations) AS flocs WHERE LOWER(pt."Don vi") = LOWER(flocs)) -- Case-insensitive
          )
        GROUP BY COALESCE(pt."Don vi", 'Không xác định')
    ),
    revenues AS (
        SELECT
            COALESCE(dr."Tên đơn vị", 'Không xác định') AS loc_name,
            SUM(CAST(REPLACE(dr."Kỳ báo cáo"::text, ',', '') AS NUMERIC)) AS total_rev
        FROM "Doanh_thu" dr
        WHERE (p_filter_year IS NULL OR dr."Năm"::INTEGER = p_filter_year)
          AND (
              p_filter_months IS NULL OR
              array_length(p_filter_months, 1) IS NULL OR
              array_length(p_filter_months, 1) = 0 OR
              regexp_replace(dr."Tháng", '\D', '', 'g')::INTEGER = ANY(p_filter_months)
          )
          AND dr."Tên đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group')
          AND ( 
              p_filter_locations IS NULL OR
              array_length(p_filter_locations, 1) IS NULL OR
              array_length(p_filter_locations, 1) = 0 OR
              EXISTS (SELECT 1 FROM unnest(p_filter_locations) AS flocs WHERE LOWER(dr."Tên đơn vị") = LOWER(flocs)) -- Case-insensitive
          )
        GROUP BY COALESCE(dr."Tên đơn vị", 'Không xác định')
    ),
    all_locs AS ( 
        SELECT loc_name FROM ft_salaries
        UNION
        SELECT loc_name FROM pt_salaries
        UNION
        SELECT loc_name FROM revenues
    )
    SELECT
        al.loc_name,
        COALESCE(fts.total_ft_salary, 0) AS ft_salary,
        COALESCE(pts.total_pt_salary, 0) AS pt_salary,
        COALESCE(r.total_rev, 0) AS total_revenue
    FROM all_locs al
    LEFT JOIN ft_salaries fts ON al.loc_name = fts.loc_name
    LEFT JOIN pt_salaries pts ON al.loc_name = pts.loc_name
    LEFT JOIN revenues r ON al.loc_name = r.loc_name
    ORDER BY al.loc_name;
END;
$$;
```

#### `get_nganhdoc_ft_salary_hanoi`

This function fetches aggregated full-time salary by `nganh_doc` for entities located in 'Hà Nội' (based on `hn_or_note` column in `Fulltime` table), for a specified year and optional months.

**SQL Code:**
```sql
-- Function: get_nganhdoc_ft_salary_hanoi
DROP FUNCTION IF EXISTS get_nganhdoc_ft_salary_hanoi(INTEGER, INTEGER[]);
CREATE OR REPLACE FUNCTION get_nganhdoc_ft_salary_hanoi(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL
)
RETURNS TABLE(
    nganh_doc_key TEXT,
    ft_salary NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH unique_nganh_doc AS (
        SELECT DISTINCT ON (COALESCE(f.nganh_doc, 'Chưa phân loại'))
            COALESCE(f.nganh_doc, 'Chưa phân loại') AS nganh_doc_key,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS NUMERIC)) AS ft_salary
        FROM "Fulltime" f
        WHERE
            (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                regexp_replace(f.thang, '\D', '', 'g')::INTEGER = ANY(p_filter_months)
            )
            AND f.hn_or_note = 'Hà Nội' -- Specific filter for Hanoi
        GROUP BY COALESCE(f.nganh_doc, 'Chưa phân loại')
    )
    SELECT nganh_doc_key, ft_salary
    FROM unique_nganh_doc
    ORDER BY nganh_doc_key;
END;
$$;
```

#### `get_donvi2_pt_salary`

This function fetches aggregated part-time salary by `Don_vi_2` (from `Parttime` table), for a specified year and optional months. Assumes the column in `Parttime` table is named `Don_vi_2`.

**SQL Code:**
```sql
-- Function: get_donvi2_pt_salary
DROP FUNCTION IF EXISTS get_donvi2_pt_salary(INTEGER, INTEGER[]);
CREATE OR REPLACE FUNCTION get_donvi2_pt_salary(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL
)
RETURNS TABLE(
    don_vi_2_key TEXT,
    pt_salary NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH unique_don_vi_2 AS (
        SELECT DISTINCT ON (COALESCE(pt."Don_vi_2", 'Chưa phân loại'))
            COALESCE(pt."Don_vi_2", 'Chưa phân loại') AS don_vi_2_key,
            SUM(CAST(REPLACE(pt."Tong tien"::text, ',', '') AS NUMERIC)) AS pt_salary
        FROM "Parttime" pt
        WHERE
            (p_filter_year IS NULL OR pt."Nam"::INTEGER = p_filter_year)
            AND (
                p_filter_months IS NULL OR
                array_length(p_filter_months, 1) IS NULL OR
                array_length(p_filter_months, 1) = 0 OR
                regexp_replace(pt."Thoi gian", '\D', '', 'g')::INTEGER = ANY(p_filter_months)
            )
        GROUP BY COALESCE(pt."Don_vi_2", 'Chưa phân loại')
    )
    SELECT don_vi_2_key, pt_salary
    FROM unique_don_vi_2
    ORDER BY don_vi_2_key;
END;
$$;
```

#### `get_ft_workload_efficiency_by_location`

This function calculates Full-Time Salary per Full-Time Workday, Revenue per Full-Time Workday, and Total Full-Time Workdays for each location (`dia_diem` or `Tên đơn vị`).
It uses filters for year, months, specific locations, and `nganh_doc` (for Fulltime salary & workdays).
Revenue data is joined based on location name, assuming `Fulltime.dia_diem` and `Doanh_thu."Tên đơn vị"` can be aligned.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_ft_workload_efficiency_by_location(INTEGER, INTEGER[], TEXT[], TEXT[]);
CREATE OR REPLACE FUNCTION get_ft_workload_efficiency_by_location(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL,
    p_filter_nganh_docs TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    location_name TEXT,
    ft_salary_per_ft_workday DOUBLE PRECISION,
    revenue_per_ft_workday DOUBLE PRECISION,
    total_ft_workdays DOUBLE PRECISION -- Expected type for column 4
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ft_metrics AS (
        SELECT
            f.dia_diem,
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) AS total_ft_salary,
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
            )::DOUBLE PRECISION AS total_ft_workdays -- Cast sum to DOUBLE PRECISION
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
        GROUP BY f.dia_diem
    ),
    rev_metrics AS (
        SELECT
            dr."Tên đơn vị" AS dia_diem, 
            SUM(CAST(REPLACE(dr."Kỳ báo cáo"::text, ',', '') AS DOUBLE PRECISION)) AS total_revenue
        FROM "Doanh_thu" dr
        WHERE (p_filter_year IS NULL OR dr."Năm"::INTEGER = p_filter_year)
          AND (
              p_filter_months IS NULL OR
              array_length(p_filter_months, 1) IS NULL OR
              array_length(p_filter_months, 1) = 0 OR
              regexp_replace(dr."Tháng", '\D', '', 'g')::INTEGER = ANY(p_filter_months)
          )
          AND dr."Tên đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group')
          AND (
              p_filter_locations IS NULL OR
              array_length(p_filter_locations, 1) IS NULL OR
              array_length(p_filter_locations, 1) = 0 OR
              EXISTS (SELECT 1 FROM unnest(p_filter_locations) AS flocs WHERE LOWER(dr."Tên đơn vị") = LOWER(flocs)) -- Case-insensitive
          )
        GROUP BY dr."Tên đơn vị"
    ),
    all_locations AS (
        SELECT dia_diem FROM ft_metrics
        UNION
        SELECT dia_diem FROM rev_metrics
    )
    SELECT
        al.dia_diem AS location_name,
        COALESCE(fm.total_ft_salary / NULLIF(fm.total_ft_workdays, 0), 0.0::DOUBLE PRECISION) AS ft_salary_per_ft_workday,
        COALESCE(rm.total_revenue / NULLIF(fm.total_ft_workdays, 0), 0.0::DOUBLE PRECISION) AS revenue_per_ft_workday,
        COALESCE(fm.total_ft_workdays, 0.0::DOUBLE PRECISION) AS total_ft_workdays -- Ensures this is DOUBLE PRECISION
    FROM all_locations al
    LEFT JOIN ft_metrics fm ON al.dia_diem = fm.dia_diem
    LEFT JOIN rev_metrics rm ON al.dia_diem = rm.dia_diem
    WHERE COALESCE(fm.total_ft_workdays, 0) > 0; 
END;
$$;
```

#### `get_detailed_employee_salary_data`

This function fetches detailed salary information for full-time employees for a selected period and the corresponding period in the previous year to enable Year-over-Year (YoY) comparison. It returns current year (CY) and previous year (PY) metrics for `tong_cong` (total workdays) and `tien_linh` (earnings), and calculates `tien_linh_per_cong` for both periods.
It also returns `total_records` (unique employees in CY matching filters) and overall sums for `tien_linh_cy` and `tong_cong_cy`.
It supports filtering by year (as CY), months, locations (`dia_diem`), and `nganh_doc`.
If `p_filter_year` is `NULL`, previous year fields will be `NULL`.
It assumes the `Fulltime` table has columns `ma_nhan_vien`, `ho_va_ten`, `tien_linh` (text format, possibly with commas), and all necessary workday columns.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_detailed_employee_salary_data(INTEGER, INTEGER[], TEXT[], TEXT[], INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_detailed_employee_salary_data(
    p_filter_year INTEGER DEFAULT NULL, -- This is the Current Year (CY) for comparison
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL,
    p_filter_nganh_docs TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT NULL,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    ma_nv TEXT,
    ho_ten TEXT,
    tong_cong_cy DOUBLE PRECISION,
    tien_linh_cy DOUBLE PRECISION,
    tien_linh_per_cong_cy DOUBLE PRECISION,
    tong_cong_py DOUBLE PRECISION,
    tien_linh_py DOUBLE PRECISION,
    tien_linh_per_cong_py DOUBLE PRECISION,
    total_records BIGINT, -- Total unique employees in CY matching filters
    overall_sum_tien_linh_cy DOUBLE PRECISION, -- Sum of tien_linh_cy for all matched CY employees
    overall_sum_tong_cong_cy DOUBLE PRECISION -- Sum of tong_cong_cy for all matched CY employees
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_previous_year INTEGER;
BEGIN
    IF p_filter_year IS NOT NULL THEN
        v_previous_year := p_filter_year - 1;
    ELSE
        v_previous_year := NULL; -- No previous year if p_filter_year is NULL
    END IF;

    RETURN QUERY
    WITH base_employee_data AS (
        SELECT
            f.ma_nhan_vien,
            f.ho_va_ten,
            f.nam::INTEGER AS data_year,
            (
                COALESCE(f.ngay_thuong_chinh_thuc, 0) +
                COALESCE(f.ngay_thuong_thu_viec, 0) +
                COALESCE(f.nghi_tuan, 0) +
                COALESCE(f.le_tet, 0) +
                COALESCE(f.ngay_thuong_chinh_thuc2, 0) +
                COALESCE(f.ngay_thuong_thu_viec3, 0) +
                COALESCE(f.nghi_tuan4, 0) +
                COALESCE(f.le_tet5, 0) +
                COALESCE(f.nghi_nl, 0)
            ) AS individual_tong_cong,
            CAST(REPLACE(f.tien_linh::text, ',', '') AS DOUBLE PRECISION) AS individual_tien_linh
        FROM "Fulltime" f
        WHERE 
            (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year OR f.nam::INTEGER = v_previous_year) -- Fetch for CY and PY if CY is given
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
    ),
    grouped_by_employee_year AS (
        SELECT
            bed.ma_nhan_vien,
            MIN(bed.ho_va_ten) AS ho_va_ten_selected, 
            bed.data_year,
            SUM(bed.individual_tong_cong) AS aggregated_tong_cong,
            SUM(bed.individual_tien_linh) AS aggregated_tien_linh
        FROM base_employee_data bed
        GROUP BY bed.ma_nhan_vien, bed.data_year
    ),
    current_year_aggregated AS (
        SELECT * FROM grouped_by_employee_year WHERE data_year = p_filter_year
    ),
    previous_year_aggregated AS (
        SELECT * FROM grouped_by_employee_year WHERE data_year = v_previous_year
    ),
    combined_employee_data AS (
        SELECT
            COALESCE(cya.ma_nhan_vien, pya.ma_nhan_vien) AS ma_nhan_vien,
            COALESCE(cya.ho_va_ten_selected, pya.ho_va_ten_selected) AS ho_va_ten_selected,
            cya.aggregated_tong_cong AS tong_cong_cy,
            cya.aggregated_tien_linh AS tien_linh_cy,
            pya.aggregated_tong_cong AS tong_cong_py,
            pya.aggregated_tien_linh AS tien_linh_py
        FROM current_year_aggregated cya
        FULL OUTER JOIN previous_year_aggregated pya ON cya.ma_nhan_vien = pya.ma_nhan_vien
    ),
    overall_sums_cy AS ( -- Calculate overall sums only for the current year filtered data
        SELECT
            SUM(cya.aggregated_tong_cong) AS total_overall_tong_cong_cy,
            SUM(cya.aggregated_tien_linh) AS total_overall_tien_linh_cy,
            COUNT(cya.ma_nhan_vien) AS total_unique_employees_cy -- Count of employees in CY
        FROM current_year_aggregated cya
    ),
    paginated_employee_data AS (
      SELECT
          ced.ma_nhan_vien,
          ced.ho_va_ten_selected,
          ced.tong_cong_cy,
          ced.tien_linh_cy,
          ced.tong_cong_py,
          ced.tien_linh_py,
          os_cy.total_overall_tong_cong_cy,
          os_cy.total_overall_tien_linh_cy,
          os_cy.total_unique_employees_cy
      FROM combined_employee_data ced
      CROSS JOIN overall_sums_cy os_cy -- Make overall CY sums available to each row before pagination
      ORDER BY ced.ma_nhan_vien
      LIMIT p_limit 
      OFFSET p_offset
    )
    SELECT
        CAST(ped.ma_nhan_vien AS TEXT) AS ma_nv,
        CAST(ped.ho_va_ten_selected AS TEXT) AS ho_ten,
        CAST(ped.tong_cong_cy AS DOUBLE PRECISION) AS tong_cong_cy,
        CAST(ped.tien_linh_cy AS DOUBLE PRECISION) AS tien_linh_cy,
        CASE
            WHEN COALESCE(ped.tong_cong_cy, 0) = 0 THEN NULL
            ELSE CAST(ped.tien_linh_cy / ped.tong_cong_cy AS DOUBLE PRECISION)
        END AS tien_linh_per_cong_cy,
        CAST(ped.tong_cong_py AS DOUBLE PRECISION) AS tong_cong_py,
        CAST(ped.tien_linh_py AS DOUBLE PRECISION) AS tien_linh_py,
        CASE
            WHEN COALESCE(ped.tong_cong_py, 0) = 0 THEN NULL
            ELSE CAST(ped.tien_linh_py / ped.tong_cong_py AS DOUBLE PRECISION)
        END AS tien_linh_per_cong_py,
        CAST(ped.total_unique_employees_cy AS BIGINT) AS total_records,
        CAST(ped.total_overall_tien_linh_cy AS DOUBLE PRECISION) AS overall_sum_tien_linh_cy,
        CAST(ped.total_overall_tong_cong_cy AS DOUBLE PRECISION) AS overall_sum_tong_cong_cy
    FROM paginated_employee_data ped;
END;
$$;
```

#### `get_doctor_count_latest_fulltime`

Hàm này dùng để đếm tổng số nhân viên full-time có chức danh là bác sĩ trong bảng `Fulltime` ở tháng & năm mới nhất có dữ liệu. Hàm này thực hiện các bước sau:
1. Count số lượng bác sĩ thông qua cột "ma_nhan_vien" của bảng Fulltime
2. Filter tháng mới nhất của số lượng này thông qua cột Năm (int8) và Thang_x (text)
3. Với "ma_nhan_vien" của bảng Fulltime thì trùng với cột "Mã nhân viên" trong bảng "MS_CBNV"
4. Bảng "MS_CBNV" có một cột tên là "Job title". Cột này trùng với cột "CHỨC DANH CÔNG VIỆC (JOB TITLE)" của bảng "MS_Org_chucdanh"
5. Trong bảng "MS_Org_chucdanh" thì chọn filter cột "JOB TYPE" =Bác sĩ

Hàm này **không nhận tham số filter** và **chỉ trả về 1 số nguyên duy nhất**.

**SQL Cod   e:**
```sql
-- Xóa tất cả các phiên bản của hàm cũ (nếu có)
CREATE OR REPLACE FUNCTION get_doctor_count_latest_fulltime()
RETURNS INTEGER
LANGUAGE SQL
AS $$
  WITH max_year AS (
    SELECT MAX(nam::INTEGER) AS max_year FROM "Fulltime"
  ),
  valid_months AS (
    SELECT thang
    FROM "Fulltime"
    WHERE nam = (SELECT max_year FROM max_year)
      AND thang IS NOT NULL
      AND regexp_replace(thang, '\\D', '', 'g') ~ '^\\d+$'
  ),
  max_month AS (
    SELECT LPAD(MAX(CAST(regexp_replace(thang, '\\D', '', 'g') AS INTEGER))::text, 2, '0') AS max_month
    FROM valid_months
  )
  SELECT COUNT(DISTINCT f.ma_nhan_vien)
  FROM "Fulltime" f
  JOIN "MS_CBNV" m ON f.ma_nhan_vien = m."Mã nhân viên"
  JOIN "MS_Org_chucdanh" o ON TRIM(UPPER(m."Job title")) = TRIM(UPPER(o."CHỨC DANH CÔNG VIỆC (JOB TITLE)"))
  WHERE f.nam::INTEGER = (SELECT MAX(nam) FROM "Fulltime")
    AND regexp_replace(f.thang, '\D', '', 'g') = (
      SELECT LPAD(MAX(CAST(regexp_replace(thang, '\D', '', 'g') AS INTEGER))::text, 2, '0')
      FROM "Fulltime"
      WHERE nam = (SELECT MAX(nam) FROM "Fulltime")
    )
      AND o."JOB TYPE" = 'Bác sĩ';
$$;
```

- Đảm bảo bảng `Fulltime` có trường `ma_nhan_vien`, `thang`, `nam` và bảng `MS_CBNV` có trường `"Mã nhân viên"`, `"Job title"`, và bảng `MS_Org_chucdanh` có trường `"CHỨC DANH CÔNG VIỆC (JOB TITLE)"`, `"JOB TYPE"`.
- Nếu tên trường khác, hãy sửa lại cho đúng với cấu trúc bảng của bạn.

#### `get_total_doctor_salary_latest_year`

Function này dùng để lấy tổng thu nhập (tong_thu_nhap) của tất cả bác sĩ fulltime trong năm mới nhất từ bảng Fulltime. Nếu không có dữ liệu, trả về 0.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_total_doctor_salary_latest_year()
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  SELECT COALESCE(SUM(CAST(REPLACE(tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)), 0)
  FROM "Fulltime"
  WHERE nam = (
    SELECT MAX(nam) FROM "Fulltime"
    WHERE tong_thu_nhap IS NOT NULL AND tong_thu_nhap <> ''
  )
    AND tong_thu_nhap IS NOT NULL AND tong_thu_nhap <> ''
    AND (nganh_doc ILIKE '%bác sĩ%' OR chuc_danh ILIKE '%bác sĩ%');
$$;
```

#### `get_doctor_salary_per_workday_latest_year`

Function này trả về trung bình Lương/công của các bác sĩ fulltime trong tháng/năm mới nhất (theo đúng logic join xác định bác sĩ như get_doctor_count_latest_fulltime). Công thức: tổng tong_thu_nhap chia tổng số công (tổng các cột ngày công). Đã xử lý chuẩn cột thang dạng text.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_doctor_salary_per_workday_latest_year()
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  WITH max_year AS (
    SELECT MAX(nam) AS max_year FROM "Fulltime"
  ),
  valid_months AS (
    SELECT regexp_replace(thang, '\\D', '', 'g') AS thang_so
    FROM "Fulltime"
    WHERE nam = (SELECT max_year FROM max_year)
      AND thang IS NOT NULL
      AND regexp_replace(thang, '\\D', '', 'g') ~ '^\\d+$'
  ),
  max_month AS (
    SELECT LPAD(MAX(CAST(thang_so AS INTEGER))::text, 2, '0') AS max_month
    FROM valid_months
  ),
  doctor_data AS (
    SELECT f.tong_thu_nhap,
           COALESCE(f.ngay_thuong_chinh_thuc, 0) +
           COALESCE(f.ngay_thuong_thu_viec, 0) +
           COALESCE(f.nghi_tuan, 0) +
           COALESCE(f.le_tet, 0) +
           COALESCE(f.ngay_thuong_chinh_thuc2, 0) +
           COALESCE(f.ngay_thuong_thu_viec3, 0) +
           COALESCE(f.nghi_tuan4, 0) +
           COALESCE(f.le_tet5, 0) +
           COALESCE(f.nghi_nl, 0) AS total_workdays
    FROM "Fulltime" f
    JOIN "MS_CBNV" m ON f.ma_nhan_vien = m."Mã nhân viên"
    JOIN "MS_Org_chucdanh" o ON TRIM(UPPER(m."Job title")) = TRIM(UPPER(o."CHỨC DANH CÔNG VIỆC (JOB TITLE)"))
    WHERE f.nam = (SELECT max_year FROM max_year)
      AND LPAD(regexp_replace(f.thang, '\\D', '', 'g'), 2, '0') = (SELECT max_month FROM max_month)
      AND f.thang IS NOT NULL
      AND regexp_replace(f.thang, '\\D', '', 'g') ~ '^\\d+$'
      AND o."JOB TYPE" = 'Bác sĩ'
  )
  SELECT CASE WHEN SUM(total_workdays) = 0 THEN 0
              ELSE SUM(CAST(REPLACE(tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) / SUM(total_workdays)
         END
  FROM doctor_data;
$$;
```

#### `get_doctor_salary_per_workday_by_jobtitle_latest_year`

Function này trả về lương/công trung bình của từng chức danh công việc (JOB TITLE) trong bảng MS_Org_chucdanh cho năm mới nhất, chỉ tính các chức danh có nhân viên fulltime thực nhận lương/công > 0.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_doctor_salary_per_workday_by_jobtitle_latest_year();
CREATE OR REPLACE FUNCTION get_doctor_salary_per_workday_by_jobtitle_latest_year()
RETURNS TABLE(
    job_title TEXT,
    salary_per_workday DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_year INTEGER;
BEGIN
    SELECT MAX(nam) INTO v_max_year FROM "Fulltime";
    RETURN QUERY
    SELECT
        o."CHỨC DANH CÔNG VIỆC (JOB TITLE)" AS job_title,
        CASE WHEN SUM(
            COALESCE(f.ngay_thuong_chinh_thuc, 0) +
            COALESCE(f.ngay_thuong_thu_viec, 0) +
            COALESCE(f.nghi_tuan, 0) +
            COALESCE(f.le_tet, 0) +
            COALESCE(f.ngay_thuong_chinh_thuc2, 0) +
            COALESCE(f.ngay_thuong_thu_viec3, 0) +
            COALESCE(f.nghi_tuan4, 0) +
            COALESCE(f.le_tet5, 0) +
            COALESCE(f.nghi_nl, 0)
        ) = 0 THEN 0 ELSE
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) /
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
    FROM "Fulltime" f
    JOIN "MS_CBNV" m ON f.ma_nhan_vien = m."Mã nhân viên"
    JOIN "MS_Org_chucdanh" o ON TRIM(UPPER(m."Job title")) = TRIM(UPPER(o."CHỨC DANH CÔNG VIỆC (JOB TITLE)"))
    WHERE f.nam = v_max_year
      AND f.thang IS NOT NULL
      AND regexp_replace(f.thang, '\\D', '', 'g') ~ '^\\d{1,2}'
    GROUP BY o."CHỨC DANH CÔNG VIỆC (JOB TITLE)"
    HAVING SUM(
        COALESCE(f.ngay_thuong_chinh_thuc, 0) +
        COALESCE(f.ngay_thuong_thu_viec, 0) +
        COALESCE(f.nghi_tuan, 0) +
        COALESCE(f.le_tet, 0) +
        COALESCE(f.ngay_thuong_chinh_thuc2, 0) +
        COALESCE(f.ngay_thuong_thu_viec3, 0) +
        COALESCE(f.nghi_tuan4, 0) +
        COALESCE(f.le_tet5, 0) +
        COALESCE(f.nghi_nl, 0)
    ) > 0
    ORDER BY salary_per_workday DESC;
END;
$$;
```

- Hàm này trả về lương/công trung bình cho từng chức danh công việc trong năm mới nhất.
- Chỉ tính các chức danh có tổng số công > 0.
- Đảm bảo các bảng và cột liên quan đã tồn tại đúng như tên trong hàm.

#### `get_doctor_salary_per_workday_by_jobtitle_trend`

Function này trả về lương/công trung bình của từng chức danh công việc (JOB TITLE) cho từng tháng trong năm được chọn. Dùng cho chart Biến Động Lương/Công Bác Sĩ theo chức danh.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_doctor_salary_per_workday_by_jobtitle_trend(INTEGER);
CREATE OR REPLACE FUNCTION get_doctor_salary_per_workday_by_jobtitle_trend(
    p_filter_year INTEGER DEFAULT NULL
)
RETURNS TABLE(
    month_label TEXT,
    job_title TEXT,
    salary_per_workday DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t."Thang_x" AS month_label,
        o."CHỨC DANH CÔNG VIỆC (JOB TITLE)" AS job_title,
        CASE WHEN SUM(
            COALESCE(f.ngay_thuong_chinh_thuc, 0) +
            COALESCE(f.ngay_thuong_thu_viec, 0) +
            COALESCE(f.nghi_tuan, 0) +
            COALESCE(f.le_tet, 0) +
            COALESCE(f.ngay_thuong_chinh_thuc2, 0) +
            COALESCE(f.ngay_thuong_thu_viec3, 0) +
            COALESCE(f.nghi_tuan4, 0) +
            COALESCE(f.le_tet5, 0) +
            COALESCE(f.nghi_nl, 0)
        ) = 0 THEN 0 ELSE
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) /
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
    FROM "Fulltime" f
    JOIN "MS_CBNV" m ON f.ma_nhan_vien = m."Mã nhân viên"
    JOIN "MS_Org_chucdanh" o ON TRIM(UPPER(m."Job title")) = TRIM(UPPER(o."CHỨC DANH CÔNG VIỆC (JOB TITLE)"))
    JOIN "Time" t ON f.nam::INTEGER = t."Năm"::INTEGER AND LPAD(regexp_replace(f.thang, '\\D', '', 'g'), 2, '0') = LPAD(regexp_replace(t."Thang_x", '\\D', '', 'g'), 2, '0')
    WHERE (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
      AND f.thang IS NOT NULL
      AND regexp_replace(f.thang, '\\D', '', 'g') ~ '^\\d{1,2}'
    GROUP BY t."Thang_x", o."CHỨC DANH CÔNG VIỆC (JOB TITLE)"
    HAVING SUM(
        COALESCE(f.ngay_thuong_chinh_thuc, 0) +
        COALESCE(f.ngay_thuong_thu_viec, 0) +
        COALESCE(f.nghi_tuan, 0) +
        COALESCE(f.le_tet, 0) +
        COALESCE(f.ngay_thuong_chinh_thuc2, 0) +
        COALESCE(f.ngay_thuong_thu_viec3, 0) +
        COALESCE(f.nghi_tuan4, 0) +
        COALESCE(f.le_tet5, 0) +
        COALESCE(f.nghi_nl, 0)
    ) > 0
    ORDER BY t."Thang_x", job_title;
END;
$$;
```

- Hàm này trả về lương/công trung bình cho từng chức danh công việc theo từng tháng trong năm được chọn.
- Chỉ tính các chức danh có tổng số công > 0 trong tháng đó.
- Đảm bảo các bảng và cột liên quan đã tồn tại đúng như tên trong hàm.

#### `get_doctor_salary_ranking_latest_year`

Hàm này trả về danh sách xếp hạng các bác sĩ fulltime theo tổng lương và lương/công trong năm mới nhất. Kết quả gồm:
- Mã nhân viên
- Họ và tên
- Chuyên môn (Job title)
- Tổng chi phí lương năm nay
- Lương/công năm nay

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_doctor_salary_ranking_latest_year();
CREATE OR REPLACE FUNCTION get_doctor_salary_ranking_latest_year()
RETURNS TABLE(
    ma_nv TEXT,
    ho_ten TEXT,
    job_title TEXT,
    total_salary DOUBLE PRECISION,
    salary_per_workday DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_year INTEGER;
BEGIN
    SELECT MAX(nam) INTO v_max_year FROM "Fulltime";
    RETURN QUERY
    SELECT
        f.ma_nhan_vien AS ma_nv,
        f.ho_va_ten AS ho_ten,
        m."Job title" AS job_title,
        SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) AS total_salary,
        CASE WHEN SUM(
            COALESCE(f.ngay_thuong_chinh_thuc, 0) +
            COALESCE(f.ngay_thuong_thu_viec, 0) +
            COALESCE(f.nghi_tuan, 0) +
            COALESCE(f.le_tet, 0) +
            COALESCE(f.ngay_thuong_chinh_thuc2, 0) +
            COALESCE(f.ngay_thuong_thu_viec3, 0) +
            COALESCE(f.nghi_tuan4, 0) +
            COALESCE(f.le_tet5, 0) +
            COALESCE(f.nghi_nl, 0)
        ) = 0 THEN 0 ELSE
            SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) /
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
    FROM "Fulltime" f
    JOIN "MS_CBNV" m ON f.ma_nhan_vien = m."Mã nhân viên"
    JOIN "MS_Org_chucdanh" o ON TRIM(UPPER(m."Job title")) = TRIM(UPPER(o."CHỨC DANH CÔNG VIỆC (JOB TITLE)"))
    WHERE f.nam = v_max_year
      AND o."JOB TYPE" = 'Bác sĩ'
      AND f.thang IS NOT NULL
      AND regexp_replace(f.thang, '\\D', '', 'g') ~ '^\\d{1,2}'
    GROUP BY f.ma_nhan_vien, f.ho_va_ten, m."Job title"
    HAVING SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) > 0
    ORDER BY total_salary DESC, salary_per_workday DESC;
END;
$$;
```

---

Once these functions are successfully created (or updated) in your Supabase SQL Editor, the application should be able to correctly filter and aggregate data. If you continue to encounter "unterminated dollar-quoted string" errors, please double-check for any invisible characters or ensure the entire function block is being processed correctly by the SQL editor, especially ensuring no comments are between `END;` and the final `$$;`.
Additionally, for the `get_monthly_salary_trend_fulltime`, `get_monthly_salary_trend_parttime`, `get_monthly_revenue_trend`, `get_monthly_employee_trend_fulltime`, and `get_monthly_ft_salary_revenue_per_employee_trend` functions, ensure you have a `Time` table (capital T) with appropriate columns (`"Năm"`, `thangpro` (TEXT), `"Thang_x"` (TEXT)) as described in the function's comments.
    

    

    





    






