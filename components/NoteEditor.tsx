'use client';

import { useEffect, useState } from 'react';
import { Note } from '@/types';

interface NoteEditorProps {
  note?: Note | null; // If provided, we are editing; otherwise creating
  onSave: (data: { title: string; content: string }) => void;
  onCancel: () => void;
}

export default function NoteEditor({ note, onSave, onCancel }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});

  // Pre-populate fields when editing an existing note
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    } else {
      setTitle('');
      setContent('');
    }
    setErrors({});
  }, [note]);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!title.trim()) newErrors.title = 'Title is required.';
    if (!content.trim()) newErrors.content = 'Content is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ title: title.trim(), content: content.trim() });
  };

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">
          {note ? 'Edit Note' : 'New Note'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          aria-label="Cancel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Title field */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5" htmlFor="note-title">
          Title
        </label>
        <input
          id="note-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Python Async/Await, React Hooks, SQL Joins..."
          className={`w-full bg-gray-900/80 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition-all ${
            errors.title
              ? 'border-red-500/60 focus:ring-red-500/40'
              : 'border-gray-700 focus:border-violet-500/60 focus:ring-violet-500/30'
          }`}
        />
        {errors.title && (
          <p className="text-xs text-red-400 mt-1">{errors.title}</p>
        )}
      </div>

      {/* Content field */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5" htmlFor="note-content">
          Content
          <span className="ml-2 text-gray-600 font-normal">
            (paste code, notes, or any text you want to be taught)
          </span>
        </label>
        <textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your notes, code snippets, or any content here..."
          rows={12}
          className={`w-full bg-gray-900/80 border rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 font-mono leading-relaxed focus:outline-none focus:ring-1 resize-y transition-all ${
            errors.content
              ? 'border-red-500/60 focus:ring-red-500/40'
              : 'border-gray-700 focus:border-violet-500/60 focus:ring-violet-500/30'
          }`}
        />
        {errors.content ? (
          <p className="text-xs text-red-400 mt-1">{errors.content}</p>
        ) : (
          <p className="text-xs text-gray-600 mt-1">
            {wordCount} words · {charCount.toLocaleString()} characters
          </p>
        )}
      </div>

      {/* Quick paste tip */}
      <div className="bg-violet-500/5 border border-violet-500/10 rounded-lg p-3 text-xs text-gray-500">
        <strong className="text-gray-400">Tip:</strong> You can paste code directly — the AI teacher will detect
        the language and teach it line by line. Works great with documentation, tutorials, or your own notes.
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700/60 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 active:scale-95 transition-all shadow-lg shadow-violet-600/20"
        >
          {note ? 'Save Changes' : 'Add Note'}
        </button>
      </div>
    </form>
  );
}
