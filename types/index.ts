// Core domain types for the Voice Teacher application

export type TeachingStyle = 'beginner' | 'intermediate' | 'advanced';

export type TeachingApproach =
  | 'step-by-step'
  | 'explain-then-example'
  | 'quiz-based'
  | 'line-by-line';

export type TTSVoice =
  | 'alloy'
  | 'echo'
  | 'fable'
  | 'onyx'
  | 'nova'
  | 'shimmer';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isVoice?: boolean; // true if user message came from voice recording
  isSpeaking?: boolean; // true if this assistant message is currently being spoken
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

export interface AppSettings {
  openaiApiKey: string;
  teachingStyle: TeachingStyle;
  teachingApproach: TeachingApproach;
  voiceOutputEnabled: boolean;
  ttsVoice: TTSVoice;
  speechRate: number; // 0.25 to 4.0, default 1.0
}

export interface TranscribeRequest {
  // Audio blob sent as FormData
}

export interface TranscribeResponse {
  text: string;
  error?: string;
}

export interface ChatRequest {
  message: string;
  history: Array<{ role: MessageRole; content: string }>;
  noteContext?: string;
  settings: Pick<AppSettings, 'teachingStyle' | 'teachingApproach'>;
  lineByLine?: {
    currentLine: string;
    lineNumber: number;
    totalLines: number;
    language: string;
    fullCode: string;
    learnedLines: string[];
  };
}

export interface ChatResponse {
  content: string;
  error?: string;
}

export interface TTSRequest {
  text: string;
  voice: TTSVoice;
  speed: number;
}

export interface TTSResponse {
  // Audio blob returned as binary stream
  error?: string;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  durationMs: number;
}

// Line-by-line teaching session
export type LineStatus = 'pending' | 'teaching' | 'learned';

export interface CodeLine {
  lineNumber: number;
  content: string;
  status: LineStatus;
}

export interface LineByLineSession {
  id: string;
  noteId?: string;
  title: string;
  language: string;
  lines: CodeLine[];
  currentLineIndex: number;
  startedAt: number;
  completedAt?: number;
}

export interface AppContextValue {
  // Chat state
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => ChatMessage;
  clearMessages: () => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;

  // Notes state
  notes: Note[];
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Note;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => void;
  deleteNote: (id: string) => void;

  // Settings state
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Active note context for teaching
  activeNoteContext: string | null;
  setActiveNoteContext: (context: string | null) => void;

  // Line-by-line session
  lineByLineSession: LineByLineSession | null;
  startLineByLineSession: (title: string, code: string, language: string, noteId?: string) => void;
  markCurrentLineLearned: () => void;
  skipCurrentLine: () => void;
  endLineByLineSession: () => void;

  // UI state
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}
