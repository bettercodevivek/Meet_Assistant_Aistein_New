import mongoose from 'mongoose';

/** Coerce JWT `userId` string to ObjectId for MongoDB queries. */
export function authUserObjectId(userId: string): mongoose.Types.ObjectId | null {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  return new mongoose.Types.ObjectId(userId);
}
