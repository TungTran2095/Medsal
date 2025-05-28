# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Supabase Setup

This application interacts with a Supabase database. Some features, like listing database tables in the Workspace, require specific SQL functions to be present in your Supabase project.

### Required SQL Functions

#### `get_public_tables`

This function is used by the application to retrieve a list of tables from your public schema in Supabase. If this function is missing, you will see an error in the Workspace when it tries to load the table list.

To create this function:

1.  Go to your Supabase Project.
2.  Navigate to the **SQL Editor** (usually found in the left sidebar).
3.  Click on **New query** (or "+ New query").
4.  Paste the following SQL code into the editor:

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

5.  Click **Run**.

Once the function is successfully created, the application should be able to list your public tables.
