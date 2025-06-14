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
import { Video as VideoIcon, Users, AlertTriangle } from 'lucide-react'; // Video is also an icon name
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
      
      // For prototype: add a dummy remote stream to simulate another participant
      // In a real app, this would come from a WebRTC connection.
      setTimeout(() => {
         if(stream) { // ensure stream is still valid
            const dummyStream = stream.clone(); // Clone for safety, though not perfect
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
      toast({ title: 'Media Error', description: errorMessage, variant: 'destructive' });
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
      <div className="flex items-center justify-center min-h-screen text-lg text-primary animate-pulse">
        Loading CommVerse Room...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <RoomHeader roomId={roomId} />
      
      <div className="flex flex-1 overflow-hidden md:flex-row flex-col"> {/* Main content flex container */}
        {/* Video and Call Controls Area */}
        <main className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
          {!isCallActive ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-lg shadow-inner p-6">
              <Card className="p-6 md:p-10 text-center shadow-xl max-w-md w-full">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <VideoIcon className="w-16 h-16 text-primary" />
                  </div>
                  <CardTitle className="text-2xl md:text-3xl mb-2">Join Voice & Video Call</CardTitle>
                  <CardDescription className="text-muted-foreground mb-6">
                    Connect with others face-to-face and by voice.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mediaError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 shrink-0" /> 
                      <p>{mediaError}</p>
                    </div>
                  )}
                  <Button onClick={joinCall} size="lg" className="w-full py-3 text-lg">
                    <VideoIcon className="mr-2 h-5 w-5" /> Join Call
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 overflow-y-auto p-1 mb-2 md:mb-4">
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
                   <div className="bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground aspect-video p-4">
                       <Users className="w-12 h-12 md:w-16 md:h-16 opacity-50 mb-2" />
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
              />
            </>
          )}
        </main>

        {/* Sidebar (Chat + Topic Suggestions) */}
        <aside className="w-full md:w-[340px] lg:w-[400px] border-t md:border-t-0 md:border-l bg-card flex flex-col shadow-lg max-h-full md:max-h-[calc(100vh-var(--header-height,69px))]">
          {/* Adjust max-h based on header height if known, or use 100vh and manage overflow within */}
          <div className="p-3 border-b sticky top-0 bg-card z-10">
            <h2 className="text-lg font-semibold text-primary">Live Chat</h2>
          </div>
          <ScrollArea className="flex-1 p-2 md:p-4">
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
          
          <div className="border-t">
            <TopicSuggestion messages={messages} />
          </div>
        </aside>
      </div>
    </div>
  );
}
