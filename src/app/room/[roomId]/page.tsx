
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
import { database } from '@/lib/firebase'; // Firebase integration
import { ref, onValue, set, onDisconnect, remove, serverTimestamp } from 'firebase/database'; // Firebase RTDB functions

// Helper to generate a unique ID for participants
const generateParticipantId = () => `participant-${Math.random().toString(36).substring(2, 11)}`;

export default function RoomPage() {
  const params = useParams();
  const roomId = typeof params.roomId === 'string' ? params.roomId : '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [localParticipantId, setLocalParticipantId] = useState<string | null>(null);
  const localParticipantIdRef = useRef<string | null>(null); // Ref to hold current participantId for cleanup

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]); // All participants from Firebase
  const [streamParticipants, setStreamParticipants] = useState<StreamParticipant[]>([]); // Participants with active streams (local + remote)


  const [isCallActive, setIsCallActive] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    const newParticipantId = generateParticipantId();
    setLocalParticipantId(newParticipantId);
    localParticipantIdRef.current = newParticipantId; // Store in ref for cleanup

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
    
    // Firebase cleanup on unmount
    return () => {
      if (roomId && localParticipantIdRef.current) {
        const participantRef = ref(database, `rooms/${roomId}/participants/${localParticipantIdRef.current}`);
        remove(participantRef);
      }
    };
  }, [roomId]);

  // Subscribe to participants changes in Firebase
  useEffect(() => {
    if (!roomId || !isCallActive || !localParticipantId) return;

    const participantsRef = ref(database, `rooms/${roomId}/participants`);
    const unsubscribe = onValue(participantsRef, (snapshot) => {
      const participantsData = snapshot.val();
      const fetchedParticipants: Participant[] = [];
      if (participantsData) {
        Object.keys(participantsData).forEach(key => {
          if (key !== localParticipantId) { // Exclude local participant from this list initially
            fetchedParticipants.push({ id: key, ...participantsData[key] });
          }
        });
      }
      setAllParticipants(fetchedParticipants);
      // Basic update to streamParticipants - more complex WebRTC logic would update this based on connections
      // For now, we'll just show our local stream and placeholders if others are detected
      if (localStream) {
        const localParticipantStream: StreamParticipant = {
          id: localParticipantId,
          name: 'You (Me)', // Placeholder name
          stream: localStream,
          isLocal: true,
          isAudioEnabled: isMicEnabled,
          isVideoEnabled: isVideoEnabled,
        };
         // Combine local stream with dummy remote streams for now
        const currentStreamParticipants = [localParticipantStream];
        
        // Placeholder for remote participants based on 'allParticipants'
        // In a real app, this would be driven by successful WebRTC connections
        fetchedParticipants.forEach(p => {
          // This is a placeholder. Real remote streams would be added via WebRTC.
          // For now, we'll just acknowledge their presence without a stream.
          // To actually display remote videos, WebRTC peer connections are needed.
        });
        setStreamParticipants(currentStreamParticipants);

      }
    });

    return () => unsubscribe();
  }, [roomId, isCallActive, localParticipantId, localStream, isMicEnabled, isVideoEnabled]);


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

      // Add local participant to Firebase
      const participantRef = ref(database, `rooms/${roomId}/participants/${localParticipantId}`);
      const participantData = {
        id: localParticipantId,
        name: `User-${localParticipantId.substring(0,5)}`, // Simple name
        joinedAt: serverTimestamp(),
        isAudioEnabled: true,
        isVideoEnabled: true,
      };
      await set(participantRef, participantData);
      onDisconnect(participantRef).remove(); // Firebase handles removal if connection drops

      const localPStream: StreamParticipant = {
        id: localParticipantId,
        name: 'You',
        stream: stream,
        isLocal: true,
        isAudioEnabled: true,
        isVideoEnabled: true,
      };
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
    if (roomId && localParticipantId) {
      const participantRef = ref(database, `rooms/${roomId}/participants/${localParticipantId}`);
      await remove(participantRef); // Explicitly remove on leaving
    }
    cleanupStream(localStream);
    // In a full WebRTC app, you would also clean up all peer connections here
    streamParticipants.filter(p => !p.isLocal).forEach(p => p.stream && cleanupStream(p.stream));
    
    setLocalStream(null);
    setStreamParticipants([]);
    setAllParticipants([]);
    setIsCallActive(false);
    setMediaError(null);
  }, [roomId, localParticipantId, localStream, streamParticipants]);

  useEffect(() => {
    // This effect ensures that if the component unmounts (e.g. user navigates away),
    // we attempt to leave the call properly.
    const currentLocalParticipantId = localParticipantIdRef.current;
    const currentRoomId = roomId;
    
    return () => { 
      if (isCallActive && currentRoomId && currentLocalParticipantId) {
        // Try to gracefully leave the call if it was active
        const participantRef = ref(database, `rooms/${currentRoomId}/participants/${currentLocalParticipantId}`);
        remove(participantRef);
      }
      cleanupStream(localStream);
      streamParticipants.filter(p => !p.isLocal).forEach(p => p.stream && cleanupStream(p.stream));
    };
  }, [isCallActive, localStream, streamParticipants, roomId]);


  const toggleMic = async () => {
    if (localStream && localParticipantId) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const newMicState = !isMicEnabled;
        audioTracks.forEach(track => track.enabled = newMicState);
        setIsMicEnabled(newMicState);
        
        // Update Firebase
        const participantRef = ref(database, `rooms/${roomId}/participants/${localParticipantId}`);
        await set(participantRef, { isAudioEnabled: newMicState }, { merge: true });

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

        // Update Firebase
        const participantRef = ref(database, `rooms/${roomId}/participants/${localParticipantId}`);
        await set(participantRef, { isVideoEnabled: newVideoState }, { merge: true });

        setStreamParticipants(prev => prev.map(p => p.id === localParticipantId ? {...p, isVideoEnabled: newVideoState} : p));
      }
    }
  };
  
  const handleSendMessage = (text: string) => {
    if (!localParticipantId) return; // Using localParticipantId as userId for chat now
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      sender: 'user', 
      timestamp: new Date(),
      roomId,
      userId: localParticipantId, 
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
              <div className="mb-2 text-sm text-muted-foreground">
                In call. Participants in room (from Firebase): {allParticipants.length + 1} (including you).
                {/* Displaying names of other participants */}
                {allParticipants.length > 0 && (
                  <span className="ml-2">Others: {allParticipants.map(p => p.name || p.id.substring(0,5)).join(', ')}</span>
                )}
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
                {/* This part needs full WebRTC to show actual remote streams */}
                {allParticipants.length > 0 && !streamParticipants.find(p => !p.isLocal && p.stream) && (
                   <div className="bg-muted/70 rounded-lg flex flex-col items-center justify-center text-muted-foreground aspect-video p-4 animate-pulse border border-border/30">
                       <Users className="w-12 h-12 md:w-16 md:h-16 opacity-60 mb-3" />
                       <p className="text-sm md:text-base text-center">
                        {allParticipants.length > 0 ? `${allParticipants.length} other participant(s) detected. Waiting for video/audio connection...` : "Waiting for others to join..."}
                       </p>
                       <p className="text-xs mt-1"> (Full video connection requires WebRTC offer/answer exchange - not yet implemented) </p>
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
