import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IKnowledgeBase extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    prompt: {
      type: String,
      required: true,
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
  { collection: 'knowledgebases' },
);

export default (mongoose.models.KnowledgeBase as Model<IKnowledgeBase>) ||
  mongoose.model<IKnowledgeBase>('KnowledgeBase', KnowledgeBaseSchema);

