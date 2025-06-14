'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Link as LinkIcon } from 'lucide-react'; // Changed to LinkIcon to avoid conflict
import { useEffect, useState } from 'react';

interface RoomHeaderProps {
  roomId: string;
}

export default function RoomHeader({ roomId }: RoomHeaderProps) {
  const { toast } = useToast();
  const [roomUrl, setRoomUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRoomUrl(window.location.href);
    }
  }, []);

  const handleCopyLink = async () => {
    if (!roomUrl) return;
    try {
      await navigator.clipboard.writeText(roomUrl);
      toast({
        title: 'Link Copied!',
        description: 'Room link copied to clipboard.',
        duration: 3000,
      });
    } catch (err) {
      toast({
        title: 'Error Copying Link',
        description: 'Failed to copy room link. Please try again.',
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
          <p className="text-sm text-muted-foreground mt-1">Share this room ID or link to invite others.</p>
        </div>
        <Button 
          onClick={handleCopyLink} 
          variant="outline" 
          size="default" 
          aria-label="Copy room link"
          className="border-primary/40 hover:bg-primary/10 hover:text-primary hover:border-primary/70 transition-all duration-200 group"
        >
          <Copy className="mr-2 h-4 w-4 group-hover:animate-pulse" /> Copy Link
        </Button>
      </div>
    </header>
  );
}
