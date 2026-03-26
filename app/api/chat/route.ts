// POST /api/chat
// Receives a message, conversation history, note context, and settings,
// sends to GPT-4 with the appropriate teaching system prompt,
// and returns the AI teacher's response.

import { NextRequest, NextResponse } from 'next/server';
import { createOpenAIClient } from '@/lib/openai';
import { buildSystemPrompt, buildLineByLinePrompt, trimHistory } from '@/lib/teachingPrompts';
import { ChatRequest, ChatResponse } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60; // GPT-4 responses for complex topics can take time

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    const apiKey = request.headers.get('x-openai-api-key');
    if (!apiKey) {
      return NextResponse.json(
        {
          content: '',
          error: 'Missing API key. Please set your OpenAI API key in Settings.',
        },
        { status: 401 }
      );
    }

    const body: ChatRequest = await request.json();
    const { message, history, noteContext, settings, lineByLine } = body;

    if (!message || message.trim() === '') {
      return NextResponse.json(
        { content: '', error: 'Message cannot be empty.' },
        { status: 400 }
      );
    }

    const openai = createOpenAIClient(apiKey);

    // Build the teaching system prompt — use line-by-line prompt if in that mode
    const systemPrompt = lineByLine
      ? buildLineByLinePrompt(
          settings.teachingStyle,
          lineByLine.currentLine,
          lineByLine.lineNumber,
          lineByLine.totalLines,
          lineByLine.language,
          lineByLine.fullCode,
          lineByLine.learnedLines
        )
      : buildSystemPrompt(
          settings.teachingStyle,
          settings.teachingApproach,
          noteContext
        );

    // Trim history to prevent context window overflow
    const trimmedHistory = trimHistory(history ?? []);

    // Construct the full messages array for the API call
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...trimmedHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message.trim() },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,   // Moderate creativity for engaging teaching
      max_tokens: 1500,   // Enough for thorough explanations with code blocks
      presence_penalty: 0.1,  // Slight penalty to avoid repetition
      frequency_penalty: 0.1,
    });

    const content = completion.choices[0]?.message?.content ?? '';

    if (!content) {
      return NextResponse.json(
        { content: '', error: 'The AI returned an empty response. Please try again.' },
        { status: 200 }
      );
    }

    return NextResponse.json({ content });
  } catch (err: unknown) {
    console.error('[/api/chat] Error:', err);

    const message =
      err instanceof Error
        ? err.message
        : 'An unexpected error occurred while generating the teaching response.';

    const status = message.includes('API key') ? 401 : 500;

    return NextResponse.json(
      { content: '', error: `Chat error: ${message}` },
      { status }
    );
  }
}
