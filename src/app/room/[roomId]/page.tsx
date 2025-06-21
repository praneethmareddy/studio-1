
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);

  const [isMediaReady, setIsMediaReady] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const { toast } = useToast();

  const cleanupConnections = useCallback(() => {
    console.log("Cleaning up connections.");
    localStream?.getTracks().forEach(track => track.stop());
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    socket?.disconnect();
  }, [localStream, socket]);

  useEffect(() => {
    if (!searchParams.get('name')) {
      toast({
        title: 'Name Required',
        description: 'You must provide a name to enter a room. Redirecting to home...',
        variant: 'destructive',
      });
      router.push('/');
    }

    // Add cleanup for when the component unmounts or before the page is refreshed
    window.addEventListener('beforeunload', cleanupConnections);
    return () => {
      window.removeEventListener('beforeunload', cleanupConnections);
      cleanupConnections();
    };
  }, []);

  const handleUserJoined = useCallback(async ({ id: peerId, name: peerName }: { id: string; name: string }) => {
    if (peerId === socket?.id) return;
    toast({ title: 'User Joined', description: `${peerName} has entered the room.` });
    console.log(`User joined: ${peerName} (${peerId}). Creating offer...`);
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[peerId] = pc;
    
    localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${peerName} (${peerId})`);
      setRemoteParticipants(prev => {
        const participantExists = prev.some(p => p.id === peerId);
        if (participantExists) return prev;
        return [...prev, { id: peerId, name: peerName, stream: event.streams[0] }];
      });
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket?.emit('offer', { target: peerId, sdp: offer, name: localParticipantName });
  }, [socket, localStream, localParticipantName, toast]);

  const handleReceiveOffer = useCallback(async (data: { caller: string, sdp: RTCSessionDescriptionInit, name: string }) => {
    console.log(`Received offer from ${data.name} (${data.caller})`);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[data.caller] = pc;
    
    localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', { target: data.caller, candidate: event.candidate });
      }
    };

     pc.ontrack = (event) => {
      console.log(`Received remote track from ${data.name} (${data.caller})`);
      setRemoteParticipants(prev => {
        const participantExists = prev.some(p => p.id === data.caller);
        if (participantExists) return prev;
        return [...prev, { id: data.caller, name: data.name, stream: event.streams[0] }];
      });
    };

    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket?.emit('answer', { target: data.caller, sdp: answer, name: localParticipantName });
  }, [socket, localStream, localParticipantName]);

  const handleReceiveAnswer = useCallback(async (data: { answerer: string, sdp: RTCSessionDescriptionInit, name: string }) => {
    console.log(`Received answer from ${data.name} (${data.answerer})`);
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
        console.error("Error adding received ICE candidate", error);
      }
    }
  }, []);

  const handleUserDisconnected = useCallback((peerId: string) => {
    const leavingParticipant = remoteParticipants.find(p => p.id === peerId) || { name: 'A user' };
    toast({ title: 'User Left', description: `${leavingParticipant.name} has left the room.` });
    console.log(`User disconnected: ${peerId}`);
    if (peerConnectionsRef.current[peerId]) {
      peerConnectionsRef.current[peerId].close();
      delete peerConnectionsRef.current[peerId];
    }
    setRemoteParticipants(prev => prev.filter(p => p.id !== peerId));
  }, [toast, remoteParticipants]);

  // Effect to handle signaling connection once media is ready
  useEffect(() => {
    if (!isMediaReady || !roomId || !localParticipantName) return;

    const newSocket = io(SIGNALING_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to signaling server with ID:', newSocket.id);
      newSocket.emit('join-room', { roomId, name: localParticipantName });
    });
    
    newSocket.on('user-joined', handleUserJoined);
    newSocket.on('offer', handleReceiveOffer);
    newSocket.on('answer', handleReceiveAnswer);
    newSocket.on('ice-candidate', handleReceiveCandidate);
    newSocket.on('user-disconnected', handleUserDisconnected);

    newSocket.on('receive-message', (newMessage: Message) => {
      setMessages(prev => [...prev, newMessage]);
    });

    newSocket.on('previous-messages', (history: Message[]) => {
       setMessages(prev => [...history, ...prev.filter(m => m.sender === 'system')]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [isMediaReady, roomId, localParticipantName, handleUserJoined, handleReceiveOffer, handleReceiveAnswer, handleReceiveCandidate, handleUserDisconnected]);


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const joinCall = async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setIsMediaReady(true);
    } catch (err) {
      console.error('Error accessing media devices.', err);
      let errorMessage = 'Could not access camera/microphone.';
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") errorMessage = "Camera/microphone access denied. Please allow access in your browser settings to try again.";
        else if (err.name === "NotFoundError") errorMessage = "No camera/microphone found. Please ensure they are connected and enabled.";
      }
      setMediaError(errorMessage);
      toast({ title: 'Media Access Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const leaveCall = useCallback(() => {
    cleanupConnections();
    router.push('/');
  }, [cleanupConnections, router]);

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
    if (!socket) return;
    
    const newMessage: Message = {
      id: `${socket.id}-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: new Date(),
      roomId,
      userId: socket.id,
      senderName: localParticipantName,
    };
    
    setMessages(prev => [...prev, newMessage]);
    socket.emit('send-message', { roomId, message: text });
  };
  
  const totalParticipants = 1 + remoteParticipants.length;
  const videoGridCols = totalParticipants > 4 ? 'grid-cols-3' : 'grid-cols-2';
  const videoGridRows = totalParticipants > 2 ? 'grid-rows-2' : 'grid-rows-1';

  return (
    <div className="flex flex-col h-screen bg-background">
      <RoomHeader roomId={roomId} />

      <div className="flex flex-1 overflow-hidden md:flex-row flex-col">
        <main className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
          {!isMediaReady ? (
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
                  isCurrentUser={msg.userId === socket?.id && msg.sender === 'user'}
                />
              ))}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>
          
          <ChatInput onSendMessage={handleSendMessage} disabled={!isMediaReady} />
          
          <div className="border-t border-border/50 bg-background/30">
            <TopicSuggestion messages={messages} />
          </div>
        </aside>
      </div>
    </div>
  );
}
