/**
 * Gemini API client helper.
 * Calls the server-side proxy at /api/gemini to keep the API key secure.
 */

export interface GeminiResponse {
  text: string;
  error?: string;
}

/**
 * Send a prompt to the Gemini API via the server proxy.
 * @param prompt - The text prompt to send to Gemini
 * @returns The generated text response
 */
export async function generateContent(prompt: string): Promise<GeminiResponse> {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { text: '', error: errorData.error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { text: data.text, error: data.error };
  } catch (err: any) {
    return { text: '', error: err.message || 'Network error' };
  }
}
