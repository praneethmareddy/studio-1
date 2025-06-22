
'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import RoomHeader from '@/components/chat/RoomHeader';
import VideoPlayer from '@/components/chat/VideoPlayer';
import CallControls from '@/components/chat/CallControls';
import type { Message, RemoteParticipant, Reaction } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Video as VideoIcon, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
  
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const micAudioTrackRef = useRef<MediaStreamTrack | null>(null);
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


  const createPeerConnection = useCallback((peerId: string, peerName: string): RTCPeerConnection => {
      if (peerConnectionsRef.current.has(peerId)) {
        cleanupPeerConnection(peerId);
      }
      
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
                isScreenSharing: existingParticipant?.isScreenSharing ?? false,
            });
        });
      };
      
      localStreamRef.current?.getTracks().forEach(track => {
          try {
            pc.addTrack(track, localStreamRef.current!);
          } catch (e) {
             console.error(`Error adding track for ${peerId}:`, e);
          }
      });

      peerConnectionsRef.current.set(peerId, pc);
      return pc;
  }, [socket, cleanupPeerConnection]);


  const stopScreenShare = useCallback(() => {
    if (!cameraVideoTrackRef.current || !localStreamRef.current) return;
  
    const screenVideoTrack = localStreamRef.current.getVideoTracks().find(track => track.getSettings().displaySurface);
  
    peerConnectionsRef.current.forEach(pc => {
      const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender && cameraVideoTrackRef.current) {
          videoSender.replaceTrack(cameraVideoTrackRef.current);
      }
      // Audio sender handling is tricky because screen audio is optional.
      // A simple approach is to always replace with the mic track.
      if (micAudioTrackRef.current) {
        const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (audioSender) audioSender.replaceTrack(micAudioTrackRef.current);
      }
    });
    
    // Stop and remove screen tracks from the local stream
    localStreamRef.current.getTracks().forEach(track => {
        if(track.getSettings().displaySurface || track.id !== micAudioTrackRef.current?.id) {
            track.stop();
            localStreamRef.current.removeTrack(track);
        }
    });

    // Re-add original camera and mic tracks if they are not already there
    if(cameraVideoTrackRef.current && !localStreamRef.current.getVideoTracks().length) {
        localStreamRef.current.addTrack(cameraVideoTrackRef.current);
    }
     if(micAudioTrackRef.current && !localStreamRef.current.getAudioTracks().length) {
        localStreamRef.current.addTrack(micAudioTrackRef.current);
    }
  
    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    setIsScreenSharing(false);
  
    if (pinnedUserId === socket?.id) {
      setPinnedUserId(null);
    }
  
    socket?.emit('screen-share-stopped', { roomId });
    
  }, [socket, roomId, pinnedUserId]);


  useEffect(() => {
    if (!socket) return;
        
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
    
    const handleExistingUsers = (users: {id: string, name: string, isScreenSharing: boolean}[]) => {
      console.log('Received existing users list:', users);
      const newParticipants = new Map<string, {name: string}>();
      users.forEach(user => {
        if (user.id !== socket.id) {
          newParticipants.set(user.id, { name: user.name });
          if(user.isScreenSharing) {
            setPinnedUserId(user.id);
          }
        }
      });
      setAllParticipants(prev => new Map([...prev, ...newParticipants]));
      if(localStreamRef.current) {
         users.forEach(user => {
            if (user.id !== socket.id) callUser(user.id, user.name)
         });
      }
    };

    const handleUserJoined = ({ id: peerId, name: peerName, isScreenSharing }: { id: string; name: string, isScreenSharing: boolean }) => {
      if (peerId === socket.id) return;
      toast({ title: 'User Joined', description: `${peerName} has entered the room.` });
      setAllParticipants(prev => new Map(prev).set(peerId, { name: peerName }));
      
      if (localStreamRef.current) {
        console.log(`Already in call, initiating call to new user ${peerName}`);
        callUser(peerId, peerName);
      }

      if (isScreenSharing) {
        setPinnedUserId(peerId);
      }
    };

    const handleReceiveOffer = async ({ caller, sdp, name: callerName }: { caller: string, sdp: RTCSessionDescriptionInit, name: string }) => {
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
      if (peerId === pinnedUserId) {
        setPinnedUserId(null);
      }
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

    const handleScreenShareStarted = ({ userId }: { userId: string }) => {
        setPinnedUserId(userId);
        setRemoteParticipants(prev => {
            const newMap = new Map(prev);
            const participant = newMap.get(userId);
            if (participant) {
                newMap.set(userId, { ...participant, isScreenSharing: true });
            }
            return newMap;
        });
    };

    const handleScreenShareStopped = ({ userId }: { userId: string }) => {
        if (pinnedUserId === userId) {
            setPinnedUserId(null);
        }
        setRemoteParticipants(prev => {
            const newMap = new Map(prev);
            const participant = newMap.get(userId);
            if (participant) {
                newMap.set(userId, { ...participant, isScreenSharing: false });
            }
            return newMap;
        });
    };

    const handleReceiveEmoji = ({ userId, emoji }: { userId: string, emoji: string }) => {
        setReactions(prev => [...prev, { userId, emoji, id: Date.now() }]);
    };

    const handleForceStopScreenShare = () => {
      if (isScreenSharing) {
        stopScreenShare();
        toast({
          title: "Screen Share Stopped",
          description: "Another user has started presenting.",
          duration: 3000,
        });
      }
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
    socket.on('user-screen-share-started', handleScreenShareStarted);
    socket.on('user-screen-share-stopped', handleScreenShareStopped);
    socket.on('receive-emoji', handleReceiveEmoji);
    socket.on('force-stop-screen-share', handleForceStopScreenShare);


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
      socket.off('user-screen-share-started');
      socket.off('user-screen-share-stopped');
      socket.off('receive-emoji');
      socket.off('force-stop-screen-share');
    };
  }, [socket, cleanupPeerConnection, toast, createPeerConnection, pinnedUserId, stopScreenShare]);

  
  const joinCall = async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      micAudioTrackRef.current = stream.getAudioTracks()[0];
      cameraVideoTrackRef.current = stream.getVideoTracks()[0];
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

  const leaveCall = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    }
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
  }, [cleanupPeerConnection, isScreenSharing, stopScreenShare]);

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
          stopScreenShare();
      } else {
          try {
              const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
              
              if (!localStreamRef.current) return;
              
              // Store original tracks if not already stored
              if (!cameraVideoTrackRef.current) cameraVideoTrackRef.current = localStreamRef.current.getVideoTracks()[0];
              if (!micAudioTrackRef.current) micAudioTrackRef.current = localStreamRef.current.getAudioTracks()[0];

              const screenVideoTrack = screenStream.getVideoTracks()[0];
              const screenAudioTrack = screenStream.getAudioTracks()[0];
              
              peerConnectionsRef.current.forEach(pc => {
                  const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
                  if (videoSender) videoSender.replaceTrack(screenVideoTrack);
                  
                  if (screenAudioTrack) {
                      const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
                      if (audioSender) audioSender.replaceTrack(screenAudioTrack);
                  }
              });

              // Replace tracks in local stream for local preview
              const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
              if(currentVideoTrack) localStreamRef.current.removeTrack(currentVideoTrack);
              localStreamRef.current.addTrack(screenVideoTrack);

              if (screenAudioTrack) {
                const currentAudioTrack = localStreamRef.current.getAudioTracks()[0];
                if(currentAudioTrack) localStreamRef.current.removeTrack(currentAudioTrack);
                localStreamRef.current.addTrack(screenAudioTrack);
              }
              
              setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
              setIsScreenSharing(true);
              setPinnedUserId(socket?.id || null);
              socket?.emit('screen-share-started', { roomId });
              
              screenVideoTrack.onended = () => {
                  stopScreenShare();
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

  const handleSendReaction = (emoji: string) => {
    if (!socket) return;
    socket.emit('send-emoji', { roomId, emoji });
    setReactions(prev => [...prev, { userId: socket.id!, emoji, id: Date.now() }]);
  };
  
  const videoParticipants = Array.from(remoteParticipants.values());
  if (localStream && isInCall) {
    videoParticipants.unshift({
        id: socket?.id || 'local',
        name: `${localParticipantName} (You)`,
        stream: localStream,
        isLocal: true,
        isAudioEnabled: isMicEnabled,
        isVideoEnabled: isVideoEnabled,
        isScreenSharing: isScreenSharing
    } as any);
  }
  
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
  
  const getGridLayoutClassName = (count: number) => {
    if (count <= 1) {
      return 'grid-cols-1 max-w-4xl mx-auto';
    }
    if (count === 2) {
      return 'grid-cols-1 md:grid-cols-2';
    }
    if (count <= 4) {
      return 'grid-cols-2';
    }
    if (count <= 6) {
      return 'grid-cols-2 md:grid-cols-3';
    }
    if (count <= 9) {
      return 'grid-cols-3';
    }
    return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  };

  const pinnedParticipant = videoParticipants.find(p => p.id === pinnedUserId);
  const filmstripParticipants = videoParticipants.filter(p => p.id !== pinnedUserId);

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
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              {pinnedParticipant ? (
                // Spotlight Layout
                <div className="flex-1 flex flex-col min-h-0 gap-2">
                  <div className="flex-1 bg-card rounded-lg overflow-hidden relative">
                    <VideoPlayer
                      key={pinnedParticipant.id}
                      stream={pinnedParticipant.stream}
                      name={pinnedParticipant.name}
                      isLocal={(pinnedParticipant as any).isLocal}
                      isAudioEnabled={pinnedParticipant.isAudioEnabled}
                      isVideoEnabled={pinnedParticipant.isVideoEnabled}
                      reactions={reactions.filter(r => r.userId === pinnedParticipant.id)}
                      onPin={() => setPinnedUserId(null)}
                      isPinned={true}
                      isScreenSharing={pinnedParticipant.isScreenSharing}
                    />
                  </div>
                  <div className="h-28 md:h-36 flex-shrink-0">
                    <div className="flex gap-2 h-full overflow-x-auto p-1">
                      {filmstripParticipants.map(participant => (
                         <div key={participant.id} className="h-full aspect-video flex-shrink-0">
                           <VideoPlayer
                             stream={participant.stream}
                             name={participant.name}
                             isLocal={(participant as any).isLocal}
                             isAudioEnabled={participant.isAudioEnabled}
                             isVideoEnabled={participant.isVideoEnabled}
                             reactions={reactions.filter(r => r.userId === participant.id)}
                             onPin={() => setPinnedUserId(participant.id)}
                           />
                         </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // Grid Layout
                <div className={cn(
                  "flex-1 grid gap-2 overflow-y-auto p-1", 
                  getGridLayoutClassName(videoParticipants.length)
                )}>
                    {videoParticipants.map(participant => (
                      <div key={participant.id} className="aspect-video min-w-0">
                        <VideoPlayer
                            stream={participant.stream}
                            name={participant.name}
                            isLocal={(participant as any).isLocal}
                            isAudioEnabled={participant.isAudioEnabled}
                            isVideoEnabled={participant.isVideoEnabled}
                            reactions={reactions.filter(r => r.userId === participant.id)}
                            onPin={() => setPinnedUserId(participant.id)}
                            isScreenSharing={participant.isScreenSharing}
                        />
                      </div>
                    ))}
                </div>
              )}
              <CallControls
                isMicEnabled={isMicEnabled}
                isVideoEnabled={isVideoEnabled}
                isScreenSharing={isScreenSharing}
                onLeaveCall={leaveCall}
                onToggleMic={toggleMic}
                onToggleVideo={toggleVideo}
                onToggleScreenShare={toggleScreenShare}
                onSendReaction={handleSendReaction}
                className="mt-auto mx-auto"
                isMobile={isMobile}
              />
            </div>
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
