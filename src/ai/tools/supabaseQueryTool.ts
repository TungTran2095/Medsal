'use server';
/**
 * @fileOverview A Genkit tool for querying Supabase database tables.
 *
 * - querySupabaseTableTool - The Genkit tool definition.
 */

import {ai} from '@/ai/genkit';
import {supabase} from '@/lib/supabaseClient';
import {z} from 'genkit';

const FilterSchema = z.object({
  column: z.string().describe('The column name to filter on.'),
  operator: z
    .enum([
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'like',
      'ilike',
      // Add other Supabase operators as needed, e.g., 'in', 'is'
    ])
    .describe('The filter operator (e.g., eq, gt, like).'),
  value: z
    .any()
    .describe(
      "The value to filter by. Should be a string, number, or boolean as appropriate for the column and operator. For 'like' or 'ilike', use '%' wildcards e.g. '%value%'."
    ),
});

const QuerySupabaseTableInputSchema = z.object({
  tableName: z
    .string()
    .describe('The name of the public Supabase table to query.'),
  selectQuery: z
    .string()
    .optional()
    .default('*')
    .describe(
      "The columns to select, e.g., '*' or 'column1, column2'. Defaults to '*'."
    ),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe('The maximum number of rows to return. Defaults to 5.'),
  filters: z
    .array(FilterSchema)
    .optional()
    .describe(
      "An array of filters to apply. E.g., [{column: 'status', operator: 'eq', value: 'active'}]"
    ),
  orderBy: z
    .object({
      column: z.string().describe('Column to order by.'),
      ascending: z
        .boolean()
        .optional()
        .default(true)
        .describe('True for ascending, false for descending. Defaults to true.'),
    })
    .optional()
    .describe('Optional ordering for the results.'),
});

const QuerySupabaseTableOutputSchema = z.object({
  result: z
    .string()
    .describe(
      'The query result as a JSON string, or an error message if the query failed.'
    ),
});

export const querySupabaseTableTool = ai.defineTool(
  {
    name: 'querySupabaseTableTool',
    description:
      'Queries a specified public table in the Supabase database. Use this to fetch data based on table name, columns, filters, limit, and ordering.',
    inputSchema: QuerySupabaseTableInputSchema,
    outputSchema: QuerySupabaseTableOutputSchema,
  },
  async (input) => {
    try {
      let query = supabase
        .from(input.tableName)
        .select(input.selectQuery || '*');

      if (input.filters && input.filters.length > 0) {
        input.filters.forEach((filter) => {
          // Supabase client methods like .eq(), .gt() are dynamically called
          // based on filter.operator. This requires careful handling of 'any' type
          // for filter.value if we were to be extremely type-safe, but for common cases
          // Supabase client handles string-to-type conversion well for basic operators.
          if (typeof (query as any)[filter.operator] === 'function') {
            query = (query as any)[filter.operator](
              filter.column,
              filter.value
            );
          } else {
            throw new Error(`Unsupported filter operator: ${filter.operator}`);
          }
        });
      }

      if (input.orderBy) {
        query = query.order(input.orderBy.column, {
          ascending: input.orderBy.ascending,
        });
      }

      query = query.limit(input.limit || 5);

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        return { result: `Error querying Supabase: ${error.message}` };
      }

      return { result: JSON.stringify(data, null, 2) };
    } catch (e: any) {
      console.error('Error in querySupabaseTableTool:', e);
      return { result: `Tool execution error: ${e.message}` };
    }
  }
);
