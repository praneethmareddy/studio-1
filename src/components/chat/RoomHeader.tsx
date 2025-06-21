'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Users } from 'lucide-react';

interface RoomHeaderProps {
  roomId: string;
  participantCount: number;
}

export default function RoomHeader({ roomId, participantCount }: RoomHeaderProps) {
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
      <div className="container mx-auto flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-headline font-semibold text-primary tracking-tight whitespace-nowrap">
            Room: <span className="font-bold text-accent">{roomId}</span>
          </h1>
          <Button 
            onClick={handleCopyId} 
            variant="ghost" 
            size="icon" 
            aria-label="Copy Room ID"
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200 group h-8 w-8"
          >
            <Copy className="h-5 w-5 group-hover:animate-pulse" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-primary">
          <Users className="h-6 w-6" />
          <span className="text-xl font-bold">{participantCount}</span>
        </div>
      </div>
    </header>
  );
}
