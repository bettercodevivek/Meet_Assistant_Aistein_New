import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IPhoneConversation extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  channel: string;
  status: string;
  transcript: any;
  isAiManaging: boolean;
  metadata: {
    batch_call_id: string;
    conversation_id: string;
    phone_number: string;
    duration_seconds: number;
    call_successful: boolean;
    source: string;
    /** Per-automation run: which steps completed, skipped, or failed (after batch sync). */
    automation_runs?: Array<{
      automationId: string;
      automationName: string;
      ranAt: string;
      steps: Array<{
        type: string;
        label: string;
        status: 'completed' | 'skipped' | 'failed';
        detail?: string;
        at: string;
      }>;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PhoneConversationSchema = new Schema<IPhoneConversation>(
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
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      default: 'phone',
    },
    status: {
      type: String,
      default: 'closed',
    },
    transcript: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isAiManaging: {
      type: Boolean,
      default: true,
    },
    metadata: {
      batch_call_id: {
        type: String,
      },
      conversation_id: {
        type: String,
      },
      phone_number: {
        type: String,
      },
      duration_seconds: {
        type: Number,
      },
      call_successful: {
        type: Boolean,
      },
      source: {
        type: String,
        default: 'batch',
      },
      automation_runs: {
        type: [Schema.Types.Mixed],
        default: undefined,
      },
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
    collection: 'phone_conversations',
    timestamps: true,
  }
);

export default (mongoose.models.PhoneConversation as Model<IPhoneConversation>) ||
  mongoose.model<IPhoneConversation>('PhoneConversation', PhoneConversationSchema);
