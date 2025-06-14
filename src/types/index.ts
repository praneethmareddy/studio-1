export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system'; // 'user' for participant, 'ai' for suggestions, 'system' for notifications
  timestamp: Date;
  roomId: string;
  userId?: string; // Optional: if you want to identify users later
}
