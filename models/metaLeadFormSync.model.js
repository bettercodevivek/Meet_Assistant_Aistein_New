const mongoose = require('mongoose');

const MetaLeadFormSyncSchema = new mongoose.Schema(
  {
    form_id: { type: String, required: true, unique: true, index: true },
    last_sync_unix: { type: Number, required: true, default: 0 },
  },
  { collection: 'meta_lead_form_sync' },
);

module.exports =
  mongoose.models.MetaLeadFormSync ||
  mongoose.model('MetaLeadFormSync', MetaLeadFormSyncSchema);
