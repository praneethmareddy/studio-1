
'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import RoomHeader from '@/components/chat/RoomHeader';
import VideoPlayer from '@/components/chat/VideoPlayer';
import CallControls from '@/components/chat/CallControls';
import type { Message, RemoteParticipant } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Video as VideoIcon, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';

const SIGNALING_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:5000';

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const ChatSidebar = dynamic(() => import('@/components/chat/ChatSidebar'), {
  ssr: false,
  loading: () => (
    <div className="w-full md:w-[340px] lg:w-[380px] border-t md:border-t-0 md:border-l border-border/50 bg-card flex flex-col p-4 gap-4">
       <Skeleton className="h-8 w-1/2" />
       <div className="flex-1 space-y-4">
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-16 w-3/4 ml-auto" />
        <Skeleton className="h-12 w-2/3" />
       </div>
       <Skeleton className="h-10 w-full" />
       <Skeleton className="h-24 w-full" />
    </div>
  ),
});


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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const isMobile = useIsMobile();

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const { toast } = useToast();
  const localParticipantNameRef = useRef(localParticipantName);
  localParticipantNameRef.current = localParticipantName;


  const cleanupPeerConnection = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    setRemoteParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
    });
  }, []);

  // Effect for initializing and cleaning up socket connection
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

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setAllParticipants(new Map([[newSocket.id, { name: localParticipantNameRef.current }]]));
      newSocket.emit('join-room', { roomId, name: localParticipantNameRef.current });
    });

    const cleanup = () => {
      console.log("Cleaning up all connections.");
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      peerConnectionsRef.current.forEach((_, peerId) => cleanupPeerConnection(peerId));
      newSocket.disconnect();
    };
    
    window.addEventListener('beforeunload', cleanup);

    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [roomId, localParticipantName, router, toast, cleanupPeerConnection]);


  // Effect for handling socket events
  useEffect(() => {
    if (!socket) return;
    
    const createPeerConnection = (peerId: string, peerName: string): RTCPeerConnection => {
      // If a PC already exists, close it before creating a new one.
      if (peerConnectionsRef.current.has(peerId)) {
        cleanupPeerConnection(peerId);
      }
      
      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        console.log(`Received remote track from ${peerName} (${peerId})`);
        setRemoteParticipants(prev => {
            const existingParticipant = prev.get(peerId);
            return new Map(prev).set(peerId, { 
                id: peerId, 
                name: peerName, 
                stream: event.streams[0],
                isAudioEnabled: existingParticipant?.isAudioEnabled ?? true,
                isVideoEnabled: existingParticipant?.isVideoEnabled ?? true,
            });
        });
      };
      
      localStreamRef.current?.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });

      peerConnectionsRef.current.set(peerId, pc);
      return pc;
    };
    
    const callUser = async (peerId: string, peerName: string) => {
      const pc = createPeerConnection(peerId, peerName);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { target: peerId, sdp: pc.localDescription, name: localParticipantNameRef.current });
      } catch (e) {
        console.error(`Error creating offer for ${peerId}:`, e);
      }
    };
    
    const handleExistingUsers = (users: {id: string, name: string}[]) => {
      console.log('Received existing users list:', users);
      const newParticipants = new Map<string, {name: string}>();
      users.forEach(user => {
        if (user.id !== socket.id) {
          newParticipants.set(user.id, { name: user.name });
        }
      });
      setAllParticipants(prev => new Map([...prev, ...newParticipants]));
    };

    const handleUserJoined = ({ id: peerId, name: peerName }: { id: string; name: string }) => {
      if (peerId === socket.id) return;
      toast({ title: 'User Joined', description: `${peerName} has entered the room.` });
      setAllParticipants(prev => new Map(prev).set(peerId, { name: peerName }));
      
      // If we are already in a call, we should initiate a connection to the new user.
      if (localStreamRef.current) {
        console.log(`Already in call, initiating call to new user ${peerName}`);
        callUser(peerId, peerName);
      }
    };

    const handleReceiveOffer = async ({ caller, sdp, name: callerName }: { caller: string, sdp: RTCSessionDescriptionInit, name: string }) => {
      if (!localStreamRef.current) {
        console.warn('Offer received, but local stream is not ready. Ignoring offer.');
        return;
      }
      console.log(`Received offer from ${callerName}`);
      const pc = createPeerConnection(caller, callerName);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { target: caller, sdp: pc.localDescription, name: localParticipantNameRef.current });
      } catch (e) {
        console.error(`Error handling offer from ${caller}:`, e);
      }
    };

    const handleReceiveAnswer = async ({ answerer, sdp }: { answerer: string, sdp: RTCSessionDescriptionInit }) => {
      console.log(`Received answer from ${answerer}`);
      const pc = peerConnectionsRef.current.get(answerer);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (e) {
          console.error(`Error setting remote description for answer from ${answerer}:`, e);
        }
      }
    };

    const handleReceiveCandidate = async ({ from, candidate }: { from: string, candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
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
      setAllParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(peerId);
        return newMap;
      });
    };

    const handleReceiveMessage = (newMessage: Message) => setMessages(prev => [...prev, newMessage]);
    const handlePreviousMessages = (history: Message[]) => setMessages(history);
    
    const handleVideoStateChange = ({ userId, isVideoEnabled }: { userId: string, isVideoEnabled: boolean }) => {
      setRemoteParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(userId);
          if (participant) {
              newMap.set(userId, { ...participant, isVideoEnabled });
          }
          return newMap;
      });
    };
  
    const handleAudioStateChange = ({ userId, isAudioEnabled }: { userId:string, isAudioEnabled: boolean }) => {
        setRemoteParticipants(prev => {
            const newMap = new Map(prev);
            const participant = newMap.get(userId);
            if (participant) {
                newMap.set(userId, { ...participant, isAudioEnabled });
            }
            return newMap;
        });
    };
    
    socket.on('existing-users', handleExistingUsers);
    socket.on('user-joined', handleUserJoined);
    socket.on('offer', handleReceiveOffer);
    socket.on('answer', handleReceiveAnswer);
    socket.on('ice-candidate', handleReceiveCandidate);
    socket.on('user-disconnected', handleUserDisconnected);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('previous-messages', handlePreviousMessages);
    socket.on('user-video-state-changed', handleVideoStateChange);
    socket.on('user-audio-state-changed', handleAudioStateChange);

    return () => {
      socket.off('existing-users');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-disconnected');
      socket.off('receive-message');
      socket.off('previous-messages');
      socket.off('user-video-state-changed');
      socket.off('user-audio-state-changed');
    };
  }, [socket, cleanupPeerConnection, toast]);

  
  const joinCall = async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsInCall(true);
      
      allParticipants.forEach((participant, peerId) => {
        if (peerId !== socket?.id) {
          console.log(`Joining call, initiating call to existing user ${participant.name}`);
          const pc = createPeerConnection(peerId, participant.name);
          const callUser = async () => {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket?.emit('offer', { target: peerId, sdp: pc.localDescription, name: localParticipantNameRef.current });
            } catch (e) {
                console.error(`Error creating offer for ${peerId} in joinCall:`, e);
            }
          }
          callUser();
        }
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

  const createPeerConnection = (peerId: string, peerName: string): RTCPeerConnection => {
      if (peerConnectionsRef.current.has(peerId)) {
        console.log(`PC for ${peerName} already exists. Using existing one.`);
        return peerConnectionsRef.current.get(peerId)!;
      }
      console.log(`Creating new PC for ${peerName}`);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', { target: peerId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        console.log(`Received remote track from ${peerName} (${peerId})`);
        setRemoteParticipants(prev => {
            const existingParticipant = prev.get(peerId);
            return new Map(prev).set(peerId, { 
                id: peerId, 
                name: peerName, 
                stream: event.streams[0],
                isAudioEnabled: existingParticipant?.isAudioEnabled ?? true,
                isVideoEnabled: existingParticipant?.isVideoEnabled ?? true,
            });
        });
      };
      
      if(localStreamRef.current){
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      peerConnectionsRef.current.set(peerId, pc);
      return pc;
  };

  const leaveCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);
    setIsInCall(false);
    
    peerConnectionsRef.current.forEach((pc, peerId) => {
      cleanupPeerConnection(peerId);
    });

    setRemoteParticipants(new Map());
  }, [cleanupPeerConnection]);

  const toggleMic = () => {
    if (localStream) {
      const newMicState = !isMicEnabled;
      localStream.getAudioTracks().forEach(track => (track.enabled = newMicState));
      setIsMicEnabled(newMicState);
      socket?.emit('audio-state-changed', { roomId, isAudioEnabled: newMicState });
    }
  };

  const toggleVideo = () => {
    if (isScreenSharing) {
        toast({
            title: "Action not allowed",
            description: "Please stop sharing your screen before turning off your camera.",
            duration: 3000
        });
        return;
    }
    if (localStream) {
      const newVideoState = !isVideoEnabled;
      localStream.getVideoTracks().forEach(track => (track.enabled = newVideoState));
      setIsVideoEnabled(newVideoState);
      socket?.emit('video-state-changed', { roomId, isVideoEnabled: newVideoState });
    }
  };

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            // Stop screen sharing by stopping the screen track
            const screenTrack = localStreamRef.current?.getVideoTracks()[0];
            if (screenTrack && screenTrack.getSettings().displaySurface) {
                screenTrack.stop(); // This will trigger the 'onended' event handler
            }
        } else {
            // Start screen sharing
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
                const screenTrack = screenStream.getVideoTracks()[0];

                if (!localStreamRef.current) return;

                // Store current camera track to switch back later
                const cameraTrack = localStreamRef.current.getVideoTracks()[0];
                if (cameraTrack) {
                    cameraVideoTrackRef.current = cameraTrack;
                } else {
                    toast({ title: "Camera required", description: "Please enable your camera to start screen sharing.", variant: "destructive" });
                    return;
                }

                // Replace the track in all active peer connections
                peerConnectionsRef.current.forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(screenTrack);
                    }
                });

                // Update local stream for preview
                localStreamRef.current.removeTrack(cameraTrack);
                localStreamRef.current.addTrack(screenTrack);
                setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                setIsScreenSharing(true);
                
                // Handle when user clicks the browser's "Stop sharing" button
                screenTrack.onended = () => {
                    if (cameraVideoTrackRef.current && localStreamRef.current) {
                        // Get the current screen track to remove it
                        const currentScreenTrack = localStreamRef.current.getVideoTracks()[0];
                        
                        // Replace screen track with camera track for all peers
                        peerConnectionsRef.current.forEach(pc => {
                            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                            if (sender) {
                                sender.replaceTrack(cameraVideoTrackRef.current);
                            }
                        });
                        
                        // Update local stream for preview
                        localStreamRef.current.removeTrack(currentScreenTrack);
                        localStreamRef.current.addTrack(cameraVideoTrackRef.current);
                        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

                        setIsScreenSharing(false);
                    }
                };

            } catch (err) {
                console.error("Error accessing screen media.", err);
                if (err instanceof Error && err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                    toast({
                        title: 'Screen Share Error',
                        description: 'Could not access your screen. Please try again.',
                        variant: 'destructive',
                    });
                }
            }
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
  
  const videoParticipants = Array.from(remoteParticipants.values());
  if (localStream && isInCall) {
    videoParticipants.unshift({
        id: socket?.id || 'local',
        name: `${localParticipantName} (You)`,
        stream: localStream,
        isLocal: true,
        isAudioEnabled: isMicEnabled,
        isVideoEnabled: isVideoEnabled && !isScreenSharing,
    } as any);
  }
  
  const gridClass = videoParticipants.length <= 1 ? 'grid-cols-1 grid-rows-1'
                  : videoParticipants.length === 2 ? 'grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1'
                  : videoParticipants.length <= 4 ? 'grid-cols-2 grid-rows-2'
                  : 'grid-cols-2 lg:grid-cols-3';

  const renderChatSidebar = () => (
    <ChatSidebar
      messages={messages}
      allParticipants={allParticipants}
      socket={socket}
      onSendMessage={handleSendMessage}
      onClose={() => setIsChatOpen(false)}
      isMobile={isMobile}
    />
  );
  
  return (
    <div className="flex flex-col h-screen bg-background">
      <RoomHeader 
        roomId={roomId} 
        videoParticipants={videoParticipants} 
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        isChatOpen={isChatOpen}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden transition-all duration-300">
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
                    isLocal={participant.id === socket?.id || (participant as any).isLocal}
                    isAudioEnabled={participant.isAudioEnabled}
                    isVideoEnabled={participant.isVideoEnabled}
                  />
                ))}
              </div>
              <CallControls
                isMicEnabled={isMicEnabled}
                isVideoEnabled={isVideoEnabled}
                isScreenSharing={isScreenSharing}
                onLeaveCall={leaveCall}
                onToggleMic={toggleMic}
                onToggleVideo={toggleVideo}
                onToggleScreenShare={toggleScreenShare}
                className="mt-auto"
              />
            </>
          )}
        </main>
        
        {!isMobile && isChatOpen && renderChatSidebar()}
        
      </div>
      
      {isMobile && (
          <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
              <SheetContent side="right" className="w-[85vw] p-0 border-none">
                  {renderChatSidebar()}
              </SheetContent>
          </Sheet>
      )}
    </div>
  );
}
