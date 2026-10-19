const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true },
    ip: String,
    userAgent: String,
    meta: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 }, // keep 90 days
  },
  { versionKey: false }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
