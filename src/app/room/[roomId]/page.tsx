
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import RoomHeader from '@/components/chat/RoomHeader';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessage from '@/components/chat/ChatMessage';
import TopicSuggestion from '@/components/chat/TopicSuggestion';
import VideoPlayer from '@/components/chat/VideoPlayer';
import CallControls from '@/components/chat/CallControls';
import type { Message, RemoteParticipant } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video as VideoIcon, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SIGNALING_SERVER_URL = 'http://localhost:5000';

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export default function RoomPage() {
  const params = useParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [localParticipantId, setLocalParticipantId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);

  const [isCallActive, setIsCallActive] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const newSocket = io(SIGNALING_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to signaling server with ID:', newSocket.id);
      setLocalParticipantId(newSocket.id);
    });

    newSocket.on('user-joined', handleUserJoined);
    newSocket.on('offer', handleReceiveOffer);
    newSocket.on('answer', handleReceiveAnswer);
    newSocket.on('ice-candidate', handleReceiveCandidate);
    newSocket.on('user-disconnected', handleUserDisconnected);

    newSocket.on('receive-message', (data: { text: string, sender: string, timestamp?: string }) => {
      const newMessage: Message = {
        id: `${data.sender}-${data.timestamp || Date.now()}`,
        text: data.text,
        sender: 'user',
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        roomId: roomId,
        userId: data.sender,
      };
      setMessages(prev => [...prev, newMessage]);
    });

    newSocket.on('previous-messages', (history: {text: string, sender: string, timestamp: string}[]) => {
       const formattedHistory: Message[] = history.map(item => ({
         id: `${item.sender}-${item.timestamp}`,
         text: item.text,
         sender: 'user',
         timestamp: new Date(item.timestamp),
         roomId: roomId,
         userId: item.sender,
       }));
       setMessages(prev => [...formattedHistory, ...prev.filter(m => m.sender === 'system')]);
    });

    return () => {
      newSocket.disconnect();
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      peerConnectionsRef.current = {};
    };
  }, [roomId]);

  useEffect(() => {
    setMounted(true);
    if (roomId) {
      setMessages([
        {
          id: 'system-welcome',
          text: `Welcome to Room ${roomId}! Join the call to connect with others. Chat is enabled after joining the call.`,
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

  const createPeerConnection = useCallback((peerId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}`);
      setRemoteParticipants(prev => {
        const existingParticipant = prev.find(p => p.id === peerId);
        if (existingParticipant) {
          return prev.map(p => p.id === peerId ? { ...p, stream: event.streams[0] } : p);
        } else {
          return [...prev, { id: peerId, name: `User ${peerId.substring(0, 4)}`, stream: event.streams[0] }];
        }
      });
    };

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    peerConnectionsRef.current[peerId] = pc;
    return pc;
  }, [localStream, socket]);

  const handleUserJoined = useCallback(async (peerId: string) => {
    toast({ title: 'User Joined', description: `A new user has entered the room.` });
    console.log('New user joined:', peerId);
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket?.emit('offer', { target: peerId, sdp: offer });
  }, [createPeerConnection, socket, toast]);

  const handleReceiveOffer = useCallback(async (data: { caller: string, sdp: RTCSessionDescriptionInit }) => {
    console.log('Received offer from:', data.caller);
    const pc = createPeerConnection(data.caller);
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket?.emit('answer', { target: data.caller, sdp: answer });
  }, [createPeerConnection, socket]);

  const handleReceiveAnswer = useCallback(async (data: { answerer: string, sdp: RTCSessionDescriptionInit }) => {
    console.log('Received answer from:', data.answerer);
    const pc = peerConnectionsRef.current[data.answerer];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
  }, []);

  const handleReceiveCandidate = useCallback(async (data: { from: string, candidate: RTCIceCandidateInit }) => {
    const pc = peerConnectionsRef.current[data.from];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error("Error adding received ice candidate", error);
      }
    }
  }, []);

  const handleUserDisconnected = useCallback((peerId: string) => {
    toast({ title: 'User Left', description: `A user has left the room.` });
    console.log('User disconnected:', peerId);
    if (peerConnectionsRef.current[peerId]) {
      peerConnectionsRef.current[peerId].close();
      delete peerConnectionsRef.current[peerId];
    }
    setRemoteParticipants(prev => prev.filter(p => p.id !== peerId));
  }, [toast]);

  const joinCall = async () => {
    if (!socket) {
      toast({ title: 'Error', description: 'Not connected to signaling server.', variant: 'destructive' });
      return;
    }
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setIsCallActive(true);
      setIsMicEnabled(true);
      setIsVideoEnabled(true);
      socket.emit('join-room', roomId);
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

  const leaveCall = useCallback(() => {
    socket?.disconnect(); 
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    setRemoteParticipants([]);
    setIsCallActive(false);
    setMediaError(null);
  }, [localStream, socket]);

  const toggleMic = () => {
    if (localStream) {
      const newMicState = !isMicEnabled;
      localStream.getAudioTracks().forEach(track => (track.enabled = newMicState));
      setIsMicEnabled(newMicState);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const newVideoState = !isVideoEnabled;
      localStream.getVideoTracks().forEach(track => (track.enabled = newVideoState));
      setIsVideoEnabled(newVideoState);
    }
  };

  const handleSendMessage = (text: string) => {
    if (!localParticipantId || !socket) return;
    
    const newMessage: Message = {
      id: `${localParticipantId}-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: new Date(),
      roomId,
      userId: localParticipantId,
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    socket.emit('send-message', { 
        roomId, 
        message: text,
        sender: localParticipantId 
    });
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
                {localStream && (
                  <VideoPlayer
                    stream={localStream}
                    isLocal
                    name="You"
                    isAudioEnabled={isMicEnabled}
                    isVideoEnabled={isVideoEnabled}
                  />
                )}
                {remoteParticipants.map(participant => (
                  <VideoPlayer
                    key={participant.id}
                    stream={participant.stream}
                    name={participant.name}
                  />
                ))}
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
          
          <ChatInput onSendMessage={handleSendMessage} disabled={!isCallActive} />
          
          <div className="border-t border-border/50 bg-background/30">
            <TopicSuggestion messages={messages} />
          </div>
        </aside>
      </div>
    </div>
  );
}
