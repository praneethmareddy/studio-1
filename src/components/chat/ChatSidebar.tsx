'use client';

import React, { Suspense } from 'react';
import type { Message } from '@/types';
import type { Socket } from 'socket.io-client';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatSummary from '@/components/chat/ChatSummary';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, X } from 'lucide-react';

interface ChatSidebarProps {
  messages: Message[];
  allParticipants: Map<string, { name: string }>;
  socket: Socket | null;
  onSendMessage: (text: string) => void;
  onClose: () => void;
  isMobile?: boolean;
}

export default function ChatSidebar({
  messages,
  allParticipants,
  socket,
  onSendMessage,
  onClose,
  isMobile = false,
}: ChatSidebarProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <aside className="w-full md:w-[340px] lg:w-[380px] border-t md:border-t-0 md:border-l border-border/50 bg-card flex flex-col shadow-lg max-h-full h-full">
      <div className="p-3 border-b border-border/50 sticky top-0 bg-card z-10 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-primary tracking-tight">Live Chat</h2>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-muted-foreground px-2 h-8">
                <Users className="h-4 w-4" />
                <span className="font-medium">{allParticipants.size}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" side="top" align="end">
              <div className="font-semibold text-sm mb-2">Room Members</div>
              <ScrollArea className="max-h-48">
                <div className="space-y-2 pr-2">
                  {Array.from(allParticipants.entries()).map(([id, p]) => (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      <Avatar className="h-7 w-7 text-xs">
                        <AvatarFallback className="bg-muted text-muted-foreground">{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{p.name}{id === socket?.id ? ' (You)' : ''}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-5 w-5" />
              <span className="sr-only">Close Chat</span>
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 p-2 md:p-3">
        <div className="space-y-3">
          {messages.map(msg => (
            <ChatMessage
              key={msg.id || `${msg.userId}-${msg.timestamp}`}
              message={msg}
              isCurrentUser={msg.userId === socket?.id}
            />
          ))}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>
      
      <ChatInput onSendMessage={onSendMessage} disabled={!socket} />
      
      <div className="border-t border-border/50 bg-background/30">
        <ChatSummary messages={messages} />
      </div>
    </aside>
  );
}
