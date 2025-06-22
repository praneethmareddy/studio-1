
'use client';

import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video as VideoIcon, VideoOff as VideoIconOff, PhoneOff, ScreenShare, ScreenShareOff, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';


interface CallControlsProps {
  isMicEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeaveCall: () => void;
  onSendReaction: (emoji: string) => void;
  className?: string;
}

const EMOJI_REACTIONS = ['👍', '❤️', '🎉', '😂', '😮', '👏'];

export default function CallControls({
  isMicEnabled,
  isVideoEnabled,
  isScreenSharing,
  onToggleMic,
  onToggleVideo,
  onToggleScreenShare,
  onLeaveCall,
  onSendReaction,
  className,
}: CallControlsProps) {
  const controlButtonBaseClass = "transition-all duration-200 ease-in-out transform hover:scale-110 rounded-full w-14 h-14 md:w-16 md:h-16 p-0 text-lg shadow-lg active:animate-button-press disabled:transform-none disabled:cursor-not-allowed";
  
  return (
    <TooltipProvider>
      <div className={cn(
          "flex justify-center items-center gap-3 md:gap-4 p-3 bg-card/70 backdrop-blur-sm rounded-xl shadow-xl border border-border/50", 
          className
        )}
      >
        <Button
          onClick={onToggleMic}
          variant={isMicEnabled ? "outline" : "secondary"}
          aria-label={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
          className={cn(
            controlButtonBaseClass, 
            isMicEnabled ? "border-primary/50 hover:bg-primary/10 text-primary" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-glow-accent-sm"
          )}
        >
          {isMicEnabled ? <Mic className="h-6 w-6 md:h-7 md:w-7" /> : <MicOff className="h-6 w-6 md:h-7 md:w-7" />}
        </Button>
        <Button
          onClick={onToggleVideo}
          variant={isVideoEnabled ? "outline" : "secondary"}
          aria-label={isVideoEnabled ? "Stop video" : "Start video"}
          disabled={isScreenSharing}
          className={cn(
            controlButtonBaseClass, 
            isVideoEnabled ? "border-primary/50 hover:bg-primary/10 text-primary" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-glow-accent-sm",
            "disabled:bg-muted disabled:border-border disabled:text-muted-foreground"
            )}
        >
          {isVideoEnabled ? <VideoIcon className="h-6 w-6 md:h-7 md:w-7" /> : <VideoIconOff className="h-6 w-6 md:h-7 md:w-7" />}
        </Button>
        <Tooltip>
            <TooltipTrigger asChild>
                {/* A wrapper div is needed for Tooltip to work on a disabled button */}
                <div className="relative"> 
                    <Button
                        onClick={onToggleScreenShare}
                        variant={isScreenSharing ? "secondary" : "outline"}
                        aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
                        className={cn(
                            controlButtonBaseClass,
                            isScreenSharing ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-primary/50 hover:bg-primary/10 text-primary",
                            "disabled:bg-muted disabled:border-border disabled:text-muted-foreground"
                        )}
                        >
                        {isScreenSharing ? <ScreenShareOff className="h-6 w-6 md:h-7 md:w-7" /> : <ScreenShare className="h-6 w-6 md:h-7 md:w-7" />}
                    </Button>
                </div>
            </TooltipTrigger>
        </Tooltip>

        <Popover>
          <PopoverTrigger asChild>
              <Button
                  variant="outline"
                  aria-label="Send reaction"
                  className={cn(controlButtonBaseClass, "border-primary/50 hover:bg-primary/10 text-primary")}
              >
                  <Smile className="h-6 w-6 md:h-7 md:w-7" />
              </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-card/80 backdrop-blur-md border-border/60">
              <div className="flex gap-2">
                  {EMOJI_REACTIONS.map(emoji => (
                      <Button
                          key={emoji}
                          variant="ghost"
                          onClick={() => onSendReaction(emoji)}
                          className="text-2xl p-2 rounded-full h-12 w-12 hover:bg-accent/50 transform transition-transform hover:scale-125"
                      >
                          {emoji}
                      </Button>
                  ))}
              </div>
          </PopoverContent>
        </Popover>

        <Button
          onClick={onLeaveCall}
          variant="destructive"
          aria-label="Leave call"
          className={cn(controlButtonBaseClass, "bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white shadow-glow-accent-md")}
        >
          <PhoneOff className="h-6 w-6 md:h-7 md:w-7" />
        </Button>
      </div>
    </TooltipProvider>
  );
}
