'use client';

import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video as VideoIcon, VideoOff as VideoIconOff, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallControlsProps {
  isMicEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
  className?: string;
}

export default function CallControls({
  isMicEnabled,
  isVideoEnabled,
  onToggleMic,
  onToggleVideo,
  onLeaveCall,
  className
}: CallControlsProps) {
  return (
    <div className={cn("flex justify-center items-center gap-2 md:gap-3 p-3 bg-card rounded-xl shadow-lg border", className)}>
      <Button
        onClick={onToggleMic}
        variant={isMicEnabled ? "outline" : "secondary"}
        size="lg"
        aria-label={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
        className={cn("transition-all rounded-full w-12 h-12 md:w-14 md:h-14 p-0", !isMicEnabled && "bg-destructive hover:bg-destructive/90 text-destructive-foreground")}
      >
        {isMicEnabled ? <Mic className="h-5 w-5 md:h-6 md:w-6" /> : <MicOff className="h-5 w-5 md:h-6 md:w-6" />}
      </Button>
      <Button
        onClick={onToggleVideo}
        variant={isVideoEnabled ? "outline" : "secondary"}
        size="lg"
        aria-label={isVideoEnabled ? "Stop video" : "Start video"}
         className={cn("transition-all rounded-full w-12 h-12 md:w-14 md:h-14 p-0", !isVideoEnabled && "bg-destructive hover:bg-destructive/90 text-destructive-foreground")}
      >
        {isVideoEnabled ? <VideoIcon className="h-5 w-5 md:h-6 md:w-6" /> : <VideoIconOff className="h-5 w-5 md:h-6 md:w-6" />}
      </Button>
      <Button
        onClick={onLeaveCall}
        variant="destructive"
        size="lg"
        aria-label="Leave call"
        className="transition-all rounded-full w-12 h-12 md:w-14 md:h-14 p-0"
      >
        <PhoneOff className="h-5 w-5 md:h-6 md:w-6" />
      </Button>
    </div>
  );
}
