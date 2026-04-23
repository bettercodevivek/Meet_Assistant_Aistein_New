const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema(
  {
    leadgen_id: { type: String, required: true, unique: true, index: true },
    form_id: { type: String, required: true, index: true },
    page_id: { type: String, default: '' },
    created_time: { type: String, required: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
    source: { type: String, required: true, default: 'facebook' },
    created_at: { type: Date, required: true, default: () => new Date() },
  },
  { collection: 'leads' },
);

module.exports = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
