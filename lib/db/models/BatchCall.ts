import mongoose, { Schema, Model, Document } from 'mongoose';

export type RecipientCallStatus =
  | 'pending'
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled'
  | 'skipped';

export interface IRecipient {
  phone_number: string;
  name: string;
  email?: string;
  dynamic_variables?: Record<string, any>;
  call_status?: RecipientCallStatus;
  conversation_id?: string;
}

export interface IBatchCall extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  batch_call_id: string;
  name: string;
  call_name: string;
  agent_id: string;
  agent_name?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  phone_number_id: string;
  phone_provider: string;
  recipients: IRecipient[];
  recipients_count: number;
  created_at_unix: number;
  scheduled_time_unix: number;
  timezone: string;
  total_calls_dispatched: number;
  total_calls_scheduled: number;
  total_calls_finished: number;
  last_updated_at_unix: number;
  retry_count: number;
  conversations_synced: boolean;
  automation_triggered_phones: string[];
  automation_id?: mongoose.Types.ObjectId;
  /** Global index of the first recipient in the current ElevenLabs job (0 on first run; advances on resume). */
  segment_start_index: number;
  /** After cancel: first global index not yet completed; used to resume. */
  resume_next_index: number;
  can_resume: boolean;
  /** When true, no-answer / failed rows are redialed automatically after an interval (up to max waves). */
  no_answer_auto_retry_enabled: boolean;
  /** Seconds to wait after a wave completes before redialing remaining no-answer rows. */
  no_answer_retry_interval_seconds: number;
  /** Max automatic redial waves after the initial batch completes (each wave calls all still no-answer). */
  no_answer_retry_max_waves: number;
  /** How many auto-retry waves have fully completed (excludes the first CSV batch). */
  no_answer_retry_waves_completed: number;
  /** Unix seconds when the next auto-retry may run; 0 if none scheduled. */
  next_no_answer_retry_at_unix: number;
  /** True while an auto-retry batch is running in the voice API (completed = wave finished). */
  no_answer_auto_retry_in_flight: boolean;
  /** Phones included in the current Python job when it is a non-contiguous auto-retry (avoids wrong index-based status merge). */
  current_job_dial_phones?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const RecipientSchema = new Schema<IRecipient>(
  {
    phone_number: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: false },
    dynamic_variables: { type: Schema.Types.Mixed, required: false },
    call_status: {
      type: String,
      enum: [
        'pending',
        'queued',
        'in_progress',
        'completed',
        'failed',
        'rejected',
        'cancelled',
        'skipped',
      ],
      default: 'pending',
    },
    conversation_id: { type: String, required: false },
  },
  { _id: false }
);

const BatchCallSchema = new Schema<IBatchCall>(
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
    batch_call_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    call_name: {
      type: String,
      required: true,
    },
    agent_id: {
      type: String,
      required: true,
      index: true,
    },
    agent_name: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    phone_number_id: {
      type: String,
      required: true,
    },
    phone_provider: {
      type: String,
      default: 'twilio',
    },
    recipients: {
      type: [RecipientSchema],
      default: [],
    },
    recipients_count: {
      type: Number,
      default: 0,
    },
    created_at_unix: {
      type: Number,
      required: true,
    },
    scheduled_time_unix: {
      type: Number,
      required: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    total_calls_dispatched: {
      type: Number,
      default: 0,
    },
    total_calls_scheduled: {
      type: Number,
      default: 0,
    },
    total_calls_finished: {
      type: Number,
      default: 0,
    },
    last_updated_at_unix: {
      type: Number,
      required: true,
    },
    retry_count: {
      type: Number,
      default: 0,
    },
    conversations_synced: {
      type: Boolean,
      default: false,
    },
    automation_triggered_phones: {
      type: [String],
      default: [],
    },
    automation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Automation',
    },
    segment_start_index: {
      type: Number,
      default: 0,
    },
    resume_next_index: {
      type: Number,
      default: 0,
    },
    can_resume: {
      type: Boolean,
      default: false,
    },
    no_answer_auto_retry_enabled: {
      type: Boolean,
      default: true,
    },
    no_answer_retry_interval_seconds: {
      type: Number,
      default: 300,
    },
    no_answer_retry_max_waves: {
      type: Number,
      default: 3,
    },
    no_answer_retry_waves_completed: {
      type: Number,
      default: 0,
    },
    next_no_answer_retry_at_unix: {
      type: Number,
      default: 0,
    },
    no_answer_auto_retry_in_flight: {
      type: Boolean,
      default: false,
    },
    current_job_dial_phones: {
      type: [String],
      required: false,
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
    collection: 'batchcalls',
    timestamps: true,
  }
);

export default (mongoose.models.BatchCall as Model<IBatchCall>) ||
  mongoose.model<IBatchCall>('BatchCall', BatchCallSchema);
