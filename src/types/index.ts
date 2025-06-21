
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
}

export interface VideoParticipant {
    id: string;
    name: string;
    stream: MediaStream | null;
    isLocal: boolean;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
}
