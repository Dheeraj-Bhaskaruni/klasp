'use client';

// Global application state managed via React Context.
// Notes and settings are persisted to localStorage.
// Chat history lives only in memory and resets on page reload.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppContextValue,
  AppSettings,
  ChatMessage,
  CodeLine,
  LineByLineSession,
  Note,
  TeachingApproach,
  TeachingStyle,
  TTSVoice,
} from '@/types';

// ─── Default values ────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  openaiApiKey: '',
  teachingStyle: 'beginner' as TeachingStyle,
  teachingApproach: 'step-by-step' as TeachingApproach,
  voiceOutputEnabled: true,
  ttsVoice: 'nova' as TTSVoice,
  speechRate: 1.0,
};

const STORAGE_KEYS = {
  NOTES: 'vt_notes',
  SETTINGS: 'vt_settings',
} as const;

// ─── Context ───────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

// ─── Utilities ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn(`Failed to persist ${key} to localStorage.`);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Hydration guard — prevents SSR/client mismatch by waiting for mount
  const [isHydrated, setIsHydrated] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeNoteContext, setActiveNoteContext] = useState<string | null>(null);
  const [lineByLineSession, setLineByLineSession] = useState<LineByLineSession | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Ref to track the latest notes/settings for stable callbacks
  const notesRef = useRef(notes);
  const settingsRef = useRef(settings);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load persisted data after hydration
  useEffect(() => {
    const savedNotes = loadFromStorage<Note[]>(STORAGE_KEYS.NOTES, []);
    const savedSettings = loadFromStorage<AppSettings>(
      STORAGE_KEYS.SETTINGS,
      DEFAULT_SETTINGS
    );

    // Merge with defaults to handle new settings fields added in updates
    setNotes(savedNotes);
    setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
    setIsHydrated(true);
  }, []);

  // ── Chat actions ────────────────────────────────────────────────────────────

  const addMessage = useCallback(
    (message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage => {
      const newMessage: ChatMessage = {
        ...message,
        id: generateId(),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newMessage]);
      return newMessage;
    },
    []
  );

  const updateMessage = useCallback(
    (id: string, updates: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
      );
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setActiveNoteContext(null);
  }, []);

  // ── Notes actions ───────────────────────────────────────────────────────────

  const addNote = useCallback(
    (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note => {
      const newNote: Note = {
        ...note,
        id: generateId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setNotes((prev) => {
        const updated = [newNote, ...prev];
        saveToStorage(STORAGE_KEYS.NOTES, updated);
        return updated;
      });
      return newNote;
    },
    []
  );

  const updateNote = useCallback(
    (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => {
      setNotes((prev) => {
        const updated = prev.map((note) =>
          note.id === id
            ? { ...note, ...updates, updatedAt: Date.now() }
            : note
        );
        saveToStorage(STORAGE_KEYS.NOTES, updated);
        return updated;
      });
    },
    []
  );

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const updated = prev.filter((note) => note.id !== id);
      saveToStorage(STORAGE_KEYS.NOTES, updated);
      return updated;
    });
  }, []);

  // ── Line-by-line session actions ─────────────────────────────────────────

  const startLineByLineSession = useCallback(
    (title: string, code: string, language: string, noteId?: string) => {
      const codeLines = code.split('\n').filter((l) => l.trim() !== '');
      const lines: CodeLine[] = codeLines.map((content, idx) => ({
        lineNumber: idx + 1,
        content,
        status: idx === 0 ? 'teaching' : 'pending',
      }));

      const session: LineByLineSession = {
        id: generateId(),
        noteId,
        title,
        language,
        lines,
        currentLineIndex: 0,
        startedAt: Date.now(),
      };

      setLineByLineSession(session);
      setMessages([]);
    },
    []
  );

  const markCurrentLineLearned = useCallback(() => {
    setLineByLineSession((prev) => {
      if (!prev) return null;
      const lines = [...prev.lines];
      lines[prev.currentLineIndex] = { ...lines[prev.currentLineIndex], status: 'learned' };

      const nextIndex = prev.currentLineIndex + 1;
      if (nextIndex < lines.length) {
        lines[nextIndex] = { ...lines[nextIndex], status: 'teaching' };
        return { ...prev, lines, currentLineIndex: nextIndex };
      }

      // All lines learned
      return { ...prev, lines, currentLineIndex: nextIndex, completedAt: Date.now() };
    });
  }, []);

  const skipCurrentLine = useCallback(() => {
    setLineByLineSession((prev) => {
      if (!prev) return null;
      const lines = [...prev.lines];
      // Keep current line as pending (skipped)
      lines[prev.currentLineIndex] = { ...lines[prev.currentLineIndex], status: 'pending' };

      const nextIndex = prev.currentLineIndex + 1;
      if (nextIndex < lines.length) {
        lines[nextIndex] = { ...lines[nextIndex], status: 'teaching' };
        return { ...prev, lines, currentLineIndex: nextIndex };
      }

      return { ...prev, lines, currentLineIndex: nextIndex };
    });
  }, []);

  const endLineByLineSession = useCallback(() => {
    setLineByLineSession(null);
  }, []);

  // ── Settings actions ────────────────────────────────────────────────────────

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...updates };
      saveToStorage(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });
  }, []);

  // ── Context value ───────────────────────────────────────────────────────────

  const value: AppContextValue = {
    messages,
    addMessage,
    clearMessages,
    updateMessage,
    notes,
    addNote,
    updateNote,
    deleteNote,
    settings,
    updateSettings,
    activeNoteContext,
    setActiveNoteContext,
    lineByLineSession,
    startLineByLineSession,
    markCurrentLineLearned,
    skipCurrentLine,
    endLineByLineSession,
    isSpeaking,
    setIsSpeaking,
    isProcessing,
    setIsProcessing,
  };

  // Render a minimal shell during SSR/hydration to avoid mismatches
  if (!isHydrated) {
    return (
      <AppContext.Provider value={value}>
        <div className="min-h-screen bg-gray-950" />
      </AppContext.Provider>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
