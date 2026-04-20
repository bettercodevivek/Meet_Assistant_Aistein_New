import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IAutomationAction {
  type: string;
  config: Record<string, unknown>;
}

export interface IAutomationTrigger {
  type: string;
  config?: Record<string, unknown>;
}

export interface IAutomation extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: IAutomationTrigger;
  actions: IAutomationAction[];
  createdAt: Date;
  updatedAt: Date;
}

const AutomationActionSchema = new Schema<IAutomationAction>(
  {
    type: {
      type: String,
      required: true,
    },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const AutomationTriggerSchema = new Schema<IAutomationTrigger>(
  {
    type: {
      type: String,
      required: true,
    },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const AutomationSchema = new Schema<IAutomation>(
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
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    trigger: {
      type: AutomationTriggerSchema,
      required: true,
    },
    actions: {
      type: [AutomationActionSchema],
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
    collection: 'automations',
    timestamps: true,
  }
);

export default (mongoose.models.Automation as Model<IAutomation>) ||
  mongoose.model<IAutomation>('Automation', AutomationSchema);
