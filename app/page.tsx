'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import ChatMessage from '@/components/ChatMessage';
import MicButton from '@/components/MicButton';
import VoiceToggle from '@/components/VoiceToggle';
import AudioVisualizer, { ThinkingIndicator } from '@/components/AudioVisualizer';
import LineByLineTeacher from '@/components/LineByLineTeacher';
import { AudioRecorder, playAudioBlob } from '@/lib/audioRecorder';
import { isValidApiKeyFormat } from '@/lib/openai';
import { ChatMessage as ChatMessageType } from '@/types';
import Link from 'next/link';

// Detect voice commands in line-by-line mode
const AFFIRMATIVE_PATTERNS = /^(yes|yeah|yep|yup|got it|understood|learned|learned it|next|sure|ok|okay|i got it|i understand|move on|next line|correct|right)\b/i;
const SKIP_PATTERNS = /^(skip|skip it|skip this|pass|next one|skip line)\b/i;
const REPLAY_PATTERNS = /^(replay|repeat|again|read again|say again|one more time|read it again|play again)\b/i;
const STOP_PATTERNS = /^(stop|end|quit|exit|done|finish|end session|stop session)\b/i;

// ─── Helper: call the API routes ─────────────────────────────────────────────

async function transcribeAudio(audioBlob: Blob, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'x-openai-api-key': apiKey },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Transcription failed.');
  }
  return data.text as string;
}

async function sendChatMessage(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  noteContext: string | null,
  settings: { teachingStyle: string; teachingApproach: string },
  apiKey: string,
  lineByLine?: {
    currentLine: string;
    lineNumber: number;
    totalLines: number;
    language: string;
    fullCode: string;
    learnedLines: string[];
  }
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-openai-api-key': apiKey,
    },
    body: JSON.stringify({ message, history, noteContext, settings, lineByLine }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Chat request failed.');
  }
  return data.content as string;
}

