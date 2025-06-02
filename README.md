
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
    *   **For `get_monthly_salary_trend_fulltime` or `get_monthly_salary_trend_parttime`**: If you encounter an error like "cannot change return type of existing function", you MUST first run `DROP FUNCTION function_name(integer);` (e.g., `DROP FUNCTION get_monthly_salary_trend_fulltime(integer);`) and then run the `CREATE OR REPLACE FUNCTION` script for it.

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

This function is used by the Payroll Dashboard to calculate the total sum of `tong_thu_nhap` from the `Parttime` table, with optional filters for a selected year and an array of months. It correctly parses text-based month columns (e.g., "Tháng 01") into integers.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_total_salary_parttime(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  SELECT SUM(CAST(REPLACE(tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION))
  FROM "Parttime"  -- Querying the Parttime table
  WHERE (filter_year IS NULL OR nam::INTEGER = filter_year)
    AND (
        filter_months IS NULL OR
        array_length(filter_months, 1) IS NULL OR
        array_length(filter_months, 1) = 0 OR
        regexp_replace(thang, '\D', '', 'g')::INTEGER = ANY(filter_months)
    );
$$;
```

#### `get_total_revenue`

This function is used by the Payroll Dashboard to calculate the total sum of "Kỳ báo cáo" from the "Doanh_thu" table, with optional filters for a selected year and an array of months. It assumes "Doanh_thu" table has `nam` (integer), `thang` (text, e.g., "Tháng 01"), and "Tên đơn vị" (text) columns for filtering. Rows where "Tên đơn vị" is "Medcom", "Medon", "Medicons", "Meddom", or "Med Group" are excluded.

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
  FROM "Doanh_thu"
  WHERE (filter_year IS NULL OR nam::INTEGER = filter_year)
    AND (
        filter_months IS NULL OR
        array_length(filter_months, 1) IS NULL OR
        array_length(filter_months, 1) = 0 OR
        regexp_replace(thang, '\D', '', 'g')::INTEGER = ANY(filter_months)
    )
    AND "Tên đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group');
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
    -- 2. The "Time" table MUST have the following columns (or equivalents):
    --    - A column for the numeric year, e.g., "Năm" (INTEGER). Used for joining with Fulltime.nam.
    --    - A column for the numeric month (1-12), e.g., "thangpro" (INTEGER). Used for joining with the parsed month from Fulltime.thang AND for sorting.
    --    - The display column for the X-axis, named "Thang_x" (TEXT). This is what will be shown on the chart.
    --    If your "Time" table uses different column names, please update the JOIN clause below.

    RETURN QUERY
    SELECT
        t."Thang_x" AS month_label,         -- X-axis label from the "Time" table
        f.nam::INTEGER AS year_val,         -- Year from Fulltime table
        SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) AS total_salary
    FROM
        "Fulltime" f
    INNER JOIN
        "Time" t ON f.nam::INTEGER = t."Năm"  -- ASSUMED column name "Năm" (year) in "Time" table
                 AND regexp_replace(f.thang, '\D', '', 'g')::INTEGER = t."thangpro" -- ASSUMED column name "thangpro" (numeric month) in "Time" table
    WHERE
        (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year) -- Filter on Fulltime.nam
    GROUP BY
        f.nam::INTEGER,
        t."Thang_x",
        t."thangpro" -- Group also by numeric month from "Time" table for ordering
    ORDER BY
        f.nam::INTEGER,
        t."thangpro"; -- Order by year, then by the numeric month from "Time" table for correct trend
END;
$$;
```

#### `get_monthly_salary_trend_parttime`

This function is used by the Payroll Dashboard to fetch the total part-time salary (`tong_thu_nhap` from "Parttime" table) aggregated per month and year, for a given year. The X-axis of the chart will use the `Thang_x` column from your `Time` table.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_monthly_salary_trend_parttime(
    p_filter_year INTEGER DEFAULT NULL
)
RETURNS TABLE(
    month_label TEXT,  -- This will be Time."Thang_x"
    year_val INTEGER,    -- This will be Parttime.nam
    total_salary DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- IMPORTANT ASSUMPTIONS: "Time" (capital T) table exists with "Năm", "thangpro", "Thang_x".
    -- "Parttime" table exists.

    RETURN QUERY
    SELECT
        t."Thang_x" AS month_label,
        pt.nam::INTEGER AS year_val,
        SUM(CAST(REPLACE(pt.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) AS total_salary
    FROM
        "Parttime" pt
    INNER JOIN
        "Time" t ON pt.nam::INTEGER = t."Năm"
                 AND regexp_replace(pt.thang, '\D', '', 'g')::INTEGER = t."thangpro"
    WHERE
        (p_filter_year IS NULL OR pt.nam::INTEGER = p_filter_year)
    GROUP BY
        pt.nam::INTEGER,
        t."Thang_x",
        t."thangpro"
    ORDER BY
        pt.nam::INTEGER,
        t."thangpro";
END;
$$;
```

#### `get_monthly_revenue_trend`

This function is used by the Payroll Dashboard to fetch the total revenue ("Kỳ báo cáo" from "Doanh_thu" table) aggregated per month and year, for a given year. It excludes specific "Tên đơn vị" values. The X-axis of the chart will use the `Thang_x` column from your `Time` table.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_monthly_revenue_trend(
    p_filter_year INTEGER DEFAULT NULL
)
RETURNS TABLE(
    month_label TEXT,  -- This will be Time."Thang_x"
    year_val INTEGER,    -- This will be Doanh_thu.nam
    total_revenue DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- IMPORTANT ASSUMPTIONS FOR THIS FUNCTION TO WORK:
    -- 1. A table named "Time" (capital T) MUST exist in your database with appropriate columns ("Năm", "thangpro", "Thang_x").
    -- 2. A table named "Doanh_thu" MUST exist with columns "Kỳ báo cáo", "nam", "thang", and "Tên đơn vị".

    RETURN QUERY
    SELECT
        t."Thang_x" AS month_label,
        dr.nam::INTEGER AS year_val,
        SUM(CAST(REPLACE(dr."Kỳ báo cáo"::text, ',', '') AS DOUBLE PRECISION)) AS total_revenue
    FROM
        "Doanh_thu" dr
    INNER JOIN
        "Time" t ON dr.nam::INTEGER = t."Năm"
                 AND regexp_replace(dr.thang, '\D', '', 'g')::INTEGER = t."thangpro"
    WHERE
        (p_filter_year IS NULL OR dr.nam::INTEGER = p_filter_year)
        AND dr."Tên đơn vị" NOT IN ('Medcom', 'Medon', 'Medicons', 'Meddom', 'Med Group')
    GROUP BY
        dr.nam::INTEGER,
        t."Thang_x",
        t."thangpro"
    ORDER BY
        dr.nam::INTEGER,
        t."thangpro";
END;
$$;
```

Once these functions are successfully created (or updated) in your Supabase SQL Editor, the application should be able to correctly filter and aggregate data. If you continue to encounter "unterminated dollar-quoted string" errors, please double-check for any invisible characters or ensure the entire function block is being processed correctly by the SQL editor, especially ensuring no comments are between `END;` and the final `$$;`.
Additionally, for the `get_monthly_salary_trend_fulltime`, `get_monthly_salary_trend_parttime`, and `get_monthly_revenue_trend` functions, ensure you have a `Time` table (capital T) with appropriate columns (`"Năm"`, `"thangpro"`, `"Thang_x"`) as described in the function's comments.


    