'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { isValidApiKeyFormat } from '@/lib/openai';
import {
  TeachingApproach,
  TeachingStyle,
  TTSVoice,
} from '@/types';

// ─── Option definitions ────────────────────────────────────────────────────────

const TEACHING_STYLES: { value: TeachingStyle; label: string; description: string }[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'Simple language, lots of analogies, no jargon. Best for newcomers.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Assumes some experience. Focuses on building mental models.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Peer-level discussion. Covers edge cases, trade-offs, and performance.',
  },
];

const TEACHING_APPROACHES: { value: TeachingApproach; label: string; description: string }[] = [
  {
    value: 'step-by-step',
    label: 'Step-by-Step',
    description: 'Numbered sequential steps that build on each other.',
  },
  {
    value: 'explain-then-example',
    label: 'Explain then Example',
    description: 'Concept explanation followed by a concrete code or real-world example.',
  },
  {
    value: 'quiz-based',
    label: 'Quiz-Based (Socratic)',
    description: 'Teacher asks questions to check your understanding before proceeding.',
  },
  {
    value: 'line-by-line',
    label: 'Line-by-Line Code',
    description: 'Ideal for code. Walks through each line explaining what it does and why.',
  },
];

const TTS_VOICES: { value: TTSVoice; label: string; description: string }[] = [
  { value: 'nova', label: 'Nova', description: 'Warm and friendly — great for teaching' },
  { value: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
  { value: 'echo', label: 'Echo', description: 'Clear and articulate' },
  { value: 'fable', label: 'Fable', description: 'Expressive and engaging' },
  { value: 'onyx', label: 'Onyx', description: 'Deep and authoritative' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft and calm' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, updateSettings } = useApp();

  const [apiKeyInput, setApiKeyInput] = useState(settings.openaiApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const apiKeyValid = isValidApiKeyFormat(apiKeyInput);

  const showSaved = (msg = 'Settings saved') => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(null), 2500);
  };

  const handleApiKeySave = () => {
    updateSettings({ openaiApiKey: apiKeyInput.trim() });
    showSaved('API key saved');
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKeyInput(e.target.value);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your API key and teaching preferences.
        </p>
      </div>

      {/* Saved notification */}
      {savedMessage && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-sm text-green-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {savedMessage}
        </div>
      )}

      {/* ── Section: OpenAI API Key ── */}
      <section className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">OpenAI API Key</h2>
            <p className="text-xs text-gray-500">
              Required for Whisper, GPT-4, and TTS. Stored in your browser only.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={handleApiKeyChange}
              placeholder="sk-..."
              className={`w-full bg-gray-900/80 border rounded-xl px-4 py-3 pr-12 text-sm font-mono transition-all focus:outline-none focus:ring-1 ${
                apiKeyInput && !apiKeyValid
                  ? 'border-red-500/60 text-red-400 focus:ring-red-500/30'
                  : apiKeyValid
                  ? 'border-green-500/40 text-gray-200 focus:ring-green-500/20'
                  : 'border-gray-700 text-gray-200 focus:border-violet-500/60 focus:ring-violet-500/30'
              }`}
              onKeyDown={(e) => e.key === 'Enter' && apiKeyValid && handleApiKeySave()}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {apiKeyInput && !apiKeyValid && (
            <p className="text-xs text-red-400">API key must start with &ldquo;sk-&rdquo; and be at least 20 characters.</p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleApiKeySave}
              disabled={!apiKeyValid}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              Save API Key
            </button>
            {settings.openaiApiKey && (
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Key saved
              </div>
            )}
          </div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Security note:</strong> Your API key is stored only in
          your browser&rsquo;s localStorage and is never sent to any server other than OpenAI.
          Get your key at{' '}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:underline"
          >
            platform.openai.com/api-keys
          </a>
        </div>
      </section>

      {/* ── Section: Teaching Style ── */}
      <section className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-white font-semibold text-sm">Teaching Style</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            How the AI calibrates explanation complexity.
          </p>
        </div>
        <div className="space-y-2">
          {TEACHING_STYLES.map((style) => (
            <label
              key={style.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                settings.teachingStyle === style.value
                  ? 'border-violet-500/40 bg-violet-500/8'
                  : 'border-gray-700/60 hover:border-gray-600 hover:bg-gray-700/20'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    settings.teachingStyle === style.value
                      ? 'border-violet-500 bg-violet-500'
                      : 'border-gray-600'
                  }`}
                >
                  {settings.teachingStyle === style.value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <span className={`text-sm font-medium ${settings.teachingStyle === style.value ? 'text-white' : 'text-gray-300'}`}>
                  {style.label}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">{style.description}</p>
              </div>
              <input
                type="radio"
                name="teachingStyle"
                value={style.value}
                checked={settings.teachingStyle === style.value}
                onChange={() => {
                  updateSettings({ teachingStyle: style.value });
                  showSaved();
                }}
                className="sr-only"
              />
            </label>
          ))}
        </div>
      </section>

      {/* ── Section: Teaching Approach ── */}
      <section className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-white font-semibold text-sm">Teaching Approach</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            How the AI structures its explanations.
          </p>
        </div>
        <div className="space-y-2">
          {TEACHING_APPROACHES.map((approach) => (
            <label
              key={approach.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                settings.teachingApproach === approach.value
                  ? 'border-violet-500/40 bg-violet-500/8'
                  : 'border-gray-700/60 hover:border-gray-600 hover:bg-gray-700/20'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    settings.teachingApproach === approach.value
                      ? 'border-violet-500 bg-violet-500'
                      : 'border-gray-600'
                  }`}
                >
                  {settings.teachingApproach === approach.value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <span className={`text-sm font-medium ${settings.teachingApproach === approach.value ? 'text-white' : 'text-gray-300'}`}>
                  {approach.label}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">{approach.description}</p>
              </div>
              <input
                type="radio"
                name="teachingApproach"
                value={approach.value}
                checked={settings.teachingApproach === approach.value}
                onChange={() => {
                  updateSettings({ teachingApproach: approach.value });
                  showSaved();
                }}
                className="sr-only"
              />
            </label>
          ))}
        </div>
      </section>

      {/* ── Section: Voice Output ── */}
      <section className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-sm">Voice Output</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Have the AI teacher speak its responses aloud using OpenAI TTS.
            </p>
          </div>
          {/* Toggle switch */}
          <button
            onClick={() => {
              updateSettings({ voiceOutputEnabled: !settings.voiceOutputEnabled });
              showSaved();
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-2 focus:ring-offset-gray-900 ${
              settings.voiceOutputEnabled ? 'bg-violet-600' : 'bg-gray-600'
            }`}
            aria-checked={settings.voiceOutputEnabled}
            role="switch"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings.voiceOutputEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Voice selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400">Voice</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TTS_VOICES.map((voice) => (
              <button
                key={voice.value}
                onClick={() => {
                  updateSettings({ ttsVoice: voice.value });
                  showSaved();
                }}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  settings.ttsVoice === voice.value
                    ? 'border-violet-500/40 bg-violet-500/10 text-white'
                    : 'border-gray-700/60 text-gray-400 hover:border-gray-600 hover:bg-gray-700/20'
                }`}
              >
                <div className="text-xs font-medium">{voice.label}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{voice.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Speech rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-400">Speech Rate</label>
            <span className="text-xs text-gray-400 font-mono">
              {settings.speechRate.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={settings.speechRate}
            onChange={(e) => {
              updateSettings({ speechRate: parseFloat(e.target.value) });
            }}
            onMouseUp={() => showSaved()}
            onTouchEnd={() => showSaved()}
            className="w-full h-1.5 rounded-full appearance-none bg-gray-700 accent-violet-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-gray-600">
            <span>0.5x (Slow)</span>
            <span>1.0x (Normal)</span>
            <span>2.0x (Fast)</span>
          </div>
        </div>
      </section>

      {/* ── Section: Data ── */}
      <section className="bg-gray-800/50 border border-gray-700/60 rounded-2xl p-5">
        <h2 className="text-white font-semibold text-sm mb-3">Data & Privacy</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          All data (notes, settings, API key) is stored exclusively in your browser&rsquo;s
          localStorage. Nothing is stored on any server. Chat history is in-memory only
          and clears when you close the tab.
        </p>
        <button
          onClick={() => {
            if (confirm('This will clear all notes and reset all settings. This cannot be undone.')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
        >
          Clear all data
        </button>
      </section>
    </div>
  );
}
