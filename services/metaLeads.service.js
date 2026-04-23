const crypto = require('crypto');
const Lead = require('../models/lead.model');
const MetaLeadFormSync = require('../models/metaLeadFormSync.model');
const logger = require('../lib/metaLeads/logger');
const { connectDb } = require('../lib/metaLeads/mongoose');

const GRAPH_VERSION = 'v19.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function flattenFieldData(fieldData) {
  if (!Array.isArray(fieldData)) return {};
  const out = {};
  for (const item of fieldData) {
    const name = item?.name;
    const values = item?.values;
    if (!name) continue;
    if (Array.isArray(values) && values.length > 0) {
      out[name] = values.length === 1 ? values[0] : values.join(', ');
    } else {
      out[name] = '';
    }
  }
  return out;
}

function verifyMetaSignature(signatureHeader, rawBody, appSecret) {
  if (!signatureHeader || !rawBody || !appSecret) return false;
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;
  const receivedHex = signatureHeader.slice(prefix.length);
  const expectedHex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  if (receivedHex.length !== expectedHex.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(receivedHex, 'hex'), Buffer.from(expectedHex, 'hex'));
  } catch {
    return false;
  }
}

async function graphGetJson(url) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, { method: 'GET' });
      const json = await res.json();
      if (json.error) {
        lastErr = new Error(json.error.message || 'graph_error');
        if (attempt < 2) await sleep(400 * 2 ** attempt);
        continue;
      }
      if (!res.ok) {
        lastErr = new Error(`http_${res.status}`);
        if (attempt < 2) await sleep(400 * 2 ** attempt);
        continue;
      }
      return json;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await sleep(400 * 2 ** attempt);
    }
  }
  throw lastErr;
}

async function fetchLeadFromGraph(leadgenId) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN missing');
  const u = new URL(`${GRAPH_BASE}/${encodeURIComponent(leadgenId)}`);
  u.searchParams.set('fields', 'created_time,field_data,form_id,page_id');
  u.searchParams.set('access_token', token);
  return graphGetJson(u.toString());
}

async function saveLeadFromGraphPayload({ leadgen_id, form_id, page_id, graphPayload }) {
  await connectDb();
  const existing = await Lead.findOne({ leadgen_id }).lean();
  if (existing) {
    logger.info({ msg: 'lead_duplicate_skip', leadgen_id, form_id });
    return { skipped: true };
  }
  const created_time = graphPayload.created_time || '';
  const data = flattenFieldData(graphPayload.field_data);
  try {
    await Lead.create({
      leadgen_id,
      form_id,
      page_id,
      created_time,
      data,
      source: 'facebook',
    });
    logger.info({ msg: 'lead_stored', leadgen_id, form_id, page_id });
    return { skipped: false };
  } catch (e) {
    if (e && e.code === 11000) {
      logger.info({ msg: 'lead_duplicate_skip', leadgen_id, form_id });
      return { skipped: true };
    }
    throw e;
  }
}

async function ingestLeadById({ leadgen_id, form_id, page_id }) {
  try {
    await connectDb();
    const existing = await Lead.findOne({ leadgen_id }).lean();
    if (existing) {
      logger.info({ msg: 'lead_duplicate_skip', leadgen_id, form_id });
      return;
    }
    const graphPayload = await fetchLeadFromGraph(leadgen_id);
    await saveLeadFromGraphPayload({ leadgen_id, form_id, page_id, graphPayload });
    logger.info({ msg: 'lead_fetch_ok', leadgen_id });
  } catch (e) {
    logger.error({ msg: 'lead_fetch_failed', leadgen_id, err: String(e && e.message ? e.message : e) });
  }
}

function extractLeadEvents(body) {
  const events = [];
  const entries = body?.entry;
  if (!Array.isArray(entries)) return events;
  for (const entry of entries) {
    const changes = entry?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = change?.value;
      if (!value) continue;
      const leadgen_id = value.leadgen_id;
      const form_id = value.form_id;
      const page_id = value.page_id;
      if (leadgen_id && form_id && page_id) {
        events.push({ leadgen_id: String(leadgen_id), form_id: String(form_id), page_id: String(page_id) });
      }
    }
  }
  return events;
}

async function processWebhookBody(body) {
  const events = extractLeadEvents(body);
  for (const ev of events) {
    await ingestLeadById(ev);
  }
}

