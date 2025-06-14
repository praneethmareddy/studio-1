'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import RoomHeader from '@/components/chat/RoomHeader';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessage from '@/components/chat/ChatMessage';
import TopicSuggestion from '@/components/chat/TopicSuggestion';
import type { Message } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

export default function RoomPage() {
  const params = useParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);


  useEffect(() => {
    setMounted(true);
    // Generate a simple client-side unique ID for this session
    setCurrentUserId(`user-${Math.random().toString(36).substring(2, 9)}`);

    if (roomId) {
      setMessages([
        { 
          id: 'system-welcome', 
          text: `Welcome to Room ${roomId}! Start chatting or get topic suggestions.`, 
          sender: 'system', 
          timestamp: new Date(),
          roomId: roomId,
        }
      ]);
    }
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = (text: string) => {
    if (!currentUserId) return; // Should not happen if mounted
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, // More unique ID
      text,
      sender: 'user', 
      timestamp: new Date(),
      roomId,
      userId: currentUserId, 
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
  };

  if (!mounted || !roomId) {
    return (
      <div className="flex items-center justify-center min-h-screen text-lg text-primary animate-pulse">
        Loading CommVerse Room...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <RoomHeader roomId={roomId} />
      
      <div className="flex flex-1 overflow-hidden md:flex-row flex-col-reverse">
        {/* Main chat area */}
        <main className="flex-1 flex flex-col overflow-hidden p-2 md:p-4">
          <Card className="flex-1 flex flex-col overflow-hidden shadow-inner bg-white dark:bg-gray-800 rounded-lg">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {messages.map(msg => (
                  <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    isCurrentUser={msg.userId === currentUserId && msg.sender === 'user'} 
                  />
                ))}
              </div>
              <div ref={messagesEndRef} />
            </ScrollArea>
            <ChatInput onSendMessage={handleSendMessage} />
          </Card>
        </main>

        {/* Sidebar for topic suggestions */}
        <aside className="w-full md:w-96 lg:w-[400px] border-t md:border-t-0 md:border-l bg-card overflow-y-auto flex flex-col shadow-lg md:rounded-l-lg">
          <TopicSuggestion messages={messages} />
        </aside>
      </div>
    </div>
  );
}
