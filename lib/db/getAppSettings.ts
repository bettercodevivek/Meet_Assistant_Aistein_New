import connectDB from '@/lib/db/mongodb';
import AppSettings from '@/lib/db/models/AppSettings';

const SINGLETON_KEY = 'default';

export async function getAppSettings() {
  await connectDB();
  const doc = await AppSettings.findOneAndUpdate(
    { singletonKey: SINGLETON_KEY },
    { $setOnInsert: { singletonKey: SINGLETON_KEY } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc;
}
