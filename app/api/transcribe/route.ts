// POST /api/transcribe
// Receives a multipart/form-data request containing an audio file blob,
// forwards it to OpenAI Whisper for transcription, and returns the text.

import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/openai';
import { TranscribeResponse } from '@/types';
import { toFile } from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 30; // seconds — Whisper typically responds in < 10s

export async function POST(request: NextRequest): Promise<NextResponse<TranscribeResponse>> {
  try {
    // Retrieve the API key from the request header
    const apiKey = request.headers.get('x-openai-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { text: '', error: 'Missing API key. Please set your OpenAI API key in Settings.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { text: '', error: 'No audio file provided in the request.' },
        { status: 400 }
      );
    }

    // Determine file extension from MIME type for Whisper compatibility
    const mimeType = audioFile.type || 'audio/webm';
    const ext = mimeType.includes('mp4')
      ? 'mp4'
      : mimeType.includes('ogg')
      ? 'ogg'
      : 'webm';

    const openai = createOpenAIClient(apiKey);

    // Convert Blob to a File-like object compatible with the OpenAI SDK
    const arrayBuffer = await audioFile.arrayBuffer();
    const file = await toFile(Buffer.from(arrayBuffer), `recording.${ext}`, {
      type: mimeType,
    });

    // Using the default response_format ('json') so the SDK returns a typed object
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
    });

    const text = transcription.text ?? '';

    if (!text || text.trim() === '') {
      return NextResponse.json(
        { text: '', error: 'No speech detected. Please try speaking more clearly.' },
        { status: 200 }
      );
    }

    return NextResponse.json({ text: text.trim() });
  } catch (err: unknown) {
    console.error('[/api/transcribe] Error:', err);

    const message =
      err instanceof Error
        ? err.message
        : 'An unexpected error occurred during transcription.';

    // Surface OpenAI API errors clearly
    if (message.includes('API key')) {
      return NextResponse.json({ text: '', error: message }, { status: 401 });
    }

    return NextResponse.json(
      { text: '', error: `Transcription failed: ${message}` },
      { status: 500 }
    );
  }
}
