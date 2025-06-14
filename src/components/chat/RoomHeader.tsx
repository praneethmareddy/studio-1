'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';
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
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy link.',
        variant: 'destructive',
      });
    }
  };

  return (
    <header className="p-4 border-b bg-card shadow-sm sticky top-0 z-10 animate-fade-in">
      <div className="container mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-headline font-semibold text-primary">Room: {roomId}</h1>
          <p className="text-sm text-muted-foreground">Share this room ID or link to invite others.</p>
        </div>
        <Button onClick={handleCopyLink} variant="outline" size="sm" aria-label="Copy room link">
          <Copy className="mr-2 h-4 w-4" /> Copy Link
        </Button>
      </div>
    </header>
  );
}
