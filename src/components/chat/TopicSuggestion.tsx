'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Lightbulb, Sparkles, AlertTriangle } from 'lucide-react';
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
      .filter(msg => msg.sender === 'user') 
      .map(msg => msg.text)
      .join('\n');

    if (chatContent.trim().length < 20) { 
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
    <div className="p-3 md:p-4 space-y-4 h-full flex flex-col">
      <Card className="shadow-lg border-border/50 flex-grow flex flex-col bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center font-headline tracking-tight text-primary">
            <Lightbulb className="mr-2.5 h-6 w-6 text-primary drop-shadow-[0_1px_2px_rgba(var(--primary-rgb),0.4)]" />
            Topic Ideas
          </CardTitle>
          <CardDescription className="text-muted-foreground">Running out of things to say? Let AI help!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 flex-grow overflow-y-auto custom-scrollbar pr-1"> {/* Added custom-scrollbar if needed */}
          {error && (
            <Alert variant="destructive" className="my-2 animate-shake">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Suggestion Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
              <p className="ml-2 text-muted-foreground">Thinking of topics...</p>
              <p className="text-xs text-muted-foreground/70">AI is brewing some ideas!</p>
            </div>
          )}

          {!isLoading && !error && suggestedTopics.length === 0 && (
            <div className="text-center text-muted-foreground py-6 px-2">
              <Sparkles className="mx-auto h-12 w-12 mb-3 text-accent opacity-80" />
              <p className="font-medium">Ready for inspiration?</p>
              <p className="text-sm">Click below to get topic suggestions based on your chat!</p>
            </div>
          )}
          
          {suggestedTopics.length > 0 && (
            <ul className="list-none space-y-2.5">
              {suggestedTopics.map((topic, index) => (
                <li 
                  key={index} 
                  className="p-3 bg-background rounded-md border border-primary/20 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 transform hover:scale-[1.02]"
                  style={{animation: `slide-in-up 0.3s ease-out ${index * 0.05}s backwards`}}
                >
                  <p className="text-sm text-foreground">{topic}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <div className="p-3 md:p-4 border-t border-border/50 mt-auto">
          <Button 
            onClick={handleSuggestTopics} 
            disabled={isLoading} 
            className="w-full bg-gradient-to-r from-accent to-pink-500 hover:shadow-glow-accent-md text-accent-foreground transition-all duration-300 ease-in-out transform hover:scale-105 active:animate-button-press py-3 text-base"
            aria-label="Suggest conversation topics"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-5 w-5" />
            )}
            Get Suggestions
          </Button>
        </div>
      </Card>
    </div>
  );
}
