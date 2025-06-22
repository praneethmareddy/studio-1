
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, VideoOff as VideoIconOff, Pin, PinOff, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Reaction } from '@/types';

interface VideoPlayerProps {
  stream: MediaStream | null;
  isLocal?: boolean;
  name?: string;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean; 
  isScreenSharing?: boolean;
  isPinned?: boolean;
  onPin: () => void;
  reactions: Reaction[];
}

export default function VideoPlayer({ 
  stream, 
  isLocal = false, 
  name = 'Participant',
  isAudioEnabled = true,
  isVideoEnabled = true,
  isScreenSharing = false,
  isPinned = false,
  onPin,
  reactions
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [localReactions, setLocalReactions] = useState<Reaction[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
      if (reactions.length > 0) {
        const newReaction = reactions[reactions.length -1];
        setLocalReactions(prev => [...prev, newReaction]);
        setTimeout(() => {
            setLocalReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 2000); // 2s duration for animation
      }
  }, [reactions]);

  const handleToggleFullscreen = () => {
    if (!playerRef.current) return;

    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const hasVideoTrack = stream?.getVideoTracks().some(track => track.readyState === 'live');
  const displayVideo = stream && hasVideoTrack && isVideoEnabled;

  return (
    <div 
      ref={playerRef}
      className={cn(
        "group overflow-hidden shadow-lg w-full h-full flex flex-col rounded-lg relative bg-muted transition-all duration-300",
        isScreenSharing
          ? "border-2 border-accent shadow-glow-accent-sm"
          : isPinned
          ? "border-2 border-primary/70"
          : "border border-border/50"
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cn(
          "w-full h-full object-contain transition-opacity duration-300",
          { "opacity-0 absolute -z-10": !displayVideo },
          isScreenSharing ? "object-contain" : "object-cover"
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
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 p-1.5 px-3 bg-black/50 backdrop-blur-sm rounded-lg text-xs text-white">
            <span className="font-medium truncate">{name}</span>
        </div>
      )}

      <div className="absolute top-2 right-2 flex items-center gap-1.5 p-1 bg-black/40 backdrop-blur-sm rounded-full text-xs">
          {isAudioEnabled ? (
            <Mic className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <MicOff className="h-3.5 w-3.5 text-red-400" />
          )}
      </div>

      <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
        {!isLocal && (
          <button
              onClick={onPin}
              className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={isPinned ? "Unpin participant" : "Pin participant"}
          >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        )}
        
        {displayVideo && isScreenSharing && (
          <button
              onClick={handleToggleFullscreen}
              className="p-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        )}
      </div>


      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
        {localReactions.map(reaction => (
            <div key={reaction.id} className="absolute animate-float-up text-4xl">
                {reaction.emoji}
            </div>
        ))}
      </div>
    </div>
  );
}
