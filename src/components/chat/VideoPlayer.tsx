'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Mic, MicOff, Video as VideoIconOn, VideoOff as VideoIconOff } from 'lucide-react';
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
    <Card className={cn("overflow-hidden shadow-lg w-full aspect-video flex flex-col rounded-lg", isLocal ? "border-primary border-2" : "border")}>
      <CardContent className="p-0 relative flex-1 bg-muted flex items-center justify-center">
        {displayVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground bg-muted/70 h-full w-full p-4">
            <User className="w-12 h-12 md:w-16 md:h-16 opacity-50" />
            {stream && !isVideoEnabled && <p className="mt-2 text-xs md:text-sm">Video Off</p>}
            {stream && !hasVideoTrack && <p className="mt-2 text-xs md:text-sm">No Video Signal</p>}
            {!stream && <p className="mt-2 text-xs md:text-sm">No Stream</p>}
          </div>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 md:gap-2 p-1 bg-black/40 rounded-md">
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
      <CardFooter className="p-2 bg-card-foreground/5 border-t">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className={cn("text-xs", isLocal ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
              {name.substring(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium truncate text-card-foreground">{name}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
