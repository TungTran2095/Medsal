// use server'
'use server';
/**
 * @fileOverview Implements the echoUserInput flow which takes user input and echoes it back in a conversational manner.
 *
 * - echoUserInput - A function that handles the echoing of user input.
 * - EchoUserInputInput - The input type for the echoUserInput function.
 * - EchoUserInputOutput - The return type for the echoUserInput function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EchoUserInputInputSchema = z.object({
  userInput: z.string().describe('The user input to be echoed back.'),
  previousContext: z
    .string()
    .optional()
    .describe('The previous context of the conversation.'),
});
export type EchoUserInputInput = z.infer<typeof EchoUserInputInputSchema>;

const EchoUserInputOutputSchema = z.object({
  echoedResponse: z.string().describe('The AI echoed response.'),
});
export type EchoUserInputOutput = z.infer<typeof EchoUserInputOutputSchema>;

export async function echoUserInput(input: EchoUserInputInput): Promise<EchoUserInputOutput> {
  return echoUserInputFlow(input);
}

const prompt = ai.definePrompt({
  name: 'echoUserInputPrompt',
  input: {schema: EchoUserInputInputSchema},
  output: {schema: EchoUserInputOutputSchema},
  prompt: `You are an AI that echoes user input in a conversational and contextually relevant manner.

  Previous Context: {{previousContext}}

  User Input: {{userInput}}

  Echoed Response: `,
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
