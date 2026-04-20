import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IVoiceKnowledgeBaseDocument extends Document {
  userId: mongoose.Types.ObjectId;
  /** Linked Mongo KnowledgeBase `_id` when this doc mirrors `/api/knowledge-bases`. */
  mongoKnowledgeBaseId?: string;
  document_id: string;
  name: string;
  source_type: 'text' | 'url' | 'file';
  status?: string;
  created_at_unix?: number;
  folder_path: string[];
  prompt?: string;
  firstMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VoiceKnowledgeBaseDocumentSchema = new Schema<IVoiceKnowledgeBaseDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mongoKnowledgeBaseId: {
      type: String,
      index: true,
    },
    document_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    source_type: {
      type: String,
      required: true,
      enum: ['text', 'url', 'file'],
    },
    status: {
      type: String,
    },
    created_at_unix: {
      type: Number,
    },
    folder_path: {
      type: [String],
      default: [],
    },
    prompt: {
      type: String,
    },
    firstMessage: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'voice_knowledge_base_documents' },
);

export default (mongoose.models.VoiceKnowledgeBaseDocument as Model<IVoiceKnowledgeBaseDocument>) ||
  mongoose.model<IVoiceKnowledgeBaseDocument>('VoiceKnowledgeBaseDocument', VoiceKnowledgeBaseDocumentSchema);
