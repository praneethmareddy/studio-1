'use server';

/**
 * @fileOverview AI agent that summarizes chat content.
 *
 * - summarizeChat - A function that summarizes the chat.
 * - SummarizeChatInput - The input type for the summarizeChat function.
 * - SummarizeChatOutput - The return type for the summarizeChat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeChatInputSchema = z.object({
  chatContent: z
    .string()
    .describe('The current content of the chat to summarize.'),
});
export type SummarizeChatInput = z.infer<
  typeof SummarizeChatInputSchema
>;

const SummarizeChatOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise summary of the chat content.'),
});
export type SummarizeChatOutput = z.infer<
  typeof SummarizeChatOutputSchema
>;

export async function summarizeChat(
  input: SummarizeChatInput
): Promise<SummarizeChatOutput> {
  return summarizeChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeChatPrompt',
  input: {schema: SummarizeChatInputSchema},
  output: {schema: SummarizeChatOutputSchema},
  prompt: `You are an AI assistant designed to summarize conversations.

  Based on the chat content provided, provide a concise summary of the key points.

  Chat Content: {{{chatContent}}}

  Summary:`,
});

const summarizeChatFlow = ai.defineFlow(
  {
    name: 'summarizeChatFlow',
    inputSchema: SummarizeChatInputSchema,
    outputSchema: SummarizeChatOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
