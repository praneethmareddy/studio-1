'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, Video as VideoIconOn, VideoOff as VideoIconOff, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  stream: MediaStream | null;
  isLocal?: boolean;
  name?: string;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean; 
}

export default function VideoPlayer({ 
  stream, 
  isLocal = false, 
  name = 'Participant',
  isAudioEnabled = true,
  isVideoEnabled = true
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideoTrack = stream?.getVideoTracks().some(track => track.readyState === 'live' && !track.muted);
  const displayVideo = stream && hasVideoTrack && isVideoEnabled;

  return (
    <Card className={cn(
        "overflow-hidden shadow-md w-full aspect-video flex flex-col rounded-lg", 
        isLocal ? "border-2 border-primary/70 shadow-glow-primary-sm" : "border border-border/50",
        "bg-muted" // Always have a background for the avatar to show against
      )}
    >
      <CardContent className="p-0 relative flex-1 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            { "opacity-0": !displayVideo }
          )}
        />
        {!displayVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground h-full w-full p-4">
            <Avatar className="w-20 h-20 text-3xl">
              <AvatarFallback className="bg-background text-muted-foreground">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!stream && <p className="mt-2 text-xs font-medium flex items-center gap-1.5"><WifiOff className="w-3 h-3"/> No Stream</p>}
          </div>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 p-1 bg-black/40 backdrop-blur-sm rounded-md text-xs">
          {isAudioEnabled ? (
            <Mic className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <MicOff className="h-3.5 w-3.5 text-red-400" />
          )}
           {isVideoEnabled && hasVideoTrack ? (
            <VideoIconOn className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <VideoIconOff className="h-3.5 w-3.5 text-red-400" />
          )}
        </div>
      </CardContent>
      <CardFooter className={cn(
          "p-2 bg-card-foreground/5 border-t",
           isLocal ? "border-primary/30" : "border-border/30"
        )}
      >
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className={cn(
                "text-[10px] font-semibold", 
                isLocal ? "bg-gradient-to-br from-primary to-accent text-primary-foreground" : "bg-secondary text-secondary-foreground"
              )}
            >
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium truncate text-card-foreground">{name}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
