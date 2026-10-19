const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

// Records security-relevant events. Never throws: auditing must not break a request.
async function audit(req, userId, action, meta = {}) {
  try {
    await AuditLog.create({
      userId,
      action,
      ip: req.ip,
      userAgent: (req.headers['user-agent'] || '').slice(0, 250),
      meta,
    });
  } catch (err) {
    logger.warn(`audit log failed: ${err.message}`);
  }
}

module.exports = audit;