async function fetchTTS(
  text: string,
  voice: string,
  speed: number,
  apiKey: string
): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-openai-api-key': apiKey,
    },
    body: JSON.stringify({ text, voice, speed }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'TTS request failed.');
  }

  return res.blob();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const {
    messages,
    addMessage,
    updateMessage,
    clearMessages,
    settings,
    updateSettings,
    activeNoteContext,
    setActiveNoteContext,
    lineByLineSession,
    markCurrentLineLearned,
    skipCurrentLine,
    endLineByLineSession,
    isSpeaking,
    setIsSpeaking,
    isProcessing,
    setIsProcessing,
  } = useApp();

  const [isRecording, setIsRecording] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const continuousModeRef = useRef(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserCleanupRef = useRef<(() => void) | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentSpeakingIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const startRecordingRef = useRef<() => Promise<void>>(undefined);

  const apiKeyValid = isValidApiKeyFormat(settings.openaiApiKey);

  // ── Auto-scroll to bottom when new messages arrive ─────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      recorderRef.current?.destroy();
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
      analyserCleanupRef.current?.();
      currentAudioRef.current?.pause();
    };
  }, []);

  // ── Speak AI response via TTS ──────────────────────────────────────────────
  const speakText = useCallback(
    async (text: string, messageId: string) => {
      if (!settings.voiceOutputEnabled || !apiKeyValid) return;

      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      setIsSpeaking(true);
      currentSpeakingIdRef.current = messageId;
      updateMessage(messageId, { isSpeaking: true });

      try {
        const audioBlob = await fetchTTS(
          text,
          settings.ttsVoice,
          settings.speechRate,
          settings.openaiApiKey
        );
        const audio = playAudioBlob(audioBlob);
        currentAudioRef.current = audio;

        audio.addEventListener('ended', () => {
          setIsSpeaking(false);
          updateMessage(messageId, { isSpeaking: false });
          currentSpeakingIdRef.current = null;
        });

        audio.addEventListener('error', () => {
          setIsSpeaking(false);
          updateMessage(messageId, { isSpeaking: false });
          currentSpeakingIdRef.current = null;
        });
      } catch (err) {
        console.error('TTS error:', err);
        setIsSpeaking(false);
        updateMessage(messageId, { isSpeaking: false });
      }
    },
    [settings, apiKeyValid, setIsSpeaking, updateMessage]
  );

  // ── Replay current line in line-by-line mode ───────────────────────────
  const handleReplayLine = useCallback(async () => {
    if (!lineByLineSession || !apiKeyValid) return;
    if (lineByLineSession.currentLineIndex >= lineByLineSession.lines.length) return;

    const currentLine = lineByLineSession.lines[lineByLineSession.currentLineIndex];
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      const audioBlob = await fetchTTS(
        `Line ${currentLine.lineNumber}: ${currentLine.content}`,
        settings.ttsVoice,
        settings.speechRate,
        settings.openaiApiKey
      );
      const audio = playAudioBlob(audioBlob);
      currentAudioRef.current = audio;
      setIsSpeaking(true);
      audio.addEventListener('ended', () => {
        setIsSpeaking(false);
        currentAudioRef.current = null;
      });
      audio.addEventListener('error', () => {
        setIsSpeaking(false);
        currentAudioRef.current = null;
      });
    } catch {
      setError('Failed to replay line.');
    }
  }, [lineByLineSession, apiKeyValid, settings, setIsSpeaking]);

  // ── Handle full AI response pipeline ──────────────────────────────────────
  const handleSendMessage = useCallback(
    async (userText: string, isVoice = false) => {
      if (!userText.trim() || isProcessing) return;
      setError(null);

      if (!apiKeyValid) {
        setError('Please add your OpenAI API key in Settings before chatting.');
        return;
      }

      // In line-by-line mode, detect voice commands
      if (lineByLineSession && lineByLineSession.currentLineIndex < lineByLineSession.lines.length) {
        const trimmed = userText.trim();

        if (AFFIRMATIVE_PATTERNS.test(trimmed)) {
          addMessage({ role: 'user', content: userText, isVoice });
          markCurrentLineLearned();
          addMessage({ role: 'assistant', content: 'Learned! Moving to the next line.' });
          return;
        }

        if (SKIP_PATTERNS.test(trimmed)) {
          addMessage({ role: 'user', content: userText, isVoice });
          skipCurrentLine();
          addMessage({ role: 'assistant', content: 'Skipped. Moving to the next line.' });
          return;
        }

        if (REPLAY_PATTERNS.test(trimmed)) {
          addMessage({ role: 'user', content: userText, isVoice });
          addMessage({ role: 'assistant', content: 'Replaying this line...' });
          await handleReplayLine();
          return;
        }

        if (STOP_PATTERNS.test(trimmed)) {
          addMessage({ role: 'user', content: userText, isVoice });
          addMessage({ role: 'assistant', content: 'Session ended.' });
          endLineByLineSession();
          return;
        }
      }

      // Add user message to history
      addMessage({ role: 'user', content: userText, isVoice });

      setIsProcessing(true);

      try {
        // Build conversation history for the API
        const history = messages
          .filter((m): m is ChatMessageType => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        // Build line-by-line context if in that mode
        let lineByLineContext: Parameters<typeof sendChatMessage>[5];
        if (lineByLineSession && lineByLineSession.currentLineIndex < lineByLineSession.lines.length) {
          const currentLine = lineByLineSession.lines[lineByLineSession.currentLineIndex];
          lineByLineContext = {
            currentLine: currentLine.content,
            lineNumber: currentLine.lineNumber,
            totalLines: lineByLineSession.lines.length,
            language: lineByLineSession.language,
            fullCode: lineByLineSession.lines.map((l) => l.content).join('\n'),
            learnedLines: lineByLineSession.lines
              .filter((l) => l.status === 'learned')
              .map((l) => `Line ${l.lineNumber}`),
          };
        }

        const aiContent = await sendChatMessage(
          userText,
          history,
          activeNoteContext,
          {
            teachingStyle: settings.teachingStyle,
            teachingApproach: settings.teachingApproach,
          },
          settings.openaiApiKey,
          lineByLineContext
        );

        const aiMessage = addMessage({ role: 'assistant', content: aiContent });
        setIsProcessing(false);

        // Speak the response if voice output is enabled
        if (settings.voiceOutputEnabled) {
          await speakText(aiContent, aiMessage.id);
        }
      } catch (err) {
        setIsProcessing(false);
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        setError(msg);
        console.error('Chat error:', err);
      }
    },
    [
      isProcessing,
      apiKeyValid,
      messages,
      activeNoteContext,
      lineByLineSession,
      settings,
      addMessage,
      markCurrentLineLearned,
      skipCurrentLine,
      endLineByLineSession,
      handleReplayLine,
      setIsProcessing,
      speakText,
    ]
  );

  // ── Auto-read current line aloud when line-by-line session advances ────
  const lastReadLineRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lineByLineSession || !apiKeyValid) return;
    if (lineByLineSession.currentLineIndex >= lineByLineSession.lines.length) return;

    const currentLine = lineByLineSession.lines[lineByLineSession.currentLineIndex];
    const lineKey = `${lineByLineSession.id}-${currentLine.lineNumber}`;

    if (lastReadLineRef.current === lineKey) return;
    lastReadLineRef.current = lineKey;

    // Read the current line aloud via TTS
    (async () => {
      try {
        const audioBlob = await fetchTTS(
          `Line ${currentLine.lineNumber}: ${currentLine.content}`,
          settings.ttsVoice,
          settings.speechRate,
          settings.openaiApiKey
        );
        // Stop any currently playing audio
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        const audio = playAudioBlob(audioBlob);
        currentAudioRef.current = audio;
        setIsSpeaking(true);

        audio.addEventListener('ended', () => {
          setIsSpeaking(false);
          currentAudioRef.current = null;
        });
        audio.addEventListener('error', () => {
          setIsSpeaking(false);
          currentAudioRef.current = null;
        });
      } catch {
        // TTS failed silently — user can still read the line visually
      }
    })();
  }, [lineByLineSession, apiKeyValid, settings.ttsVoice, settings.speechRate, settings.openaiApiKey, setIsSpeaking]);

  // ── Voice recording flow ───────────────────────────────────────────────────

  // ── Core recording helpers ─────────────────────────────────────────────

  const cleanupRecording = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    analyserCleanupRef.current?.();
    analyserCleanupRef.current = null;
    setAudioLevel(0);
  }, []);

  // Process a recorded audio blob: transcribe → send message → (if continuous) re-listen
  const processRecording = useCallback(async (blob: Blob) => {
    setIsProcessing(true);
    setIsRecording(false);
    cleanupRecording();

    let shouldRestart = false;

    try {
      const text = await transcribeAudio(blob, settings.openaiApiKey);
      if (text) {
        await handleSendMessage(text, true);
      } else {
        if (!continuousModeRef.current) {
          setError('No speech detected. Please try again.');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed.';
      setError(msg);
    }

    setIsProcessing(false);

    // Check if we should restart for continuous mode
    if (continuousModeRef.current) {
      // Wait for any TTS to finish playing
      if (currentAudioRef.current && !currentAudioRef.current.paused && !currentAudioRef.current.ended) {
        await new Promise<void>((resolve) => {
          const audio = currentAudioRef.current;
          if (!audio) { resolve(); return; }
          const onDone = () => {
            audio.removeEventListener('ended', onDone);
            audio.removeEventListener('error', onDone);
            resolve();
          };
          audio.addEventListener('ended', onDone);
          audio.addEventListener('error', onDone);
        });
      }
      shouldRestart = continuousModeRef.current;
    }

    // Restart recording if still in continuous mode (done outside try/catch)
    if (shouldRestart && startRecordingRef.current) {
      // Small delay to avoid overlapping audio contexts
      await new Promise((r) => setTimeout(r, 300));
      if (continuousModeRef.current) {
        startRecordingRef.current();
      }
    }
  }, [settings.openaiApiKey, handleSendMessage, cleanupRecording, setIsProcessing]);

  // Start a recording session (creates fresh recorder + stream each time)
  const startRecording = useCallback(async () => {
    if (recorderRef.current) {
      recorderRef.current.destroy();
      recorderRef.current = null;
    }
    cleanupRecording();
    setError(null);

    const isContinuous = continuousModeRef.current;

    const recorder = new AudioRecorder({
      silenceDetection: isContinuous,
      silenceThreshold: 0.015,
      silenceTimeout: 1500,
      onStop: (blob) => {
        processRecording(blob);
      },
      onError: (err) => {
        setError(err.message);
        setIsRecording(false);
        setIsProcessing(false);
        cleanupRecording();
        continuousModeRef.current = false;
        setContinuousMode(false);
      },
    });

    try {
      await recorder.initialize();
      recorderRef.current = recorder;

      if (recorder.stream) {
        const { createAudioAnalyser } = await import('@/lib/audioRecorder');
        const { getLevel, cleanup } = createAudioAnalyser(recorder.stream);
        analyserCleanupRef.current = cleanup;
        audioLevelIntervalRef.current = setInterval(() => {
          setAudioLevel(getLevel());
        }, 150);
      }

      await recorder.start();
      setIsRecording(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start recording.';
      setError(msg);
      continuousModeRef.current = false;
      setContinuousMode(false);
    }
  }, [processRecording, cleanupRecording, setIsProcessing]);

  // Keep ref in sync for recursive calls
  startRecordingRef.current = startRecording;

  // Stop recording and cleanup
  const stopRecording = useCallback(() => {
    recorderRef.current?.destroy();
    recorderRef.current = null;
    setIsRecording(false);
    cleanupRecording();
  }, [cleanupRecording]);

  // Single tap mic: start/stop one recording
  const handleMicClick = useCallback(async () => {
    if (isProcessing) return;

    if (continuousMode) {
      continuousModeRef.current = false;
      setContinuousMode(false);
      stopRecording();
      return;
    }

    if (isRecording) {
      // Manual stop — triggers onStop → processRecording
      recorderRef.current?.stop();
      return;
    }

    await startRecording();
  }, [isRecording, isProcessing, continuousMode, startRecording, stopRecording]);

  // Toggle continuous voice chat
  const toggleContinuousMode = useCallback(async () => {
    if (continuousMode) {
      continuousModeRef.current = false;
      setContinuousMode(false);
      stopRecording();
    } else {
      if (!apiKeyValid) {
        setError('Please add your OpenAI API key in Settings first.');
        return;
      }
      continuousModeRef.current = true;
      setContinuousMode(true);
      await startRecording();
    }
  }, [continuousMode, apiKeyValid, startRecording, stopRecording]);

  // ── Text input ─────────────────────────────────────────────────────────────
  const handleTextSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (textInput.trim()) {
        handleSendMessage(textInput.trim(), false);
        setTextInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    },
    [textInput, handleSendMessage]
  );

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit(e);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  // ── Read text aloud directly (no AI, just TTS) ─────────────────────────
  const handleReadAloud = useCallback(async () => {
    if (!textInput.trim() || !apiKeyValid) return;
    const textToRead = textInput.trim();
    setTextInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    addMessage({ role: 'user', content: `[Read aloud] ${textToRead}` });

    try {
      const audioBlob = await fetchTTS(
        textToRead,
        settings.ttsVoice,
        settings.speechRate,
        settings.openaiApiKey
      );
      const aiMsg = addMessage({ role: 'assistant', content: `Reading: "${textToRead.slice(0, 100)}${textToRead.length > 100 ? '...' : ''}"` });
      const audio = playAudioBlob(audioBlob);
      currentAudioRef.current = audio;
      setIsSpeaking(true);
      updateMessage(aiMsg.id, { isSpeaking: true });

      audio.addEventListener('ended', () => {
        setIsSpeaking(false);
        updateMessage(aiMsg.id, { isSpeaking: false });
      });
      audio.addEventListener('error', () => {
        setIsSpeaking(false);
        updateMessage(aiMsg.id, { isSpeaking: false });
      });
    } catch {
      setError('Failed to read aloud.');
    }
  }, [textInput, apiKeyValid, settings, addMessage, updateMessage, setIsSpeaking]);

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (currentSpeakingIdRef.current) {
      updateMessage(currentSpeakingIdRef.current, { isSpeaking: false });
    }
    setIsSpeaking(false);
    currentSpeakingIdRef.current = null;
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* ── API key warning banner ── */}
      {!apiKeyValid && (
        <div className="flex-shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-400 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            OpenAI API key not configured.
          </p>
          <Link
            href="/settings"
            className="text-xs font-medium text-amber-400 underline hover:text-amber-300 flex-shrink-0"
          >
            Add API key in Settings
          </Link>
        </div>
      )}

      {/* ── Active note context banner ── */}
      {activeNoteContext && (
        <div className="flex-shrink-0 bg-violet-500/10 border-b border-violet-500/20 px-4 py-2 flex items-center justify-between gap-4">
          <p className="text-xs text-violet-300 flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Teaching from notes context
          </p>
          <button
            onClick={() => setActiveNoteContext(null)}
            className="text-xs text-violet-400 hover:text-violet-200 underline flex-shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 chat-scroll">
        {/* Line-by-line teaching panel */}
        {lineByLineSession && (
          <div className="mb-4">
            <LineByLineTeacher
              session={lineByLineSession}
              onMarkLearned={markCurrentLineLearned}
              onSkip={skipCurrentLine}
              onEnd={endLineByLineSession}
              onReplayLine={handleReplayLine}
            />
          </div>
        )}

        {messages.length === 0 && !lineByLineSession && (
          <div className="flex flex-col items-center justify-center h-full min-h-64 text-center px-4 gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-semibold text-xl mb-2">
                Your AI Teacher is ready
              </h2>
              <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
                Tap the microphone to speak, or type below.{' '}
                <Link href="/notes" className="text-violet-400 hover:underline">
                  Upload notes
                </Link>{' '}
                to get personalized teaching on your material.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                'Explain React hooks to me',
                'Teach me async/await in Python',
                'What is a REST API?',
                'How does recursion work?',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={!apiKeyValid}
                  className="px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-400 hover:border-violet-500/40 hover:text-violet-300 hover:bg-gray-800/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="message-enter max-w-4xl mx-auto w-full">
            <ChatMessage message={message} />
          </div>
        ))}

        {/* Thinking indicator */}
        {isProcessing && (
          <div className="message-enter max-w-4xl mx-auto w-full flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <div className="bg-gray-800/80 border border-gray-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
              <ThinkingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Error display ── */}
      {error && (
        <div className="flex-shrink-0 mx-4 mb-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Bottom input area ── */}
      <div className="flex-shrink-0 border-t border-gray-800/80 bg-gray-950/95 backdrop-blur-sm px-4 pb-4 pt-3">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Audio visualizer + speaking indicator */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <AudioVisualizer
                isActive={isRecording}
                mode="recording"
                audioLevel={audioLevel}
                barCount={20}
              />
            </div>
            {isSpeaking && (
              <div className="flex items-center gap-2">
                <AudioVisualizer isActive={true} mode="speaking" barCount={8} />
                <button
                  onClick={stopSpeaking}
                  className="text-xs text-green-400 hover:text-green-200 flex items-center gap-1 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  Stop
                </button>
              </div>
            )}
          </div>

          {/* Continuous mode banner */}
          {continuousMode && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">
                  Continuous voice chat is ON — just keep talking
                </span>
              </div>
              <button
                onClick={toggleContinuousMode}
                className="text-xs text-green-400 hover:text-green-200 px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
              >
                Stop
              </button>
            </div>
          )}

          {/* Mic button + text input */}
          <div className="flex items-end gap-3">
            <div className="flex-shrink-0 pb-1 flex flex-col items-center gap-1">
              <MicButton
                isRecording={isRecording}
                isProcessing={isProcessing}
                isDisabled={!apiKeyValid}
                onClick={handleMicClick}
                audioLevel={audioLevel}
              />
              {/* Continuous mode toggle */}
              <button
                onClick={toggleContinuousMode}
                disabled={!apiKeyValid}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-all ${
                  continuousMode
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title={continuousMode ? 'Stop continuous voice chat' : 'Start continuous voice chat'}
              >
                {continuousMode ? 'LIVE' : 'Continuous'}
              </button>
            </div>

            <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={textInput}
                onChange={handleTextareaInput}
                onKeyDown={handleTextareaKeyDown}
                placeholder={
                  apiKeyValid
                    ? 'Type a message... (Enter to send, Shift+Enter for new line)'
                    : 'Add your OpenAI API key in Settings to start...'
                }
                disabled={!apiKeyValid || isProcessing}
                rows={1}
                className="flex-1 bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 resize-none overflow-hidden transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: '46px', maxHeight: '160px' }}
              />
              {/* Read aloud button */}
              <button
                type="button"
                onClick={handleReadAloud}
                disabled={!textInput.trim() || !apiKeyValid || isProcessing}
                className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                aria-label="Read aloud"
                title="Read this text aloud"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </button>
              {/* Send to AI button */}
              <button
                type="submit"
                disabled={!textInput.trim() || !apiKeyValid || isProcessing}
                className="flex-shrink-0 w-11 h-11 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-violet-600/20"
                aria-label="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <VoiceToggle
              enabled={settings.voiceOutputEnabled}
              onChange={(val) => updateSettings({ voiceOutputEnabled: val })}
            />
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  onClick={clearMessages}
                  className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1.5 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  Clear chat
                </button>
              )}
              <span className="text-xs text-gray-700 capitalize">
                {settings.teachingStyle} · {settings.teachingApproach}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
