'use client';

import { LineByLineSession } from '@/types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface LineByLineTeacherProps {
  session: LineByLineSession;
  onMarkLearned: () => void;
  onSkip: () => void;
  onEnd: () => void;
  onReplayLine: () => void;
}

export default function LineByLineTeacher({
  session,
  onMarkLearned,
  onSkip,
  onEnd,
  onReplayLine,
}: LineByLineTeacherProps) {
  const learnedCount = session.lines.filter((l) => l.status === 'learned').length;
  const totalLines = session.lines.length;
  const progress = totalLines > 0 ? (learnedCount / totalLines) * 100 : 0;
  const isComplete = session.completedAt != null || session.currentLineIndex >= totalLines;
  const currentLine = session.lines[session.currentLineIndex];

  return (
    <div className="bg-gray-900 border border-gray-700/60 rounded-2xl overflow-hidden mx-auto max-w-4xl w-full">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800/80 border-b border-gray-700/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{session.title}</h3>
            <p className="text-xs text-gray-400">
              Line {Math.min(session.currentLineIndex + 1, totalLines)} of {totalLines} · {learnedCount} learned
            </p>
          </div>
        </div>
        <button
          onClick={onEnd}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-700/50"
        >
          End session
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-800 relative">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Code view with line status indicators */}
      <div className="p-4 overflow-x-auto">
        <div className="font-mono text-sm space-y-0">
          {session.lines.map((line, idx) => {
            const isCurrent = idx === session.currentLineIndex;
            const isLearned = line.status === 'learned';
            const isPending = line.status === 'pending' && idx !== session.currentLineIndex;

            return (
              <div
                key={idx}
                className={`flex items-start gap-3 px-3 py-1 rounded-lg transition-all duration-300 ${
                  isCurrent
                    ? 'bg-violet-500/15 border border-violet-500/30'
                    : isLearned
                    ? 'bg-emerald-500/5'
                    : 'opacity-50'
                }`}
              >
                {/* Status indicator */}
                <div className="flex-shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center">
                  {isLearned ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  ) : isCurrent ? (
                    <div className="w-5 h-5 rounded-full bg-violet-500 animate-pulse flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                  )}
                </div>

                {/* Line number */}
                <span className="flex-shrink-0 w-6 text-right text-xs text-gray-600 mt-0.5">
                  {line.lineNumber}
                </span>

                {/* Code content */}
                <div className="flex-1 min-w-0 overflow-x-auto">
                  <SyntaxHighlighter
                    language={session.language}
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: 0,
                      background: 'transparent',
                      fontSize: '0.8125rem',
                      lineHeight: '1.5',
                      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                    }}
                    wrapLongLines
                  >
                    {line.content}
                  </SyntaxHighlighter>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current line — read & confirm */}
      {!isComplete && currentLine && (
        <div className="px-4 pb-4">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">Reading line {currentLine.lineNumber}:</p>
            <div className="bg-gray-950 rounded-lg p-3 mb-4">
              <SyntaxHighlighter
                language={session.language}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: 'transparent',
                  fontSize: '0.875rem',
                  lineHeight: '1.6',
                  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                }}
              >
                {currentLine.content}
              </SyntaxHighlighter>
            </div>
            <p className="text-sm text-gray-300 mb-4 text-center">Did you learn this line?</p>
            <div className="flex gap-2">
              <button
                onClick={onReplayLine}
                className="px-4 py-2.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                title="Read again"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Replay
              </button>
              <button
                onClick={onMarkLearned}
                className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Yes, learned it
              </button>
              <button
                onClick={onSkip}
                className="px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-all active:scale-[0.98]"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion state */}
      {isComplete && (
        <div className="px-4 pb-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-white mb-1">Session Complete!</h4>
            <p className="text-sm text-gray-400 mb-4">
              You learned {learnedCount} out of {totalLines} lines.
              {learnedCount < totalLines && ` ${totalLines - learnedCount} lines were skipped.`}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={onEnd}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
