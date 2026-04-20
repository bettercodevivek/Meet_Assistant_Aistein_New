import mongoose, { Schema, Model, Document } from 'mongoose';

export interface ICustomer extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phone: string;
  tags: string[];
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
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
    email: {
      type: String,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      default: 'manual',
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
    collection: 'customers',
    timestamps: true,
  }
);

export default (mongoose.models.Customer as Model<ICustomer>) ||
  mongoose.model<ICustomer>('Customer', CustomerSchema);
