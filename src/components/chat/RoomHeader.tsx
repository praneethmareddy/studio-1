'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Users, MessageSquare, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback } from '../ui/avatar';
import type { VideoParticipant } from '@/types';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ThemeToggleButton } from '../theme/theme-toggle-button';


interface RoomHeaderProps {
  roomId: string;
  videoParticipants: VideoParticipant[];
  onToggleChat: () => void;
  isChatOpen: boolean;
}

export default function RoomHeader({ roomId, videoParticipants, onToggleChat, isChatOpen }: RoomHeaderProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();

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
      style={{'--header-height': '65px'} as React.CSSProperties} 
      className="p-3 border-b border-border/50 bg-card shadow-sm sticky top-0 z-20 animate-fade-in"
    >
      <div className="container mx-auto flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-1.5 px-2 h-9">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-lg font-bold text-foreground">{videoParticipants.length}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="font-semibold text-sm mb-2">In Call</div>
                <ScrollArea className="max-h-48">
                  <div className="space-y-2 pr-2">
                    {videoParticipants.length > 0 ? videoParticipants.map(p => (
                        <div key={p.id} className="flex items-center gap-2 text-sm">
                            <Avatar className="h-7 w-7 text-xs">
                                <AvatarFallback className="bg-muted text-muted-foreground">{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{p.name}</span>
                        </div>
                    )) : (
                      <p className="text-xs text-muted-foreground">No one else is in the call yet.</p>
                    )}
                  </div>
                </ScrollArea>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl md:text-2xl font-headline font-semibold text-foreground tracking-tight whitespace-nowrap">
              Room: <span className="font-bold text-primary">{roomId}</span>
            </h1>
            <Button 
              onClick={handleCopyId} 
              variant="ghost" 
              size="icon" 
              aria-label="Copy Room ID"
              className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200 group h-8 w-8"
            >
              <Copy className="h-4 w-4 group-hover:animate-pulse" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <Button
              onClick={onToggleChat}
              variant="outline"
              size="icon"
              className={cn(
                !isMobile && isChatOpen && "bg-accent text-accent-foreground"
              )}
            >
                {isChatOpen && !isMobile ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                <span className="sr-only">{isChatOpen && !isMobile ? "Close Chat" : "Open Chat"}</span>
            </Button>
            <ThemeToggleButton />
        </div>
       
      </div>
    </header>
  );
}
