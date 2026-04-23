import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type MetaLeadsServiceModule = {
  verifyMetaSignature: (signatureHeader: string | null, rawBody: Buffer, appSecret: string) => boolean;
  processWebhookBody: (body: unknown) => Promise<void>;
  listLeads: (params: {
    form_id?: string;
    created_time_from?: string;
    created_time_to?: string;
    page?: string;
    limit?: string;
  }) => Promise<unknown>;
  runPeriodicLeadSync: () => Promise<unknown>;
};

let cached: MetaLeadsServiceModule | null = null;

export async function getMetaLeadsService(): Promise<MetaLeadsServiceModule> {
  if (cached) return cached;
  const href = pathToFileURL(join(process.cwd(), 'services', 'metaLeads.service.js')).href;
  const mod = (await import(/* webpackIgnore: true */ href)) as {
    default?: MetaLeadsServiceModule;
  } & MetaLeadsServiceModule;
  cached = mod.default ?? mod;
  return cached;
}
