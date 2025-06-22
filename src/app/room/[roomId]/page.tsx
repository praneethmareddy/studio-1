'use client';

import { useEffect, useState, useRef, useCallback, Suspense, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import RoomHeader from '@/components/chat/RoomHeader';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatSummary from '@/components/chat/ChatSummary';
import VideoPlayer from '@/components/chat/VideoPlayer';
import CallControls from '@/components/chat/CallControls';
import type { Message, RemoteParticipant } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Video as VideoIcon, AlertTriangle, Loader2, RefreshCw, Users } from 'lucide-react';
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
  
  const [localParticipantName] = useState(searchParams.get('name') || 'Anonymous');
  const [messages, setMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [allParticipants, setAllParticipants] = useState<Map<string, { name: string }>>(new Map());

  const [isInCall, setIsInCall] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const localParticipantNameRef = useRef(localParticipantName);
  localParticipantNameRef.current = localParticipantName; // Keep ref updated without causing re-renders


  const cleanupPeerConnection = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
  }, []);

  // Effect for establishing and cleaning up socket connection
  useEffect(() => {
    if (localParticipantName === 'Anonymous') {
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
    
    setAllParticipants(new Map([[newSocket.id, { name: localParticipantName }]]));

    const cleanup = () => {
      console.log("Cleaning up all connections.");
      localStream?.getTracks().forEach(track => track.stop());
      peerConnectionsRef.current.forEach((_, peerId) => cleanupPeerConnection(peerId));
      newSocket.disconnect();
      setRemoteParticipants(new Map());
      setAllParticipants(new Map());
    };
    
    newSocket.on('connect', () => {
      setAllParticipants(new Map([[newSocket.id, { name: localParticipantName }]]));
      newSocket.emit('join-room', { roomId, name: localParticipantNameRef.current });
    });

    window.addEventListener('beforeunload', cleanup);

    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); // This effect should only run once when the component mounts or roomId changes.

  // Effect for handling all signaling and chat logic
  useEffect(() => {
    if (!socket) return;

    const createPeerConnection = (peerId: string, peerName: string): RTCPeerConnection => {
      if (peerConnectionsRef.current.has(peerId)) {
        return peerConnectionsRef.current.get(peerId)!;
      }
      
      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        console.log(`Received remote track from ${peerName} (${peerId})`);
        setRemoteParticipants(prev => new Map(prev).set(peerId, { id: peerId, name: peerName, stream: event.streams[0] }));
      };
      
      pc.onnegotiationneeded = async () => {
        try {
          // Check if the connection is stable before creating an offer
          if (pc.signalingState === 'stable') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', { target: peerId, sdp: pc.localDescription, name: localParticipantNameRef.current });
          }
        } catch (err) {
          console.error('Error during negotiationneeded event:', err);
        }
      };

      peerConnectionsRef.current.set(peerId, pc);
      return pc;
    };
    
    const handleExistingUsers = (users: {id: string, name: string}[]) => {
      console.log('Received existing users list:', users);
      const newParticipants = new Map<string, {name: string}>();
      users.forEach(user => {
        if (user.id !== socket.id) {
          newParticipants.set(user.id, { name: user.name });
          const pc = createPeerConnection(user.id, user.name);
          // If we are already in a call, add tracks to new PCs
          if (localStream) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
          }
        }
      });
      setAllParticipants(prev => new Map([...prev, ...newParticipants]));
    };

    const handleUserJoined = ({ id: peerId, name: peerName }: { id: string; name: string }) => {
      if (peerId === socket.id) return;
      toast({ title: 'User Joined', description: `${peerName} has entered the room.` });
      
      setAllParticipants(prev => new Map(prev).set(peerId, { name: peerName }));
      
      const pc = createPeerConnection(peerId, peerName);
      // If we are already in a call, add tracks to the new peer's connection
      if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      }
    };

    const handleReceiveOffer = async (data: { caller: string, sdp: RTCSessionDescriptionInit, name: string }) => {
      if (!localStream) {
        return; // Don't answer if we're not in the call
      }
      const pc = createPeerConnection(data.caller, data.name);
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { target: data.caller, sdp: answer, name: localParticipantNameRef.current });
    };

    const handleReceiveAnswer = async (data: { answerer: string, sdp: RTCSessionDescriptionInit }) => {
      const pc = peerConnectionsRef.current.get(data.answerer);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
    };

    const handleReceiveCandidate = async (data: { from: string, candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionsRef.current.get(data.from);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error("Error adding received ICE candidate", error);
        }
      }
    };

    const handleUserDisconnected = (peerId: string) => {
      const participant = allParticipants.get(peerId);
      if (participant) {
        toast({ title: 'User Left', description: `${participant.name} has left the room.` });
      }
      
      cleanupPeerConnection(peerId);
      setRemoteParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
      });
      setAllParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
      });
    };

    const handleReceiveMessage = (newMessage: Message) => {
      setMessages(prev => [...prev, newMessage]);
    }
    const handlePreviousMessages = (history: Message[]) => {
       setMessages(history);
    }
    
    socket.on('existing-users', handleExistingUsers);
    socket.on('user-joined', handleUserJoined);
    socket.on('offer', handleReceiveOffer);
    socket.on('answer', handleReceiveAnswer);
    socket.on('ice-candidate', handleReceiveCandidate);
    socket.on('user-disconnected', handleUserDisconnected);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('previous-messages', handlePreviousMessages);

    return () => {
      socket.off('existing-users');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-disconnected');
      socket.off('receive-message');
      socket.off('previous-messages');
    };
  }, [socket, localStream, cleanupPeerConnection, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const joinCall = async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setIsInCall(true);

      // Add tracks to all existing peer connections
      peerConnectionsRef.current.forEach(pc => {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      });

    } catch (err) {
      console.error('Error accessing media devices.', err);
      let errorMessage = 'Could not access camera/microphone.';
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") errorMessage = "Camera/microphone access denied. Please allow access in your browser settings to try again.";
        else if (err.name === "NotFoundError") errorMessage = "No camera/microphone found. Please ensure they are connected and enabled.";
      }
      setMediaError(errorMessage);
    }
  };

  const leaveCall = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setIsInCall(false);
    
    // Remove tracks from all peer connections
    peerConnectionsRef.current.forEach(pc => {
      pc.getSenders().forEach(sender => {
        pc.removeTrack(sender);
      });
    });
    
    socket?.emit('leave-call', { roomId });
  }, [localStream, socket, roomId]);

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
  
  const videoParticipants = useMemo(() => {
    const remoteP = Array.from(remoteParticipants.values());
    const participants = remoteP.map(p => ({ id: p.id, name: p.name, stream: p.stream, isLocal: false, isAudioEnabled: true, isVideoEnabled: true }));
    if (localStream && isInCall) {
        participants.unshift({ id: socket?.id || 'local', name: `${localParticipantName} (You)`, stream: localStream, isLocal: true, isAudioEnabled: isMicEnabled, isVideoEnabled: isVideoEnabled });
    }
    return participants;
  }, [localStream, remoteParticipants, localParticipantName, socket, isMicEnabled, isVideoEnabled, isInCall]);
  
  const allParticipantsArray = useMemo(() => Array.from(allParticipants.entries()).map(([id, data]) => ({ id, ...data })), [allParticipants]);
  
  const gridClass = videoParticipants.length <= 1 ? 'grid-cols-1 grid-rows-1'
                  : videoParticipants.length === 2 ? 'grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1'
                  : videoParticipants.length <= 4 ? 'grid-cols-2 grid-rows-2'
                  : 'grid-cols-2 lg:grid-cols-3';

  return (
    <div className="flex flex-col h-screen bg-background">
      <RoomHeader roomId={roomId} videoParticipants={videoParticipants} />

      <div className="flex flex-1 overflow-hidden md:flex-row flex-col">
        <main className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden">
          {!isInCall ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-card/50 rounded-lg shadow-inner p-4 animate-fade-in">
              <Card className="p-6 text-center shadow-xl max-w-md w-full border-border/50 hover:shadow-2xl transition-shadow duration-300 rounded-xl">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <VideoIcon className="w-16 h-16 text-primary drop-shadow-[0_2px_4px_rgba(var(--primary-rgb),0.5)]" />
                  </div>
                  <CardTitle className="text-2xl md:text-3xl mb-2 font-headline tracking-tight">Join Voice & Video Call</CardTitle>
                  <CardDescription className="text-muted-foreground text-sm">
                    Connect with others face-to-face and by voice.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mediaError ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-md text-xs flex items-center gap-2 animate-shake">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <p>{mediaError}</p>
                      </div>
                      <Button
                        onClick={() => { setMediaError(null); joinCall(); }}
                        size="lg"
                        variant="outline"
                        className="w-full py-6 text-base"
                      >
                        <RefreshCw className="mr-2 h-5 w-5" /> Try Again
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={joinCall}
                      size="lg"
                      className="w-full py-6 text-base bg-gradient-to-r from-primary to-accent hover:shadow-glow-primary-md text-primary-foreground transition-all duration-300 ease-in-out transform hover:scale-105 active:animate-button-press"
                    >
                      <VideoIcon className="mr-2 h-5 w-5" /> Join Call
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className={`flex-1 grid gap-2 md:gap-3 overflow-y-auto p-1 mb-2 md:mb-4 animate-fade-in ${gridClass}`}>
                {videoParticipants.map(participant => (
                  <VideoPlayer
                    key={participant.id}
                    stream={participant.stream}
                    name={participant.name}
                    isLocal={participant.isLocal}
                    isAudioEnabled={participant.isAudioEnabled}
                    isVideoEnabled={participant.isVideoEnabled}
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

        <aside className="w-full md:w-[340px] lg:w-[380px] border-t md:border-t-0 md:border-l border-border/50 bg-card flex flex-col shadow-lg max-h-full md:max-h-[calc(100vh-var(--header-height,65px))]">
          <div className="p-3 border-b border-border/50 sticky top-0 bg-card z-10 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-primary tracking-tight">Live Chat</h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-muted-foreground px-2 h-8">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{allParticipantsArray.length}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" side="top" align="end">
                  <div className="font-semibold text-sm mb-2">Room Members</div>
                  <ScrollArea className="max-h-48">
                    <div className="space-y-2 pr-2">
                        {allParticipantsArray.map(p => (
                            <div key={p.id} className="flex items-center gap-2 text-sm">
                                <Avatar className="h-7 w-7 text-xs">
                                    <AvatarFallback className="bg-muted text-muted-foreground">{p.name.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{p.name}{p.id === socket?.id ? ' (You)' : ''}</span>
                            </div>
                        ))}
                    </div>
                  </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
          <ScrollArea className="flex-1 p-2 md:p-3">
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
            <ChatSummary messages={messages} />
          </div>
        </aside>
      </div>
    </div>
  );
}
