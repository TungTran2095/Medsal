
'use server';
/**
 * @fileOverview A Genkit flow to list available tools.
 *
 * - listAvailableTools - A function that returns a list of registered Genkit tools.
 * - AiToolInfo - The type for individual tool information.
 * - ListAvailableToolsOutput - The return type for the listAvailableTools function.
 */

import {ai} from '@/ai/genkit';
import {Tool} from 'genkit/internal/registry';
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
// This is a simplified approach. For complex schemas, more robust handling might be needed.
function getSchemaRepresentation(schema: z.ZodTypeAny | undefined): string | undefined {
  if (!schema) return undefined;
  try {
    // Attempt to get a structural representation. This is not a standard Zod feature for full JSON schema.
    // A common practice is to use zod-to-json-schema, but for simplicity here,
    // we'll try to access the description or typeName.
    // For more detailed schema representation, you'd integrate a library like zod-to-json-schema.
    if (schema.description) {
      return `Description: ${schema.description}`;
    }
    // Fallback for basic types
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
    inputSchema: z.void(), // Changed from z.undefined()
    outputSchema: ListAvailableToolsOutputSchema,
  },
  async () => {
    const registeredTools: AiToolInfo[] = [];
    const toolMap = ai.registry.listTools();

    for (const tool of toolMap) {
        const typedTool = tool as Tool<any, any>; // Cast to Genkit's internal Tool type if needed or use specific type
        registeredTools.push({
          name: typedTool.name,
          description: typedTool.description || 'No description provided.',
          // @ts-ignore // Accessing _def.inputSchema, might need adjustment based on actual Genkit Tool definition structure
          inputSchema: getSchemaRepresentation(typedTool.inputSchema),
        });
    }
    return { tools: registeredTools };
  }
);

