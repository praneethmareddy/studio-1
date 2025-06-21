'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { generateRoomId } from '@/lib/roomUtils';
import { MessageSquarePlus, LogIn, Sparkles, User } from 'lucide-react';

export default function HomePage() {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [username, setUsername] = useState('');
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateRoom = () => {
    if (username.trim()) {
      const newRoomId = generateRoomId();
      router.push(`/room/${newRoomId}?name=${encodeURIComponent(username.trim())}`);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomIdInput.trim() && username.trim()) {
      router.push(`/room/${roomIdInput.trim().toUpperCase()}?name=${encodeURIComponent(username.trim())}`);
    }
  };

  const isJoinDisabled = !roomIdInput.trim() || !username.trim();
  const isCreateDisabled = !username.trim();

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Sparkles className="h-16 w-16 text-primary animate-pulse" />
        <p className="text-primary/80 mt-4 text-lg">Loading CommVerse...</p>
      </div>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in">
      <Card className="w-full max-w-md shadow-xl hover:shadow-2xl transition-shadow duration-300 border-border/50">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-primary transform transition-transform duration-500 hover:scale-110 drop-shadow-[0_2px_3px_rgba(var(--primary-rgb),0.4)]">
               <defs>
                <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{stopColor: 'hsl(var(--primary))', stopOpacity: 1}} />
                  <stop offset="100%" style={{stopColor: 'hsl(var(--accent))', stopOpacity: 1}} />
                </linearGradient>
              </defs>
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" fill="url(#iconGradient)"/>
              <path d="M9 11H11V13H9V11Z" fill="hsl(var(--primary-foreground))" opacity="0.8"/>
              <path d="M13 11H15V13H13V11Z" fill="hsl(var(--primary-foreground))" opacity="0.8"/>
              <path d="M7 8H17V10H7V8Z" fill="hsl(var(--primary-foreground))" opacity="0.8"/>
            </svg>
          </div>
          <CardTitle className="text-5xl font-headline tracking-tight">CommVerse</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">Connect and Converse Instantly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
           <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-muted-foreground flex items-center gap-2 pl-1"><User className="h-4 w-4"/> Your Name</label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name to join"
              className="text-center text-lg py-6 md:py-7 placeholder:text-muted-foreground/70 focus:shadow-glow-primary-sm"
              aria-label="Enter your name"
              required
            />
          </div>

          <Button
            onClick={handleCreateRoom}
            className="w-full text-lg py-6 md:py-7 bg-gradient-to-r from-primary to-accent hover:shadow-glow-primary-md text-primary-foreground transition-all duration-300 ease-in-out transform hover:scale-105 active:animate-button-press"
            aria-label="Create a new chat room"
            size="lg"
            disabled={isCreateDisabled}
          >
            <MessageSquarePlus className="mr-2 h-6 w-6" /> Create New Room
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/70" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or join an existing room
              </span>
            </div>
          </div>
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <Input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
              placeholder="ENTER ROOM ID"
              className="text-center text-lg tracking-widest py-6 md:py-7 placeholder:text-muted-foreground/70 focus:shadow-glow-primary-sm"
              aria-label="Enter Room ID to join"
            />
            <Button
              type="submit"
              variant="secondary"
              className="w-full text-lg py-6 md:py-7 border border-primary/30 hover:border-primary/70 hover:bg-primary/10 hover:text-primary transition-all duration-300 ease-in-out transform hover:scale-105 active:animate-button-press"
              aria-label="Join existing room"
              disabled={isJoinDisabled}
              size="lg"
            >
              <LogIn className="mr-2 h-6 w-6" /> Join Room
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground pt-4">
          <p>Rooms are active for 5 minutes of inactivity.</p>
        </CardFooter>
      </Card>
       <p className="mt-8 text-xs text-muted-foreground animate-fade-in animation-delay-500">
        Press <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border/50 rounded-md">Ctrl/Cmd</kbd> + <kbd className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border/50 rounded-md">B</kbd> to toggle sidebar (if available).
      </p>
    </main>
  );
}
