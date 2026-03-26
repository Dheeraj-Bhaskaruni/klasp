'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import NoteCard from '@/components/NoteCard';
import NoteEditor from '@/components/NoteEditor';
import { Note } from '@/types';
import { playAudioBlob } from '@/lib/audioRecorder';

export default function NotesPage() {
  const router = useRouter();
  const { notes, addNote, updateNote, deleteNote, setActiveNoteContext, clearMessages, startLineByLineSession, settings } = useApp();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [readingNoteId, setReadingNoteId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = (data: { title: string; content: string }) => {
    if (editingNote) {
      updateNote(editingNote.id, data);
      showSuccess('Note updated.');
    } else {
      addNote(data);
      showSuccess('Note added.');
    }
    setIsEditorOpen(false);
    setEditingNote(null);
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteNote(id);
    showSuccess('Note deleted.');
  };

  const handleTeachMe = (note: Note) => {
    // Set the note content as the active teaching context and navigate to chat
    const context = `# ${note.title}\n\n${note.content}`;
    setActiveNoteContext(context);
    clearMessages();
    router.push('/');
  };

  const handleTeachLineByLine = (note: Note) => {
    // Detect language from content (simple heuristic)
    const lang = detectLanguage(note.content);
    startLineByLineSession(note.title, note.content, lang, note.id);
    router.push('/');
  };

  const handleReadAloud = useCallback(async (note: Note) => {
    const apiKey = settings.openaiApiKey;
    if (!apiKey) {
      showSuccess('Please add your OpenAI API key in Settings first.');
      return;
    }

    // If already reading this note, stop it
    if (readingNoteId === note.id && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setReadingNoteId(null);
      return;
    }

    // Stop any current audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setReadingNoteId(note.id);

    try {
      const textToRead = `${note.title}. ${note.content}`;
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-api-key': apiKey,
        },
        body: JSON.stringify({
          text: textToRead,
          voice: settings.ttsVoice,
          speed: settings.speechRate,
        }),
      });

      if (!res.ok) {
        throw new Error('TTS request failed');
      }

      const audioBlob = await res.blob();
      const audio = playAudioBlob(audioBlob);
      currentAudioRef.current = audio;

      audio.addEventListener('ended', () => {
        setReadingNoteId(null);
        currentAudioRef.current = null;
      });

      audio.addEventListener('error', () => {
        setReadingNoteId(null);
        currentAudioRef.current = null;
      });
    } catch {
      setReadingNoteId(null);
      showSuccess('Failed to read aloud. Check your API key.');
    }
  }, [settings.openaiApiKey, settings.ttsVoice, settings.speechRate, readingNoteId]);

  const handleOpenNewEditor = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleCancelEditor = () => {
    setIsEditorOpen(false);
    setEditingNote(null);
  };

  // Simple language detection heuristic
  function detectLanguage(content: string): string {
    if (content.includes('def ') || content.includes('import ') && content.includes(':')) return 'python';
    if (content.includes('function ') || content.includes('const ') || content.includes('let ')) return 'javascript';
    if (content.includes('interface ') || content.includes(': string') || content.includes(': number')) return 'typescript';
    if (content.includes('public class ') || content.includes('System.out')) return 'java';
    if (content.includes('#include') || content.includes('std::')) return 'cpp';
    if (content.includes('func ') && content.includes('fmt.')) return 'go';
    if (content.includes('<div') || content.includes('<html')) return 'html';
    if (content.includes('SELECT ') || content.includes('FROM ')) return 'sql';
    return 'text';
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Teaching Notes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Add notes, code, or any content and let the AI teacher explain it to you.
          </p>
        </div>
        {!isEditorOpen && (
          <button
            onClick={handleOpenNewEditor}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all active:scale-95 shadow-lg shadow-violet-600/20 flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Note
          </button>
        )}
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-sm text-green-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {successMessage}
        </div>
      )}

      {/* Note editor (inline) */}
      {isEditorOpen && (
        <div className="mb-6">
          <NoteEditor
            note={editingNote}
            onSave={handleSave}
            onCancel={handleCancelEditor}
          />
        </div>
      )}

      {/* Search */}
      {notes.length > 0 && (
        <div className="mb-5 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800/60 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 && !isEditorOpen ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <p className="text-white font-medium">No notes yet</p>
            <p className="text-gray-500 text-sm mt-1 max-w-xs">
              Add your first note to start teaching. You can paste code, documentation, or any text.
            </p>
          </div>
          <button
            onClick={handleOpenNewEditor}
            className="px-4 py-2 rounded-xl bg-violet-600/10 border border-violet-600/20 text-violet-400 text-sm font-medium hover:bg-violet-600/20 transition-all"
          >
            Add your first note
          </button>
        </div>
      ) : filteredNotes.length === 0 && searchQuery ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          No notes match &ldquo;{searchQuery}&rdquo;
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTeachMe={handleTeachMe}
              onTeachLineByLine={handleTeachLineByLine}
              onReadAloud={handleReadAloud}
              isReading={readingNoteId === note.id}
            />
          ))}
        </div>
      )}

      {/* Stats footer */}
      {notes.length > 0 && (
        <div className="mt-8 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-600">
          <span>
            {notes.length} note{notes.length !== 1 ? 's' : ''} total
            {searchQuery && filteredNotes.length !== notes.length && (
              <> · {filteredNotes.length} shown</>
            )}
          </span>
          <span>
            {notes.reduce((acc, n) => acc + n.content.split(/\s+/).filter(Boolean).length, 0).toLocaleString()} words
          </span>
        </div>
      )}
    </div>
  );
}
