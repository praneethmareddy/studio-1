'use server';

/**
 * @fileOverview AI agent that suggests conversation topics based on chat content.
 *
 * - suggestConversationTopics - A function that suggests conversation topics.
 * - SuggestConversationTopicsInput - The input type for the suggestConversationTopics function.
 * - SuggestConversationTopicsOutput - The return type for the suggestConversationTopics function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestConversationTopicsInputSchema = z.object({
  chatContent: z
    .string()
    .describe('The current content of the chat to suggest topics from.'),
});
export type SuggestConversationTopicsInput = z.infer<
  typeof SuggestConversationTopicsInputSchema
>;

const SuggestConversationTopicsOutputSchema = z.object({
  topics: z
    .array(z.string())
    .describe('An array of suggested conversation topics.'),
});
export type SuggestConversationTopicsOutput = z.infer<
  typeof SuggestConversationTopicsOutputSchema
>;

export async function suggestConversationTopics(
  input: SuggestConversationTopicsInput
): Promise<SuggestConversationTopicsOutput> {
  return suggestConversationTopicsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestConversationTopicsPrompt',
  input: {schema: SuggestConversationTopicsInputSchema},
  output: {schema: SuggestConversationTopicsOutputSchema},
  prompt: `You are an AI assistant designed to suggest engaging conversation topics.

  Based on the chat content provided, suggest three relevant and interesting conversation topics.

  Chat Content: {{{chatContent}}}

  Topics:`,
});

const suggestConversationTopicsFlow = ai.defineFlow(
  {
    name: 'suggestConversationTopicsFlow',
    inputSchema: SuggestConversationTopicsInputSchema,
    outputSchema: SuggestConversationTopicsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
