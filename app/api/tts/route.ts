// POST /api/tts
// Receives text, voice selection, and speed, sends to OpenAI TTS,
// and streams back the resulting audio binary.

import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/openai';
import { TTSRequest, TTSVoice } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const VALID_VOICES: TTSVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

// OpenAI TTS has a 4096 character limit per request.
// We truncate here to prevent API errors. Callers should chunk long responses.
const MAX_TEXT_LENGTH = 4000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const apiKey = request.headers.get('x-openai-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key. Please set your OpenAI API key in Settings.' },
        { status: 401 }
      );
    }

    const body: TTSRequest = await request.json();
    const { text, voice = 'nova', speed = 1.0 } = body;

    if (!text || text.trim() === '') {
      return NextResponse.json(
        { error: 'Text cannot be empty.' },
        { status: 400 }
      );
    }

    // Validate voice selection
    const selectedVoice: TTSVoice = VALID_VOICES.includes(voice) ? voice : 'nova';

    // Clamp speed to OpenAI's supported range: 0.25–4.0
    const clampedSpeed = Math.min(Math.max(speed, 0.25), 4.0);

    // Strip markdown formatting for cleaner speech output.
    // Code blocks are replaced with a verbal cue since code reads awkwardly aloud.
    const cleanText = sanitizeForSpeech(text).slice(0, MAX_TEXT_LENGTH);

    const openai = createOpenAIClient(apiKey);

    const response = await openai.audio.speech.create({
      model: 'tts-1',         // tts-1 for low latency; tts-1-hd for higher quality
      voice: selectedVoice,
      input: cleanText,
      speed: clampedSpeed,
    });

    // Get audio as ArrayBuffer and return as binary response
    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[/api/tts] Error:', err);

    const message =
      err instanceof Error
        ? err.message
        : 'An unexpected error occurred during text-to-speech conversion.';

    const status = message.includes('API key') ? 401 : 500;

    return NextResponse.json(
      { error: `TTS error: ${message}` },
      { status }
    );
  }
}

/**
 * Strips or replaces markdown constructs that would sound awkward when spoken.
 * - Code blocks become a verbal placeholder
 * - Inline code uses backtick removal
 * - Bold/italic markers are removed
 * - Headers become natural speech
 */
function sanitizeForSpeech(text: string): string {
  return text
    // Replace fenced code blocks with a brief verbal cue
    .replace(/```[\s\S]*?```/g, ' [code example] ')
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove horizontal rules
    .replace(/^---+$/gm, '')
    // Collapse multiple blank lines to a single pause
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
