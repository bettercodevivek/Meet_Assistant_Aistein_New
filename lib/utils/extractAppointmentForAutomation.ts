/**
 * Convert ElevenLabs / Python transcript payloads to plain text for local extraction.
 */
export function phoneTranscriptToPlainText(transcript: unknown): string {
  if (transcript == null) return '';
  if (typeof transcript === 'string') return transcript.trim();
  if (Array.isArray(transcript)) {
    return transcript
      .map((t: unknown) => {
        if (typeof t === 'string') return t;
        if (!t || typeof t !== 'object') return '';
        const o = t as Record<string, unknown>;
        const role = String(o.role ?? o.speaker ?? o.agent ?? '').trim();
        const text = String(
          o.message ??
            o.content ??
            o.text ??
            o.transcript ??
            o.body ??
            o.utterance ??
            '',
        ).trim();
        if (!text) return '';
        return role ? `${role}: ${text}` : text;
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (typeof transcript === 'object') {
    const o = transcript as Record<string, unknown>;
    if (Array.isArray(o.transcript)) return phoneTranscriptToPlainText(o.transcript);
    if (Array.isArray(o.messages)) return phoneTranscriptToPlainText(o.messages);
    if (Array.isArray(o.turns)) return phoneTranscriptToPlainText(o.turns);
    if (typeof o.text === 'string') return o.text.trim();
    try {
      return JSON.stringify(transcript).slice(0, 50000);
    } catch {
      return '';
    }
  }
  return String(transcript).trim();
}

/**
 * When the Python `/conversations/:id/extract` API is missing (404), extract the same
 * appointment fields using OpenAI from the call transcript stored in Mongo.
 */
export async function extractAppointmentFieldsWithOpenAI(
  transcriptText: string,
  options: {
    extraction_prompt?: string;
    json_example?: Record<string, unknown>;
  },
): Promise<Record<string, unknown> | null> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const trimmed = transcriptText.trim();
  if (!openaiApiKey || !trimmed) return null;

  const example = options.json_example ?? {
    appointment_booked: true,
    date: '2026-04-22',
    time: '14:30',
    confidence: 'high',
  };

  const system = `You extract structured scheduling data from a phone call transcript.
${options.extraction_prompt || ''}

Reply with ONLY a single JSON object (no markdown) using the same keys and value types as this example shape:
${JSON.stringify(example)}

Rules:
- appointment_booked: boolean — true only if both a concrete date and a concrete time were agreed for the appointment.
- date: YYYY-MM-DD if inferable, else empty string.
- time: HH:mm 24h if inferable, else empty string.
- confidence: "high" | "medium" | "low".`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Transcript:\n\n${trimmed.slice(0, 14000)}`,
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    let text = data.choices?.[0]?.message?.content?.trim() ?? '';
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    const parsed = JSON.parse(text) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
