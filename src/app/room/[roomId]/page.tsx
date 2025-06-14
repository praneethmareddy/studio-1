
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import RoomHeader from '@/components/chat/RoomHeader';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessage from '@/components/chat/ChatMessage';
import TopicSuggestion from '@/components/chat/TopicSuggestion';
import VideoPlayer from '@/components/chat/VideoPlayer';
import CallControls from '@/components/chat/CallControls';
import type { Message, Participant, StreamParticipant } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video as VideoIcon, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Helper to generate a unique ID for participants (can be kept client-side for now)
const generateParticipantId = () => `participant-${Math.random().toString(36).substring(2, 11)}`;

export default function RoomPage() {
  const params = useParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [localParticipantId, setLocalParticipantId] = useState<string | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // allParticipants and streamParticipants state related to Firebase is removed.
  // Real-time participant updates will need a new backend (e.g. WebSockets + MongoDB).
  const [streamParticipants, setStreamParticipants] = useState<StreamParticipant[]>([]);


  const [isCallActive, setIsCallActive] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    const newParticipantId = generateParticipantId();
    setLocalParticipantId(newParticipantId);

    if (roomId) {
      setMessages([
        { 
          id: 'system-welcome', 
          text: `Welcome to Room ${roomId}! Join the call or start chatting. MongoDB is configured, but real-time participant updates are not implemented.`, 
          sender: 'system', 
          timestamp: new Date(),
          roomId: roomId,
        }
      ]);
    }
    
    // Cleanup related to Firebase is removed.
    // New cleanup logic for MongoDB/WebSockets would be different.
    return () => {
      // Placeholder for future cleanup if needed
    };
  }, [roomId]);


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const cleanupStream = (stream: MediaStream | null) => {
    stream?.getTracks().forEach(track => track.stop());
  };

  const joinCall = async () => {
    if (!localParticipantId) {
      toast({ title: 'Error', description: 'Participant ID not set.', variant: 'destructive' });
      return;
    }
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setIsCallActive(true);
      setIsMicEnabled(true);
      setIsVideoEnabled(true);

      // Logic for adding participant to Firebase is removed.
      // This would be replaced by calls to your new MongoDB backend via API/WebSockets.

      const localPStream: StreamParticipant = {
        id: localParticipantId,
        name: 'You',
        stream: stream,
        isLocal: true,
        isAudioEnabled: true,
        isVideoEnabled: true,
      };
      // For now, only local stream is shown. Remote streams require full WebRTC + signaling.
      setStreamParticipants([localPStream]); 

    } catch (err) {
      console.error('Error accessing media devices.', err);
      let errorMessage = 'Could not access camera/microphone.';
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") errorMessage = "Camera/microphone access denied. Please allow access in your browser settings.";
        else if (err.name === "NotFoundError") errorMessage = "No camera/microphone found. Please ensure they are connected and enabled.";
      }
      setMediaError(errorMessage);
      toast({ title: 'Media Access Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const leaveCall = useCallback(async () => {
    // Logic for removing participant from Firebase is removed.
    // This would be replaced by calls to your new MongoDB backend.
    
    cleanupStream(localStream);
    // In a full WebRTC app, you would also clean up all peer connections here
    // For now, just clear local stream representation
    setLocalStream(null);
    setStreamParticipants([]);
    setIsCallActive(false);
    setMediaError(null);
  }, [localStream]); // Dependencies updated

  useEffect(() => {
    // This effect ensures that if the component unmounts (e.g. user navigates away),
    // we attempt to clean up local media.
    return () => { 
      if (isCallActive) {
        cleanupStream(localStream);
      }
      // Cleanup of remote streams is not relevant here without signaling
    };
  }, [isCallActive, localStream]);


  const toggleMic = async () => {
    if (localStream && localParticipantId) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const newMicState = !isMicEnabled;
        audioTracks.forEach(track => track.enabled = newMicState);
        setIsMicEnabled(newMicState);
        
        // Update to MongoDB backend would go here
        setStreamParticipants(prev => prev.map(p => p.id === localParticipantId ? {...p, isAudioEnabled: newMicState} : p));
      }
    }
  };

  const toggleVideo = async () => {
    if (localStream && localParticipantId) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const newVideoState = !isVideoEnabled;
        videoTracks.forEach(track => track.enabled = newVideoState);
        setIsVideoEnabled(newVideoState);

        // Update to MongoDB backend would go here
        setStreamParticipants(prev => prev.map(p => p.id === localParticipantId ? {...p, isVideoEnabled: newVideoState} : p));
      }
    }
  };
  
  const handleSendMessage = (text: string) => {
    if (!localParticipantId) return;
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      sender: 'user', 
      timestamp: new Date(),
      roomId,
      userId: localParticipantId, 
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    // Saving messages to MongoDB would happen here, via an API call.
  };

  if (!mounted || !roomId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-lg text-primary animate-fade-in">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        Loading CommVerse Room...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <RoomHeader roomId={roomId} />
      
      <div className="flex flex-1 overflow-hidden md:flex-row flex-col">
        <main className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
          {!isCallActive ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-card/50 rounded-lg shadow-inner p-6 animate-fade-in">
              <Card className="p-6 md:p-10 text-center shadow-xl max-w-md w-full border-border/50 hover:shadow-2xl transition-shadow duration-300">
                <CardHeader>
                  <div className="flex justify-center mb-6">
                    <VideoIcon className="w-20 h-20 text-primary drop-shadow-[0_2px_4px_rgba(var(--primary-rgb),0.5)]" />
                  </div>
                  <CardTitle className="text-3xl md:text-4xl mb-2 font-headline tracking-tight">Join Voice & Video Call</CardTitle>
                  <CardDescription className="text-muted-foreground mb-6 text-base">
                    Connect with others face-to-face and by voice.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mediaError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm flex items-center gap-2 animate-shake">
                      <AlertTriangle className="h-5 w-5 shrink-0" /> 
                      <p>{mediaError}</p>
                    </div>
                  )}
                  <Button 
                    onClick={joinCall} 
                    size="lg" 
                    className="w-full py-7 text-lg bg-gradient-to-r from-primary to-accent hover:shadow-glow-primary-md text-primary-foreground transition-all duration-300 ease-in-out transform hover:scale-105 active:animate-button-press"
                  >
                    <VideoIcon className="mr-2 h-6 w-6" /> Join Call
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {/* Participant count from Firebase is removed. This needs new backend logic. */}
              <div className="mb-2 text-sm text-muted-foreground">
                In call. (Participant list display requires backend integration with MongoDB/WebSockets)
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 overflow-y-auto p-1 mb-2 md:mb-4 animate-fade-in">
                {streamParticipants.find(p => p.isLocal && p.stream) && (
                  <VideoPlayer 
                    stream={streamParticipants.find(p => p.isLocal)!.stream} 
                    isLocal 
                    name={streamParticipants.find(p => p.isLocal)!.name || 'You'}
                    isAudioEnabled={streamParticipants.find(p => p.isLocal)!.isAudioEnabled}
                    isVideoEnabled={streamParticipants.find(p => p.isLocal)!.isVideoEnabled}
                  />
                )}
                {/* Placeholder for remote streams - requires full WebRTC and signaling backend */}
                 <div className="bg-muted/70 rounded-lg flex flex-col items-center justify-center text-muted-foreground aspect-video p-4 animate-pulse border border-border/30">
                     <Users className="w-12 h-12 md:w-16 md:h-16 opacity-60 mb-3" />
                     <p className="text-sm md:text-base text-center">
                       Waiting for remote video/audio connection...
                     </p>
                     <p className="text-xs mt-1"> (Full video connection requires WebRTC offer/answer exchange with a signaling server - not yet implemented with MongoDB) </p>
                 </div>
              </div>
              <CallControls
                isMicEnabled={isMicEnabled}
                isVideoEnabled={isVideoEnabled}
                onLeaveCall={leaveCall}
                onToggleMic={toggleMic}
                onToggleVideo={toggleVideo}
                className="mt-auto" 
              />
            </>
          )}
        </main>

        <aside className="w-full md:w-[360px] lg:w-[420px] border-t md:border-t-0 md:border-l border-border/50 bg-card flex flex-col shadow-lg max-h-full md:max-h-[calc(100vh-var(--header-height,73px))]">
          <div className="p-4 border-b border-border/50 sticky top-0 bg-card z-10">
            <h2 className="text-xl font-semibold text-primary tracking-tight">Live Chat</h2>
          </div>
          <ScrollArea className="flex-1 p-3 md:p-4">
            <div className="space-y-3">
              {messages.map(msg => (
                <ChatMessage 
                  key={msg.id} 
                  message={msg} 
                  isCurrentUser={msg.userId === localParticipantId && msg.sender === 'user'} 
                />
              ))}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>
          <ChatInput onSendMessage={handleSendMessage} /> 
          
          <div className="border-t border-border/50">
            <TopicSuggestion messages={messages} />
          </div>
        </aside>
      </div>
    </div>
  );
}
