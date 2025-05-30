
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

#### `get_employee_count_fulltime`

This function is used by the Payroll Dashboard to count the number of unique employees from the `Fulltime` table, with optional filters for a selected year and an array of months. It correctly parses text-based month columns (e.g., "Tháng 01") into integers.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_employee_count_fulltime(
    filter_year INTEGER DEFAULT NULL,
    filter_months INTEGER[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  SELECT COUNT(DISTINCT employee_id)::INTEGER
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

#### `get_monthly_salary_trend_fulltime`

This function is used by the Payroll Dashboard to fetch the total salary (`tong_thu_nhap`) aggregated per month and year, for a given year. This is used to display the monthly salary trend. It now correctly parses text-based month columns (e.g., "Tháng 01") into integers.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_monthly_salary_trend_fulltime(
    p_filter_year INTEGER DEFAULT NULL
)
RETURNS TABLE(month INTEGER, year INTEGER, total_salary DOUBLE PRECISION)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        regexp_replace(f.thang, '\D', '', 'g')::INTEGER AS month, -- Extract numeric month
        f.nam::INTEGER AS year,
        SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) AS total_salary
    FROM "Fulltime" f
    WHERE (
        p_filter_year IS NULL OR
        f.nam::INTEGER = p_filter_year
      )
    GROUP BY f.nam, regexp_replace(f.thang, '\D', '', 'g') -- Group by the extracted numeric month
    ORDER BY f.nam, month; -- Order by the extracted numeric month
END;
$$;
```

Once these functions are successfully created (or updated) in your Supabase SQL Editor, the application should be able to correctly filter and aggregate data. If you continue to encounter "unterminated dollar-quoted string" errors, please double-check for any invisible characters or ensure the entire function block is being processed correctly by the SQL editor, especially ensuring no comments are between `END;` and the final `$$;`.
