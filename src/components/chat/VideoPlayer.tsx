
'use client';

import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, Video as VideoIconOn, VideoOff as VideoIconOff } from 'lucide-react';
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

  const hasVideoTrack = stream?.getVideoTracks().some(track => track.readyState === 'live');
  const displayVideo = stream && hasVideoTrack && isVideoEnabled;

  return (
    <div className={cn(
        "overflow-hidden shadow-lg w-full aspect-video flex flex-col rounded-xl relative", 
        isLocal ? "border-2 border-primary/70 shadow-glow-primary-md" : "border border-border/50",
        "bg-muted"
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          { "opacity-0 absolute -z-10": !displayVideo }
        )}
      />
      
      {!displayVideo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-card-foreground p-4">
          <Avatar className="w-20 h-20 text-3xl lg:w-24 lg:h-24 lg:text-4xl border-2 border-background">
            <AvatarFallback className="bg-background text-foreground font-semibold">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="mt-4 flex items-center gap-2">
             <VideoIconOff className="h-5 w-5 text-muted-foreground" />
             <span className="text-base font-medium text-foreground truncate">{name}</span>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-2 left-2 flex items-center gap-2 p-1.5 px-3 bg-black/50 backdrop-blur-sm rounded-lg text-xs text-white">
            <span className="font-medium truncate">{name}</span>
        </div>
      )}

      {/* Audio status always visible */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 p-1 bg-black/40 backdrop-blur-sm rounded-full text-xs">
          {isAudioEnabled ? (
            <Mic className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <MicOff className="h-3.5 w-3.5 text-red-400" />
          )}
      </div>
    </div>
  );
}
