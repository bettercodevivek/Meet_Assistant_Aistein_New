import mongoose from 'mongoose';
import KnowledgeBase from '@/lib/db/models/KnowledgeBase';
import VoiceKnowledgeBaseDocument from '@/lib/db/models/VoiceKnowledgeBaseDocument';
import { ingestDocument } from '@/lib/elevenlabs/pythonApi';

type EnsureVoiceDocInput = {
  userId: mongoose.Types.ObjectId;
  knowledgeBaseId: string;
  name: string;
  prompt: string;
  firstMessage?: string;
};

/**
 * Ingest a Mongo knowledge base prompt as text in the voice KB service and keep a local mapping.
 */
export async function ensureVoiceDocumentForKnowledgeBase(
  input: EnsureVoiceDocInput,
): Promise<string> {
  const name = input.name.trim();
  const prompt = input.prompt.trim();
  if (!name || !prompt) {
    throw new Error('Knowledge base name and prompt are required for ingestion');
  }

  const formData = new FormData();
  formData.append('source_type', 'text');
  formData.append('name', name);
  formData.append('text', prompt);
  formData.append('prompt', prompt);
  if (input.firstMessage?.trim()) {
    formData.append('firstMessage', input.firstMessage.trim());
  }

  const response = await ingestDocument(formData);
  if (!response.document_id) {
    throw new Error('Voice knowledge-base ingest did not return a document id');
  }

  await VoiceKnowledgeBaseDocument.findOneAndUpdate(
    {
      userId: input.userId,
      mongoKnowledgeBaseId: input.knowledgeBaseId,
    },
    {
      userId: input.userId,
      mongoKnowledgeBaseId: input.knowledgeBaseId,
      document_id: response.document_id,
      name: response.name || name,
      source_type: response.source_type || 'text',
      status: response.status,
      created_at_unix: response.created_at_unix,
      folder_path: response.folder_path || [],
      prompt,
      firstMessage: input.firstMessage?.trim() || '',
      updatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return response.document_id;
}

/**
 * Resolve voice knowledge-base document IDs for selected Mongo KB ids.
 * Missing mappings are auto-ingested from Mongo KB prompt content.
 */
export async function resolveVoiceKnowledgeBaseIdsForAgent(
  userId: mongoose.Types.ObjectId,
  mongoKnowledgeBaseIds: string[],
): Promise<string[]> {
  const uniqueIds = Array.from(
    new Set(
      mongoKnowledgeBaseIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
  if (uniqueIds.length === 0) return [];

  const existing = await VoiceKnowledgeBaseDocument.find({
    userId,
    mongoKnowledgeBaseId: { $in: uniqueIds },
  })
    .sort({ updatedAt: -1 })
    .lean();

  const byKbId = new Map<string, string>();
  for (const row of existing) {
    const kbId = typeof row.mongoKnowledgeBaseId === 'string' ? row.mongoKnowledgeBaseId : '';
    if (!kbId || byKbId.has(kbId) || !row.document_id) continue;
    byKbId.set(kbId, row.document_id);
  }

  const missing = uniqueIds.filter((id) => !byKbId.has(id));
  if (missing.length > 0) {
    const objectIds = missing
      .map((id) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter((id): id is mongoose.Types.ObjectId => id !== null);

    if (objectIds.length > 0) {
      const mongoKbs = await KnowledgeBase.find({
        _id: { $in: objectIds },
        userId,
      }).lean();

      for (const kb of mongoKbs) {
        const kbId = String(kb._id);
        const docId = await ensureVoiceDocumentForKnowledgeBase({
          userId,
          knowledgeBaseId: kbId,
          name: kb.name,
          prompt: kb.prompt,
          firstMessage: kb.firstMessage,
        });
        byKbId.set(kbId, docId);
      }
    }
  }

  return uniqueIds
    .map((id) => byKbId.get(id))
    .filter((id): id is string => Boolean(id));
}