async function listLeads({ form_id, created_time_from, created_time_to, page, limit }) {
  await connectDb();
  const filter = {};
  if (form_id) filter.form_id = String(form_id);
  if (created_time_from || created_time_to) {
    filter.created_time = {};
    if (created_time_from) filter.created_time.$gte = String(created_time_from);
    if (created_time_to) filter.created_time.$lte = String(created_time_to);
  }
  const p = Math.max(1, parseInt(String(page || '1'), 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(String(limit || '20'), 10) || 20));
  const skip = (p - 1) * lim;
  const [items, total] = await Promise.all([
    Lead.find(filter).sort({ created_time: -1 }).skip(skip).limit(lim).lean(),
    Lead.countDocuments(filter),
  ]);
  return {
    data: items,
    page: p,
    limit: lim,
    total,
    totalPages: Math.ceil(total / lim) || 1,
  };
}

function parseFormIdsEnv() {
  const raw = process.env.META_LEAD_FORM_IDS || process.env.META_FORM_IDS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function fetchFormLeadIdsSince(formId, sinceUnix) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN missing');
  const filtering = encodeURIComponent(
    JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: sinceUnix }]),
  );
  const leads = [];
  let url = `${GRAPH_BASE}/${encodeURIComponent(formId)}/leads?fields=id,created_time&filtering=${filtering}&access_token=${encodeURIComponent(token)}`;
  let guard = 0;
  while (url && guard < 50) {
    guard += 1;
    const json = await graphGetJson(url);
    const data = json.data;
    if (Array.isArray(data)) {
      for (const row of data) {
        if (row.id) leads.push({ id: String(row.id), created_time: row.created_time || '' });
      }
    }
    url = json.paging?.next || null;
  }
  return leads;
}

async function syncSingleForm(formId) {
  await connectDb();
  const row = await MetaLeadFormSync.findOne({ form_id: formId });
  const nowUnix = Math.floor(Date.now() / 1000);
  const storedLast = row?.last_sync_unix ?? 0;
  const sinceUnix = storedLast > 0 ? storedLast : nowUnix - 7 * 86400;
  const summaries = await fetchFormLeadIdsSince(formId, sinceUnix);
  let stored = 0;
  for (const { id: leadgen_id } of summaries) {
    const exists = await Lead.findOne({ leadgen_id }).select('_id').lean();
    if (exists) continue;
    try {
      const graphPayload = await fetchLeadFromGraph(leadgen_id);
      const r = await saveLeadFromGraphPayload({
        leadgen_id,
        form_id: String(graphPayload.form_id || formId),
        page_id: String(graphPayload.page_id || process.env.META_PAGE_ID || ''),
        graphPayload,
      });
      if (!r.skipped) stored += 1;
    } catch (e) {
      logger.error({ msg: 'cron_lead_fetch_failed', leadgen_id, form_id: formId, err: String(e) });
    }
  }
  const maxSeen = summaries.reduce((m, s) => {
    const t = Date.parse(s.created_time);
    const u = Number.isFinite(t) ? Math.floor(t / 1000) : 0;
    return Math.max(m, u);
  }, sinceUnix);
  const nextLast = summaries.length
    ? Math.max(storedLast, maxSeen)
    : Math.max(storedLast, nowUnix - 60);
  await MetaLeadFormSync.findOneAndUpdate(
    { form_id: formId },
    { $set: { last_sync_unix: nextLast } },
    { upsert: true, new: true },
  );
  logger.info({ msg: 'meta_form_sync_done', form_id: formId, candidates: summaries.length, stored });
}

async function runPeriodicLeadSync() {
  await connectDb();
  const forms = parseFormIdsEnv();
  if (forms.length === 0) {
    logger.warn({ msg: 'meta_cron_no_form_ids' });
    return { forms: 0 };
  }
  for (const formId of forms) {
    try {
      await syncSingleForm(formId);
    } catch (e) {
      logger.error({ msg: 'meta_form_sync_error', form_id: formId, err: String(e) });
    }
  }
  return { forms: forms.length };
}

module.exports = {
  flattenFieldData,
  verifyMetaSignature,
  fetchLeadFromGraph,
  saveLeadFromGraphPayload,
  ingestLeadById,
  extractLeadEvents,
  processWebhookBody,
  listLeads,
  runPeriodicLeadSync,
};
