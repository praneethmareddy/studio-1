'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Lightbulb, Sparkles } from 'lucide-react';
import { suggestConversationTopics, SuggestConversationTopicsInput } from '@/ai/flows/suggest-conversation-topics';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Message } from '@/types';

interface TopicSuggestionProps {
  messages: Message[];
}

export default function TopicSuggestion({ messages }: TopicSuggestionProps) {
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuggestTopics = async () => {
    setIsLoading(true);
    setError(null);
    setSuggestedTopics([]);

    const chatContent = messages
      .filter(msg => msg.sender === 'user') // Only use user messages for context
      .map(msg => msg.text)
      .join('\n');

    if (chatContent.trim().length < 20) { // Require some content before suggesting
      setError("Not enough chat content to suggest topics. Keep chatting!");
      setIsLoading(false);
      return;
    }

    try {
      const input: SuggestConversationTopicsInput = { chatContent };
      const result = await suggestConversationTopics(input);
      if (result.topics && result.topics.length > 0) {
        setSuggestedTopics(result.topics);
      } else {
        setError("Couldn't find any specific topics, but feel free to discuss anything!");
      }
    } catch (e) {
      console.error("Failed to suggest topics:", e);
      setError("Sorry, I couldn't come up with topics right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      <Card className="shadow-md flex-grow flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center font-headline">
            <Lightbulb className="mr-2 h-6 w-6 text-primary" />
            Topic Ideas
          </CardTitle>
          <CardDescription>Running out of things to say? Let AI help!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 flex-grow overflow-y-auto">
          {error && (
            <Alert variant="destructive" className="my-2">
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Suggestion Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Thinking of topics...</p>
            </div>
          )}

          {!isLoading && !error && suggestedTopics.length === 0 && (
            <div className="text-center text-muted-foreground py-6">
              <Sparkles className="mx-auto h-10 w-10 mb-2 text-accent" />
              <p>Click the button below to get topic suggestions based on your chat!</p>
            </div>
          )}
          
          {suggestedTopics.length > 0 && (
            <ul className="list-none space-y-2">
              {suggestedTopics.map((topic, index) => (
                <li key={index} className="p-3 bg-background rounded-md border border-primary/20 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-sm text-foreground">{topic}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <div className="p-4 border-t mt-auto">
          <Button 
            onClick={handleSuggestTopics} 
            disabled={isLoading} 
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground transition-transform transform hover:scale-105"
            aria-label="Suggest conversation topics"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Get Suggestions
          </Button>
        </div>
      </Card>
    </div>
  );
}
