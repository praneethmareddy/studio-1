'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Link as LinkIcon } from 'lucide-react';

interface RoomHeaderProps {
  roomId: string;
}

export default function RoomHeader({ roomId }: RoomHeaderProps) {
  const { toast } = useToast();

  const handleCopyId = async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
      toast({
        title: 'Room ID Copied!',
        description: 'You can now share it with others to join.',
        duration: 3000,
      });
    } catch (err) {
      toast({
        title: 'Error Copying ID',
        description: 'Failed to copy room ID. Please try again.',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  return (
    <header 
      style={{'--header-height': '73px'} as React.CSSProperties} 
      className="p-4 border-b border-border/50 bg-card shadow-md sticky top-0 z-20 animate-fade-in"
    >
      <div className="container mx-auto flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-6 w-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-headline font-semibold text-primary tracking-tight">
              Room: <span className="font-bold text-accent">{roomId}</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 hidden sm:block">Share this room ID to invite others.</p>
        </div>
        <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground hidden md:block">Copy ID:</p>
            <Button 
              onClick={handleCopyId} 
              variant="outline" 
              size="icon" 
              aria-label="Copy Room ID"
              className="border-primary/40 hover:bg-primary/10 hover:text-primary hover:border-primary/70 transition-all duration-200 group h-10 w-10"
            >
              <Copy className="h-5 w-5 group-hover:animate-pulse" />
            </Button>
        </div>
      </div>
    </header>
  );
}
