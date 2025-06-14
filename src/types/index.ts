
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system'; 
  timestamp: Date;
  roomId: string;
  userId?: string; 
}

export interface Participant {
  id: string;
  name: string;
  isLocal?: boolean;
  stream?: MediaStream;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
}

// This type was previously RemoteStream, now generalized and also used for local participant in the context of WebRTC state
export interface StreamParticipant extends Participant {
  stream: MediaStream; // Stream is non-optional for active participants in a call
}
