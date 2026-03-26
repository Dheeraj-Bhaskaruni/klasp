'use client';

import { memo, useEffect, useRef } from 'react';

interface MicButtonProps {
  isRecording: boolean;
  isDisabled?: boolean;
  isProcessing?: boolean;
  onClick: () => void;
  audioLevel?: number;
}

const MicButton = memo(function MicButton({
  isRecording,
  isDisabled = false,
  isProcessing = false,
  onClick,
  audioLevel = 0,
}: MicButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Update glow + scale via DOM refs (no re-render)
  useEffect(() => {
    if (!isRecording) return;
    const scale = 1 + audioLevel * 0.15;
    const opacity = 0.3 + audioLevel * 0.5;

    if (buttonRef.current) {
      buttonRef.current.style.transform = `scale(${scale})`;
    }
    if (glowRef.current) {
      glowRef.current.style.opacity = `${opacity}`;
      glowRef.current.style.transform = `scale(${scale})`;
    }
  }, [audioLevel, isRecording]);

  return (
    <div className="relative flex items-center justify-center">
      {isRecording && (
        <>
          <div
            className="absolute rounded-full border-2 border-red-500/20 animate-ping"
            style={{ width: 108, height: 108 }}
          />
          <div
            className="absolute rounded-full border border-red-500/10 animate-ping"
            style={{ width: 132, height: 132, animationDelay: '0.3s' }}
          />
        </>
      )}

      <div
        ref={glowRef}
        className={`absolute rounded-full transition-none ${
          isRecording ? 'bg-red-500' : 'bg-violet-600'
        }`}
        style={{
          width: 76,
          height: 76,
          filter: 'blur(20px)',
          opacity: 0,
        }}
      />

      <button
        ref={buttonRef}
        onClick={onClick}
        disabled={isDisabled || isProcessing}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        aria-pressed={isRecording}
        className={`
          relative z-10 w-16 h-16 rounded-full flex items-center justify-center
          transition-colors duration-150 active:scale-95 focus:outline-none
          focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
          ${isProcessing
            ? 'cursor-not-allowed bg-gray-700 opacity-60 focus:ring-gray-600'
            : isRecording
            ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 shadow-lg shadow-red-500/40 focus:ring-red-500 cursor-pointer'
            : 'bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 shadow-lg shadow-violet-500/40 focus:ring-violet-500 cursor-pointer'
          }
        `}
      >
        {isProcessing ? (
          <svg
            className="animate-spin text-white"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
          </svg>
        ) : isRecording ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="white" fillOpacity="0.9" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span
          className={`text-xs font-medium ${
            isProcessing
              ? 'text-gray-500'
              : isRecording
              ? 'text-red-400 animate-pulse'
              : 'text-gray-500'
          }`}
        >
          {isProcessing
            ? 'Processing...'
            : isRecording
            ? 'Recording — tap to stop'
            : 'Tap to speak'}
        </span>
      </div>
    </div>
  );
});

export default MicButton;
