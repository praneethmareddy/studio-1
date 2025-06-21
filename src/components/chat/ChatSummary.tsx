'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, Sparkles, AlertTriangle, BookText } from 'lucide-react';
import { summarizeChat, SummarizeChatInput } from '@/ai/flows/suggest-conversation-topics';
import type { Message } from '@/types';

interface ChatSummaryProps {
  messages: Message[];
}

export default function ChatSummary({ messages }: ChatSummaryProps) {
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async () => {
    setIsLoading(true);
    setError(null);
    setSummary('');

    const chatContent = messages
      .filter(msg => msg.sender === 'user') 
      .map(msg => `${msg.senderName}: ${msg.text}`)
      .join('\n');

    if (chatContent.trim().length < 50) { 
      setError("Not enough chat content to create a summary. Keep chatting!");
      setIsLoading(false);
      return;
    }

    try {
      const input: SummarizeChatInput = { chatContent };
      const result = await summarizeChat(input);
      if (result.summary) {
        setSummary(result.summary);
      } else {
        setError("Couldn't generate a summary from the conversation.");
      }
    } catch (e) {
      console.error("Failed to summarize chat:", e);
      setError("Sorry, I couldn't create a summary right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3 md:p-4 space-y-3">
      <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
              <BookText className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground tracking-tight">Chat Summary</h3>
          </div>
          <Button 
            onClick={handleSummarize} 
            disabled={isLoading} 
            size="sm"
            variant="ghost"
            className="text-primary hover:text-primary hover:bg-primary/10 h-8 px-3"
            aria-label="Summarize chat"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">{isLoading ? 'Generating...' : 'Summarize'}</span>
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
            <span>Reading the chat and summarizing...</span>
          </div>
        )}

        {!isLoading && !error && !summary && (
          <div className="text-center text-sm text-muted-foreground p-2">
            <p>Click "Summarize" to get a summary of the chat.</p>
          </div>
        )}
        
        {summary && (
          <div 
            className="p-2.5 bg-background rounded-lg border border-primary/20 text-sm flex flex-col gap-2.5"
            style={{animation: `slide-in-up 0.3s ease-out backwards`}}
          >
            <p className="text-foreground whitespace-pre-wrap">{summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
