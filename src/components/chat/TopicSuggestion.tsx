
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, Sparkles, AlertTriangle } from 'lucide-react';
import { suggestConversationTopics, SuggestConversationTopicsInput } from '@/ai/flows/suggest-conversation-topics';
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
    <div className="p-3 md:p-4 space-y-3">
      <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
              <Lightbulb className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground tracking-tight">Topic Ideas</h3>
          </div>
          <Button 
            onClick={handleSuggestTopics} 
            disabled={isLoading} 
            size="sm"
            variant="ghost"
            className="text-primary hover:text-primary hover:bg-primary/10 h-8 px-3"
            aria-label="Get topic ideas"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">{isLoading ? 'Generating...' : 'Get Ideas'}</span>
          </Button>
      </div>

      <div className="min-h-[4rem] flex flex-col justify-center transition-all duration-300">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive animate-shake">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center text-sm text-muted-foreground py-4">
            <Loader2 className="h-5 w-5 animate-spin mr-2.5" />
            <span>Thinking of great topics...</span>
          </div>
        )}

        {!isLoading && !error && suggestedTopics.length === 0 && (
          <div className="text-center text-sm text-muted-foreground p-2">
            <p>Click "Get Ideas" to generate topics from the chat.</p>
          </div>
        )}
        
        {suggestedTopics.length > 0 && (
          <ul className="space-y-2">
            {suggestedTopics.map((topic, index) => (
              <li 
                key={index} 
                className="p-2.5 bg-background rounded-lg border border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all text-sm flex items-center gap-2.5 group"
                style={{animation: `slide-in-up 0.3s ease-out ${index * 0.05}s backwards`}}
              >
                <Sparkles className="h-4 w-4 text-accent shrink-0 group-hover:scale-110 transition-transform" />
                <p className="text-foreground">{topic}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
