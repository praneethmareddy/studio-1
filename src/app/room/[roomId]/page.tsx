'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import RoomHeader from '@/components/chat/RoomHeader';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessage from '@/components/chat/ChatMessage';
import TopicSuggestion from '@/components/chat/TopicSuggestion';
import VideoPlayer from '@/components/chat/VideoPlayer';
import CallControls from '@/components/chat/CallControls';
import type { Message, RemoteStream } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video as VideoIcon, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


export default function RoomPage() {
  const params = useParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    setCurrentUserId(`user-${Math.random().toString(36).substring(2, 9)}`);

    if (roomId) {
      setMessages([
        { 
          id: 'system-welcome', 
          text: `Welcome to Room ${roomId}! Join the call or start chatting.`, 
          sender: 'system', 
          timestamp: new Date(),
          roomId: roomId,
        }
      ]);
    }
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
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setIsCallActive(true);
      setIsMicEnabled(true);
      setIsVideoEnabled(true);
      
      setTimeout(() => {
         if(stream) { 
            const dummyStream = stream.clone(); 
            setRemoteStreams([{ id: 'remote-dummy-1', stream: dummyStream, name: 'Participant 2', isAudioEnabled: true, isVideoEnabled: true }]);
         }
      }, 2000);

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

  const leaveCall = () => {
    cleanupStream(localStream);
    remoteStreams.forEach(rs => cleanupStream(rs.stream));
    setLocalStream(null);
    setRemoteStreams([]);
    setIsCallActive(false);
    setMediaError(null);
  };

  useEffect(() => {
    return () => { 
      cleanupStream(localStream);
      remoteStreams.forEach(rs => cleanupStream(rs.stream));
    };
  }, [localStream, remoteStreams]);


  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach(track => track.enabled = !track.enabled);
        setIsMicEnabled(prev => !prev);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach(track => track.enabled = !track.enabled);
        setIsVideoEnabled(prev => !prev);
      }
    }
  };
  
  const handleSendMessage = (text: string) => {
    if (!currentUserId) return;
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      sender: 'user', 
      timestamp: new Date(),
      roomId,
      userId: currentUserId, 
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
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
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 overflow-y-auto p-1 mb-2 md:mb-4 animate-fade-in">
                <VideoPlayer 
                  stream={localStream} 
                  isLocal 
                  name="You" 
                  isAudioEnabled={isMicEnabled}
                  isVideoEnabled={isVideoEnabled}
                />
                {remoteStreams.map(rs => (
                  <VideoPlayer 
                    key={rs.id} 
                    stream={rs.stream} 
                    name={rs.name || 'Participant'}
                    isAudioEnabled={rs.isAudioEnabled} 
                    isVideoEnabled={rs.isVideoEnabled}
                  />
                ))}
                {remoteStreams.length === 0 && localStream && (
                   <div className="bg-muted/70 rounded-lg flex flex-col items-center justify-center text-muted-foreground aspect-video p-4 animate-pulse border border-border/30">
                       <Users className="w-12 h-12 md:w-16 md:h-16 opacity-60 mb-3" />
                       <p className="text-sm md:text-base text-center">Waiting for others to join...</p>
                   </div>
                )}
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
                  isCurrentUser={msg.userId === currentUserId && msg.sender === 'user'} 
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
