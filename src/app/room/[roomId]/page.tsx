
'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
import { Video as VideoIcon, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SIGNALING_SERVER_URL = 'http://localhost:5000';

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export default function RoomPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen text-lg text-primary">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        Loading CommVerse Room...
      </div>
    }>
      <RoomPage />
    </Suspense>
  );
}

function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const localParticipantName = searchParams.get('name') || 'Anonymous';
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  
  const [isInCall, setIsInCall] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const participantInfoRef = useRef<Map<string, { name: string }>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const cleanupPeerConnection = useCallback((peerId: string) => {
    if (peerConnectionsRef.current[peerId]) {
      peerConnectionsRef.current[peerId].close();
      delete peerConnectionsRef.current[peerId];
    }
  }, []);

  const cleanupAllConnections = useCallback(() => {
    console.log("Cleaning up all connections.");
    localStream?.getTracks().forEach(track => track.stop());
    Object.keys(peerConnectionsRef.current).forEach(cleanupPeerConnection);
    socket?.disconnect();
    setRemoteParticipants(new Map());
    participantInfoRef.current.clear();
  }, [localStream, socket, cleanupPeerConnection]);

  // Main setup effect
  useEffect(() => {
    if (!searchParams.get('name')) {
      toast({
        title: 'Name Required',
        description: 'You must provide a name to enter a room. Redirecting to home...',
        variant: 'destructive',
      });
      router.push('/');
      return;
    }

    const newSocket = io(SIGNALING_SERVER_URL);
    setSocket(newSocket);

    window.addEventListener('beforeunload', cleanupAllConnections);

    return () => {
      window.removeEventListener('beforeunload', cleanupAllConnections);
      cleanupAllConnections();
    };
  }, []); // Should only run once

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream | null) => {
    if (peerConnectionsRef.current[peerId]) {
      return peerConnectionsRef.current[peerId];
    }
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const peerName = participantInfoRef.current.get(peerId)?.name || 'Someone';
      console.log(`Received remote track from ${peerName} (${peerId})`);
      setRemoteParticipants(prev => new Map(prev).set(peerId, { id: peerId, name: peerName, stream: event.streams[0] }));
    };

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }
    
    peerConnectionsRef.current[peerId] = pc;
    return pc;
  }, [socket]);


  // Effect to handle signaling
  useEffect(() => {
    if (!socket) return;
    
    const handleUserJoined = async ({ id: peerId, name: peerName }: { id: string; name: string }) => {
      if (peerId === socket.id) return;
      toast({ title: 'User Joined', description: `${peerName} has entered the room.` });
      participantInfoRef.current.set(peerId, { name: peerName });

      if (isInCall && localStream) {
        console.log(`User ${peerName} joined. I'm in call, so I'll send them an offer.`);
        const pc = createPeerConnection(peerId, localStream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { target: peerId, sdp: offer, name: localParticipantName });
      }
    };

    const handleReceiveOffer = async (data: { caller: string, sdp: RTCSessionDescriptionInit, name: string }) => {
      if (!isInCall || !localStream) {
        console.log("Received offer but not ready, ignoring.");
        return;
      }
      console.log(`Received offer from ${data.name} (${data.caller})`);
      participantInfoRef.current.set(data.caller, { name: data.name });
      const pc = createPeerConnection(data.caller, localStream);
      
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { target: data.caller, sdp: answer, name: localParticipantName });
    };

    const handleReceiveAnswer = async (data: { answerer: string, sdp: RTCSessionDescriptionInit, name: string }) => {
      console.log(`Received answer from ${data.name} (${data.answerer})`);
      const pc = peerConnectionsRef.current[data.answerer];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
    };

    const handleReceiveCandidate = async (data: { from: string, candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionsRef.current[data.from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error("Error adding received ICE candidate", error);
        }
      }
    };

    const handleUserDisconnected = (peerId: string) => {
      const leavingParticipantName = participantInfoRef.current.get(peerId)?.name || 'A user';
      toast({ title: 'User Left', description: `${leavingParticipantName} has left the room.` });
      
      cleanupPeerConnection(peerId);
      setRemoteParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
      });
      participantInfoRef.current.delete(peerId);
    };

    socket.on('connect', () => {
      socket.emit('join-room', { roomId, name: localParticipantName });
    });
    
    socket.on('user-joined', handleUserJoined);
    socket.on('offer', handleReceiveOffer);
    socket.on('answer', handleReceiveAnswer);
    socket.on('ice-candidate', handleReceiveCandidate);
    socket.on('user-disconnected', handleUserDisconnected);
    
    socket.on('receive-message', (newMessage: Message) => {
      setMessages(prev => [...prev, newMessage]);
    });
    socket.on('previous-messages', (history: Message[]) => {
       setMessages(history);
    });

    return () => {
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-disconnected');
      socket.off('receive-message');
      socket.off('previous-messages');
    };
  }, [socket, roomId, localParticipantName, isInCall, localStream, createPeerConnection, cleanupPeerConnection, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const joinCall = async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setIsInCall(true);
      setIsMicEnabled(true);
      setIsVideoEnabled(true);
      
      // Proactively connect to anyone we know about who is already in the room
      for (const [peerId, peerInfo] of participantInfoRef.current.entries()) {
          console.log(`Initiating call with existing user ${peerInfo.name}`);
          const pc = createPeerConnection(peerId, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit('offer', { target: peerId, sdp: offer, name: localParticipantName });
      }

    } catch (err) {
      console.error('Error accessing media devices.', err);
      let errorMessage = 'Could not access camera/microphone.';
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") errorMessage = "Camera/microphone access denied. Please allow access in your browser settings to try again.";
        else if (err.name === "NotFoundError") errorMessage = "No camera/microphone found. Please ensure they are connected and enabled.";
      }
      setMediaError(errorMessage);
    }
  };

  const leaveCall = useCallback(() => {
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setIsInCall(false);
    
    Object.keys(peerConnectionsRef.current).forEach(cleanupPeerConnection);
    setRemoteParticipants(new Map());

    socket?.emit('leave-call', { roomId });

  }, [localStream, socket, roomId, cleanupPeerConnection]);

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
    if (!socket || !text.trim()) return;
    
    const myMessage: Message = {
      id: `${socket.id!}-${Date.now()}`,
      roomId,
      text,
      sender: 'user',
      timestamp: new Date(),
      userId: socket.id!,
      senderName: localParticipantName
    };
    socket.emit('send-message', { roomId, message: text });
    setMessages(prev => [...prev, myMessage]);
  };
  
  const remoteParticipantsArray = Array.from(remoteParticipants.values());
  const totalParticipants = (isInCall ? 1 : 0) + remoteParticipantsArray.length;
  const videoGridCols = totalParticipants > 4 ? 'grid-cols-3' : totalParticipants > 1 ? 'grid-cols-2' : 'grid-cols-1';
  const videoGridRows = totalParticipants > 2 ? 'grid-rows-2' : 'grid-rows-1';

  return (
    <div className="flex flex-col h-screen bg-background">
      <RoomHeader roomId={roomId} />

      <div className="flex flex-1 overflow-hidden md:flex-row flex-col">
        <main className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
          {!isInCall ? (
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
                  {mediaError ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-sm flex items-center gap-2 animate-shake">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <p>{mediaError}</p>
                      </div>
                      <Button
                        onClick={() => { setMediaError(null); joinCall(); }}
                        size="lg"
                        variant="outline"
                        className="w-full py-7 text-lg"
                      >
                        <RefreshCw className="mr-2 h-6 w-6" /> Try Again
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={joinCall}
                      size="lg"
                      className="w-full py-7 text-lg bg-gradient-to-r from-primary to-accent hover:shadow-glow-primary-md text-primary-foreground transition-all duration-300 ease-in-out transform hover:scale-105 active:animate-button-press"
                    >
                      <VideoIcon className="mr-2 h-6 w-6" /> Join Call
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className={`flex-1 grid gap-2 md:gap-4 overflow-y-auto p-1 mb-2 md:mb-4 animate-fade-in ${videoGridCols} ${videoGridRows}`}>
                {localStream && (
                  <VideoPlayer
                    stream={localStream}
                    isLocal
                    name={`${localParticipantName} (You)`}
                    isAudioEnabled={isMicEnabled}
                    isVideoEnabled={isVideoEnabled}
                  />
                )}
                {remoteParticipantsArray.map(participant => (
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
                  isCurrentUser={msg.userId === socket?.id}
                />
              ))}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>
          
          <ChatInput onSendMessage={handleSendMessage} disabled={!socket} />
          
          <div className="border-t border-border/50 bg-background/30">
            <TopicSuggestion messages={messages} />
          </div>
        </aside>
      </div>
    </div>
  );
}

    