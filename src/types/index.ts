
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system'; 
  timestamp: Date;
  roomId: string;
  userId?: string; 
}

// Represents a participant in the room, identified by their socket ID
export interface Participant {
  id: string; // This will be the socket.id
  name: string;
  isLocal?: boolean;
}

// Represents a remote participant with their media stream
export interface RemoteParticipant extends Participant {
  stream: MediaStream;
}

// The types below are no longer needed for Socket.IO signaling
// and can be removed if you are not using them elsewhere.
export interface StreamParticipant extends Participant {
  stream: MediaStream; // Stream is non-optional for active participants in a call
}
