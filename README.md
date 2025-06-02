
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
    *   **For `get_monthly_salary_trend_fulltime` or `get_monthly_salary_trend_parttime` or `get_monthly_revenue_trend`**: If you encounter an error like "cannot change return type of existing function", you MUST first run `DROP FUNCTION function_name(integer);` (e.g., `DROP FUNCTION get_monthly_salary_trend_fulltime(integer);`) and then run the `CREATE OR REPLACE FUNCTION` script for it.

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

This function is used by the Payroll Dashboard to calculate the total sum of `tong_thu_nhap` from the `Fulltime` table, with optional filters for a selected year and an array of months. It correctly parses text-based month columns (e.g., "Tháng 01") into integers.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_total_salary_fulltime(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL
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
    );
$$;
```

#### `get_total_salary_parttime`

This function is used by the Payroll Dashboard to calculate the total sum of `"Tong tien"` from the `Parttime` table, with optional filters for a selected year and an array of months. It correctly parses text-based month columns (e.g., "Tháng 01") into integers. It assumes the `Parttime` table has `"Nam"` (INTEGER for year) and `"Thoi gian"` (TEXT for month description, e.g., "Tháng 01") columns.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_total_salary_parttime(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  SELECT SUM(CAST(REPLACE("Tong tien"::text, ',', '') AS DOUBLE PRECISION))
  FROM "Parttime" pt
  WHERE (filter_year IS NULL OR pt."Nam"::INTEGER = filter_year)
    AND (
        filter_months IS NULL OR
        array_length(filter_months, 1) IS NULL OR
        array_length(filter_months, 1) = 0 OR
        regexp_replace(pt."Thoi gian", '\D', '', 'g')::INTEGER = ANY(filter_months)
    );
$$;
```

#### `get_total_revenue`

