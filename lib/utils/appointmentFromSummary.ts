/**
 * OpenAI: detect whether a conversation summary implies a concrete scheduled appointment,
 * and extract ISO-8601 datetime + short details when possible.
 */

export type AppointmentAnalysis = {
  appointmentBooked: boolean | null;
  appointmentAt: Date | null;
  appointmentDetails: string | null;
};

export async function analyzeAppointmentFromSummary(
  summary: string,
): Promise<AppointmentAnalysis> {
  const trimmed = summary.trim();
  if (!trimmed) {
    return { appointmentBooked: null, appointmentAt: null, appointmentDetails: null };
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return { appointmentBooked: null, appointmentAt: null, appointmentDetails: null };
  }

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
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content: `You analyze a conversation SUMMARY for scheduling / appointments.

Set appointmentBooked TRUE if the summary shows a concrete meeting or appointment with BOTH a specific calendar date (or unambiguous day) AND a specific time (or clear time window) — including when the user requested that slot and the assistant captured or repeated those details, or when a booking was confirmed.

Set appointmentBooked FALSE when scheduling stays vague ("sometime", "later", "next week" with no agreed date+time), or no date+time pair appears, or the user cancelled.

appointmentIso: If appointmentBooked is true AND you can infer a single datetime, return it as RFC3339/ISO-8601 in UTC or with offset (e.g. 2026-04-05T15:00:00Z). If unknown, null.

details: One short English phrase (≤ 200 chars) describing what was booked (e.g. "Therapy follow-up video call"). If none, null.

Reply with ONLY JSON, no markdown:
{"appointmentBooked":true|false,"appointmentIso":"..."|null,"details":"..."|null}`,
          },
          {
            role: 'user',
            content: trimmed.slice(0, 12000),
          },
        ],
      }),
    });

    if (!response.ok) {
      return { appointmentBooked: null, appointmentAt: null, appointmentDetails: null };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    let text = data.choices?.[0]?.message?.content?.trim() ?? '';
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    const parsed = JSON.parse(text) as {
      appointmentBooked?: unknown;
      appointmentIso?: unknown;
      details?: unknown;
    };

    const appointmentBooked =
      typeof parsed.appointmentBooked === 'boolean' ? parsed.appointmentBooked : null;

    let appointmentAt: Date | null = null;
    if (typeof parsed.appointmentIso === 'string' && parsed.appointmentIso.trim()) {
      const d = new Date(parsed.appointmentIso.trim());
      if (!Number.isNaN(d.getTime())) {
        appointmentAt = d;
      }
    }

    const appointmentDetails =
      typeof parsed.details === 'string' && parsed.details.trim()
        ? parsed.details.trim().slice(0, 500)
        : null;

    return { appointmentBooked, appointmentAt, appointmentDetails };
  } catch {
    return { appointmentBooked: null, appointmentAt: null, appointmentDetails: null };
  }
}

/** @deprecated Prefer analyzeAppointmentFromSummary for new code */
export async function classifyAppointmentBooked(summary: string): Promise<boolean | null> {
  const r = await analyzeAppointmentFromSummary(summary);
  return r.appointmentBooked;
}
