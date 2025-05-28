
// use server'
'use server';
/**
 * @fileOverview Implements the echoUserInput flow which takes user input and interacts with a Gemini-powered AI.
 *
 * - echoUserInput - A function that handles the AI interaction.
 * - EchoUserInputInput - The input type for the echoUserInput function.
 * - EchoUserInputOutput - The return type for the echoUserInput function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EchoUserInputInputSchema = z.object({
  userInput: z.string().describe('The user input to be processed by the AI.'),
  previousContext: z
    .string()
    .optional()
    .describe('The previous context of the conversation.'),
});
export type EchoUserInputInput = z.infer<typeof EchoUserInputInputSchema>;

const EchoUserInputOutputSchema = z.object({
  echoedResponse: z.string().describe("The AI's response to the user."),
});
export type EchoUserInputOutput = z.infer<typeof EchoUserInputOutputSchema>;

export async function echoUserInput(input: EchoUserInputInput): Promise<EchoUserInputOutput> {
  return echoUserInputFlow(input);
}

const prompt = ai.definePrompt({
  name: 'echoUserInputPrompt',
  input: {schema: EchoUserInputInputSchema},
  output: {schema: EchoUserInputOutputSchema},
  prompt: `You are a helpful and friendly AI assistant named Echo.
Your goal is to assist the user with their questions and tasks.
Use the previous context to maintain a natural conversation flow.

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

