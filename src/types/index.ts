

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system'; 
  timestamp: Date | string; // Allow string for data from backend
  roomId: string;
  userId: string; 
  senderName: string;
  senderId?: string; // from backend
}

export interface RemoteParticipant {
  id: string; // socket.id
  name: string;
  stream: MediaStream;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}

export interface VideoParticipant {
    id: string;
    name: string;
    stream: MediaStream | null;
    isLocal: boolean;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isScreenSharing: boolean;
}

export interface Reaction {
  userId: string;
  emoji: string;
  id: number; // unique id for animation key
}
