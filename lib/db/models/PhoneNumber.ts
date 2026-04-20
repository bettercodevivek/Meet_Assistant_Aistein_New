import mongoose, { Schema, Model, Document } from 'mongoose';

export interface ISipCredentials {
  username: string;
  password: string;
}

export interface IInboundTrunkConfig {
  address: string;
  media_encryption?: string;
  credentials?: ISipCredentials;
}

export interface IOutboundTrunkConfig {
  address: string;
  credentials: ISipCredentials;
  media_encryption?: string;
  transport?: string;
}

export interface IPhoneNumber extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  phone_number_id: string;
  elevenlabs_phone_number_id?: string;
  label: string;
  phone_number: string;
  provider: 'twilio' | 'sip_trunk';
  supports_inbound: boolean;
  supports_outbound: boolean;
  agent_id?: string;
  inbound_trunk_config?: IInboundTrunkConfig;
  outbound_trunk_config?: IOutboundTrunkConfig;
  twilio_sid?: string;
  twilio_token?: string;
  created_at_unix: number;
  createdAt: Date;
  updatedAt: Date;
}

const SipCredentialsSchema = new Schema<ISipCredentials>(
  {
    username: { type: String, required: false },
    password: { type: String, required: false },
  },
  { _id: false }
);

const InboundTrunkConfigSchema = new Schema<IInboundTrunkConfig>(
  {
    address: { type: String, required: false },
    media_encryption: { type: String, required: false },
    credentials: { type: SipCredentialsSchema, required: false },
  },
  { _id: false }
);

const OutboundTrunkConfigSchema = new Schema<IOutboundTrunkConfig>(
  {
    address: { type: String, required: false },
    credentials: { type: SipCredentialsSchema, required: false },
    media_encryption: { type: String, required: false },
    transport: { type: String, required: false },
  },
  { _id: false }
);

const PhoneNumberSchema = new Schema<IPhoneNumber>(
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
    phone_number_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    elevenlabs_phone_number_id: {
      type: String,
      index: true,
    },
    label: {
      type: String,
      required: true,
    },
    phone_number: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      enum: ['twilio', 'sip_trunk'],
      required: true,
    },
    supports_inbound: {
      type: Boolean,
      default: false,
    },
    supports_outbound: {
      type: Boolean,
      default: true,
    },
    agent_id: {
      type: String,
      index: true,
    },
    inbound_trunk_config: {
      type: InboundTrunkConfigSchema,
      required: false,
    },
    outbound_trunk_config: {
      type: OutboundTrunkConfigSchema,
      required: false,
    },
    twilio_sid: {
      type: String,
    },
    twilio_token: {
      type: String,
      select: false,
    },
    created_at_unix: {
      type: Number,
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
  {
    collection: 'phonenumbers',
    timestamps: true,
  }
);

export default (mongoose.models.PhoneNumber as Model<IPhoneNumber>) ||
  mongoose.model<IPhoneNumber>('PhoneNumber', PhoneNumberSchema);
