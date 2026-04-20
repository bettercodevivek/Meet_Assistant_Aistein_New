import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IAgent extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  agent_id: string;
  name: string;
  first_message: string;
  system_prompt: string;
  language: string;
  voice_id?: string;
  greeting_message?: string;
  escalationRules?: string[];
  /** Legacy: ElevenLabs document IDs when used; often empty when using Mongo KB prompts only. */
  knowledge_base_ids: string[];
  /** MongoDB KnowledgeBase `_id`s (strings) selected to merge into the agent system prompt. */
  mongoKnowledgeBaseIds: string[];
  tool_ids?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
    },
    agent_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    first_message: {
      type: String,
      required: true,
    },
    system_prompt: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
      default: 'en',
    },
    voice_id: {
      type: String,
      default: 'eleven_multilingual_v2',
    },
    greeting_message: {
      type: String,
    },
    escalationRules: {
      type: [String],
      default: [],
    },
    knowledge_base_ids: {
      type: [String],
      default: [],
    },
    mongoKnowledgeBaseIds: {
      type: [String],
      default: [],
    },
    tool_ids: {
      type: [String],
      default: [],
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
  {
    collection: 'agents',
    timestamps: true,
  }
);

const existingAgentModel = mongoose.models.Agent as Model<IAgent> | undefined;

// In dev hot-reload, mongoose can cache an older schema version.
// Re-register if the cached model is missing newer fields.
if (existingAgentModel && !existingAgentModel.schema.path('mongoKnowledgeBaseIds')) {
  mongoose.deleteModel('Agent');
}

export default (mongoose.models.Agent as Model<IAgent>) ||
  mongoose.model<IAgent>('Agent', AgentSchema);
