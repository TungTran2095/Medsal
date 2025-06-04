
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
    *   **For `get_monthly_salary_trend_fulltime`, `get_monthly_salary_trend_parttime`, `get_monthly_revenue_trend`, `get_salary_revenue_ratio_components_by_location`, `get_location_comparison_metrics`, `get_nganhdoc_ft_salary_hanoi`, or `get_donvi2_pt_salary`**: If you encounter an error like "cannot change return type of existing function", you MUST first run `DROP FUNCTION function_name(parameters);` (e.g., `DROP FUNCTION get_monthly_salary_trend_fulltime(integer, text[]);` or `DROP FUNCTION get_location_comparison_metrics(integer, integer[], text[]);` or `DROP FUNCTION get_nganhdoc_ft_salary_hanoi(INTEGER, INTEGER[]);`) and then run the `CREATE OR REPLACE FUNCTION` script for it.

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

#### `get_total_salary_fulltime`

This function is used by the Payroll Dashboard to calculate the total sum of `tong_thu_nhap` from the `Fulltime` table, with optional filters for a selected year, an array of months, and an array of location names. It correctly parses text-based month columns (e.g., "Tháng 01") into integers.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_total_salary_fulltime(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_total_salary_fulltime(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL,
    filter_locations TEXT[] DEFAULT NULL -- Added
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  SELECT SUM(CAST(REPLACE(tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION))
  FROM "Fulltime"
  WHERE (filter_year IS NULL OR nam::INTEGER = filter_year)
    AND (
        filter_months IS NULL OR
        array_length(filter_months, 1) IS NULL OR
        array_length(filter_months, 1) = 0 OR
        regexp_replace(thang, '\D', '', 'g')::INTEGER = ANY(filter_months)
    )
    AND ( -- Added location filter
        filter_locations IS NULL OR
        array_length(filter_locations, 1) IS NULL OR
        array_length(filter_locations, 1) = 0 OR
        dia_diem = ANY(filter_locations)
    );
$$;
```

#### `get_total_salary_parttime`

This function is used by the Payroll Dashboard to calculate the total sum of `"Tong tien"` from the `Parttime` table, with optional filters for a selected year, an array of months, and an array of location names. It correctly parses text-based month columns (e.g., "Tháng 01") into integers. It assumes the `Parttime` table has `"Nam"` (INTEGER for year), `"Thoi gian"` (TEXT for month description), and `"Don vi"` (TEXT for location) columns.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_total_salary_parttime(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_total_salary_parttime(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL,
    filter_locations TEXT[] DEFAULT NULL -- Added
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
    AND ( -- Added location filter
        filter_locations IS NULL OR
        array_length(filter_locations, 1) IS NULL OR
        array_length(filter_locations, 1) = 0 OR
        pt."Don vi" = ANY(filter_locations)
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
    filter_locations TEXT[] DEFAULT NULL -- Added
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
    AND ( -- Added location filter
        filter_locations IS NULL OR
        array_length(filter_locations, 1) IS NULL OR
        array_length(filter_locations, 1) = 0 OR
        dr."Tên đơn vị" = ANY(filter_locations)
    );
$$;
```

#### `get_monthly_salary_trend_fulltime`

This function is used by the Payroll Dashboard to fetch the total salary (`tong_thu_nhap` from "Fulltime" table) aggregated per month and year, for a given year and optional list of locations. The X-axis of the chart will use the `Thang_x` column from your `Time` table.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_monthly_salary_trend_fulltime(INTEGER, TEXT[]);
CREATE OR REPLACE FUNCTION get_monthly_salary_trend_fulltime(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL -- Added
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
        AND ( -- Added location filter
            p_filter_locations IS NULL OR
            array_length(p_filter_locations, 1) IS NULL OR
            array_length(p_filter_locations, 1) = 0 OR
            f.dia_diem = ANY(p_filter_locations)
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

This function is used by the Payroll Dashboard to fetch the total part-time salary (`"Tong tien"` from "Parttime" table) aggregated per month and year, for a given year and optional list of locations. The X-axis of the chart will use the `Thang_x` column from your `Time` table. It assumes "Parttime" has columns `"Nam"` (INTEGER), `"Thoi gian"` (TEXT), and `"Don vi"` (TEXT).

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_monthly_salary_trend_parttime(INTEGER, TEXT[]);
CREATE OR REPLACE FUNCTION get_monthly_salary_trend_parttime(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL -- Added
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
        AND ( -- Added location filter
            p_filter_locations IS NULL OR
            array_length(p_filter_locations, 1) IS NULL OR
            array_length(p_filter_locations, 1) = 0 OR
            pt."Don vi" = ANY(p_filter_locations)
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
    p_filter_locations TEXT[] DEFAULT NULL -- Added
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
        AND ( -- Added location filter
            p_filter_locations IS NULL OR
            array_length(p_filter_locations, 1) IS NULL OR
            array_length(p_filter_locations, 1) = 0 OR
            dr."Tên đơn vị" = ANY(p_filter_locations)
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

#### `get_salary_revenue_ratio_components_by_location`

This function calculates the full-time and part-time salary components of the salary-to-revenue ratio for each work location, applying optional year, month, and specific location filters.
It unifies location names from `Fulltime.dia_diem`, `Parttime."Don vi"`, and `Doanh_thu."Tên đơn vị"`.

**SQL Code:**
```sql
DROP FUNCTION IF EXISTS get_salary_revenue_ratio_components_by_location(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_salary_revenue_ratio_components_by_location(
    p_filter_year INTEGER DEFAULT NULL,
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL -- Added: list of specific location names (department names) to filter for
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
          AND ( -- Apply main location filter here
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
          AND ( -- Apply main location filter here
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
          AND ( -- Apply main location filter here
              p_filter_locations IS NULL OR
              array_length(p_filter_locations, 1) IS NULL OR
              array_length(p_filter_locations, 1) = 0 OR
              dr."Tên đơn vị" = ANY(p_filter_locations)
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

**SQL Code:**
```sql
-- Function: get_location_comparison_metrics
DROP FUNCTION IF EXISTS get_location_comparison_metrics(INTEGER, INTEGER[], TEXT[]);
CREATE OR REPLACE FUNCTION get_location_comparison_metrics(
    p_filter_year INTEGER,
    p_filter_months INTEGER[] DEFAULT NULL,
    p_filter_locations TEXT[] DEFAULT NULL -- Input: specific location names to filter for
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
          AND ( -- Apply main location filter here IF provided, otherwise ALL locations for the year/months
              p_filter_locations IS NULL OR
              array_length(p_filter_locations, 1) IS NULL OR
              array_length(p_filter_locations, 1) = 0 OR
              f.dia_diem = ANY(p_filter_locations)
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
          AND ( -- Apply main location filter here IF provided
              p_filter_locations IS NULL OR
              array_length(p_filter_locations, 1) IS NULL OR
              array_length(p_filter_locations, 1) = 0 OR
              pt."Don vi" = ANY(p_filter_locations)
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
          AND ( -- Apply main location filter here IF provided
              p_filter_locations IS NULL OR
              array_length(p_filter_locations, 1) IS NULL OR
              array_length(p_filter_locations, 1) = 0 OR
              dr."Tên đơn vị" = ANY(p_filter_locations)
          )
        GROUP BY COALESCE(dr."Tên đơn vị", 'Không xác định')
    ),
    all_locs AS ( -- Collect all distinct locations that have any data in the given period
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
    SELECT
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
    ORDER BY nganh_doc_key;
END;
$$;
```

#### `get_donvi2_pt_salary`

This function fetches aggregated part-time salary by `Don_vi_2` (from `Parttime` table), for a specified year and optional months.

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
    SELECT
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
    ORDER BY don_vi_2_key;
END;
$$;
```


Once these functions are successfully created (or updated) in your Supabase SQL Editor, the application should be able to correctly filter and aggregate data. If you continue to encounter "unterminated dollar-quoted string" errors, please double-check for any invisible characters or ensure the entire function block is being processed correctly by the SQL editor, especially ensuring no comments are between `END;` and the final `$$;`.
Additionally, for the `get_monthly_salary_trend_fulltime`, `get_monthly_salary_trend_parttime`, and `get_monthly_revenue_trend` functions, ensure you have a `Time` table (capital T) with appropriate columns (`"Năm"`, `thangpro` (TEXT), `"Thang_x"` (TEXT)) as described in the function's comments.
    

    

    