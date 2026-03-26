'use client';

import { ChatMessage as ChatMessageType } from '@/types';
import CodeBlock from './CodeBlock';

interface ChatMessageProps {
  message: ChatMessageType;
}

interface MessagePart {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

/**
 * Parses a markdown-ish message string into alternating text and code segments.
 * Handles fenced code blocks: ```lang\n...\n```
 */
function parseMessageContent(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  // Match fenced code blocks: ```optional-lang\ncode\n```
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add preceding text if any
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        parts.push({ type: 'text', content: text });
      }
    }

    parts.push({
      type: 'code',
      language: match[1] || 'text',
      content: match[2].trimEnd(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  const remaining = content.slice(lastIndex).trim();
  if (remaining) {
    parts.push({ type: 'text', content: remaining });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }];
}

/**
 * Renders inline markdown: bold (**text**), italic (*text*), inline code (`code`).
 * Returns an array of React nodes.
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Patterns handled in order: inline code, bold, italic
  const patterns = [
    { regex: /`([^`]+)`/g, render: (m: string, g1: string) => (
      <code key={m} className="px-1.5 py-0.5 rounded bg-gray-700/70 text-violet-300 font-mono text-xs">{g1}</code>
    )},
    { regex: /\*\*([^*]+)\*\*/g, render: (m: string, g1: string) => (
      <strong key={m} className="font-semibold text-white">{g1}</strong>
    )},
    { regex: /\*([^*]+)\*/g, render: (m: string, g1: string) => (
      <em key={m} className="italic text-gray-300">{g1}</em>
    )},
  ];

  // Simple approach: split and rejoin with React nodes
  const parts: React.ReactNode[] = [text];

  for (const { regex, render } of patterns) {
    const result: React.ReactNode[] = [];
    for (const part of parts) {
      if (typeof part !== 'string') {
        result.push(part);
        continue;
      }
      const segments = part.split(regex);
      let captureIndex = 0;
      for (let i = 0; i < segments.length; i++) {
        if (i % (regex.source.match(/\(/g)?.length ?? 1 + 1) === 0) {
          if (segments[i]) result.push(segments[i]);
        } else {
          result.push(render(`${i}`, segments[i]));
          captureIndex++;
        }
      }
    }
    // Only update if we found matches
    if (result.length !== parts.length || result.some((r) => typeof r !== 'string')) {
      // Rebuild from scratch for each pattern for simplicity and correctness
    }
  }

  return parts;
}

/**
 * Renders a block of text with basic markdown support:
 * - Headers (## Heading)
 * - Bullet lists (- item or * item)
 * - Numbered lists (1. item)
 * - Bold, italic, inline code
 * - Line breaks
 */
function RenderTextBlock({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines (used as spacing between blocks)
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      const classes = [
        'font-bold text-white',
        level === 1 ? 'text-xl mt-4 mb-2' :
        level === 2 ? 'text-lg mt-3 mb-1.5' :
        'text-base mt-2 mb-1',
      ].join(' ');
      elements.push(
        <p key={i} className={classes}>{headerText}</p>
      );
      i++;
      continue;
    }

    // Collect consecutive list items
    if (line.match(/^(\s*[-*•]|\s*\d+\.)\s/)) {
      const listItems: string[] = [];
      let isOrdered = false;
      while (i < lines.length && lines[i].match(/^(\s*[-*•]|\s*\d+\.)\s/)) {
        const itemMatch = lines[i].match(/^(\s*)([-*•]|\d+\.)\s+(.+)/);
        if (itemMatch) {
          if (itemMatch[2].match(/\d+\./)) isOrdered = true;
          listItems.push(itemMatch[3]);
        }
        i++;
      }
      const ListTag = isOrdered ? 'ol' : 'ul';
      elements.push(
        <ListTag
          key={`list-${i}`}
          className={`my-2 space-y-1 pl-5 ${isOrdered ? 'list-decimal' : 'list-disc'} text-gray-200`}
        >
          {listItems.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed">
              {renderInlineText(item)}
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-gray-200 my-1">
        {renderInlineText(line)}
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}

/**
 * Renders a single line with inline markdown (bold, italic, inline code).
 */
function renderInlineText(text: string): React.ReactNode {
  // Process inline code first, then bold, then italic
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Inline code `...`
  const inlineCodeRegex = /`([^`]+)`/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = inlineCodeRegex.exec(remaining)) !== null) {
    if (m.index > lastIdx) {
      parts.push(
        <span key={key++}>{processBoldItalic(remaining.slice(lastIdx, m.index))}</span>
      );
    }
    parts.push(
      <code key={key++} className="px-1.5 py-0.5 rounded bg-gray-700/70 text-violet-300 font-mono text-xs">
        {m[1]}
      </code>
    );
    lastIdx = m.index + m[0].length;
  }

  if (lastIdx < remaining.length) {
    parts.push(
      <span key={key++}>{processBoldItalic(remaining.slice(lastIdx))}</span>
    );
  }

  return parts.length > 0 ? <>{parts}</> : processBoldItalic(text);
}

function processBoldItalic(text: string): React.ReactNode {
  // **bold**
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = boldRegex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(<span key={key++}>{text.slice(lastIdx, m.index)}</span>);
    }
    parts.push(<strong key={key++} className="font-semibold text-white">{m[1]}</strong>);
    lastIdx = m.index + m[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIdx)}</span>);
  }

  return parts.length > 1 ? <>{parts}</> : text;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const parts = parseMessageContent(message.content);

  const timeLabel = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`flex gap-3 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mt-1 ${
          isUser
            ? 'bg-violet-600 text-white'
            : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
        }`}
      >
        {isUser ? (
          'You'
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Sender label + time */}
        <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs font-medium text-gray-400">
            {isUser ? 'You' : 'Teacher'}
          </span>
          {message.isVoice && (
            <span className="text-xs text-violet-400 flex items-center gap-0.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              </svg>
              voice
            </span>
          )}
          {message.isSpeaking && (
            <span className="text-xs text-green-400 flex items-center gap-0.5 animate-pulse">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              speaking
            </span>
          )}
          <span className="text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {timeLabel}
          </span>
        </div>

        {/* Message content */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-violet-600/80 text-white rounded-tr-sm'
              : 'bg-gray-800/80 text-gray-100 rounded-tl-sm border border-gray-700/50'
          }`}
        >
          {parts.map((part, idx) =>
            part.type === 'code' ? (
              <CodeBlock
                key={idx}
                code={part.content}
                language={part.language}
              />
            ) : (
              <RenderTextBlock key={idx} content={part.content} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
