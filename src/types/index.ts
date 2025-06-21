
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system'; 
  timestamp: Date;
  roomId: string;
  userId: string; 
  senderName: string;
}

export interface RemoteParticipant {
  id: string; // socket.id
  name: string;
  stream: MediaStream;
}
