'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [messageText, setMessageText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t bg-card sticky bottom-0 z-10">
      <Input
        type="text"
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        placeholder="Type your message..."
        className="flex-grow focus-visible:ring-primary"
        disabled={disabled}
        aria-label="Chat message input"
      />
      <Button type="submit" disabled={!messageText.trim() || disabled} aria-label="Send message">
        <Send className="h-5 w-5" />
      </Button>
    </form>
  );
}
