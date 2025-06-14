'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Mic, MicOff, Video as VideoIconOn, VideoOff as VideoIconOff, WifiOff } from 'lucide-react';
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

  const hasVideoTrack = stream?.getVideoTracks().some(track => track.readyState === 'live' && track.enabled);
  const displayVideo = stream && hasVideoTrack && isVideoEnabled;

  return (
    <Card className={cn(
        "overflow-hidden shadow-lg w-full aspect-video flex flex-col rounded-xl border-2", 
        isLocal ? "border-primary/70 shadow-glow-primary-sm" : "border-border/50",
        !displayVideo && "bg-muted"
      )}
    >
      <CardContent className="p-0 relative flex-1 flex items-center justify-center">
        {displayVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground h-full w-full p-4">
            <User className="w-16 h-16 md:w-20 md:h-20 opacity-50 mb-2" />
            {stream && !isVideoEnabled && <p className="mt-2 text-sm md:text-base font-medium">Video Off</p>}
            {stream && isVideoEnabled && !hasVideoTrack && <p className="mt-2 text-sm md:text-base font-medium flex items-center gap-1.5"><WifiOff className="w-4 h-4"/> No Video Signal</p>}
            {!stream && <p className="mt-2 text-sm md:text-base font-medium flex items-center gap-1.5"><WifiOff className="w-4 h-4"/> No Stream</p>}
          </div>
        )}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 md:gap-2 p-1.5 bg-black/50 backdrop-blur-sm rounded-lg text-xs">
          {isAudioEnabled ? (
            <Mic className="h-4 w-4 text-green-400" />
          ) : (
            <MicOff className="h-4 w-4 text-red-400" />
          )}
           {isVideoEnabled && hasVideoTrack ? (
            <VideoIconOn className="h-4 w-4 text-green-400" />
          ) : (
            <VideoIconOff className="h-4 w-4 text-red-400" />
          )}
        </div>
      </CardContent>
      <CardFooter className={cn(
          "p-2.5 bg-card-foreground/5 border-t",
           isLocal ? "border-primary/30" : "border-border/30"
        )}
      >
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className={cn(
                "text-xs font-semibold", 
                isLocal ? "bg-gradient-to-br from-primary to-accent text-primary-foreground" : "bg-secondary text-secondary-foreground"
              )}
            >
              {name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium truncate text-card-foreground">{name}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
