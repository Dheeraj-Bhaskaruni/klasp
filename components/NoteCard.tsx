'use client';

import { useState } from 'react';
import { Note } from '@/types';

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onTeachMe: (note: Note) => void;
  onTeachLineByLine: (note: Note) => void;
  onReadAloud: (note: Note) => void;
  isReading?: boolean;
}

export default function NoteCard({ note, onEdit, onDelete, onTeachMe, onTeachLineByLine, onReadAloud, isReading }: NoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formattedDate = new Date(note.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const previewContent = note.content.slice(0, 200);
  const hasMore = note.content.length > 200;
  const lineCount = note.content.split('\n').length;
  const wordCount = note.content.split(/\s+/).filter(Boolean).length;

  return (
    <div className="group bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/70 transition-all duration-150 hover:bg-gray-800/80">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">{note.title}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500">{formattedDate}</span>
            <span className="text-xs text-gray-600">
              {wordCount} words · {lineCount} lines
            </span>
          </div>
        </div>

        {/* Action buttons — always visible on mobile, visible on hover for desktop */}
        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(note)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            title="Edit note"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>

          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(note.id)}
                className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 rounded text-xs font-medium text-gray-400 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete note"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content preview */}
      <div className="mb-3">
        <p className="text-xs text-gray-400 leading-relaxed font-mono whitespace-pre-wrap break-words">
          {isExpanded ? note.content : previewContent}
          {!isExpanded && hasMore && (
            <span className="text-gray-600">...</span>
          )}
        </p>
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-violet-400 hover:text-violet-300 mt-1.5 transition-colors"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Teaching buttons */}
      <div className="flex flex-col gap-2">
        {/* Read aloud - primary action */}
        <button
          onClick={() => onReadAloud(note)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
            isReading
              ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300 animate-pulse'
              : 'bg-blue-600/10 border border-blue-600/20 text-blue-400 hover:bg-blue-600/20 hover:border-blue-600/40 hover:text-blue-300'
          }`}
        >
          {isReading ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Reading... (tap to stop)
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              Read to me
            </>
          )}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onTeachMe(note)}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-violet-600/10 border border-violet-600/20 text-violet-400 text-sm font-medium hover:bg-violet-600/20 hover:border-violet-600/40 hover:text-violet-300 transition-all duration-150 active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            Teach me
          </button>
          <button
            onClick={() => onTeachLineByLine(note)}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-600/10 border border-emerald-600/20 text-emerald-400 text-sm font-medium hover:bg-emerald-600/20 hover:border-emerald-600/40 hover:text-emerald-300 transition-all duration-150 active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            Line by line
          </button>
        </div>
      </div>
    </div>
  );
}
