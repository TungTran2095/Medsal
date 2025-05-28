
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number; // Using number for Date.now() for simplicity, can be Date object
}
