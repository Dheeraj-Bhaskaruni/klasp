// OpenAI client factory - instantiated per-request using the API key from settings.
// We do NOT use a global singleton because the API key is supplied by the user
// at runtime and stored in localStorage; server routes receive it via request headers.

import OpenAI from 'openai';

/**
 * Creates an OpenAI client instance with the provided API key.
 * Used in API route handlers where the key is forwarded from the client.
 */
export function createOpenAIClient(apiKey: string): OpenAI {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'OpenAI API key is required. Please configure it in the Settings page.'
    );
  }

  return new OpenAI({
    apiKey: apiKey.trim(),
  });
}

/**
 * Validates that an API key has the expected format (sk-...).
 * This is a lightweight client-side check only — not a network call.
 */
export function isValidApiKeyFormat(key: string): boolean {
  return typeof key === 'string' && key.startsWith('sk-') && key.length > 20;
}
