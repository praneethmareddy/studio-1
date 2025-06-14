'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { generateRoomId } from '@/lib/roomUtils';
import { MessageSquarePlus, LogIn } from 'lucide-react';

export default function HomePage() {
  const [roomIdInput, setRoomIdInput] = useState('');
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    router.push(`/room/${newRoomId}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomIdInput.trim()) {
      router.push(`/room/${roomIdInput.trim().toUpperCase()}`);
    }
  };

  if (!mounted) {
    // Avoids SSR/CSR mismatch for things like router pushes or Math.random in generateRoomId affecting initial render
    // You could show a global loader here too
    return null;
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="hsl(var(--primary))" xmlns="http://www.w3.org/2000/svg" className="transform transition-transform duration-500 hover:scale-110">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z"/>
              <path d="M9 11H11V13H9V11Z"/>
              <path d="M13 11H15V13H13V11Z"/>
              <path d="M7 8H17V10H7V8Z"/>
            </svg>
          </div>
          <CardTitle className="text-4xl font-headline">CommVerse</CardTitle>
          <CardDescription className="text-lg">Connect and Converse Instantly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            onClick={handleCreateRoom}
            className="w-full text-lg py-6 bg-primary hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105"
            aria-label="Create a new chat room"
          >
            <MessageSquarePlus className="mr-2 h-6 w-6" /> Create New Room
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
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
              placeholder="Enter Room ID"
              className="text-center text-lg py-6"
              aria-label="Enter Room ID to join"
            />
            <Button
              type="submit"
              variant="secondary"
              className="w-full text-lg py-6 border border-primary/50 hover:bg-secondary/80 transition-all duration-300 ease-in-out transform hover:scale-105"
              aria-label="Join existing room"
              disabled={!roomIdInput.trim()}
            >
              <LogIn className="mr-2 h-6 w-6" /> Join Room
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
          <p>Rooms are automatically dismantled after 5 minutes of inactivity.</p>
        </CardFooter>
      </Card>
    </main>
  );
}
