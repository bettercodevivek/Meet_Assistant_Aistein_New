import mongoose, { Schema, Model, Document } from 'mongoose';

/** Single-row app configuration (singleton via `singletonKey`). */
export interface IAppSettings extends Document {
  singletonKey: string;
  /** Gmail address authorized via Kepler `/email/authorize`; used for meeting invites. */
  keplerGmailEmail: string;
  updatedAt: Date;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    keplerGmailEmail: {
      type: String,
      trim: true,
      default: '',
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'appsettings' },
);

export default (mongoose.models.AppSettings as Model<IAppSettings>) ||
  mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);
