'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export default function CodeBlock({
  code,
  language = 'text',
  showLineNumbers = true,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be blocked in some contexts
      console.warn('Clipboard copy failed');
    }
  };

  // Normalize common language aliases
  const normalizedLang = normalizeLanguage(language);

  return (
    <div className="relative group rounded-xl overflow-hidden border border-gray-700/60 bg-gray-950 my-3">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/80 border-b border-gray-700/60">
        <div className="flex items-center gap-2">
          {/* macOS-style dots */}
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <span className="ml-2 text-xs text-gray-400 font-mono">
            {normalizedLang}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Syntax highlighted code */}
      <SyntaxHighlighter
        language={normalizedLang}
        style={vscDarkPlus}
        showLineNumbers={showLineNumbers && code.split('\n').length > 2}
        wrapLines
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: '1rem 1.25rem',
          background: 'transparent',
          fontSize: '0.8125rem',
          lineHeight: '1.6',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
        }}
        lineNumberStyle={{
          color: '#4a5568',
          fontSize: '0.75rem',
          userSelect: 'none',
          paddingRight: '1.5rem',
          minWidth: '2.5rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

/**
 * Normalizes common language aliases to the names react-syntax-highlighter recognizes.
 */
function normalizeLanguage(lang: string): string {
  const map: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    rb: 'ruby',
    sh: 'bash',
    zsh: 'bash',
    shell: 'bash',
    yml: 'yaml',
    md: 'markdown',
    jsx: 'jsx',
    tsx: 'tsx',
    rs: 'rust',
    go: 'go',
    cs: 'csharp',
    cpp: 'cpp',
    'c++': 'cpp',
    kt: 'kotlin',
    swift: 'swift',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    xml: 'xml',
    dockerfile: 'docker',
  };

  return map[lang.toLowerCase()] ?? lang.toLowerCase();
}
