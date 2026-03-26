'use client';

import { memo, useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  mode: 'recording' | 'speaking';
  barCount?: number;
  audioLevel?: number;
  className?: string;
}

/**
 * Animated bar visualizer. Uses refs to update bar heights directly
 * instead of triggering React re-renders on every audio level change.
 */
const AudioVisualizer = memo(function AudioVisualizer({
  isActive,
  mode,
  barCount = 12,
  audioLevel,
  className = '',
}: AudioVisualizerProps) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  // Pre-compute stable random offsets per bar (avoids jitter from Math.random on each frame)
  const offsetsRef = useRef<number[]>([]);
  if (offsetsRef.current.length !== barCount) {
    offsetsRef.current = Array.from({ length: barCount }, () => 0.4 + Math.random() * 0.6);
  }

  const colorClass =
    mode === 'recording'
      ? 'bg-gradient-to-t from-red-500 to-pink-400'
      : 'bg-gradient-to-t from-green-500 to-emerald-400';

  // Drive bar heights via direct DOM manipulation (no re-render)
  useEffect(() => {
    if (audioLevel === undefined || !isActive) return;

    const offsets = offsetsRef.current;
    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      const position = i / barCount;
      const center = 0.5;
      const spread = 0.4;
      const envelope = Math.exp(-((position - center) ** 2) / (2 * spread ** 2));
      const height = Math.max(8, audioLevel * envelope * offsets[i] * 100);
      bar.style.height = `${height}%`;
    });
  }, [audioLevel, isActive, barCount]);

  if (!isActive) {
    return (
      <div className={`flex items-center justify-center gap-0.5 h-8 ${className}`}>
        {Array.from({ length: barCount }, (_, i) => (
          <div
            key={i}
            className="w-0.5 rounded-full bg-gray-700"
            style={{ height: '6px' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center gap-0.5 h-8 ${className}`}>
      {Array.from({ length: barCount }, (_, i) => {
        const delay = (i / barCount) * 0.8;
        const duration = 0.6 + (i % 3) * 0.15;

        return (
          <div
            key={i}
            ref={(el) => { barsRef.current[i] = el; }}
            className={`w-0.5 rounded-full ${colorClass}`}
            style={
              audioLevel !== undefined
                ? { height: '8%', transition: 'height 0.15s ease-out' }
                : {
                    height: '20%',
                    animation: `audioBar ${duration}s ease-in-out infinite alternate`,
                    animationDelay: `${delay}s`,
                  }
            }
          />
        );
      })}

      <style jsx>{`
        @keyframes audioBar {
          from { height: 15%; opacity: 0.6; }
          to { height: 85%; opacity: 1; }
        }
      `}</style>
    </div>
  );
});

export default AudioVisualizer;

/**
 * Simple pulsing dot indicator for "thinking" state.
 */
export function ThinkingIndicator({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-violet-400"
            style={{
              animation: 'dotPulse 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <span className="text-sm text-gray-400 italic">Teacher is thinking...</span>

      <style jsx>{`
        @keyframes dotPulse {
          0%, 60%, 100% { opacity: 0.2; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
