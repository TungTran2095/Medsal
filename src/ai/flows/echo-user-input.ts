
// use server'
'use server';
/**
 * @fileOverview Implements the echoUserInput flow which takes user input and interacts with a Gemini-powered AI.
 * The AI can use tools to query the Supabase database.
 *
 * - echoUserInput - A function that handles the AI interaction.
 * - EchoUserInputInput - The input type for the echoUserInput function.
 * - EchoUserInputOutput - The return type for the echoUserInput function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { querySupabaseTableTool } from '@/ai/tools/supabaseQueryTool';

const EchoUserInputInputSchema = z.object({
  userInput: z.string().describe('The user input to be processed by the AI.'),
  previousContext: z
    .string()
    .optional()
    .describe('The previous context of the conversation.'),
});
export type EchoUserInputInput = z.infer<typeof EchoUserInputInputSchema>;

const EchoUserInputOutputSchema = z.object({
  echoedResponse: z.string().describe("The AI's response to the user, potentially including data from Supabase."),
});
export type EchoUserInputOutput = z.infer<typeof EchoUserInputOutputSchema>;

export async function echoUserInput(input: EchoUserInputInput): Promise<EchoUserInputOutput> {
  return echoUserInputFlow(input);
}

const prompt = ai.definePrompt({
  name: 'echoUserInputPrompt',
  input: {schema: EchoUserInputInputSchema},
  output: {schema: EchoUserInputOutputSchema},
  tools: [querySupabaseTableTool],
  prompt: `You are a helpful and friendly AI assistant named Echo.
Your goal is to assist the user with their questions and tasks.
Use the previous context to maintain a natural conversation flow.

If the user asks for information that might be in the database (e.g., "show me employees", "what are the latest orders?", "find customer details"), use the 'querySupabaseTableTool' to fetch it.
When deciding to use the tool, consider if the user's request implies accessing structured data that likely resides in a database table.

To use the 'querySupabaseTableTool':
- You MUST provide the 'tableName'. Ask clarifying questions if the table name is ambiguous (e.g., "From which table should I fetch the employees? Perhaps the 'Fulltime' table?").
- You can optionally provide 'selectQuery' (e.g., 'employee_name, salary' or '*' for all columns, defaults to '*').
- You can optionally provide 'limit' (e.g., 3 to get 3 rows, defaults to 5).
- You can optionally provide 'filters' as an array of objects. Each filter object needs 'column', 'operator' (e.g., 'eq', 'gt', 'like', 'ilike'), and 'value'. For 'like'/'ilike' operators, use '%' as a wildcard (e.g., {column: 'employee_name', operator: 'ilike', value: '%john%'}). Ensure the 'value' is appropriate for the column's data type (e.g., a number for a salary column, a string for a name).
- You can optionally provide 'orderBy' with 'column' and 'ascending' (boolean, defaults to true).

Example of using the tool: If the user asks "Show me the first 2 employees from the Fulltime table whose salary is more than 50000", you might call querySupabaseTableTool with:
tableName: 'Fulltime'
selectQuery: 'employee_name, salary'
limit: 2
filters: [{column: 'salary', operator: 'gt', value: 50000}] // Notice value is a number here
orderBy: {column: 'employee_name', ascending: true}

After receiving the result from the tool:
- If the tool returns a JSON array of data, you MUST summarize or list this data clearly for the user. Do not just say you fetched it; SHOW or DESCRIBE the data.
- If the tool returns a message like "No records found...", inform the user of this.
- If the tool returns an error message (e.g., "Error querying Supabase..."), inform the user clearly about the error, explaining what might have gone wrong (e.g., "I couldn't find a table named X" or "There was an issue with the query parameters").
Do not output raw JSON.

Previous Context:
{{#if previousContext}}
{{{previousContext}}}
{{else}}
This is the beginning of the conversation.
{{/if}}

User Input:
{{{userInput}}}

Your Response:`,
});

const echoUserInputFlow = ai.defineFlow(
  {
    name: 'echoUserInputFlow',
    inputSchema: EchoUserInputInputSchema,
    outputSchema: EchoUserInputOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

