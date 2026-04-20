interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * Generates a conversation summary from a list of messages using OpenAI
 */
export async function generateConversationSummary(
  messages: Message[],
): Promise<string> {
  if (messages.length === 0) {
    return "";
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;

  // Fallback to template-based summary if no OpenAI key
  if (!openaiApiKey) {
    console.warn("OPENAI_API_KEY not found, using template-based summary");

    return generateTemplateSummary(messages);
  }

  try {
    // Get first and last message timestamps
    const startTime = new Date(messages[0].timestamp);
    const endTime = new Date(messages[messages.length - 1].timestamp);
    const duration = Math.round(
      (endTime.getTime() - startTime.getTime()) / 60000,
    );

    // Prepare conversation for OpenAI
    const conversationText = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that creates concise conversation summaries. 
Your task is to analyze the conversation and create a summary that will help continue the conversation naturally.
Focus on: key topics discussed, decisions made, user preferences, and important context.
Keep the summary under 300 words and format it clearly.`,
          },
          {
            role: "user",
            content: `Please create a summary of this conversation that can be used to continue it later:

${conversationText}

Format the summary as:
=== CONVERSATION CONTEXT ===
Date: ${startTime.toLocaleDateString()}
Duration: ${duration} minutes
Messages: ${messages.length}

[Your intelligent summary here - include key topics, decisions, preferences, and important context]

Continue this conversation naturally, referring to the above context when relevant.
=== END CONTEXT ===`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, response.statusText);

      return generateTemplateSummary(messages);
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content || "";

    return summary || generateTemplateSummary(messages);
  } catch (error) {
    console.error("Error generating AI summary:", error);

    return generateTemplateSummary(messages);
  }
}

/**
 * Fallback template-based summary generation
 */
function generateTemplateSummary(messages: Message[]): string {
  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  // Extract topics (simple keyword extraction)
  const allContent = messages.map((m) => m.content).join(" ");
  const topics = extractKeyTopics(allContent);

  // Get first and last message timestamps
  const startTime = new Date(messages[0].timestamp);
  const endTime = new Date(messages[messages.length - 1].timestamp);

  // Build summary
  const summary = `=== CONVERSATION CONTEXT ===
Date: ${startTime.toLocaleDateString()}
Duration: ${Math.round((endTime.getTime() - startTime.getTime()) / 60000)} minutes
Messages exchanged: ${messages.length} (${userMessages.length} from user, ${assistantMessages.length} from assistant)

Key Topics Discussed:
${topics.map((t) => `- ${t}`).join("\n")}

Recent Context:
${getRecentContext(messages)}

Continue this conversation naturally, referring to the above context when relevant.
=== END CONTEXT ===`;

  return summary;
}

/**
 * Simple keyword extraction for topics
 */
function extractKeyTopics(content: string): string[] {
  // This is a simple implementation
  // In production, you might want to use NLP or AI-based extraction
  const words = content.toLowerCase().split(/\W+/);
  const commonWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "been",
    "be",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "can",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "this",
    "that",
    "what",
    "which",
    "who",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "every",
    "both",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "about",
    "hello",
    "hi",
    "thanks",
    "thank",
    "please",
    "yes",
    "no",
    "ok",
    "okay",
  ]);

  // Count word frequency
  const wordCount: { [key: string]: number } = {};

  words.forEach((word) => {
    if (word.length > 3 && !commonWords.has(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  });

  // Get top topics
  const sortedWords = Object.entries(wordCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);

  return sortedWords.length > 0 ? sortedWords : ["General conversation"];
}

/**
 * Gets recent context from the last few messages
 */
function getRecentContext(messages: Message[], count: number = 4): string {
  const recentMessages = messages.slice(-count);

  return recentMessages
    .map(
      (m) =>
        `${m.role === "user" ? "User" : "Assistant"}: ${m.content.substring(0, 150)}${m.content.length > 150 ? "..." : ""}`,
    )
    .join("\n");
}

/**
 * Generates an enhanced session context by combining knowledge base prompt with conversation summary
 */
export function createSessionContext(
  knowledgeBasePrompt: string,
  conversationSummary: string,
): string {
  if (!conversationSummary) {
    return knowledgeBasePrompt;
  }

  return `${knowledgeBasePrompt}

${conversationSummary}`;
}