This function is used by the Payroll Dashboard to calculate the total sum of "Kỳ báo cáo" from the "Doanh_thu" table, with optional filters for a selected year and an array of months. It assumes "Doanh_thu" table has `"Năm"` (integer for year), `"Tháng"` (text for month, e.g., "Tháng 01"), and "Tên đơn vị" (text) columns for filtering. Rows where "Tên đơn vị" is "Medcom", "Medon", "Medicons", "Meddom", or "Med Group" are excluded.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_total_revenue(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  SELECT SUM(CAST(REPLACE("Kỳ báo cáo"::text, ',', '') AS DOUBLE PRECISION))
  FROM "Doanh_thu" dr
  WHERE (filter_year IS NULL OR dr."Năm"::INTEGER = filter_year)
    AND (
        filter_months IS NULL OR
        array_length(filter_months, 1) IS NULL OR
        array_length(filter_months, 1) = 0 OR
        regexp_replace(dr."Tháng", '\D', '', 'g')::INTEGER = ANY(filter_months)
    )
    AND dr."Tên đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group');
$$;
```

#### `get_monthly_salary_trend_fulltime`

This function is used by the Payroll Dashboard to fetch the total salary (`tong_thu_nhap` from "Fulltime" table) aggregated per month and year, for a given year. The X-axis of the chart will use the `Thang_x` column from your `Time` table.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_monthly_salary_trend_fulltime(
    p_filter_year INTEGER DEFAULT NULL
)
RETURNS TABLE(
    month_label TEXT,  -- This will be Time."Thang_x"
    year_val INTEGER,    -- This will be Fulltime.nam
    total_salary DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- IMPORTANT ASSUMPTIONS FOR THIS FUNCTION TO WORK:
    -- 1. A table named "Time" (capital T) MUST exist in your database.
    -- 2. The "Time" table MUST have the following columns:
    --    - "Năm" (INTEGER or INT8): Numeric year.
    --    - "thangpro" (TEXT): Numeric month as text (e.g., '01', '1', '12'). Used for sorting.
    --    - "Thang_x" (TEXT): Display label for the X-axis (e.g., 'Tháng 01'). This MUST match the format of the 'thang' column in the "Fulltime" table.
    -- 3. The "Fulltime" table MUST have 'nam' (INTEGER) for year and 'thang' (TEXT, e.g., 'Tháng 01') for month.

    RETURN QUERY
    SELECT
        t."Thang_x" AS month_label,
        f.nam::INTEGER AS year_val,
        SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) AS total_salary
    FROM
        "Fulltime" f
    INNER JOIN
        "Time" t ON f.nam::INTEGER = t."Năm"::INTEGER -- Join on year
                 AND f.thang = t."Thang_x"            -- Join on month text label (e.g., "Tháng 01" = "Tháng 01")
    WHERE
        (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
    GROUP BY
        f.nam::INTEGER,
        t."Thang_x",
        t.thangpro -- Group also by textual month from "Time" table for sorting
    ORDER BY
        f.nam::INTEGER,
        regexp_replace(t.thangpro, '\D', '', 'g')::INTEGER; -- Order by year, then by the numeric version of thangpro for correct trend
END;
$$;
```

#### `get_monthly_salary_trend_parttime`

This function is used by the Payroll Dashboard to fetch the total part-time salary (`"Tong tien"` from "Parttime" table) aggregated per month and year, for a given year. The X-axis of the chart will use the `Thang_x` column from your `Time` table. It assumes "Parttime" has columns `"Nam"` (INTEGER) and `"Thoi gian"` (TEXT).

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_monthly_salary_trend_parttime(
    p_filter_year INTEGER DEFAULT NULL
)
RETURNS TABLE(
    month_label TEXT,  -- This will be Time."Thang_x"
    year_val INTEGER,    -- This will be Parttime."Nam"
    total_salary DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- IMPORTANT ASSUMPTIONS:
    -- 1. "Time" (capital T) table exists with "Năm" (INTEGER/INT8), "thangpro" (TEXT), "Thang_x" (TEXT).
    -- 2. "Parttime" table exists with '"Nam"' (INTEGER), '"Thoi gian"' (TEXT, e.g., 'Tháng 01'), and "Tong tien" (numeric or text convertible to number).

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

This function is used by the Payroll Dashboard to fetch the total revenue ("Kỳ báo cáo" from "Doanh_thu" table) aggregated per month and year, for a given year. It excludes specific "Tên đơn vị" values. The X-axis of the chart will use the `Thang_x` column from your `Time` table. It assumes "Doanh_thu" has columns `"Năm"` (INTEGER) and `"Tháng"` (TEXT).

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_monthly_revenue_trend(
    p_filter_year INTEGER DEFAULT NULL
)
RETURNS TABLE(
    month_label TEXT,  -- This will be Time."Thang_x"
    year_val INTEGER,    -- This will be Doanh_thu."Năm"
    total_revenue DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- IMPORTANT ASSUMPTIONS FOR THIS FUNCTION TO WORK:
    -- 1. A table named "Time" (capital T) MUST exist with columns:
    --    - "Năm" (INTEGER or INT8): Numeric year.
    --    - "thangpro" (TEXT): Numeric month as text (e.g., '01', '12'). Used for sorting.
    --    - "Thang_x" (TEXT): Display label for X-axis (e.g., 'Tháng 01'). Must match '"Tháng"' in "Doanh_thu".
    -- 2. A table named "Doanh_thu" MUST exist with columns "Kỳ báo cáo", "\"Năm\"", "\"Tháng\"", and "Tên đơn vị".

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

Once these functions are successfully created (or updated) in your Supabase SQL Editor, the application should be able to correctly filter and aggregate data. If you continue to encounter "unterminated dollar-quoted string" errors, please double-check for any invisible characters or ensure the entire function block is being processed correctly by the SQL editor, especially ensuring no comments are between `END;` and the final `$$;`.
Additionally, for the `get_monthly_salary_trend_fulltime`, `get_monthly_salary_trend_parttime`, and `get_monthly_revenue_trend` functions, ensure you have a `Time` table (capital T) with appropriate columns (`"Năm"`, `thangpro` (TEXT), `"Thang_x"` (TEXT)) as described in the function's comments.

    
