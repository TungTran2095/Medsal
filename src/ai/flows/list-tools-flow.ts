
'use server';
/**
 * @fileOverview A Genkit flow to list available tools.
 *
 * - listAvailableTools - A function that returns a list of registered Genkit tools.
 * - AiToolInfo - The type for individual tool information.
 * - ListAvailableToolsOutput - The return type for the listAvailableTools function.
 */

import {ai} from '@/ai/genkit';
import type { Tool } from 'genkit/tool'; // Changed import from internal registry
import {z} from 'genkit';

// Define the schema for the output of a single tool's information
const AiToolInfoSchema = z.object({
  name: z.string().describe('The name of the AI tool.'),
  description: z.string().describe('A description of what the tool does.'),
  inputSchema: z.string().optional().describe('A JSON string representation of the tool\'s input Zod schema, or a description if stringification fails.'),
});
export type AiToolInfo = z.infer<typeof AiToolInfoSchema>;

// Define the schema for the overall flow output
const ListAvailableToolsOutputSchema = z.object({
  tools: z.array(AiToolInfoSchema).describe('A list of available AI tools.'),
});
export type ListAvailableToolsOutput = z.infer<typeof ListAvailableToolsOutputSchema>;


// Exported wrapper function
export async function listAvailableTools(): Promise<ListAvailableToolsOutput> {
  return listAvailableToolsFlow();
}

// Helper to attempt to stringify a Zod schema, or return its description.
function getSchemaRepresentation(schema: z.ZodTypeAny | undefined): string | undefined {
  if (!schema) return undefined;
  try {
    if (schema.description) {
      return `Description: ${schema.description}`;
    }
    if (schema._def && schema._def.typeName) {
        let representation = `Type: ${schema._def.typeName}`;
        if (schema._def.typeName === z.ZodFirstPartyTypeKind.ZodObject && schema._def.shape) {
            const shape = schema._def.shape();
            representation += ` { ${Object.keys(shape).join(', ')} }`;
        }
        return representation;
    }
    return 'Schema details not available for direct stringification in this simplified example.';
  } catch (e) {
    console.warn('Could not stringify schema:', e);
    return schema.description || 'Complex schema, view definition in code.';
  }
}


const listAvailableToolsFlow = ai.defineFlow(
  {
    name: 'listAvailableToolsFlow',
    inputSchema: z.void(),
    outputSchema: ListAvailableToolsOutputSchema,
  },
  async () => {
    const registeredTools: AiToolInfo[] = [];
    // Use ai.listActions('tool') which is a more public and stable API
    const toolActions = ai.listActions('tool');

    for (const action of toolActions) {
        // Since we filtered by 'tool', each action is a Tool.
        // The Tool interface extends Action, so properties like name, description, inputSchema are available.
        const tool = action as Tool<any, any>; // Cast to make TypeScript happy with specific Tool type access if needed, though Action properties are usually sufficient.
        registeredTools.push({
          name: tool.name,
          description: tool.description || 'No description provided.',
          inputSchema: getSchemaRepresentation(tool.inputSchema),
        });
    }
    return { tools: registeredTools };
  }
);

