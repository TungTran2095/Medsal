
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
4.  For each function below, paste its SQL code into the editor and click **Run**.

#### `get_public_tables`

This function is used by the application to retrieve a list of tables from your public schema in Supabase. If this function is missing, you will see an error in the Workspace when it tries to load the table list.

**SQL Code:**
```sql
create or replace function get_public_tables()
returns table (table_name text)
language sql
as $$
  select tablename::text from pg_catalog.pg_tables
  where schemaname = 'public'
  order by tablename;
$$;
```

#### `get_total_salary_fulltime`

This function is used by the Payroll Dashboard to calculate the total sum of `tong_thu_nhap` from the `Fulltime` table, with optional filters for month and year.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_total_salary_fulltime(
    filter_year INTEGER DEFAULT NULL,
    filter_month INTEGER DEFAULT NULL
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
AS $$
  SELECT SUM(CAST(REPLACE(tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION))
  FROM "Fulltime"
  WHERE (filter_year IS NULL OR nam::INTEGER = filter_year)
    AND (filter_month IS NULL OR thang::INTEGER = filter_month);
$$;
```

#### `get_employee_count_fulltime`

This function is used by the Payroll Dashboard to count the number of unique employees from the `Fulltime` table, with optional filters for month and year.

**SQL Code:**
```sql
CREATE OR REPLACE FUNCTION get_employee_count_fulltime(
    filter_year INTEGER DEFAULT NULL,
    filter_month INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  SELECT COUNT(DISTINCT employee_id)::INTEGER
  FROM "Fulltime"
  WHERE (filter_year IS NULL OR nam::INTEGER = filter_year)
    AND (filter_month IS NULL OR thang::INTEGER = filter_month);
$$;
```

#### `get_monthly_salary_trend_fulltime`

This function is used by the Payroll Dashboard to fetch the total salary (`tong_thu_nhap`) aggregated per month and year, for a given year. This is used to display the monthly salary trend.

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
        f.thang AS month,
        f.nam AS year,
        SUM(CAST(REPLACE(f.tong_thu_nhap::text, ',', '') AS DOUBLE PRECISION)) AS total_salary
    FROM "Fulltime" f
    WHERE (p_filter_year IS NULL OR f.nam::INTEGER = p_filter_year)
    GROUP BY f.nam, f.thang
    ORDER BY f.nam, f.thang;
END;
$$;
```

Once these functions are successfully created, the application should be able to list your public tables and display dashboard analytics correctly.
