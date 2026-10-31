/**
 * Types partagés du chat Si Driss.
 * (Dette Sprint 4) Extraits de SessionManagerModal.tsx — composant mort de 604
 * lignes — afin de pouvoir le supprimer sans casser les importants consommateurs.
 */

export interface ChatAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'text' | 'exercise' | 'document';
  mimeType?: string;
  data?: string; // base64 Data URL or raw base64
  text?: string;
  size?: number;
  previewUrl?: string;
  exerciseId?: string;
  chapter?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'socratic' | 'direct' | 'review' | 'trap';
  timestamp: string;
  attachments?: ChatAttachment[];
}

export interface SavedSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  socraticEnabled: boolean;
  coachingMode: 'socratic' | 'direct' | 'review' | 'trap';
}
