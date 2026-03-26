'use client';

interface VoiceToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
}

export default function VoiceToggle({ enabled, onChange, className = '' }: VoiceToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      title={enabled ? 'Voice output is ON — click to switch to text only' : 'Voice output is OFF — click to enable'}
      aria-pressed={enabled}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-150 text-sm font-medium ${
        enabled
          ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
          : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-700 hover:text-gray-300'
      } ${className}`}
    >
      {enabled ? (
        // Speaker with sound waves
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      ) : (
        // Speaker muted
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      )}
      <span>{enabled ? 'Voice on' : 'Voice off'}</span>
    </button>
  );
}
